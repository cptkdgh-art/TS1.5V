/**
 * ============================================================
 * @module modules/editor/components
 * @file ControlPanel.tsx
 * ============================================================
 * @description AI 작가 제어 패널 컴포넌트 (원본 RightControlPanel 기반)
 * ============================================================
 */

import { useState } from 'react';
import type { ChapterGenerationMode, Novel, EpisodePacing, ContextManagement } from '@core/types';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import {
  InformationCircleIcon,
  ChatBubbleLeftEllipsisIcon,
  ClipboardDocumentListIcon,
  SparklesIcon,
  EyeIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@shared/components';
import type { GenerationEngine } from '@core/types';
import {
  getAiTaskPolicySummary,
  getGeminiOverloadFallbackModel,
  getGeminiWritingOverloadFallbackModel,
  getProviderForGenerationEngine,
  getSummaryTriggerChapters,
  GEMINI_WRITING_MODEL_OPTIONS,
  MODELS,
  normalizeGeminiTextModel,
} from '@services/ai/config';
import { estimateNovelContextCost } from '@services/costEstimator';
import { getAutoSummarySchedule } from '@services/ai';
import {
  DEFAULT_CHAPTER_TARGET_CHARACTERS,
  MAX_CHAPTER_TARGET_CHARACTERS,
  MIN_CHAPTER_TARGET_CHARACTERS,
  getChapterOutputTokens,
  getEffectiveChapterGenerationMode,
  getGenerationModeMaxCalls,
  getRecommendedOutputTokens,
  normalizeChapterTargetCharacters,
  normalizeChapterGenerationMode,
} from '@services/ai/generationPolicy';

// ============================================================
// ToggleSwitch 컴포넌트
// ============================================================
function ToggleSwitch({ isEnabled, onToggle, label }: { isEnabled: boolean; onToggle: (isEnabled: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isEnabled}
      aria-label={label}
      onClick={() => onToggle(!isEnabled)}
      className="relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-gray-800"
      style={{ backgroundColor: isEnabled ? '#14B8A6' : '#4B5563' }}
    >
      <span className="sr-only">{label || '토글'}</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-6' : 'translate-x-0'}`}
      />
    </button>
  );
}

function formatCurrencyKRW(value: number): string {
  if (!Number.isFinite(value)) return '계산 불가';
  if (value < 1) return `${value.toFixed(2)}원`;
  return `${Math.round(value).toLocaleString()}원`;
}

// ============================================================
// ControlPanel Props
// ============================================================
interface ControlPanelProps {
  novel: Novel;
  onUpdateNovel: (updatedNovel: Novel) => void;
  onMutateNovel: (id: string, updater: (current: Novel) => Novel) => Promise<Novel | undefined>;
  onContinue: (type: 'natural' | 'directed', directives?: { core: string; mood: string; special: string }) => void;
  onGeneratePreview: () => void;
  onPlanEpisode: () => void;
  onPromoteDirective: (directive: string) => void;
  onOpenBriefingRoom: () => void;
  onOpenSummaryModal: () => void;
  specialDirective: string;
  setSpecialDirective: (value: string) => void;
}

// ============================================================
// ControlPanel 메인 컴포넌트
// ============================================================
export function ControlPanel({
  novel,
  onUpdateNovel,
  onMutateNovel,
  onContinue,
  onGeneratePreview,
  onPlanEpisode,
  onPromoteDirective,
  onOpenBriefingRoom,
  onOpenSummaryModal,
  specialDirective,
  setSpecialDirective,
}: ControlPanelProps) {
  const [coreContent, setCoreContent] = useState('');
  const [moodAndTone, setMoodAndTone] = useState('');
  const currentEngine = novel.generationEngine as string | undefined;
  const displayedEngine = currentEngine?.startsWith('gemini-')
    ? normalizeGeminiTextModel(currentEngine)
    : MODELS.TEXT;
  const isLegacyEngine = !!currentEngine && currentEngine !== displayedEngine;
  const [isCollapsed, setIsCollapsed] = useState(false); // 모바일 접기/펼치기
  const provider = getProviderForGenerationEngine(displayedEngine);
  const normalizedModel = provider === 'gemini'
    ? normalizeGeminiTextModel(displayedEngine)
    : displayedEngine;
  const fallbackModel = provider === 'gemini'
    ? getGeminiWritingOverloadFallbackModel(normalizedModel, normalizedModel)
    : getGeminiOverloadFallbackModel(normalizedModel);
  const fullTextChapters = FIXED_RECENT_RAW_CHAPTERS;
  const summaryTriggerChapters = getSummaryTriggerChapters(novel.contextManagement?.summaryTriggerChapters ?? 5);
  const autoSummarySchedule = getAutoSummarySchedule(novel);
  const chapterTargetCharacters = normalizeChapterTargetCharacters(
    novel.chapterTargetCharacters ?? DEFAULT_CHAPTER_TARGET_CHARACTERS
  );
  const targetedGenerationEnabled = novel.targetedGenerationEnabled !== false;
  const savedChapterGenerationMode = normalizeChapterGenerationMode(novel.chapterGenerationMode);
  const chapterGenerationMode = getEffectiveChapterGenerationMode(
    savedChapterGenerationMode,
    targetedGenerationEnabled,
  );
  const maxGenerationCalls = getGenerationModeMaxCalls(chapterGenerationMode);
  const automaticOutputTokens = getChapterOutputTokens(
    targetedGenerationEnabled,
    chapterTargetCharacters,
    displayedEngine,
  );
  const contextCostEstimate = estimateNovelContextCost(novel, normalizedModel, {
    outputTokens: automaticOutputTokens,
  });
  const batchCostEstimate = contextCostEstimate.costKRW * maxGenerationCalls;
  const pendingGeneration = novel.pendingChapterGeneration;
  const writingFocusScope = novel.episodePacing?.scope ?? 'until-complete';
  const pendingChapters = pendingGeneration
    ? Math.max(0, pendingGeneration.totalChapters - pendingGeneration.completedChapters)
    : 0;
  const generationActionLabel = pendingGeneration
    ? `남은 ${Math.max(1, pendingChapters)}화 재개`
    : !targetedGenerationEnabled
      ? '자율 한 턴 쓰기'
      : chapterGenerationMode === 'extended'
      ? '긴 1화 쓰기'
      : chapterGenerationMode === 'batch2'
        ? '2화 연속 쓰기'
        : chapterGenerationMode === 'batch3' ? '3화 연속 쓰기' : '1화 쓰기';

  // ============================================================
  // 핸들러 함수들
  // ============================================================
  const handlePacingUpdate = (key: keyof EpisodePacing, value: EpisodePacing[keyof EpisodePacing]) => {
    void onMutateNovel(novel.id, (currentNovel) => ({
      ...currentNovel,
      episodePacing: {
        ...(currentNovel.episodePacing || {
          isEnabled: false,
          goal: '',
          speed: 'normal',
          scope: 'until-complete',
          destination: '',
        }),
        [key]: value
      }
    }));
  };

  const handleContextManagementUpdate = (key: keyof ContextManagement, value: ContextManagement[keyof ContextManagement]) => {
    onUpdateNovel({
      ...novel,
      contextManagement: {
        isEnabled: novel.contextManagement?.isEnabled ?? false,
        summaryTriggerChapters: novel.contextManagement?.summaryTriggerChapters ?? 5,
        [key]: value,
        fullTextChapters: FIXED_RECENT_RAW_CHAPTERS,
      }
    });
  };

  const handleAvoidRepetitionToggle = (isEnabled: boolean) => {
    onUpdateNovel({ ...novel, avoidRepetition: isEnabled });
  };

  const handleChapterTargetUpdate = (value: number) => {
    const nextTarget = normalizeChapterTargetCharacters(value);
    onUpdateNovel({
      ...novel,
      chapterTargetCharacters: nextTarget,
      maxTokens: getRecommendedOutputTokens(nextTarget, displayedEngine),
    });
  };

  const handleGenerationModeUpdate = (mode: ChapterGenerationMode) => {
    onUpdateNovel({ ...novel, chapterGenerationMode: mode });
  };

  const handleTargetedGenerationToggle = (isEnabled: boolean) => {
    onUpdateNovel({ ...novel, targetedGenerationEnabled: isEnabled });
  };

  const handleContinueDirected = () => {
    onContinue('directed', { core: coreContent, mood: moodAndTone, special: specialDirective });
    setCoreContent('');
    setMoodAndTone('');
    setSpecialDirective('');
  };

  const handlePromote = () => {
    if (specialDirective.trim()) {
      onPromoteDirective(specialDirective);
      setSpecialDirective('');
    }
  };

  // ============================================================
  // 진행률 계산
  // ============================================================
  const currentLength = novel.chapters.reduce((sum, ch) => sum + ch.content.length, 0);
  const targetLength = novel.targetCharacterCount || 0;
  const progressPercent = targetLength > 0 ? Math.min(100, (currentLength / targetLength) * 100) : 0;

  let progressColor = 'bg-teal-500';
  if (progressPercent > 100) progressColor = 'bg-red-500 animate-pulse';
  else if (progressPercent > 80) progressColor = 'bg-yellow-500';

  // ============================================================
  // 렌더링
  // ============================================================
  return (
    <aside className={`w-full lg:w-96 bg-[#1f2937] p-4 md:p-6 flex flex-col space-y-4 md:space-y-6 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-700 lg:overflow-y-auto ${isCollapsed ? 'max-h-16' : ''}`}>
      {/* 모바일 토글 헤더 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="lg:hidden flex justify-between items-center w-full sticky top-0 bg-[#1f2937] z-10 -m-4 p-4 border-b border-gray-700"
      >
        <h3 className="text-lg font-bold text-gray-200">AI 작가 제어 패널</h3>
        {isCollapsed ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
        )}
      </button>

      <section className={`flex-1 flex flex-col space-y-3 md:space-y-4 ${isCollapsed ? 'hidden lg:flex' : ''}`}>
        {/* 헤더 (데스크톱) */}
        <div className="hidden lg:flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-200">AI 작가 제어 패널</h3>
          <InformationCircleIcon className="w-5 h-5 text-gray-400" />
        </div>

        {/* 브리핑 룸 버튼 */}
        <button onClick={onOpenBriefingRoom} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2.5 px-4 rounded-lg transition-colors">
          <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />
          다음 챕터 브리핑 룸
        </button>

        {/* 에피소드 기획 버튼 */}
        <button onClick={onPlanEpisode} className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-bold py-2.5 px-4 rounded-lg transition-colors">
          <ClipboardDocumentListIcon className="w-5 h-5" />
          에피소드 기획
        </button>

        {/* 에피소드 진행 상태 표시 */}
        {novel.episodeArc && (() => {
          const totalChaptersInArc = novel.episodeArc.chapters.length;
          const currentChapterIndexInArc = novel.chapters.length - novel.episodeArc.startChapterIndex;
          const currentChapterNumberInArc = currentChapterIndexInArc + 1;

          if (currentChapterIndexInArc >= 0 && currentChapterIndexInArc < totalChaptersInArc) {
            const currentPlan = novel.episodeArc.chapters[currentChapterIndexInArc];
            return (
              <div
                className="p-3 bg-indigo-900/50 border border-indigo-700 rounded-lg text-sm cursor-pointer hover:bg-indigo-900/70 transition-colors"
                onClick={onPlanEpisode}
                title="클릭하여 에피소드 기획 수정"
              >
                <div className="flex justify-between items-center mb-1">
                  <p className="font-semibold text-indigo-300 flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3" /> 에피소드 진행 중
                  </p>
                  <span className="text-xs font-bold bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                    Step {currentChapterNumberInArc} / {totalChaptersInArc}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-gray-300 truncate" title={novel.episodeArc.goal}>
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Main Goal:</span><br />
                    {novel.episodeArc.goal}
                  </p>
                  <div className="border-t border-indigo-800/50 my-2"></div>
                  <p className="text-white truncate font-medium" title={currentPlan.goal}>
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Next Chapter:</span><br />
                    {currentPlan.goal}
                  </p>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* 집필 집중 모드 */}
        <div className="p-4 bg-gray-700/50 rounded-lg space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-white">집필 집중 모드</span>
            <ToggleSwitch isEnabled={novel.episodePacing?.isEnabled || false} onToggle={isEnabled => handlePacingUpdate('isEnabled', isEnabled)} label="집필 집중 모드 토글" />
          </div>
          {novel.episodePacing?.isEnabled && (
            <>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">적용 범위</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['next-chapter', '다음 1화만'],
                    ['until-complete', '목표 달성까지'],
                  ] as const).map(([scope, label]) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => handlePacingUpdate('scope', scope)}
                      className={`min-h-9 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${writingFocusScope === scope ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-600'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="writing-focus-goal" className="mb-1.5 block text-sm text-gray-300">
                  {writingFocusScope === 'next-chapter' ? '다음 화 목표' : '전개 방향'}
                </label>
                <textarea
                  id="writing-focus-goal"
                  aria-label="집필 집중 방향"
                  rows={2}
                  placeholder={writingFocusScope === 'next-chapter'
                    ? '다음 화에서 이룰 목표'
                    : '여러 화 동안 유지할 전개 방향'}
                  value={novel.episodePacing.goal}
                  onChange={e => handlePacingUpdate('goal', e.target.value)}
                  className="w-full resize-none bg-gray-800 border border-gray-600 rounded-md p-2 text-sm text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              {writingFocusScope === 'until-complete' && (
                <div>
                  <label htmlFor="writing-focus-destination" className="mb-1.5 block text-sm text-gray-300">
                    도달점 <span className="text-xs text-gray-500">선택</span>
                  </label>
                  <textarea
                    id="writing-focus-destination"
                    aria-label="집필 집중 도달점"
                    rows={2}
                    placeholder="이 전개가 도달할 상태"
                    value={novel.episodePacing.destination || ''}
                    onChange={e => handlePacingUpdate('destination', e.target.value)}
                    className="w-full resize-none bg-gray-800 border border-gray-600 rounded-md p-2 text-sm text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}
              <p className="text-xs text-gray-500">
                {writingFocusScope === 'next-chapter'
                  ? 'AI로 완성한 다음 화가 저장되면 집중 목표가 자동으로 꺼집니다.'
                  : '한 화에 끝내지 않고 사용자가 종료할 때까지 전개 방향을 이어갑니다.'}
              </p>
              <div>
                <label className="text-sm text-gray-400 mb-2 block border-t border-gray-700 pt-3">문장 호흡</label>
                <div className="flex justify-between gap-2">
                  {(['slow', 'normal', 'fast'] as const).map(speed => (
                    <button
                      key={speed}
                      onClick={() => handlePacingUpdate('speed', speed)}
                      className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-colors ${novel.episodePacing?.speed === speed ? 'bg-indigo-600 text-white' : 'bg-gray-800 hover:bg-gray-600 text-gray-300'}`}
                    >
                      {speed === 'slow' ? '느리게' : speed === 'normal' ? '보통' : '빠르게'}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">사건 목표와 별개로 현재 생성 회차의 문장과 문단 리듬에 적용됩니다.</p>
              </div>
            </>
          )}
        </div>

        {/* 장편 소설 문맥 관리 */}
        <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
          <h4 className="font-semibold text-white">장편 소설 문맥 관리</h4>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300">챕터 저장 후 자동 요약 API 호출</span>
            <ToggleSwitch isEnabled={novel.contextManagement?.isEnabled || false} onToggle={isEnabled => handleContextManagementUpdate('isEnabled', isEnabled)} label="자동 요약 API 호출 토글" />
          </div>
          {novel.contextManagement?.isEnabled && (
            <div className="pt-2 space-y-2 border-t border-gray-600/50">
              <div className="rounded-md border border-teal-500/30 bg-teal-950/20 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-200">최근 원문 고정 기억</span>
                  <span className="text-xs font-bold text-teal-300">최근 {fullTextChapters}화 전체</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  작품 길이와 모델이 바뀌어도 같은 기준을 유지합니다. 요약 대기 화는 기억에서 빠지지 않게 원문으로 추가됩니다.
                </p>
              </div>
              <div className="pt-2 space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="summary-trigger-chapters" className="text-sm text-gray-300">
                    자동 요약 갱신 주기
                  </label>
                  <span className="text-xs font-bold text-lime-300">
                    {summaryTriggerChapters}화마다
                  </span>
                </div>
                <input
                  id="summary-trigger-chapters"
                  type="range"
                  min="1"
                  max="20"
                  value={summaryTriggerChapters}
                  onChange={e => handleContextManagementUpdate('summaryTriggerChapters', getSummaryTriggerChapters(parseInt(e.target.value, 10)))}
                  className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-lime-500"
                />
                <p className="text-xs text-gray-500">과거 원고가 이 수만큼 쌓일 때 한 번에 묶어 요약합니다. 숫자가 클수록 요약 API 호출은 줄어듭니다.</p>
              </div>
              <div
                className="border-l-4 border-teal-500 bg-gray-900/60 px-3 py-2.5 text-xs"
                data-testid="auto-summary-schedule"
              >
                <p className="font-semibold text-white">
                  현재 {novel.chapters.length}화 · {autoSummarySchedule.nextRunAtChapter}화 저장 시 자동 실행
                </p>
                <p className="mt-1 text-teal-300">
                  {autoSummarySchedule.nextSummaryStartChapter}~{autoSummarySchedule.nextSummaryEndChapter}화 요약 예정
                </p>
                <p className={`mt-1 font-semibold ${autoSummarySchedule.nextSaveWillTrigger ? 'text-lime-300' : 'text-gray-300'}`}>
                  {autoSummarySchedule.isDue
                    ? '현재 저장분: 자동 요약 실행 대상'
                    : `다음 화 저장: ${autoSummarySchedule.nextSaveWillTrigger ? '자동 요약 실행 턴' : '일반 저장 · 요약 호출 없음'}`}
                </p>
                <p className="mt-1 text-gray-400">
                  요약 대기 누적 {autoSummarySchedule.pendingCount}/{autoSummarySchedule.triggerChapters}화
                </p>
                <p className="mt-1 text-gray-500">저장 위치: 캐시 센터 → [2계층] 장기기억 요약</p>
              </div>
            </div>
          )}
          <button onClick={onOpenSummaryModal} className="w-full bg-gray-800 hover:bg-gray-600 text-sm py-2 rounded-md transition-colors text-white">
            수동 요약 (범위 지정)
          </button>
          <p className="text-xs text-gray-500">
            {novel.contextSummary?.summarizedChapters || 0}화 요약됨{novel.contextSummary?.entries?.length ? ` (${novel.contextSummary.entries.length}개 구조화)` : ''}.
            {novel.contextManagement?.isEnabled
              ? ` ${summaryTriggerChapters}화 누적 단위 자동 갱신 활성.`
              : ' 자동 요약 OFF · 자동 토큰 사용 없음.'} 캐시 센터에서 상세 관리.
          </p>
        </div>

        {/* 집필 엔진 선택 */}
        <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
          <h4 className="font-semibold text-white">집필 엔진</h4>
          <select
            aria-label="집필 엔진 선택"
            value={displayedEngine}
            onChange={e => onUpdateNovel({ ...novel, generationEngine: e.target.value as GenerationEngine })}
            className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-sm text-white focus:ring-indigo-500 focus:border-indigo-500"
          >
            <optgroup label="Gemini (Google)">
              {GEMINI_WRITING_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </optgroup>
          </select>
          <div className="text-xs text-gray-400">
            {displayedEngine === 'gemini-2.5-pro' ? (
              <p className="text-violet-300">2.5 Pro는 정식 모델로 안정적이고 503 에러가 적습니다. 고품질 집필에 추천.</p>
            ) : displayedEngine === 'gemini-3.1-pro-preview' ? (
              <p className="text-indigo-300">3.1 Pro Preview는 최신 고품질 모델입니다. 과부하가 뜨면 안정 Flash 계열로 임시 재시도합니다.</p>
            ) : displayedEngine === 'gemini-3.8-flash' ? (
              <p className="text-amber-300">3.8 Flash는 검증 중인 집필 시험 선택입니다. 보조 생성에는 자동 사용하지 않으며 작품별로 직접 선택했을 때만 본문에 적용합니다.</p>
            ) : displayedEngine === 'gemini-3.7-flash' ? (
              <p className="text-teal-300">3.7 Flash는 현재 기본 모델입니다. 본문 집필과 보조 작업에 검증된 기본값으로 사용합니다.</p>
            ) : displayedEngine === 'gemini-3.6-flash' ? (
              <p className="text-sky-300">3.6 Flash는 이전 GA 모델입니다. 작품별 선택값을 저장하며, 3.8이나 3.7로 자동 변경하지 않습니다.</p>
            ) : displayedEngine === 'gemini-2.5-flash' ? (
              <p className="text-sky-300">2.5 Flash는 공식 안정 모델입니다. 긴 원고를 빠르고 안정적으로 처리할 때 좋습니다.</p>
            ) : displayedEngine === 'gemini-3.5-flash-lite' ? (
              <p className="text-lime-300">3.5 Flash-Lite는 저비용 보조 모델입니다. 요약, 분석, 가벼운 초안 작업에 적합합니다.</p>
            ) : !novel.generationEngine ? (
              <p className="text-teal-300">기본값은 3.7 Flash입니다. 새 작품과 모델 미지정 기존 작품에 같은 기본값을 적용합니다.</p>
            ) : null}
          </div>
          <div className="rounded-md border border-gray-600/70 bg-gray-900/40 p-3 text-xs text-gray-300 space-y-1">
            <p>
              실제 호출 모델: <span className="font-mono text-teal-300">{displayedEngine}</span>
              {isLegacyEngine && (
                <span className="text-amber-300"> (이전 저장값 {currentEngine}에서 Gemini 기본값으로 전환)</span>
              )}
            </p>
            <p>본문 폴백: 503/429 과부하 때 3.7 선택은 3.8 → 3.6, 3.8 선택은 3.7 → 3.6 순서로 임시 재시도합니다.</p>
            <p>컨텍스트 폴백: 캐시가 깨지면 캐시 없이 재시도하고, 요약이 낡았으면 구 요약을 임시 기억으로 사용합니다.</p>
            <p>보조 생성: 세계관, 분석, 요약 같은 도우미 기능은 속도와 안정성을 위해 별도 Gemini Helper 모델을 사용할 수 있습니다.</p>
            <p>출력 방식: 생성문은 실시간 스트리밍으로 표시되고, 장문 요약은 최대 10화·6만자 단위로 자동 분할합니다.</p>
          </div>

          <div className="rounded-md border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs text-gray-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-cyan-200">AI 라우팅 진단</p>
              <span className="rounded-full bg-gray-900 px-2 py-0.5 font-mono text-[11px] text-cyan-200">
                {provider}
              </span>
            </div>
            <dl className="grid grid-cols-[92px_1fr] gap-x-2 gap-y-1">
              <dt className="text-gray-400">선택값</dt>
              <dd className="font-mono text-teal-200 break-all">{displayedEngine}</dd>
              <dt className="text-gray-400">정규화</dt>
              <dd className="font-mono text-teal-200 break-all">{normalizedModel}</dd>
              <dt className="text-gray-400">과부하 폴백</dt>
              <dd className="font-mono text-amber-200 break-all">{fallbackModel || '없음'}</dd>
              <dt className="text-gray-400">보조 모델</dt>
              <dd className="text-gray-200">{getAiTaskPolicySummary()}</dd>
              <dt className="text-gray-400">고정 원문</dt>
              <dd>최근 {fullTextChapters}화 전체 + 요약 대기분</dd>
              <dt className="text-gray-400">예상 입력</dt>
              <dd>{contextCostEstimate.inputTokens.toLocaleString()} 토큰</dd>
              <dt className="text-gray-400">최대 호출</dt>
              <dd>{maxGenerationCalls}회</dd>
              <dt className="text-gray-400">묶음 상한</dt>
              <dd className="font-semibold text-lime-200">{formatCurrencyKRW(batchCostEstimate)}</dd>
            </dl>
            <div className="grid grid-cols-2 gap-1 border-t border-cyan-900/60 pt-2 text-[11px] text-gray-400">
              <span>최근 원문 {contextCostEstimate.parts.recentRawTokens.toLocaleString()}t</span>
              <span>요약 {contextCostEstimate.parts.summaryTokens.toLocaleString()}t</span>
              <span>설정/지시 {contextCostEstimate.parts.systemTokens.toLocaleString()}t</span>
              <span>브리핑 {contextCostEstimate.parts.briefingTokens.toLocaleString()}t</span>
            </div>
            {contextCostEstimate.warnings.length > 0 && (
              <div className="space-y-1 border-t border-amber-900/50 pt-2">
                {contextCostEstimate.warnings.map((warning) => (
                  <p key={warning} className="text-[11px] text-amber-200">{warning}</p>
                ))}
              </div>
            )}
          </div>

          {/* 자율 한 턴 / 목표 분량 제작 전환 */}
          <div className="pt-3 border-t border-gray-600/50 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">목표 분량·연속 집필</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {targetedGenerationEnabled ? 'ON · 제작 분량과 호출 횟수를 지정합니다.' : 'OFF · 상세 지시를 한 번의 자연스러운 응답으로 씁니다.'}
                </p>
              </div>
              <ToggleSwitch
                isEnabled={targetedGenerationEnabled}
                onToggle={handleTargetedGenerationToggle}
                label="목표 분량·연속 집필 토글"
              />
            </div>

            {targetedGenerationEnabled ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-gray-300">집필 방식</p>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="집필 방식">
                    {([
                      ['single', '1화 쓰기'],
                      ['extended', '긴 1화'],
                      ['batch2', '2화 연속'],
                      ['batch3', '3화 연속'],
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleGenerationModeUpdate(mode)}
                        className={`min-h-10 rounded-md px-2 py-2 text-sm font-semibold transition-colors ${savedChapterGenerationMode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-600'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    {chapterGenerationMode === 'extended'
                      ? '1차가 목표의 85% 미만이면 한 번 더 이어 씁니다. 시작된 응답은 목표를 넘어도 끝까지 받습니다.'
                      : chapterGenerationMode === 'batch2'
                        ? '최대 2회 호출 · 완성된 화부터 즉시 저장'
                        : chapterGenerationMode === 'batch3'
                          ? '최대 3회 호출 · 완성된 화부터 즉시 저장'
                          : '한 번의 호출로 목표 분량의 다음 한 화를 작성합니다.'}
                  </p>
                </div>

                <div className="flex justify-between items-center">
                  <label htmlFor="chapter-target-characters" className="text-sm text-gray-300">회차 목표 본문</label>
                  <span className="text-xs font-mono text-teal-300">{chapterTargetCharacters.toLocaleString()}자</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="chapter-target-characters"
                    type="range"
                    min={MIN_CHAPTER_TARGET_CHARACTERS}
                    max={MAX_CHAPTER_TARGET_CHARACTERS}
                    step="500"
                    value={chapterTargetCharacters}
                    onChange={e => handleChapterTargetUpdate(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                  <input
                    type="number"
                    min={MIN_CHAPTER_TARGET_CHARACTERS}
                    max={MAX_CHAPTER_TARGET_CHARACTERS}
                    step="500"
                    value={chapterTargetCharacters}
                    onChange={e => handleChapterTargetUpdate(parseInt(e.target.value, 10))}
                    className="w-24 bg-gray-800 text-center font-mono rounded-md border border-gray-600 p-1 text-sm text-white"
                    aria-label="회차 목표 글자 수"
                  />
                </div>
                <p className="text-xs text-gray-500">회차마다 도달하려는 본문 분량입니다. 필요한 출력 여유는 선택 모델에 맞춰 앱이 내부에서 자동 계산합니다.</p>
              </>
            ) : (
              <div className="rounded-md border border-sky-500/30 bg-sky-950/20 px-3 py-3 text-sm text-sky-100">
                <p className="font-semibold">자율 한 턴</p>
                <p className="mt-1 text-xs text-sky-200/70">글자 수를 채우거나 다음 화를 자동 생성하지 않습니다. 아래의 상세 연출 지시와 최근 3화 기억은 그대로 사용합니다.</p>
              </div>
            )}

            {pendingGeneration && (
              <div className="flex items-center justify-between gap-2 border-l-4 border-amber-500 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                <span>이어갈 집필 {pendingGeneration.completedChapters}/{pendingGeneration.totalChapters}화 완료 · 다음 실행 시 남은 {pendingChapters}화부터 기존 방식으로 재개</span>
                <button
                  type="button"
                  onClick={() => onUpdateNovel({ ...novel, pendingChapterGeneration: undefined })}
                  className="shrink-0 text-amber-100 underline underline-offset-2 hover:text-white"
                >
                  기록 지우기
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 반복 서사 방지 */}
        <div className="p-4 bg-gray-700/50 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-white">반복 서사 방지</h4>
            <ToggleSwitch isEnabled={novel.avoidRepetition || false} onToggle={handleAvoidRepetitionToggle} label="반복 서사 방지 토글" />
          </div>
          <p className="text-xs text-gray-400">이미 끝난 장면·갈등·구조는 되풀이하지 않고, 매 장면에서 관계·정보·결정·결과 중 하나가 달라지도록 지시합니다. 필요한 회상과 작가 문체는 유지합니다.</p>
        </div>

        {/* 연출 지침 섹션 */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-white">핵심 연출 지침 (AI 기억):</label>
            <p className="text-xs text-gray-400">{novel.writingDirectives?.length ? `${novel.writingDirectives.length}개의 지침 기억 중` : '기억된 지침이 없습니다.'}</p>
          </div>
          <textarea
            value={coreContent}
            onChange={e => setCoreContent(e.target.value)}
            placeholder="핵심 내용: 다음 챕터의 필수 사건"
            rows={3}
            className="w-full bg-gray-700/50 rounded-md p-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <textarea
            value={moodAndTone}
            onChange={e => setMoodAndTone(e.target.value)}
            placeholder="분위기 및 톤"
            rows={2}
            className="w-full bg-gray-700/50 rounded-md p-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="relative">
            <textarea
              value={specialDirective}
              onChange={e => setSpecialDirective(e.target.value)}
              placeholder="자유 연출 노트: AI에게 전하는 피드백이나 연출 노트를 자유롭게 작성하세요."
              rows={3}
              className="w-full bg-gray-700/50 rounded-md p-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
            />
            <button
              onClick={handlePromote}
              disabled={!specialDirective.trim()}
              title="이 피드백을 AI의 영구적인 기억(핵심 연출 지침)으로 승격"
              className="absolute top-2 right-2 p-1.5 text-gray-400 rounded-full hover:bg-gray-600 hover:text-yellow-300 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
            >
              <SparklesIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 액션 버튼 영역 */}
        <div className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            {/* 다음 챕터 예고 버튼 */}
            <button onClick={onGeneratePreview} className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-sm py-2 rounded-md text-white font-semibold transition-colors">
              <EyeIcon className="w-4 h-4" />
              다음 챕터 예고
            </button>

            {/* 미니 대시보드 */}
            <div className="flex flex-col justify-center items-center bg-gray-800 rounded-md px-2 border border-gray-700 relative overflow-hidden">
              <div className="z-10 flex flex-col items-center w-full">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                  {targetLength > 0 ? 'Volume Pace' : 'Current Volume'}
                </span>
                {targetLength > 0 ? (
                  <>
                    <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${progressColor} transition-all duration-500`} style={{ width: `${progressPercent}%` }} />
                    </div>
                    <span className={`text-[10px] mt-0.5 font-mono ${progressPercent > 90 ? 'text-red-400' : 'text-teal-300'}`}>
                      {progressPercent.toFixed(1)}% ({currentLength.toLocaleString()}자)
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-white font-mono">{currentLength.toLocaleString()}자</span>
                )}
              </div>
            </div>
          </div>

          {/* 메인 액션 버튼들 */}
          <button onClick={() => onContinue('natural')} className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-md transition-colors">
            자연스럽게 {generationActionLabel}
          </button>
          <button onClick={handleContinueDirected} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-md transition-colors shadow-lg shadow-indigo-900/20">
            지시하며 {generationActionLabel}
          </button>
        </div>
      </section>
    </aside>
  );
}
