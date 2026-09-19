/**
 * ============================================================
 * @module modules/editor/tabs
 * @file CacheTab.tsx
 * ============================================================
 * @description 캐시 센터 탭 - AI 기억 관리
 *
 * [2계층 문맥 요약 UI 개선]
 * - 구조화된 화별 요약 (entries) 표시
 * - 개별 항목 수정/삭제 가능
 * - 이정표(milestones) 타임라인
 * - 재확인 필요 플래그 표시
 * ============================================================
 */

import { useState, useMemo, useEffect } from 'react';
import type { AiAuthor, Novel, ContextManagement, Series, SummaryMilestone } from '@core/types';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import { buildWritingContext, editSummaryEntry, deleteSummaryEntry, autoUpdateSummary, inspectNovelMemory, isLegacySummary, matchesSingleChapterSignature, parseLegacyText } from '@services/ai';
import { mergeSummaryResult } from '@services/ai/summary';
import { useNovelStore } from '@stores/novelStore';
import {
  DocumentTextIcon,
  TrashIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  BookOpenIcon,
  DeviceFloppyIcon,
  BrainIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CheckCircleIcon,
  toast,
  useConfirmDialog,
} from '@shared/components';
import { MemoryOverview } from '../components/MemoryOverview';
import { CanonLedgerPanel } from '../components/CanonLedgerPanel';

interface CacheTabProps {
  novel: Novel;
  onMutateNovel: (id: string, updater: (current: Novel) => Novel) => Promise<Novel | undefined>;
  contextManagement: ContextManagement;
  isSummarizing: boolean;
  handleDeleteSummaryCache: () => void;
  author?: AiAuthor | null;
  series?: Series | null;
  onUpdateSeries?: (updatedSeries: Series) => void;
  onDeleteEngineCache: (modelName: string) => Promise<void>;
}

export function CacheTab({
  novel,
  onMutateNovel,
  contextManagement,
  isSummarizing,
  handleDeleteSummaryCache,
  author,
  series,
  onUpdateSeries,
  onDeleteEngineCache,
}: CacheTabProps) {
  const confirm = useConfirmDialog();
  const [editingSummary, setEditingSummary] = useState<string | null>(null);
  const [editingSeriesMemory, setEditingSeriesMemory] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // 구조화된 요약 관련 상태
  const [expandedEntries, setExpandedEntries] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryText, setEditingEntryText] = useState('');
  const [showMilestones, setShowMilestones] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  // 통합 텍스트 편집 vs 구조화 뷰 전환
  const [summaryViewMode, setSummaryViewMode] = useState<'structured' | 'text'>('structured');
  const seriesNovels = useNovelStore((state) => state.novels);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // === 레거시 요약 감지 + 파싱 미리보기 ===
  const hasLegacySummary = useMemo(() => isLegacySummary(novel.contextSummary), [novel.contextSummary]);

  const legacyPreview = useMemo(() => {
    if (!hasLegacySummary || !novel.contextSummary?.content) return null;
    const coveredEnd = Math.max(0, novel.chapters.length - FIXED_RECENT_RAW_CHAPTERS);
    const chaptersToSummarize = novel.chapters.slice(0, coveredEnd);
    if (chaptersToSummarize.length === 0) return null;
    return parseLegacyText(novel.contextSummary.content, chaptersToSummarize);
  }, [hasLegacySummary, novel.contextSummary?.content, novel.chapters]);

  const memoryHealth = useMemo(
    () => inspectNovelMemory(novel, currentTime),
    [novel, currentTime]
  );

  const writingContext = useMemo(
    () => buildWritingContext(novel, author || null, series || null, 'compact', seriesNovels),
    [novel, author, series, seriesNovels]
  );

  const runSummarySync = async (force: boolean) => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    setSyncMessage('');
    try {
      const result = await autoUpdateSummary(novel, { force });
      if (result.updated) {
        let applied = false;
        await onMutateNovel(novel.id, (currentNovel) => {
          const contextSummary = mergeSummaryResult(currentNovel, result);
          if (!contextSummary) return currentNovel;
          applied = true;
          return { ...currentNovel, contextSummary };
        });
        if (!applied) {
          setSyncMessage('동기화 중 원고 또는 기억이 변경되어 병합할 수 없는 결과를 저장하지 않았습니다.');
          toast.warning('원고 또는 기억이 변경되어 오래된 결과를 저장하지 않았습니다.');
          return;
        }
        const modeLabel = result.mode === 'incremental'
          ? '새 구간 이어쓰기'
          : result.mode === 'reconciled'
            ? '변경 구간만 보수'
            : result.mode === 'legacy_migrated'
              ? '기존 요약 변환'
              : result.mode === 'hierarchy_built' ? '상위 기억 정리' : '전체 재구축';
        setSyncMessage(`${modeLabel} 완료: ${result.newEntriesCount}화 처리`);
        toast.success(`기억 ${modeLabel}이 완료되었습니다.`);
      } else {
        setSyncMessage('지금 요약할 과거 원고가 없습니다. 최근 화는 원문으로 기억됩니다.');
      }
    } catch (error) {
      console.error('[CacheTab] 기억 동기화 실패:', error);
      setSyncMessage('기억 동기화에 실패했습니다. API 연결 상태를 확인해주세요.');
      toast.error('기억 동기화에 실패했습니다.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // === 레거시 → 구조화 변환 핸들러 ===
  const handleLegacyMigration = () => runSummarySync(true);

  // === 챕터별 stale(수정됨) 감지 맵 ===
  const chapterStalenessMap = useMemo(() => {
    const map = new Map<string, boolean>();
    const entries = novel.contextSummary?.entries || [];
    for (const entry of entries) {
      if (!entry.chapterSignature) continue;
      const currentChapter = novel.chapters.find(ch => ch.id === entry.chapterId);
      if (currentChapter) {
        map.set(entry.chapterId, !matchesSingleChapterSignature(entry.chapterSignature, currentChapter));
      } else {
        // 챕터가 삭제됨
        map.set(entry.chapterId, true);
      }
    }
    return map;
  }, [novel.chapters, novel.contextSummary?.entries]);

  const staleCount = useMemo(() => {
    let count = 0;
    chapterStalenessMap.forEach(isStale => { if (isStale) count++; });
    return count;
  }, [chapterStalenessMap]);

  // === 수동 전체 재생성 핸들러 ===
  const handleManualRegenerate = async () => {
    const confirmed = await confirm({
      title: '전체 요약을 다시 만들까요?',
      message: `1~${memoryHealth.archiveTargetCount}화의 기존 장기기억을 버리고 AI로 전부 다시 요약합니다. 평소 자동 요약과 스마트 동기화는 새 화만 이어 쓰거나 수정된 화만 보수하므로, 보통은 이 작업이 필요하지 않습니다.`,
      confirmText: '전체 다시 요약',
      cancelText: '취소',
      variant: 'danger',
    });
    if (confirmed) await runSummarySync(true);
  };
  const handleSmartSync = () => runSummarySync(false);

  // === 요약 수정 핸들러 (기존 텍스트 편집 모드) ===
  const handleSaveSummary = () => {
    if (editingSummary !== null && novel.contextSummary) {
      void onMutateNovel(novel.id, (currentNovel) => currentNovel.contextSummary ? ({
        ...currentNovel,
        contextSummary: { ...currentNovel.contextSummary, content: editingSummary, createdAt: Date.now() },
      }) : currentNovel);
      setEditingSummary(null);
    }
  };

  // === 구조화 요약 항목 수정 ===
  const handleSaveEntry = () => {
    if (editingEntryId && novel.contextSummary) {
      void onMutateNovel(novel.id, (currentNovel) => currentNovel.contextSummary ? ({
        ...currentNovel,
        contextSummary: editSummaryEntry(currentNovel.contextSummary, editingEntryId, editingEntryText),
      }) : currentNovel);
      setEditingEntryId(null);
      setEditingEntryText('');
    }
  };

  // === 구조화 요약 항목 삭제 ===
  const handleDeleteEntry = (chapterId: string) => {
    if (novel.contextSummary) {
      void onMutateNovel(novel.id, (currentNovel) => currentNovel.contextSummary ? ({
        ...currentNovel,
        contextSummary: deleteSummaryEntry(currentNovel.contextSummary, chapterId),
      }) : currentNovel);
    }
  };

  const handleSaveSeriesMemory = () => {
    if (series && onUpdateSeries && editingSeriesMemory !== null) {
      onUpdateSeries({
        ...series,
        seriesMemoryCompendium: editingSeriesMemory,
        seriesMemoryState: undefined,
      });
      setEditingSeriesMemory(null);
    }
  };

  const handleToggleCaching = (enabled: boolean) => {
    void onMutateNovel(novel.id, (currentNovel) => ({
      ...currentNovel,
      contextCaching: {
        ...(currentNovel.contextCaching || { activeBufferWindow: FIXED_RECENT_RAW_CHAPTERS, caches: {} }),
        isEnabled: enabled,
      },
    }));
  };

  const handleContextSetting = (field: keyof ContextManagement, value: number | boolean) => {
    void onMutateNovel(novel.id, (currentNovel) => {
      const updatedNovel: Novel = {
        ...currentNovel,
        contextManagement: {
          ...(currentNovel.contextManagement || { isEnabled: true, fullTextChapters: FIXED_RECENT_RAW_CHAPTERS, summaryTriggerChapters: 5 }),
          [field]: value,
          fullTextChapters: FIXED_RECENT_RAW_CHAPTERS,
        },
        contextCaching: currentNovel.contextCaching
          ? { ...currentNovel.contextCaching, activeBufferWindow: FIXED_RECENT_RAW_CHAPTERS }
          : currentNovel.contextCaching,
      };
      return updatedNovel;
    });
  };

  const summaryStatus = useMemo(() => {
    const totalChapters = novel.chapters.length;
    const summarizedCount = novel.contextSummary?.summarizedChapters || 0;
    const needsUpdate = memoryHealth.missingSummaryCount > 0;
    const summarizedChapters = novel.chapters.slice(0, summarizedCount);
    const hasEmptyChapters = summarizedChapters.some(ch => !ch.content || ch.content.trim().length < 10);
    const entries = novel.contextSummary?.entries || [];
    const milestones = novel.contextSummary?.milestones || [];
    const needsRecheck = novel.contextSummary?.needsRecheck || false;
    return { needsUpdate, hasEmptyChapters, summarizedCount, totalChapters, entries, milestones, needsRecheck };
  }, [novel.chapters, novel.contextSummary, memoryHealth.missingSummaryCount]);

  const getRemainingTime = (expireTime: string) => {
    const exp = new Date(expireTime).getTime();
    const diff = exp - currentTime;
    if (diff <= 0) return "만료됨";
    const mins = Math.floor(diff / 60000);
    return `${mins}분 남음`;
  };

  // 이정표 타입별 스타일
  const milestoneStyle = (type: SummaryMilestone['type']) => {
    switch (type) {
      case 'created': return 'text-teal-400 bg-teal-900/30 border-teal-700/50';
      case 'incremental': return 'text-blue-400 bg-blue-900/30 border-blue-700/50';
      case 'regenerated': return 'text-purple-400 bg-purple-900/30 border-purple-700/50';
      case 'chapter_deleted': return 'text-red-400 bg-red-900/30 border-red-700/50';
      case 'chapter_edited': return 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50';
      case 'manual_edit': return 'text-gray-300 bg-gray-800/50 border-gray-600/50';
    }
  };

  const milestoneLabel = (type: SummaryMilestone['type']) => {
    switch (type) {
      case 'created': return '생성';
      case 'incremental': return '증분';
      case 'regenerated': return '재생성';
      case 'chapter_deleted': return '삭제 감지';
      case 'chapter_edited': return '수정 감지';
      case 'manual_edit': return '수동 편집';
    }
  };

  const renderCacheStatus = (modelName: string, modelLabel: string, colorClass: string) => {
    const cacheInfo = novel.contextCaching?.caches?.[modelName];
    const isActive = cacheInfo && new Date(cacheInfo.expireTime).getTime() > currentTime;
    const totalChapters = novel.chapters.length;

    return (
      <div className="bg-gray-900/50 p-4 rounded-md border border-gray-700 flex flex-col justify-between h-full">
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className={`text-sm font-bold ${colorClass}`}>{modelLabel}</span>
            {isActive ? (
              <span className="text-[10px] bg-green-900/80 text-green-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> ACTIVE
              </span>
            ) : (
              <span className="text-[10px] bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">INACTIVE</span>
            )}
          </div>

          {isActive && cacheInfo ? (
            <div className="space-y-3">
              <div className="bg-gray-800/80 p-2 rounded text-xs space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>캐싱 구간 (고정)</span>
                  <span className="text-white font-mono">1화 ~ {cacheInfo.cachedChapterCount}화</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>활성 구간 (원문)</span>
                  <span className="text-white font-mono">{cacheInfo.cachedChapterCount + 1}화 ~ {Math.max(cacheInfo.cachedChapterCount + 1, totalChapters)}화</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-gray-400 border-t border-gray-700/50 pt-2">
                <span>토큰 크기:</span>
                <span className="text-white font-mono">~{Math.round(cacheInfo.cachedTokenCount).toLocaleString()} Tokens</span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>자동 만료:</span>
                <span className={`font-mono font-bold ${getRemainingTime(cacheInfo.expireTime) === '만료됨' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {getRemainingTime(cacheInfo.expireTime)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-gray-500">캐시된 데이터가 없습니다.</p>
              <p className="text-[10px] text-gray-600">집필을 시작하면 자동으로 생성됩니다.</p>
            </div>
          )}
        </div>

        {isActive && (
          <button
            onClick={() => onDeleteEngineCache(modelName)}
            className="mt-4 w-full text-center text-xs text-red-400 hover:text-white hover:bg-red-900/50 py-2 rounded transition-colors border border-red-900/30"
          >
            캐시 강제 초기화
          </button>
        )}
      </div>
    );
  };

  // === 구조화된 요약 항목 렌더링 ===
  const renderStructuredEntries = () => {
    const entries = summaryStatus.entries;
    if (entries.length === 0) return null;

    const displayEntries = expandedEntries ? entries : entries.slice(-5);
    const hiddenCount = entries.length - displayEntries.length;

    return (
      <div className="space-y-2">
        {hiddenCount > 0 && (
          <button
            onClick={() => setExpandedEntries(true)}
            className="w-full text-center text-xs text-teal-400 hover:text-teal-300 py-1.5 border border-teal-800/50 rounded bg-teal-900/20 hover:bg-teal-900/40 transition-colors"
          >
            + {hiddenCount}개 이전 요약 펼치기
          </button>
        )}

        {displayEntries.map((entry) => {
          const isStale = chapterStalenessMap.get(entry.chapterId) || false;
          const chapterExists = novel.chapters.some(ch => ch.id === entry.chapterId);
          return (
          <div key={entry.chapterId} className={`bg-gray-800/70 rounded-md border overflow-hidden ${isStale ? 'border-yellow-600/60' : 'border-gray-600/50'}`}>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs font-bold text-teal-400 shrink-0">{entry.chapterNumber}화</span>
                <span className="text-xs text-gray-400 truncate">{entry.chapterTitle}</span>
                {isStale && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${!chapterExists ? 'bg-red-900/60 text-red-300' : 'bg-yellow-900/60 text-yellow-300'}`}>
                    {!chapterExists ? '삭제됨' : '수정됨'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <span className="text-[10px] text-gray-500">
                  {new Date(entry.timestamp).toLocaleDateString()}
                </span>
                {editingEntryId !== entry.chapterId && (
                  <>
                    <button
                      onClick={() => { setEditingEntryId(entry.chapterId); setEditingEntryText(entry.summary); }}
                      className="p-1 text-gray-500 hover:text-teal-400 transition-colors"
                      title="수정"
                    >
                      <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.chapterId)}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                      title="삭제"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {editingEntryId === entry.chapterId ? (
              <div className="px-3 pb-3">
                <textarea
                  value={editingEntryText}
                  onChange={(e) => setEditingEntryText(e.target.value)}
                  className="w-full bg-gray-900 border border-teal-500/50 rounded-md p-2 text-white text-xs leading-relaxed focus:ring-1 focus:ring-teal-500"
                  rows={3}
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-1.5">
                  <button onClick={() => setEditingEntryId(null)} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 py-1 px-2.5 rounded">취소</button>
                  <button onClick={handleSaveEntry} className="text-xs bg-teal-600 hover:bg-teal-700 text-white py-1 px-2.5 rounded flex items-center gap-1">
                    <DeviceFloppyIcon className="w-3 h-3" /> 저장
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-3 pb-2.5">
                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{entry.summary}</p>
              </div>
            )}
          </div>
          );
        })}

        {expandedEntries && entries.length > 5 && (
          <button
            onClick={() => setExpandedEntries(false)}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-300 py-1.5 border border-gray-700/50 rounded bg-gray-800/30 transition-colors"
          >
            접기
          </button>
        )}
      </div>
    );
  };

  // === 이정표 타임라인 렌더링 ===
  const renderMilestones = () => {
    const milestones = summaryStatus.milestones;
    if (milestones.length === 0) return null;

    // 최근순 정렬
    const sorted = [...milestones].sort((a, b) => b.timestamp - a.timestamp);

    return (
      <div className="space-y-1.5 mt-3">
        <button
          onClick={() => setShowMilestones(!showMilestones)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          <ClockIcon className="w-3.5 h-3.5" />
          <span>이정표 ({milestones.length})</span>
          {showMilestones
            ? <ChevronUpIcon className="w-3 h-3" />
            : <ChevronDownIcon className="w-3 h-3" />
          }
        </button>

        {showMilestones && (
          <div className="space-y-1 max-h-[30vh] overflow-y-auto">
            {sorted.map((ms) => (
              <div key={ms.id} className={`flex items-start gap-2 p-2 rounded text-xs border ${milestoneStyle(ms.type)}`}>
                <span className="font-bold shrink-0">[{milestoneLabel(ms.type)}]</span>
                <span className="flex-1">{ms.description}</span>
                <span className="text-[10px] opacity-70 shrink-0">
                  {new Date(ms.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="font-sans space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold mb-2">캐시 센터 (기억 저장소)</h2>
        <p className="text-gray-400 text-sm">AI의 기억(Memory)을 계층별로 관리하여 비용을 절감하고 서사의 일관성을 유지합니다.</p>
      </div>

      <section className="border-y border-pink-400/30 bg-pink-950/15 px-1 py-5" aria-labelledby="author-context-title">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <BrainIcon className="w-5 h-5 text-pink-300" />
              <h3 id="author-context-title" className="font-bold text-lg text-white">이번 집필 적용 현황</h3>
              <span className="text-[11px] font-bold text-pink-100 bg-pink-700/60 px-2 py-0.5 rounded">1순위</span>
            </div>
            <p className="mt-1 text-sm text-pink-100">
              {writingContext.author.assigned ? writingContext.author.name : '담당 작가 없음'}
              {writingContext.author.specialty ? ` · ${writingContext.author.specialty}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-gray-900/70 px-2 py-1 rounded text-gray-200">공통 기억 {writingContext.diagnostics.authorGlobalMemoryCount}</span>
            <span className="bg-gray-900/70 px-2 py-1 rounded text-gray-200">작가 코어 {author?.identityCore ? '적용' : '기존 호환'}</span>
            <span className="bg-gray-900/70 px-2 py-1 rounded text-gray-200">사용자 지시 {writingContext.diagnostics.directiveCount}</span>
            <span className="bg-gray-900/70 px-2 py-1 rounded text-gray-200">원문 {writingContext.storyMemory.rawChapterCount}화</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-400 mb-1">문체와 핵심 지시</p>
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
              {writingContext.author.writingStyle || '담당 작가를 배정하면 문체가 표시됩니다.'}
            </p>
            {writingContext.author.coreDirectives && (
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words mt-2">
                {writingContext.author.coreDirectives}
              </p>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-400 mb-1">작가의 고유 정체성</p>
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
              {writingContext.author.identityCore?.selfDefinition || '기존 프로필을 고유 정체성으로 호환 적용합니다.'}
            </p>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              작품별 작가 적응은 더 이상 집필에 사용하거나 새로 편집하지 않습니다. 과거 저장값은 백업 호환을 위해 보존됩니다.
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 text-xs text-gray-400 flex flex-wrap gap-x-2 gap-y-1">
          {writingContext.priorityPolicy.map((policy, index) => (
            <span key={policy}>{index + 1}. {policy}{index < writingContext.priorityPolicy.length - 1 ? ' →' : ''}</span>
          ))}
        </div>
        {writingContext.warnings.map((warning) => (
          <p key={warning} className="mt-2 text-xs text-amber-300 flex items-start gap-1">
            <ExclamationTriangleIcon className="w-4 h-4 shrink-0" /> {warning}
          </p>
        ))}
      </section>

      <MemoryOverview
        report={memoryHealth}
        contextManagement={contextManagement}
        isBusy={isRegenerating || isSummarizing}
        syncMessage={syncMessage}
        onSettingChange={handleContextSetting}
        onSync={handleSmartSync}
      />

      {/* [0계층] 엔진 문맥 캐시 */}
      <div className="bg-gradient-to-br from-gray-800 to-indigo-900/20 border border-indigo-500/30 p-5 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2 text-lg">
              <BrainIcon className="w-5 h-5 text-teal-400" />
              [0계층] 엔진 문맥 캐시 (Context Caching)
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              반복되는 과거 문맥을 재사용해 입력 비용과 응답 대기 시간을 줄입니다. (TTL: 1시간)
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer bg-gray-900/50 px-3 py-1.5 rounded-full border border-gray-700 hover:border-gray-500 transition-colors">
            <span className="text-xs font-semibold text-gray-300">Auto Caching</span>
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={novel.contextCaching?.isEnabled ?? true} onChange={(e) => handleToggleCaching(e.target.checked)} />
              <div className={`block w-8 h-5 rounded-full transition-colors ${novel.contextCaching?.isEnabled !== false ? 'bg-teal-500' : 'bg-gray-600'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${novel.contextCaching?.isEnabled !== false ? 'transform translate-x-3' : ''}`}></div>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderCacheStatus('gemini-3.8-flash', 'Gemini 3.8 집필 시험', 'text-amber-300')}
          {renderCacheStatus('gemini-3.7-flash', 'Gemini 3.7 기본', 'text-teal-300')}
          {renderCacheStatus('gemini-3.6-flash', 'Gemini 3.6 폴백', 'text-cyan-300')}
          {renderCacheStatus('gemini-2.5-flash', 'Gemini 2.5 Flash', 'text-sky-300')}
          {renderCacheStatus('gemini-3.5-flash-lite', 'Gemini 3.5 Lite', 'text-lime-300')}
          {renderCacheStatus('gemini-2.5-pro', 'Gemini 2.5 Pro', 'text-violet-300')}
          {renderCacheStatus('gemini-3.1-pro-preview', 'Gemini 3.1 Pro', 'text-purple-300')}
        </div>

        <div className="mt-4 flex items-start gap-2 bg-indigo-900/20 p-3 rounded text-xs text-indigo-200/80">
          <InformationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong>작동 원리:</strong> 최신 {FIXED_RECENT_RAW_CHAPTERS}화(Active Buffer)를 제외한 나머지 과거 챕터를 캐싱합니다.
            캐시는 1시간 동안 유지되며, 만료되면 다음 집필 때 최신 문맥으로 다시 만듭니다.
          </p>
        </div>
      </div>

      {/* 1계층: 시리즈 연대기 */}
      {series && (
        <div className="bg-gray-800 border border-indigo-500/30 p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-indigo-300 flex items-center gap-2 text-lg">
              <BookOpenIcon className="w-5 h-5" />
              [1계층] 시리즈 연대기 (뒷표지 줄거리)
            </h3>
            <div className="flex items-center gap-2">
              {editingSeriesMemory === null ? (
                <button
                  onClick={() => setEditingSeriesMemory(series.seriesMemoryCompendium || '')}
                  className="text-sm bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 px-3 py-1 rounded-md flex items-center gap-1 transition-colors"
                >
                  <PencilIcon className="w-4 h-4" /> 내용 수정
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditingSeriesMemory(null)} className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md">취소</button>
                  <button onClick={handleSaveSeriesMemory} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md flex items-center gap-1">
                    <DeviceFloppyIcon className="w-4 h-4" /> 저장
                  </button>
                </div>
              )}
            </div>
          </div>

          {editingSeriesMemory !== null ? (
            <textarea
              value={editingSeriesMemory}
              onChange={(e) => setEditingSeriesMemory(e.target.value)}
              className="w-full bg-gray-900 border border-indigo-500/50 rounded-md p-3 text-white h-48 text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500"
              placeholder="시리즈 전체를 관통하는 핵심 사건, 역사, 설정을 기록합니다."
              autoFocus
            />
          ) : (
            <div className="bg-gray-900/50 p-3 rounded-md text-sm min-h-[60px] border border-gray-700">
              {series.seriesMemoryCompendium ? (
                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{series.seriesMemoryCompendium}</p>
              ) : (
                <p className="text-gray-500 italic">저장된 시리즈 연대기가 없습니다.</p>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">
            * 책 뒷표지의 줄거리처럼, 시리즈 전체를 관통하는 핵심 내용을 담아주세요.
          </p>
        </div>
      )}

      {/* 2계층: 문맥 요약 (구조화된 화별 요약) */}
      {(novel.contextManagement?.isEnabled || !!novel.contextSummary?.content) && (
        <div className="bg-gray-700 p-4 rounded-lg">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-teal-400 flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5" />
                [2계층] 문맥 요약 (현재 권의 기억)
              </h3>
              {!novel.contextManagement?.isEnabled && (
                <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full font-bold">
                  자동 갱신 OFF · 기존 기억 유지
                </span>
              )}
              {summaryStatus.needsRecheck && (
                <span className="text-[10px] bg-yellow-900/80 text-yellow-300 px-2 py-0.5 rounded-full font-bold animate-pulse">
                  재확인 필요
                </span>
              )}
              {summaryStatus.entries.length > 0 && (
                <span className="text-[10px] bg-teal-900/60 text-teal-300 px-2 py-0.5 rounded-full">
                  {summaryStatus.entries.length}화 구조화
                </span>
              )}
              {(novel.contextSummary?.rollups?.length ?? 0) > 0 && (
                <span className="text-[10px] bg-indigo-950/70 text-indigo-200 px-2 py-0.5 rounded-full">
                  상위 기억 {novel.contextSummary?.rollups?.filter((item) => item.level === 'episode').length ?? 0}묶음 · 권 {novel.contextSummary?.rollups?.filter((item) => item.level === 'volume').length ?? 0}묶음
                </span>
              )}
              {staleCount > 0 && (
                <span className="text-[10px] bg-yellow-900/60 text-yellow-300 px-2 py-0.5 rounded-full font-bold">
                  {staleCount}화 변경 감지
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* 수동 전체 재생성 버튼 */}
              {summaryStatus.entries.length > 0 && (
                <button
                  onClick={() => void handleManualRegenerate()}
                  disabled={isRegenerating || isSummarizing}
                  className="text-[10px] text-red-300 hover:text-white disabled:text-gray-600 px-2 py-1 border border-red-800/60 rounded bg-red-950/30 hover:bg-red-900/50 disabled:bg-transparent disabled:border-gray-700 transition-colors flex items-center gap-1"
                  title="기존 장기기억을 버리고 전체 구간을 AI로 다시 요약"
                >
                  <ArrowPathIcon className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                  {isRegenerating ? '전체 요약 중...' : '전체 다시 요약'}
                </button>
              )}
              {/* 뷰 모드 토글 (구조화 ↔ 텍스트) */}
              {summaryStatus.entries.length > 0 && novel.contextSummary?.content && (
                <button
                  onClick={() => setSummaryViewMode(summaryViewMode === 'structured' ? 'text' : 'structured')}
                  className="text-[10px] text-gray-400 hover:text-gray-300 px-2 py-0.5 border border-gray-600 rounded transition-colors"
                >
                  {summaryViewMode === 'structured' ? '통합 텍스트' : '화별 보기'}
                </button>
              )}
              {editingSummary === null && (
                <button
                  onClick={() => setEditingSummary(novel.contextSummary?.content || '')}
                  className="text-sm text-gray-400 hover:text-teal-400 flex items-center gap-1 transition-colors"
                >
                  <PencilIcon className="w-4 h-4" /> 수정
                </button>
              )}
              <button
                onClick={handleDeleteSummaryCache}
                className="text-sm text-gray-400 hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <TrashIcon className="w-4 h-4" /> 삭제
              </button>
            </div>
          </div>

          <div className="mb-3 border-l-4 border-teal-500 bg-gray-900/55 px-3 py-2 text-xs leading-relaxed text-gray-300">
            <strong className="text-teal-300">평소 저장:</strong> 새 화만 이어 쓰고, 수정된 화만 보수합니다.
            <span className="text-gray-500"> · </span>
            <strong className="text-red-300">전체 다시 요약:</strong> 위 버튼을 직접 확인한 경우에만 기존 장기기억 전체를 교체합니다.
          </div>

          {/* 레거시 요약 감지 배너 (스마트 마이그레이션) */}
          {hasLegacySummary && (
            <div className="mb-3 p-3 bg-amber-900/40 border border-amber-600/50 rounded-md">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-200">기존 수동 요약이 감지되었습니다</p>
                  <p className="text-xs text-amber-300/80 mt-1">
                    이전 방식으로 저장된 텍스트 요약입니다. 화별 구조화 형식으로 변환하면 자동 관리가 가능해집니다.
                  </p>

                  {/* 파싱 미리보기 */}
                  {legacyPreview && (
                    <div className="mt-2 p-2 bg-gray-900/60 rounded text-[11px] space-y-1">
                      <div className="flex items-center gap-3 text-gray-300">
                        <span>분석 결과:</span>
                        <span className="text-teal-400 font-bold">
                          로컬 파싱 {legacyPreview.parsedEntries.length}화
                        </span>
                        {legacyPreview.uncoveredChapterIndices.length > 0 && (
                          <span className="text-blue-400">
                            + AI 요약 {legacyPreview.uncoveredChapterIndices.length}화
                          </span>
                        )}
                        {legacyPreview.uncoveredChapterIndices.length === 0 && (
                          <span className="text-green-400">(AI 호출 불필요)</span>
                        )}
                      </div>
                      {legacyPreview.unparsedText && (
                        <div className="text-amber-400/70">
                          자유 텍스트 메모 감지됨 → 이정표에 보존
                        </div>
                      )}
                      <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-teal-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.round(legacyPreview.coverageRatio * 100)}%` }}
                        />
                      </div>
                      <div className="text-gray-500 text-[10px]">
                        커버율 {Math.round(legacyPreview.coverageRatio * 100)}% — {legacyPreview.parsedEntries.length === 0
                          ? '구조 패턴 없음 (전체 AI 요약 필요)'
                          : legacyPreview.uncoveredChapterIndices.length === 0
                            ? '모든 화 파싱 가능 (무료 변환)'
                            : `${legacyPreview.uncoveredChapterIndices.length}화만 AI 요약 (비용 최소화)`
                        }
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={handleLegacyMigration}
                      disabled={isRegenerating || isSummarizing}
                      className="text-xs bg-amber-700/60 hover:bg-amber-600/60 disabled:bg-gray-700 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                    >
                      <ArrowPathIcon className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                      {isRegenerating ? '변환 중...' : '구조화 형식으로 변환'}
                    </button>
                    <span className="text-[10px] text-amber-400/50 self-center">또는 아래에서 텍스트를 직접 수정 가능</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 상태 알림 */}
          {summaryStatus.needsUpdate && (
            <div className="mb-3 p-3 bg-indigo-900/50 border border-indigo-700 rounded-md flex items-start gap-3 animate-pulse">
              <ArrowPathIcon className="w-5 h-5 text-indigo-300 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-indigo-200">요약 갱신 추천</p>
                <p className="text-xs text-indigo-300 mt-1">
                  아직 장기기억으로 묶이지 않은 과거 원고가 {memoryHealth.pendingSummaryCount}화 있습니다.
                  {novel.contextManagement?.isEnabled
                    ? ` (${novel.contextManagement.summaryTriggerChapters}화가 모이면 새 구간만 자동 요약)`
                    : ' 자동 요약은 꺼져 있으며 원문 상태로 계속 전달됩니다.'}
                </p>
              </div>
            </div>
          )}
          {summaryStatus.hasEmptyChapters && (
            <div className="mb-3 p-3 bg-yellow-900/50 border border-yellow-700 rounded-md flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-300 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-200">주의: 빈 챕터 감지</p>
                <p className="text-xs text-yellow-300 mt-1">
                  이미 요약된 구간 내에 내용이 비어있는 챕터가 있습니다.
                </p>
              </div>
            </div>
          )}

          {/* 통합 텍스트 편집 모드 */}
          {editingSummary !== null ? (
            <div>
              <textarea
                value={editingSummary}
                onChange={(e) => setEditingSummary(e.target.value)}
                className="w-full bg-gray-900 border border-teal-500/50 rounded-md p-3 text-white h-48 text-sm leading-relaxed focus:ring-2 focus:ring-teal-500"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setEditingSummary(null)} className="text-sm bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded-lg">취소</button>
                <button onClick={handleSaveSummary} className="text-sm bg-teal-600 hover:bg-teal-700 text-white font-bold py-1 px-3 rounded-lg flex items-center gap-1">
                  <DeviceFloppyIcon className="w-4 h-4" /> 저장
                </button>
              </div>
            </div>
          ) : summaryStatus.entries.length > 0 && summaryViewMode === 'structured' ? (
            /* 구조화된 화별 요약 뷰 */
            <div>
              <div className="flex justify-between items-center text-xs text-gray-400 mb-3 border-b border-gray-500 pb-1.5">
                <span className="flex items-center gap-1">
                  <CheckCircleIcon className="w-3.5 h-3.5 text-teal-400" />
                  1 ~ {novel.contextSummary?.summarizedChapters || 0}화 요약 ({summaryStatus.entries.length}개 항목)
                </span>
                <span>{new Date(novel.contextSummary?.createdAt || 0).toLocaleString()} 업데이트</span>
              </div>

              <div className="max-h-[50vh] overflow-y-auto pr-1">
                {renderStructuredEntries()}
              </div>

              {/* 이정표 타임라인 */}
              {summaryStatus.milestones.length > 0 && renderMilestones()}
            </div>
          ) : (
            /* 기존 통합 텍스트 뷰 (폴백) */
            <div className="bg-gray-600 p-3 rounded-md text-sm min-h-[60px]">
              {novel.contextSummary?.content ? (
                <>
                  <div className="flex justify-between items-center text-xs text-gray-400 mb-2 border-b border-gray-500 pb-1">
                    <span>1 ~ {novel.contextSummary.summarizedChapters}화 요약됨</span>
                    <span>{new Date(novel.contextSummary.createdAt).toLocaleString()} 업데이트</span>
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{novel.contextSummary.content}</p>

                  {/* 이정표 타임라인 (텍스트 뷰에서도) */}
                  {summaryStatus.milestones.length > 0 && renderMilestones()}
                </>
              ) : (
                <p className="text-gray-400 italic text-center py-2">
                  {novel.contextManagement?.isEnabled
                    ? `${novel.contextManagement.summaryTriggerChapters}화가 모이면 첫 장기기억이 자동 생성됩니다.`
                    : '생성된 장기기억이 없습니다. 자동 요약은 꺼져 있어 API를 호출하지 않습니다.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <CanonLedgerPanel novel={novel} onMutateNovel={onMutateNovel} />
    </div>
  );
}
