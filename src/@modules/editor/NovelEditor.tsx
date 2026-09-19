/**
 * ============================================================
 * @module modules/editor
 * @file NovelEditor.tsx
 * ============================================================
 * @description 소설 에디터 메인 컴포넌트
 * ============================================================
 */

import React, { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import type { Novel, AiAuthor, Character, Series, Content } from '@core/types';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import { deleteContextCache, generateNextChapterPreview, refreshSummaryRange, generateCharacterProfile, generateWorldviewAspect, generateAuthorInterlude, enhancePlotSummary, cancelCurrentGeneration, analyzeAfterChapterSave, applyForeshadowingAnalysis, shouldRunForeshadowingAnalysis, shouldAutoSummarize, autoUpdateSummary, analyzeNovel, analyzeCharactersFromText, analyzeWorldviewFromNovel, createAuthorProfileFromNovel, convertScannedCharacters, generateCoverImage, generatePromptsFromTitle, formatAiErrorForUser, computeChapterSignature } from '@services/ai';
import { mergeSummaryResult } from '@services/ai/summary';
import { ChapterSidebar, ControlPanel, MobileTableOfContents, ConfirmationModal, DeleteConfirmationModal } from './components';
import { ContentTab, CharactersTab, WorldviewTab, SettingsTab, AnalysisTab, CacheTab, ForeshadowingTab } from './tabs';
import { ReadingRoom } from '@modules/reading';
import type { EditorTab } from './types';
import { Bars3Icon, ArrowLeftIcon, EyeIcon, ChevronDownIcon, ClockIcon, TrashIcon, toast, useConfirmDialog, Modal, Button, Textarea } from '@shared/components';
import type { CharacterHints, AspectMode } from './modals';
import { CharacterModal } from './modals/CharacterModal';
import { CharacterInterviewModal } from './modals/CharacterInterviewModal';
import { useChapterActions } from './hooks/useChapterActions';
import { useChapterGeneration } from './hooks/useChapterGeneration';
import { useBusyFlags } from './hooks/useBusyFlags';
import { useEditorDialogState } from './hooks/useEditorDialogState';
import { useModalFlags } from './hooks/useModalFlags';
import { logger } from '@shared/utils/logger';
import { reviseChapter } from '@services/novel';

// Lazy-loaded modals (bundle-dynamic-imports)
const ChapterChatModal = lazy(() => import('./modals/ChapterChatModal').then(m => ({ default: m.ChapterChatModal })));
const RewriteSelectionModal = lazy(() => import('./modals/RewriteSelectionModal').then(m => ({ default: m.RewriteSelectionModal })));
const ReconstructChapterModal = lazy(() => import('./modals/ReconstructChapterModal').then(m => ({ default: m.ReconstructChapterModal })));
const SnapshotModal = lazy(() => import('./modals/SnapshotModal').then(m => ({ default: m.SnapshotModal })));
const ManualSummaryModal = lazy(() => import('./modals/ManualSummaryModal').then(m => ({ default: m.ManualSummaryModal })));
const EpisodeArcModal = lazy(() => import('./modals/EpisodeArcModal').then(m => ({ default: m.EpisodeArcModal })));
const CharacterGenerateModal = lazy(() => import('./modals/CharacterGenerateModal').then(m => ({ default: m.CharacterGenerateModal })));
const AspectGenerateModal = lazy(() => import('./modals/AspectGenerateModal').then(m => ({ default: m.AspectGenerateModal })));
const BriefingRoomModal = lazy(() => import('./modals/BriefingRoomModal').then(m => ({ default: m.BriefingRoomModal })));
const EditorFeedbackModal = lazy(() => import('./modals/EditorFeedbackModal').then(m => ({ default: m.EditorFeedbackModal })));
const EditAuthorModal = lazy(() => import('@modules/author/components/EditAuthorModal').then(m => ({ default: m.EditAuthorModal })));

function buildCompactWorldviewContext(files: Novel['worldviewFiles'] = [], perFileChars = 360, maxChars = 3200): string {
  const compact = files
    .map((file) => {
      const excerpt = file.content.length > perFileChars
        ? `${file.content.slice(0, perFileChars)}...`
        : file.content;
      return `[${file.filename}]\n${excerpt}`;
    })
    .join('\n\n');

  return compact.length > maxChars
    ? `${compact.slice(0, maxChars)}\n\n[이하 세계관 파일은 속도 때문에 생략됨]`
    : compact;
}

function ModalChunkFallback() {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
        <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-300">창을 여는 중...</p>
      </div>
    </div>
  );
}

export interface NovelEditorProps {
  novel: Novel;
  series: Series | null;
  authors: AiAuthor[];
  novelsInSeries: Novel[];
  onUpdateNovel: (updatedNovel: Novel) => Promise<void>;
  onMutateNovel: (id: string, updater: (current: Novel) => Novel) => Promise<Novel | undefined>;
  onUpdateSeries: (updatedSeries: Series) => void;
  onDetachNovelFromSeries: (novelId: string) => Promise<void>;
  onBack: () => void;
  onDeleteNovel: (id: string) => void;
  onCreateAuthor: (authorDetails: Omit<AiAuthor, 'id' | 'createdAt' | 'metaChatHistory'>) => AiAuthor;
  onCreateAuthorFromDefault: (authorDetails: Omit<AiAuthor, 'id' | 'createdAt' | 'metaChatHistory'>, novelId: string) => void;
}

export function NovelEditor({
  novel,
  series,
  authors,
  onUpdateNovel,
  onMutateNovel,
  onUpdateSeries,
  onDetachNovelFromSeries,
  onBack,
  onDeleteNovel,
  onCreateAuthor,
}: NovelEditorProps) {
  // 비동기 작업 플래그 12개 (useBusyFlags: analyzing/saving/generating 등)
  const { busy, setBusy } = useBusyFlags();

  // boolean 기반 모달 open/close 플래그 10개 (useModalFlags)
  const { modal, setModal } = useModalFlags();
  const confirm = useConfirmDialog();

  // State
  const [activeTab, setActiveTab] = useState<EditorTab>('content');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentVisibleChapter, setCurrentVisibleChapter] = useState(0);
  const [specialDirective, setSpecialDirective] = useState('');
  const [editingDirectiveDraft, setEditingDirectiveDraft] = useState<{ index: number; content: Content; text: string } | null>(null);

  const {
    confirmationModal,
    setConfirmationModal,
    novelToDelete,
    setNovelToDelete,
    snapshotToDelete,
    setSnapshotToDelete,
    editingCharacter,
    setEditingCharacter,
    readingRoomChapterIndex,
    setReadingRoomChapterIndex,
    interviewingCharacter,
    setInterviewingCharacter,
    chattingChapterId,
    setChattingChapterId,
    rewriteSelection,
    setRewriteSelection,
    reconstructingChapter,
    setReconstructingChapter,
    editorFeedbackChapterIndex,
    setEditorFeedbackChapterIndex,
  } = useEditorDialogState();

  // 모바일 UX 상태
  const [isMobileControlsVisible, setIsMobileControlsVisible] = useState(true);
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);
  const [isMobileTocButtonVisible, setIsMobileTocButtonVisible] = useState(true);
  const tocBtnRef = useRef<HTMLButtonElement>(null);
  const [tocBtnTop, setTocBtnTop] = useState(100);
  const dragInfo = useRef({
    isDragging: false,
    isActuallyDragging: false,
    startY: 0,
    initialTop: 0,
  });

  // 플로팅 버튼 드래그 핸들러 (터치 민감도 개선)
  const handleTocBtnInteractionStart = useCallback((clientY: number) => {
    dragInfo.current = {
      isDragging: true,
      isActuallyDragging: false,
      startY: clientY,
      initialTop: tocBtnTop,
    };
  }, [tocBtnTop]);

  const handleTocBtnInteractionMove = useCallback((clientY: number) => {
    if (!dragInfo.current.isDragging) return;
    const deltaY = clientY - dragInfo.current.startY;
    // 터치 민감도 개선: 15px 이상 움직여야 드래그로 인식
    if (Math.abs(deltaY) > 15) {
      dragInfo.current.isActuallyDragging = true;
    }
    // 드래그가 확정된 경우에만 위치 이동
    if (dragInfo.current.isActuallyDragging) {
      const newTop = Math.max(50, Math.min(window.innerHeight - 100, dragInfo.current.initialTop + deltaY));
      setTocBtnTop(newTop);
    }
  }, []);

  const handleTocBtnInteractionEnd = useCallback(() => {
    if (dragInfo.current.isDragging && !dragInfo.current.isActuallyDragging) {
      setIsMobileTocOpen(true);
    }
    dragInfo.current.isDragging = false;
    dragInfo.current.isActuallyDragging = false;
  }, []);

  // 탭 전환 핸들러 - 본문 탭으로 돌아올 때 제어패널 다시 보이게
  const handleTabChange = useCallback((tab: EditorTab) => {
    // 모바일에서 다른 탭으로 이동 시 제어패널 숨기기
    if (window.innerWidth < 1024 && tab !== 'content') {
      setIsMobileControlsVisible(false);
    }
    // 본문 탭으로 돌아올 때 제어패널 다시 보이기
    if (tab === 'content') {
      setIsMobileControlsVisible(true);
    }
    setActiveTab(tab);
  }, []);

  // Debounced Settings
  const [title, setTitle] = useState(novel.title);
  const [plotSummary, setPlotSummary] = useState(novel.plotSummary || '');
  const [seriesPlotSummary, setSeriesPlotSummary] = useState(series?.seriesPlotSummary || '');
  const [subject, setSubject] = useState(novel.subject || '');
  const [mood, setMood] = useState(novel.mood || '');

  // Refs for debounce (stale closure 방지)
  const novelRef = useRef(novel);
  novelRef.current = novel;
  const titleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const plotTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const seriesPlotTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const subjectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const moodTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce 타이머 정리 (메모리 누수 방지)
  React.useEffect(() => {
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (plotTimerRef.current) clearTimeout(plotTimerRef.current);
      if (seriesPlotTimerRef.current) clearTimeout(seriesPlotTimerRef.current);
      if (subjectTimerRef.current) clearTimeout(subjectTimerRef.current);
      if (moodTimerRef.current) clearTimeout(moodTimerRef.current);
    };
  }, []);

  const foreshadowingAnalysisRef = useRef<string | null>(null);
  const autoSummaryRunningRef = useRef(false);
  const autoSummaryPendingRef = useRef<Novel | null>(null);

  // 피드백 루프: 챕터 저장/생성 후 복선 자동 분석
  const runForeshadowingFeedback = useCallback(async (updatedNovel: Novel) => {
    if (!updatedNovel.foreshadowingSystem || !shouldRunForeshadowingAnalysis(updatedNovel.chapters.length)) return;

    const sourceSignature = `${updatedNovel.id}:${computeChapterSignature(updatedNovel.chapters)}`;
    if (foreshadowingAnalysisRef.current === sourceSignature) return;
    foreshadowingAnalysisRef.current = sourceSignature;

    try {
      const analysis = await analyzeAfterChapterSave(updatedNovel);

      // 복선 자동 등록 + 진행 상태 자동 업데이트
      if (analysis.detectedForeshadowings.length > 0 || analysis.progressedForeshadowings.length > 0) {
        let applied = false;
        await onMutateNovel(updatedNovel.id, (currentNovel) => {
          if (!currentNovel.foreshadowingSystem) return currentNovel;
          const currentSignature = `${currentNovel.id}:${computeChapterSignature(currentNovel.chapters)}`;
          if (currentSignature !== sourceSignature) return currentNovel;
          applied = true;
          return {
            ...currentNovel,
            foreshadowingSystem: applyForeshadowingAnalysis(
              currentNovel.foreshadowingSystem,
              analysis,
              { autoAddDetected: true, autoUpdateProgressed: true }
            ),
          };
        });

        if (!applied) {
          logger.log('[복선 분석] 원고가 바뀌어 오래된 분석 결과를 폐기했습니다.');
          return;
        }
      }

      const messages: string[] = [];
      if (analysis.detectedForeshadowings.length > 0) messages.push(`새 복선 ${analysis.detectedForeshadowings.length}개 감지`);
      if (analysis.progressedForeshadowings.length > 0) messages.push(`복선 ${analysis.progressedForeshadowings.length}개 진행됨`);
      if (analysis.warnings.length > 0) messages.push(`경고 ${analysis.warnings.length}개`);
      if (messages.length > 0) {
        toast.info(`[복선 분석] ${messages.join(', ')} - 복선 탭에서 확인하세요`);
      }
    } catch (error) {
      console.error('[복선 피드백 루프] 분석 실패:', error);
      // 실패해도 사용자 작업 흐름을 방해하지 않음
    }
  }, [onMutateNovel]);

  // 자동 요약 갱신: 챕터 저장/생성 후 백그라운드 실행
  const runAutoSummary = useCallback(async (updatedNovel: Novel) => {
    autoSummaryPendingRef.current = updatedNovel;
    if (autoSummaryRunningRef.current) return;

    autoSummaryRunningRef.current = true;
    try {
      while (autoSummaryPendingRef.current) {
        const candidate = autoSummaryPendingRef.current;
        autoSummaryPendingRef.current = null;
        if (!shouldAutoSummarize(candidate)) continue;

        logger.log('[AutoSummary] 자동 요약 갱신 시작...');
        const result = await autoUpdateSummary(candidate);

        if (result.updated) {
          let applied = false;
          await onMutateNovel(candidate.id, (currentNovel) => {
            const contextSummary = mergeSummaryResult(currentNovel, result);
            if (!contextSummary) return currentNovel;
            applied = true;
            return { ...currentNovel, contextSummary };
          });

          if (applied) {
            const modeLabel = result.mode === 'incremental'
              ? '새 구간 이어쓰기'
              : result.mode === 'reconciled'
                ? '변경 구간만 보수'
                : result.mode === 'legacy_migrated' ? '레거시 변환' : '전체 재생성';
            toast.info(`[요약 자동 갱신] ${modeLabel} - ${result.newEntriesCount}화 처리`);
          } else {
            logger.log('[AutoSummary] 집필 상태가 바뀌어 오래된 요약 결과를 폐기했습니다.');
          }
        }
      }
    } catch (error) {
      console.error('[AutoSummary] 자동 요약 실패:', error);
      // 실패해도 사용자 작업 흐름을 방해하지 않음
    } finally {
      autoSummaryRunningRef.current = false;
    }
  }, [onMutateNovel]);

  const {
    editingChapter,
    setEditingChapter,
    deleteChapterModal,
    setDeleteChapterModal,
    isRemovingChapter,
    saveEditedChapter,
    requestDeleteChapter,
    confirmDeleteChapter,
    updateChapterTitle,
    addEmptyChapter,
    updateChapterContent,
  } = useChapterActions({
    novel,
    onUpdateNovel,
    onMutateNovel,
    setCurrentVisibleChapter,
    onChapterSaved: (updatedNovel) => {
      runForeshadowingFeedback(updatedNovel);
      runAutoSummary(updatedNovel);
    },
  });

  const {
    isAutoLoading,
    isCommittingChapter,
    streamingContent,
    generationError,
    generationProgress,
    continueChapter,
  } = useChapterGeneration({
    novel,
    series,
    authors,
    onMutateNovel,
    onGenerationSaved: (updatedNovel) => {
      runForeshadowingFeedback(updatedNovel);
      runAutoSummary(updatedNovel);
    },
  });

  // Handlers
  const requestConfirmation = useCallback((title: string, message: React.ReactNode, confirmText: string, onConfirm: () => void) => {
    setConfirmationModal({ title, message, confirmText, onConfirm, onClose: () => setConfirmationModal(null) });
  }, [setConfirmationModal]);

  // AI 캐릭터 생성 핸들러 (모달에서 파라미터 수신)
  const handleGenerateCharacterFromModal = useCallback(async (hints: CharacterHints) => {
    setBusy('generatingCharacter', true);
    try {
      const context = `제목: ${novel.title}\n주제: ${novel.subject}\n분위기: ${novel.mood}\n줄거리: ${novel.plotSummary}`;
      const ownerWorldview = series?.worldviewFiles ?? novel.worldviewFiles ?? [];
      const ownerCharacters = series?.characters ?? novel.characters;
      const worldview = buildCompactWorldviewContext(ownerWorldview, 260, 2200);
      const existing = ownerCharacters.map(c => c.name).join(', ');
      const processedHints = {
        name: hints.name || undefined,
        role: hints.role || undefined,
        keywords: hints.keywords ? hints.keywords.split(',').map(k => k.trim()) : undefined,
      };

      const newChar = await generateCharacterProfile(context, worldview, existing, processedHints);
      const characterWithId: Character = { ...newChar, id: `char-${Date.now()}` };

      if (series) {
        onUpdateSeries({ ...series, characters: [...series.characters, characterWithId] });
      } else {
        await onMutateNovel(novel.id, (currentNovel) => ({
          ...currentNovel,
          characters: [...currentNovel.characters, characterWithId],
        }));
      }

      setModal('characterGenerate', false);
      toast.success('새 캐릭터가 생성되었습니다!');
    } catch (error) {
      console.error('캐릭터 생성 실패:', error);
      toast.error(formatAiErrorForUser(error, '캐릭터 생성에 실패했습니다.'));
    } finally {
      setBusy('generatingCharacter', false);
    }
  }, [novel, onMutateNovel, onUpdateSeries, series, setBusy, setModal]);

  // 모달에서 호출되는 세계관 생성 핸들러 (파라미터 수신)
  const handleGenerateAspectFromModal = useCallback(async (request: string, mode: AspectMode) => {
    setBusy('generatingAspect', true);
    try {
      const novelContext = `제목: ${novel.title}\n주제: ${novel.subject}\n분위기: ${novel.mood}\n줄거리: ${novel.plotSummary}`;
      const ownerWorldview = series?.worldviewFiles ?? novel.worldviewFiles ?? [];
      const existingWorldview = mode === 'expanded'
        ? buildCompactWorldviewContext(ownerWorldview, 360, 2600)
        : '';

      const newAspect = await generateWorldviewAspect(novelContext, existingWorldview, request || '새로운 세계관 설정', mode);

      if (series) {
        onUpdateSeries({ ...series, worldviewFiles: [...ownerWorldview, newAspect] });
      } else {
        await onMutateNovel(novel.id, (currentNovel) => ({
          ...currentNovel,
          worldviewFiles: [...(currentNovel.worldviewFiles || []), newAspect],
        }));
      }

      setModal('aspectGenerate', false);
      toast.success('새 세계관 설정이 생성되었습니다!');
    } catch (error) {
      console.error('세계관 생성 실패:', error);
      toast.error(formatAiErrorForUser(error, '세계관 생성에 실패했습니다.'));
    } finally {
      setBusy('generatingAspect', false);
    }
  }, [novel, onMutateNovel, onUpdateSeries, series, setBusy, setModal]);

  const handleOpenReadingRoom = useCallback((index: number) => {
    setReadingRoomChapterIndex(index);
    setModal('readingRoom', true);
  }, [setModal, setReadingRoomChapterIndex]);

  const handleGenerateInterlude = useCallback(async (chapterIndex: number) => {
    const author = novel.aiAuthorId ? authors.find(a => a.id === novel.aiAuthorId) || null : null;
    if (!author) {
      toast.warning('작가가 배정되지 않았습니다. 설정 탭에서 작가를 배정해주세요.');
      return;
    }
    try {
      const targetChapterId = novel.chapters[chapterIndex]?.id;
      const interlude = await generateAuthorInterlude(author, novel.title, novel.chapters.slice(0, chapterIndex + 1));
      await onMutateNovel(novel.id, (currentNovel) => ({
        ...currentNovel,
        chapters: currentNovel.chapters.map((chapter, index) =>
          (targetChapterId ? chapter.id === targetChapterId : index === chapterIndex)
            ? { ...chapter, authorInterlude: interlude }
            : chapter
        ),
      }));
    } catch (error) {
      toast.error(`막간 생성 실패: ${(error as Error).message}`);
    }
  }, [novel, authors, onMutateNovel]);

  const handleChapterSelect = useCallback((index: number) => {
    const element = document.getElementById(`chapter-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setCurrentVisibleChapter(index);
    // 본문 탭으로 이동하며 제어패널 보이기
    if (window.innerWidth < 1024) {
      setIsMobileControlsVisible(true);
    }
    setActiveTab('content');
  }, []);

  const handleSaveCharacter = useCallback((details: Omit<Character, 'id'>, isNew: boolean) => {
    if (isNew) {
      const newCharacter: Character = {
        id: crypto.randomUUID(),
        ...details,
      };
      if (series) {
        onUpdateSeries({ ...series, characters: [...series.characters, newCharacter] });
      } else {
        onUpdateNovel({ ...novel, characters: [...novel.characters, newCharacter] });
      }
    } else if (editingCharacter) {
      const updateCharacter = { ...editingCharacter, ...details };
      if (series) {
        onUpdateSeries({ ...series, characters: series.characters.map(c => c.id === editingCharacter.id ? updateCharacter : c) });
      } else {
        onUpdateNovel({ ...novel, characters: novel.characters.map(c => c.id === editingCharacter.id ? updateCharacter : c) });
      }
    }
    setModal('character', false);
    setEditingCharacter(null);
  }, [editingCharacter, novel, series, onUpdateNovel, onUpdateSeries, setEditingCharacter, setModal]);

  const handleDeleteSummaryCache = useCallback(() => {
    void onMutateNovel(novel.id, (currentNovel) => ({ ...currentNovel, contextSummary: undefined }));
  }, [novel.id, onMutateNovel]);

  const handleDeleteEngineCache = useCallback(async (modelName: string) => {
    const cacheInfo = novel.contextCaching?.caches?.[modelName];
    if (!cacheInfo) return;

    const confirmed = await confirm({
      title: '모델 캐시 삭제',
      message: (
        <p>
          <span className="font-mono text-teal-300">{modelName}</span> 캐시를 삭제합니다.
          다음 요청 시 토큰 비용이 다시 발생할 수 있습니다.
        </p>
      ),
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }

    try {
      // Google 서버에서 캐시 삭제
      await deleteContextCache(cacheInfo.cacheName);

      // 로컬 상태 업데이트
      await onMutateNovel(novel.id, (currentNovel) => {
        const updatedCaches = { ...currentNovel.contextCaching?.caches };
        delete updatedCaches[modelName];
        return {
          ...currentNovel,
          contextCaching: {
            ...(currentNovel.contextCaching || { isEnabled: true, activeBufferWindow: FIXED_RECENT_RAW_CHAPTERS, caches: {} }),
            caches: updatedCaches,
          },
        };
      });
      toast.success('캐시가 삭제되었습니다.');
    } catch (e) {
      toast.error(`캐시 삭제 실패: ${(e as Error).message}`);
    }
  }, [confirm, novel, onMutateNovel]);

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    setBusy('savingTitle', true);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      onUpdateNovel({ ...novelRef.current, title: value });
      setBusy('savingTitle', false);
    }, 500);
  }, [onUpdateNovel, setBusy]);

  const handlePlotSummaryChange = useCallback((value: string) => {
    setPlotSummary(value);
    setBusy('savingPlotSummary', true);
    if (plotTimerRef.current) clearTimeout(plotTimerRef.current);
    plotTimerRef.current = setTimeout(() => {
      onUpdateNovel({ ...novelRef.current, plotSummary: value });
      setBusy('savingPlotSummary', false);
    }, 500);
  }, [onUpdateNovel, setBusy]);

  const handleSeriesPlotSummaryChange = useCallback((value: string) => {
    setSeriesPlotSummary(value);
    setBusy('savingSeriesPlotSummary', true);
    if (seriesPlotTimerRef.current) clearTimeout(seriesPlotTimerRef.current);
    seriesPlotTimerRef.current = setTimeout(() => {
      if (series) {
        onUpdateSeries({ ...series, seriesPlotSummary: value });
      }
      setBusy('savingSeriesPlotSummary', false);
    }, 500);
  }, [series, onUpdateSeries, setBusy]);

  const handleSubjectChange = useCallback((value: string) => {
    setSubject(value);
    setBusy('savingSubject', true);
    if (subjectTimerRef.current) clearTimeout(subjectTimerRef.current);
    subjectTimerRef.current = setTimeout(() => {
      onUpdateNovel({ ...novelRef.current, subject: value });
      setBusy('savingSubject', false);
    }, 500);
  }, [onUpdateNovel, setBusy]);

  const handleMoodChange = useCallback((value: string) => {
    setMood(value);
    setBusy('savingMood', true);
    if (moodTimerRef.current) clearTimeout(moodTimerRef.current);
    moodTimerRef.current = setTimeout(() => {
      onUpdateNovel({ ...novelRef.current, mood: value });
      setBusy('savingMood', false);
    }, 500);
  }, [onUpdateNovel, setBusy]);

  const handlePromoteDirective = useCallback((directive: string) => {
    const newDirective: Content = { role: 'user', parts: [{ text: directive }] };
    onUpdateNovel({
      ...novel,
      writingDirectives: [...(novel.writingDirectives || []), newDirective]
    });
  }, [novel, onUpdateNovel]);

  const handleEditDirective = useCallback((index: number, content: Content) => {
    const currentText = content.parts?.map(p => p.text).join('') || '';
    setEditingDirectiveDraft({ index, content, text: currentText });
  }, []);

  const handleContentSurfaceClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (activeTab !== 'content' || window.innerWidth >= 1024) return;

    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, label, [role="button"], [contenteditable="true"]')) return;
    if (window.getSelection()?.toString()) return;

    setIsMobileTocButtonVisible((current) => !current);
  }, [activeTab]);

  const handleSaveDirectiveDraft = useCallback(() => {
    if (!editingDirectiveDraft) return;
    const newText = editingDirectiveDraft.text.trim();
    const currentText = editingDirectiveDraft.content.parts?.map(p => p.text).join('') || '';
    if (newText && newText !== currentText) {
      const updatedDirectives = [...(novel.writingDirectives || [])];
      updatedDirectives[editingDirectiveDraft.index] = {
        ...editingDirectiveDraft.content,
        parts: [{ text: newText }],
      };
      onUpdateNovel({ ...novel, writingDirectives: updatedDirectives });
      toast.success('지시사항이 수정되었습니다.');
    }
    setEditingDirectiveDraft(null);
  }, [editingDirectiveDraft, novel, onUpdateNovel]);

  const handleEnhanceBlueprint = useCallback(async (plotToEnhance: string) => {
    const characters = series?.characters || novel.characters;
    return enhancePlotSummary({
      title: novel.title,
      subject: novel.subject,
      mood: novel.mood,
      plotSummary: plotToEnhance,
      characters,
    });
  }, [series?.characters, novel.characters, novel.title, novel.subject, novel.mood]);

  // ═══════════════════════════════════════════════════
  // [분석 기능] 상태 변경 시 실제 AI 호출 연결
  // ═══════════════════════════════════════════════════

  // 소설 구조 분석 (분석탭)
  useEffect(() => {
    if (!busy.analyzing) return;
    (async () => {
      try {
        const fullText = novel.chapters.map(c => c.content).join('\n\n');
        if (!fullText.trim()) {
          toast.warning('분석할 본문이 없습니다.');
          return;
        }
        const result = await analyzeNovel(novel.title, novel.characters, novel.chapters);
        const analysis = result as { relationships?: string; timeline?: string };
        await onMutateNovel(novel.id, (currentNovel) => ({
          ...currentNovel,
          analysis: {
            relationships: analysis.relationships || JSON.stringify(result, null, 2),
            timeline: analysis.timeline || '',
          },
        }));
        toast.success('소설 구조 분석이 완료되었습니다!');
      } catch (error) {
        console.error('소설 분석 실패:', error);
        toast.error('소설 분석 중 오류가 발생했습니다.');
      } finally {
        setBusy('analyzing', false);
      }
    })();
  }, [busy.analyzing]); // eslint-disable-line react-hooks/exhaustive-deps

  // 캐릭터 분석 (캐릭터탭 → "본문에서 분석")
  useEffect(() => {
    if (!busy.analyzingCharacters) return;
    (async () => {
      try {
        const fullText = novel.chapters.map(c => c.content).join('\n\n');
        if (!fullText.trim()) {
          toast.warning('분석할 본문이 없습니다.');
          return;
        }
        const characters = series?.characters ?? novel.characters;
        const result = await analyzeCharactersFromText(fullText, characters);

        if (result.newCharacters.length > 0 || result.characterUpdates.length > 0) {
          const newChars = convertScannedCharacters(result.newCharacters);
          const updatedCharacters = [...characters];

          // 기존 인물 업데이트
          for (const update of result.characterUpdates) {
            const idx = updatedCharacters.findIndex(c => c.name === update.characterName);
            if (idx >= 0) {
              updatedCharacters[idx] = {
                ...updatedCharacters[idx],
                log: (updatedCharacters[idx].log ? updatedCharacters[idx].log + '\n' : '') + update.suggestedLogEntry,
              };
            }
          }

          const finalCharacters = [...updatedCharacters, ...newChars];
          if (series) {
            onUpdateSeries({ ...series, characters: finalCharacters });
          } else {
            await onMutateNovel(novel.id, (currentNovel) => ({ ...currentNovel, characters: finalCharacters }));
          }
          toast.success(`새 인물 ${result.newCharacters.length}명 발견, ${result.characterUpdates.length}건 업데이트!`);
        } else {
          toast.info('새로운 인물이나 변화를 발견하지 못했습니다.');
        }
      } catch (error) {
        console.error('캐릭터 분석 실패:', error);
        toast.error('캐릭터 분석 중 오류가 발생했습니다.');
      } finally {
        setBusy('analyzingCharacters', false);
      }
    })();
  }, [busy.analyzingCharacters]); // eslint-disable-line react-hooks/exhaustive-deps

  // 세계관 분석 (세계관탭 → "본문 분석")
  useEffect(() => {
    if (!busy.analyzingWorldview) return;
    (async () => {
      try {
        const fullText = novel.chapters.map(c => c.content).join('\n\n');
        if (!fullText.trim()) {
          toast.warning('분석할 본문이 없습니다.');
          return;
        }
        const result = await analyzeWorldviewFromNovel(fullText);

        // WorldviewAnalysisResult의 각 필드를 WorldviewFile로 변환
        const fieldLabels: Record<string, string> = {
          worldLaws: '세계 법칙', geography: '지리', history: '역사',
          factions: '세력/진영', magicAndTechnology: '마법/기술 체계',
          uniqueConcepts: '고유 개념', coreTheme: '핵심 주제',
        };
        const extractedFiles = Object.entries(fieldLabels)
          .filter(([key]) => {
            const val = result[key as keyof typeof result];
            return typeof val === 'string' && val.trim();
          })
          .map(([key, label]) => ({
            filename: `${label}.txt`,
            content: result[key as keyof typeof result] as string,
          }));

        if (extractedFiles.length > 0) {
          const existingFiles = (series?.worldviewFiles ?? novel.worldviewFiles) || [];
          const newFiles = [...existingFiles, ...extractedFiles];
          if (series) {
            onUpdateSeries({ ...series, worldviewFiles: newFiles });
          } else {
            await onMutateNovel(novel.id, (currentNovel) => ({ ...currentNovel, worldviewFiles: newFiles }));
          }
          toast.success(`세계관 설정 ${extractedFiles.length}건이 추출되었습니다!`);
        } else {
          toast.info('본문에서 세계관 정보를 찾지 못했습니다.');
        }

        // 세계관에서 추출된 캐릭터 → 등장인물 탭에 자동 등록
        if (result.extractedCharacters && result.extractedCharacters.length > 0) {
          const currentCharacters = series?.characters ?? novel.characters ?? [];
          const existingNames = new Set(currentCharacters.map(c => c.name.toLowerCase()));

          const newCharacters = result.extractedCharacters
            .filter(ec => !existingNames.has(ec.name.toLowerCase()))
            .map(ec => ({
              id: crypto.randomUUID(),
              name: ec.name,
              personality: ec.personality || '불명',
              appearance: ec.appearance || '불명',
              background: [ec.role, ec.background].filter(Boolean).join(' — '),
              log: '세계관 분석에서 발견됨',
            }));

          if (newCharacters.length > 0) {
            const updatedCharacters = [...currentCharacters, ...newCharacters];
            if (series) {
              onUpdateSeries({ ...series, characters: updatedCharacters });
            } else {
              await onMutateNovel(novel.id, (currentNovel) => ({ ...currentNovel, characters: updatedCharacters }));
            }
            toast.success(`등장인물 ${newCharacters.length}명이 세계관에서 발견되어 자동 등록되었습니다!`);
          }
        }
      } catch (error) {
        console.error('세계관 분석 실패:', error);
        toast.error('세계관 분석 중 오류가 발생했습니다.');
      } finally {
        setBusy('analyzingWorldview', false);
      }
    })();
  }, [busy.analyzingWorldview]); // eslint-disable-line react-hooks/exhaustive-deps

  // 작가 진화 (설정탭 → 작가 프로필 복제)
  useEffect(() => {
    if (!busy.cloningAuthor) return;
    (async () => {
      try {
        const fullText = novel.chapters.map(c => c.content).join('\n\n');
        if (!fullText.trim()) {
          toast.warning('분석할 본문이 없습니다.');
          return;
        }
        const profile = await createAuthorProfileFromNovel(fullText, fullText.length > 50000);

        if (profile.name && profile.writingStyle) {
          const authorDetails = {
            name: profile.name || '진화된 작가',
            specialty: profile.specialty || novel.subject,
            writingStyle: profile.writingStyle || '',
            coreDirectives: profile.coreDirectives || '',
            tags: profile.tags || [],
          };
          const created = onCreateAuthor(authorDetails);
          // 자동으로 이 작가를 현재 소설에 배정
          await onMutateNovel(novel.id, (currentNovel) => ({ ...currentNovel, aiAuthorId: created.id }));
          toast.success(`'${created.name}' 작가가 생성되어 이 소설에 배정되었습니다!`);
        } else {
          toast.error('작가 프로필 분석에 실패했습니다. 본문이 충분한지 확인해주세요.');
        }
      } catch (error) {
        console.error('작가 진화 실패:', error);
        toast.error('작가 프로필 생성 중 오류가 발생했습니다.');
      } finally {
        setBusy('cloningAuthor', false);
      }
    })();
  }, [busy.cloningAuthor]); // eslint-disable-line react-hooks/exhaustive-deps

  // 표지 이미지 생성
  useEffect(() => {
    if (!modal.cover) return;
    (async () => {
      setModal('cover', false); // 중복 호출 방지
      try {
        toast.info('표지 이미지 프롬프트 생성 중...');
        const prompts = await generatePromptsFromTitle(novel.title, {
          subject: novel.subject,
          plotSummary: novel.plotSummary,
        });
        if (!prompts || prompts.length === 0) {
          toast.error('이미지 프롬프트 생성에 실패했습니다.');
          return;
        }

        toast.info('표지 이미지 생성 중... (30초~1분 소요)');
        const imageData = await generateCoverImage(prompts[0], '3:4');
        if (imageData) {
          await onMutateNovel(novel.id, (currentNovel) => ({ ...currentNovel, coverImage: imageData }));
          toast.success('표지 이미지가 생성되었습니다!');
        } else {
          toast.error('이미지 생성에 실패했습니다. Imagen API를 확인해주세요.');
        }
      } catch (error) {
        console.error('표지 생성 실패:', error);
        toast.error('표지 이미지 생성 중 오류가 발생했습니다.');
      }
    })();
  }, [modal.cover]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render Tab Content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'content':
        return (
          <ContentTab
            novel={novel}
            editingChapter={editingChapter}
            setEditingChapter={setEditingChapter}
            onSaveChapter={saveEditedChapter}
            onStartChapterChat={(index) => setChattingChapterId(novel.chapters[index]?.id ?? null)}
            isAutoLoading={isAutoLoading}
            isCommittingChapter={isCommittingChapter}
            generationError={generationError}
            generationProgress={generationProgress}
            onRetry={() => continueChapter('natural')}
            onCancelGeneration={cancelCurrentGeneration}
            streamingContent={streamingContent}
            onTextSelected={(selectedText, chapterIndex, context) => setRewriteSelection({ text: selectedText, chapterIndex, context })}
            onOpenReadingRoom={handleOpenReadingRoom}
            onDeleteChapter={requestDeleteChapter}
            onReconstructChapter={(index, title, content) => setReconstructingChapter({ index, title, content })}
            onVisibleChapterChange={setCurrentVisibleChapter}
            onAddEmptyChapter={addEmptyChapter}
            onAddChapter={() => continueChapter('natural')}
            onUpdateChapterContent={updateChapterContent}
            onGetEditorFeedback={(index) => setEditorFeedbackChapterIndex(index)}
          />
        );
      case 'characters':
        return (
          <CharactersTab
            novel={novel}
            series={series}
            onUpdateNovel={onUpdateNovel}
            onUpdateSeries={onUpdateSeries}
            isAnalyzingCharacters={busy.analyzingCharacters}
            setEditingCharacter={setEditingCharacter}
            setCharacterModalOpen={(v: boolean) => setModal('character', v)}
            requestConfirmation={requestConfirmation}
            onConfirmAnalysis={() => setBusy('analyzingCharacters', true)}
            onGenerateCharacter={() => setModal('characterGenerate', true)}
            onStartInterview={(characterId) => {
              const characters = series ? series.characters : novel.characters;
              const character = characters.find(c => c.id === characterId);
              if (character) {
                setInterviewingCharacter(character);
              }
            }}
          />
        );
      case 'worldview':
        return (
          <WorldviewTab
            novel={novel}
            series={series}
            onUpdateNovel={onUpdateNovel}
            onUpdateSeries={onUpdateSeries}
            isAnalyzingWorldview={busy.analyzingWorldview}
            requestConfirmation={requestConfirmation}
            onConfirmAnalysis={() => setBusy('analyzingWorldview', true)}
            onGenerateAspect={() => setModal('aspectGenerate', true)}
          />
        );
      case 'settings':
        return (
          <SettingsTab
            novel={novel}
            series={series}
            onUpdateNovel={onUpdateNovel}
            onUpdateSeries={onUpdateSeries}
            onDetachFromSeries={onDetachNovelFromSeries}
            authors={authors}
            setCoverModalOpen={(v: boolean) => setModal('cover', v)}
            setSnapshotToDelete={setSnapshotToDelete}
            setCreateAuthorModalOpen={(v: boolean) => setModal('createAuthor', v)}
            setNovelToDelete={setNovelToDelete}
            isCloningAuthor={busy.cloningAuthor}
            requestConfirmation={requestConfirmation}
            onTriggerSnapshotModal={() => setModal('snapshot', true)}
            onEditDirective={handleEditDirective}
            onCloneAuthor={() => setBusy('cloningAuthor', true)}
            title={title}
            onTitleChange={handleTitleChange}
            isSavingTitle={busy.savingTitle}
            plotSummary={plotSummary}
            onPlotSummaryChange={handlePlotSummaryChange}
            isSavingPlotSummary={busy.savingPlotSummary}
            seriesPlotSummary={seriesPlotSummary}
            onSeriesPlotSummaryChange={handleSeriesPlotSummaryChange}
            isSavingSeriesPlotSummary={busy.savingSeriesPlotSummary}
            subject={subject}
            onSubjectChange={handleSubjectChange}
            isSavingSubject={busy.savingSubject}
            mood={mood}
            onMoodChange={handleMoodChange}
            isSavingMood={busy.savingMood}
            onEnhanceBlueprint={handleEnhanceBlueprint}
          />
        );
      case 'analysis':
        return (
          <AnalysisTab
            novel={novel}
            onUpdateNovel={onUpdateNovel}
            isAnalyzing={busy.analyzing}
            requestConfirmation={requestConfirmation}
            onAnalyze={() => setBusy('analyzing', true)}
          />
        );
      case 'cache':
        return (
          <CacheTab
            novel={novel}
            onMutateNovel={onMutateNovel}
            contextManagement={novel.contextManagement || { isEnabled: false, fullTextChapters: FIXED_RECENT_RAW_CHAPTERS, summaryTriggerChapters: 5 }}
            isSummarizing={busy.summarizing}
            handleDeleteSummaryCache={handleDeleteSummaryCache}
            author={novel.aiAuthorId ? authors.find((item) => item.id === novel.aiAuthorId) || null : null}
            series={series}
            onUpdateSeries={onUpdateSeries}
            onDeleteEngineCache={handleDeleteEngineCache}
          />
        );
      case 'foreshadowing':
        return (
          <ForeshadowingTab
            novel={novel}
            onUpdateNovel={onUpdateNovel}
          />
        );
      default:
        return null;
    }
  };

  const fullTextChapterCount = FIXED_RECENT_RAW_CHAPTERS;
  const manualSummaryChapters = novel.chapters.slice(
    0,
    Math.max(0, novel.chapters.length - fullTextChapterCount),
  );

  return (
    <div className="flex h-screen w-full max-w-full overflow-x-hidden bg-[#111827] text-gray-100 font-sans">
      {/* 모바일 플로팅 TOC 버튼 (드래그 가능) - 최상단에 배치 */}
      <button
        ref={tocBtnRef}
        className={`fixed right-4 z-40 lg:hidden w-12 h-12 bg-indigo-600/80 backdrop-blur-sm text-white p-3 rounded-full shadow-lg cursor-grab active:cursor-grabbing transition-opacity duration-200 ${isMobileTocButtonVisible ? 'opacity-100' : 'invisible pointer-events-none opacity-0'}`}
        style={{ top: `${tocBtnTop}px` }}
        onTouchStart={(e) => handleTocBtnInteractionStart(e.touches[0].clientY)}
        onTouchMove={(e) => handleTocBtnInteractionMove(e.touches[0].clientY)}
        onTouchEnd={handleTocBtnInteractionEnd}
        onMouseDown={(e) => handleTocBtnInteractionStart(e.clientY)}
        onMouseMove={(e) => {
          if (dragInfo.current.isDragging) {
            handleTocBtnInteractionMove(e.clientY);
          }
        }}
        onMouseUp={handleTocBtnInteractionEnd}
        onMouseLeave={() => {
          if (dragInfo.current.isDragging) {
            handleTocBtnInteractionEnd();
          }
        }}
        aria-label="챕터 목록 열기"
      >
        <Bars3Icon className="w-6 h-6 pointer-events-none" />
      </button>

      {/* 모바일 풀스크린 목차 */}
      <MobileTableOfContents
        isOpen={isMobileTocOpen}
        onClose={() => {
          setIsMobileTocOpen(false);
          setIsMobileControlsVisible(true);
        }}
        chapters={novel.chapters}
        selectedIndex={editingChapter?.index ?? currentVisibleChapter}
        onChapterSelect={handleChapterSelect}
        onTabChange={handleTabChange}
        onBack={onBack}
      />

      {/* 데스크탑 사이드바 */}
      <div className="hidden lg:flex">
        <ChapterSidebar
          chapters={novel.chapters}
          selectedIndex={editingChapter?.index ?? currentVisibleChapter}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onSelectChapter={handleChapterSelect}
          onAddChapter={() => continueChapter('natural')}
          onUpdateChapterTitle={updateChapterTitle}
        />
      </div>

      {/* 메인 레이아웃 */}
      <div className="min-w-0 max-w-full flex-1 flex flex-col lg:flex-row min-h-0 bg-[#1f2437]">
        <div className="min-w-0 max-w-full flex-1 flex flex-col lg:overflow-hidden">
          {/* 헤더 - 항상 표시 (목록으로 버튼 접근성 보장) */}
          <header className="flex items-center justify-between h-14 lg:h-16 px-4 lg:px-6 border-b border-gray-700 shrink-0">
            <button onClick={onBack} className="flex items-center text-gray-400 hover:text-white">
              <ArrowLeftIcon className="w-5 h-5 mr-1 lg:mr-2" />
              <span className="hidden sm:inline">목록으로</span>
            </button>
            <div className="flex items-center gap-2 lg:gap-3 flex-1 justify-center min-w-0 px-2">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden lg:inline-flex p-1 rounded-full hover:bg-gray-700">
                <Bars3Icon className="w-5 h-5 text-gray-400"/>
              </button>
              <h1 className="text-base lg:text-xl font-bold truncate max-w-[40vw] lg:max-w-none" title={novel.title}>{novel.title}</h1>
            </div>
            <div className="flex items-center gap-1">
              {/* 모바일: 컨트롤 패널 토글 버튼 */}
              {activeTab === 'content' && (
                <button
                  onClick={() => setIsMobileControlsVisible(prev => !prev)}
                  className="lg:hidden p-2 rounded-full hover:bg-gray-700"
                  title={isMobileControlsVisible ? '제어패널 숨기기' : '제어패널 보이기'}
                >
                  <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${isMobileControlsVisible ? '' : 'rotate-180'}`} />
                </button>
              )}
              <button onClick={() => handleOpenReadingRoom(0)} aria-label="독서 모드 열기" className="p-2 rounded-full hover:bg-gray-700">
                <EyeIcon className="w-5 h-5 text-gray-400"/>
              </button>
            </div>
          </header>

          {/* 탭 네비게이션 (모바일 스크롤 가능) */}
          <nav className="shrink-0 border-b border-gray-700 overflow-x-auto scrollbar-hide">
            <div className="px-2 lg:px-6 flex space-x-1 min-w-max">
              {(['content', 'characters', 'worldview', 'foreshadowing', 'settings', 'analysis', 'cache'] as const).map(tab => (
                <button key={tab} onClick={() => handleTabChange(tab)}
                  className={`px-3 lg:px-4 py-3 font-semibold text-xs lg:text-sm transition-colors whitespace-nowrap ${activeTab === tab ? 'text-white border-b-2 border-indigo-500' : 'text-gray-400 hover:text-white'}`}>
                  {{
                    content: '본문',
                    characters: '인물',
                    worldview: '세계관',
                    foreshadowing: '복선',
                    settings: '설정',
                    analysis: '분석',
                    cache: '캐시'
                  }[tab]}
                </button>
              ))}
            </div>
          </nav>

          {/* 메인 콘텐츠 영역 - 모바일/데스크탑 모두 스크롤 가능 */}
          <main
            onClick={handleContentSurfaceClick}
            className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-8"
          >
            <div className="w-full min-w-0 max-w-4xl mx-auto">
              {renderTabContent()}
            </div>
          </main>
        </div>

        {/* 컨트롤 패널 - 데스크탑에서는 항상 표시 + sticky, 모바일에서는 content 탭 + visible 상태일 때만 */}
        <div className={`lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto ${activeTab === 'content' ? (isMobileControlsVisible ? 'block' : 'hidden lg:block') : 'hidden lg:block'}`}>
          <ControlPanel
            novel={novel}
            onUpdateNovel={onUpdateNovel}
            onMutateNovel={onMutateNovel}
            onContinue={continueChapter}
            onGeneratePreview={async () => {
              try {
                const preview = await generateNextChapterPreview(novel, series);
                toast.info(`다음 챕터 예고:\n\n${preview}`);
              } catch (error) {
                console.error('예고 생성 실패:', error);
                toast.error('다음 챕터 예고 생성 중 오류가 발생했습니다.');
              }
            }}
            onPlanEpisode={() => setModal('episodeArc', true)}
            onPromoteDirective={handlePromoteDirective}
            onOpenBriefingRoom={() => setModal('briefingRoom', true)}
            onOpenSummaryModal={() => {
              if (manualSummaryChapters.length === 0) {
                toast.info(`최근 ${fullTextChapterCount}화는 AI에 원문으로 전달되어 아직 요약할 과거 원고가 없습니다.`);
                return;
              }
              setModal('summary', true);
            }}
            specialDirective={specialDirective}
            setSpecialDirective={setSpecialDirective}
          />
        </div>
      </div>

      {/* Modals */}
      {confirmationModal && <ConfirmationModal {...confirmationModal} />}

      {deleteChapterModal && (
        <Modal
          isOpen
          onClose={() => setDeleteChapterModal(null)}
          title="회차 정리 방식 선택"
          size="md"
          isDismissible={!isRemovingChapter}
        >
          <div className="space-y-4">
            <div className="border-l-4 border-indigo-500 bg-indigo-950/30 px-4 py-3">
              <p className="font-semibold text-white">
                {deleteChapterModal.index + 1}화
                {deleteChapterModal.title.trim() !== `${deleteChapterModal.index + 1}화`
                  ? ` · ${deleteChapterModal.title}`
                  : ''}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                {deleteChapterModal.displayId} 기준 · 두 방식 모두 실행 직전 상태를 자동 복구 스냅샷으로 남깁니다. 요약·Canon·캐시·복선도 이 고유 ID를 따라 함께 정리됩니다.
              </p>
            </div>

            <button
              type="button"
              disabled={isRemovingChapter}
              onClick={() => void confirmDeleteChapter('rollback')}
              className="w-full border border-teal-700/60 bg-teal-950/25 p-4 text-left transition-colors hover:bg-teal-900/35 disabled:opacity-50"
            >
              <span className="flex items-center gap-2 font-bold text-teal-300">
                <ClockIcon className="h-5 w-5" />
                {deleteChapterModal.index === 0
                  ? '첫 회차 이전으로 되돌리기'
                  : `${deleteChapterModal.index}화 시점으로 되돌리기`}
                <span className="text-[10px] font-bold text-teal-100 bg-teal-700/70 px-2 py-0.5 rounded">추천</span>
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-gray-300">
                {deleteChapterModal.index === 0
                  ? `현재 ${novel.chapters.length}화를 정리하고 원고가 없던 시작 시점으로 돌아갑니다.`
                  : `${deleteChapterModal.index + 1}화부터 현재 ${novel.chapters.length}화까지 정리하고 ${deleteChapterModal.index}화 상태로 돌아갑니다.`}
                {' '}이어지는 원고와 기억을 한 시점으로 맞출 때 안전합니다.
              </span>
            </button>

            <button
              type="button"
              disabled={isRemovingChapter}
              onClick={() => void confirmDeleteChapter('delete')}
              className="w-full border border-red-900/70 bg-red-950/20 p-4 text-left transition-colors hover:bg-red-950/40 disabled:opacity-50"
            >
              <span className="flex items-center gap-2 font-bold text-red-300">
                <TrashIcon className="h-5 w-5" /> 이 회차만 삭제
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-gray-400">
                뒤 회차는 유지하고 이 회차만 뺍니다. 뒤 원고가 이 사건을 전제로 작성됐다면 직접 점검이 필요합니다.
              </span>
            </button>

            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setDeleteChapterModal(null)}
                disabled={isRemovingChapter}
              >
                취소
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {novelToDelete && (
        <DeleteConfirmationModal
          title="소설 삭제"
          message={`'${novelToDelete.title}' 소설과 모든 챕터를 영구적으로 삭제합니다. 계속하시겠습니까?`}
          onClose={() => setNovelToDelete(null)}
          onConfirm={() => {
            onDeleteNovel(novelToDelete.id);
            setNovelToDelete(null);
            onBack();
          }}
        />
      )}

      {snapshotToDelete && (
        <DeleteConfirmationModal
          title="스냅샷 삭제"
          message={`'${snapshotToDelete.description}' 스냅샷을 삭제하시겠습니까?`}
          onClose={() => setSnapshotToDelete(null)}
          onConfirm={() => {
            onUpdateNovel({
              ...novel,
              snapshots: (novel.snapshots || []).filter(s => s.id !== snapshotToDelete.id)
            });
            setSnapshotToDelete(null);
          }}
        />
      )}

      <Modal
        isOpen={!!editingDirectiveDraft}
        onClose={() => setEditingDirectiveDraft(null)}
        title="지시사항 수정"
        size="md"
      >
        {editingDirectiveDraft && (
          <div className="space-y-4">
            <Textarea
              value={editingDirectiveDraft.text}
              onChange={(event) => setEditingDirectiveDraft({
                ...editingDirectiveDraft,
                text: event.target.value,
              })}
              rows={6}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEditingDirectiveDraft(null)}>
                취소
              </Button>
              <Button
                onClick={handleSaveDirectiveDraft}
                disabled={!editingDirectiveDraft.text.trim()}
              >
                저장
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {modal.character && (
        <CharacterModal
          character={editingCharacter}
          onClose={() => { setModal('character', false); setEditingCharacter(null); }}
          onSave={handleSaveCharacter}
        />
      )}

      {modal.createAuthor && (
        <Suspense fallback={<ModalChunkFallback />}>
          <EditAuthorModal
            author={null}
            onClose={() => setModal('createAuthor', false)}
            onSave={(details) => {
              const created = onCreateAuthor(details);
              onUpdateNovel({ ...novel, aiAuthorId: created.id });
              setModal('createAuthor', false);
              toast.success(`'${created.name}' 작가가 생성되어 배정되었습니다.`);
            }}
          />
        </Suspense>
      )}

      {/* Reading Room */}
      {modal.readingRoom && (
        <ReadingRoom
          novel={novel}
          onClose={() => setModal('readingRoom', false)}
          onGenerateInterlude={handleGenerateInterlude}
          onUpdateNovel={onUpdateNovel}
          startChapterIndex={readingRoomChapterIndex}
        />
      )}

      {/* 수동 문맥 요약 모달 */}
      {modal.summary && (
        <Suspense fallback={<ModalChunkFallback />}>
          <ManualSummaryModal
            chapters={manualSummaryChapters}
            rawChapterCount={Math.min(fullTextChapterCount, novel.chapters.length)}
            isSummarizing={busy.summarizing}
            onClose={() => setModal('summary', false)}
            onSubmit={async (start, end) => {
              setBusy('summarizing', true);
              try {
                const result = await refreshSummaryRange(novel, start, end);

                let applied = false;
                await onMutateNovel(novel.id, (currentNovel) => {
                  const contextSummary = mergeSummaryResult(currentNovel, result);
                  if (!contextSummary) return currentNovel;
                  applied = true;
                  return {
                    ...currentNovel,
                    contextSummary,
                  };
                });
                if (applied) {
                  const gapMessage = result.filledGapCount > 0
                    ? ` 앞쪽 기억 공백 ${result.filledGapCount}화도 함께 메웠습니다.`
                    : '';
                  toast.success(`${start + 1}~${end + 1}화 요약을 갱신했습니다.${gapMessage}`);
                } else {
                  toast.warning('요약 중 원고가 변경되어 오래된 결과를 저장하지 않았습니다. 다시 실행해주세요.');
                }
              } catch (error) {
                console.error('요약 실패:', error);
                toast.error('요약 중 오류가 발생했습니다.');
              } finally {
                setBusy('summarizing', false);
                setModal('summary', false);
              }
            }}
          />
        </Suspense>
      )}

      {/* 에피소드 기획실 모달 */}
      {modal.episodeArc && (
        <Suspense fallback={<ModalChunkFallback />}>
          <EpisodeArcModal
            novel={novel}
            series={series}
            onClose={() => setModal('episodeArc', false)}
            onSave={(arc) => {
              onUpdateNovel({ ...novel, episodeArc: arc });
              setModal('episodeArc', false);
            }}
          />
        </Suspense>
      )}

      {/* 브리핑룸 모달 */}
      {modal.briefingRoom && (
        <Suspense fallback={<ModalChunkFallback />}>
          <BriefingRoomModal
            novelTitle={novel.title}
            author={novel.aiAuthorId ? authors.find(a => a.id === novel.aiAuthorId) || null : null}
            onClose={() => setModal('briefingRoom', false)}
            onApplyAsDirective={(text: string) => {
              setSpecialDirective(text);
              toast.success('브리핑 요약이 연출 노트에 적용되었습니다.');
            }}
            onPromoteToGuideline={handlePromoteDirective}
          />
        </Suspense>
      )}

      {/* AI 캐릭터 생성 모달 */}
      {modal.characterGenerate && (
        <Suspense fallback={<ModalChunkFallback />}>
          <CharacterGenerateModal
            isGenerating={busy.generatingCharacter}
            onClose={() => setModal('characterGenerate', false)}
            onGenerate={handleGenerateCharacterFromModal}
          />
        </Suspense>
      )}

      {/* AI 세계관 생성 모달 */}
      {modal.aspectGenerate && (
        <Suspense fallback={<ModalChunkFallback />}>
          <AspectGenerateModal
            isGenerating={busy.generatingAspect}
            onClose={() => setModal('aspectGenerate', false)}
            onGenerate={handleGenerateAspectFromModal}
          />
        </Suspense>
      )}

      {/* 챕터 채팅 모달 */}
      {chattingChapterId !== null && (
        <Suspense fallback={<ModalChunkFallback />}>
          <ChapterChatModal
            key={`${novel.id}:${chattingChapterId}`}
            novelId={novel.id}
            chapterId={chattingChapterId}
            onClose={() => setChattingChapterId(null)}
          />
        </Suspense>
      )}

      {/* 텍스트 다시쓰기 모달 */}
      {rewriteSelection && (
        <Suspense fallback={<ModalChunkFallback />}>
          <RewriteSelectionModal
            selection={rewriteSelection}
            onClose={() => setRewriteSelection(null)}
            onApply={(newText) => {
              const updatedChapters = [...novel.chapters];
              const chapter = updatedChapters[rewriteSelection.chapterIndex];
              updatedChapters[rewriteSelection.chapterIndex] = reviseChapter(chapter, {
                content: chapter.content.replace(rewriteSelection.text, newText),
              });
              onUpdateNovel({ ...novel, chapters: updatedChapters });
              setRewriteSelection(null);
            }}
          />
        </Suspense>
      )}

      {/* 챕터 재구성 모달 */}
      {reconstructingChapter && (
        <Suspense fallback={<ModalChunkFallback />}>
          <ReconstructChapterModal
            chapter={reconstructingChapter}
            onClose={() => setReconstructingChapter(null)}
            onApply={(newContent) => {
              const updatedChapters = [...novel.chapters];
              updatedChapters[reconstructingChapter.index] = reviseChapter(
                updatedChapters[reconstructingChapter.index],
                { content: newContent },
              );
              onUpdateNovel({ ...novel, chapters: updatedChapters });
              setReconstructingChapter(null);
            }}
          />
        </Suspense>
      )}

      {/* 웹소설 편집자 피드백 모달 */}
      {editorFeedbackChapterIndex !== null && novel.chapters[editorFeedbackChapterIndex] && (
        <Suspense fallback={<ModalChunkFallback />}>
          <EditorFeedbackModal
            chapter={novel.chapters[editorFeedbackChapterIndex]}
            novelTitle={novel.title}
            novelSubject={novel.subject}
            chapterNumber={editorFeedbackChapterIndex + 1}
            previousChapterSummary={novel.contextSummary?.content}
            characters={series?.characters || novel.characters}
            onClose={() => setEditorFeedbackChapterIndex(null)}
          />
        </Suspense>
      )}

      {/* 스냅샷 생성 모달 */}
      {modal.snapshot && (
        <Suspense fallback={<ModalChunkFallback />}>
          <SnapshotModal
            novel={novel}
            onClose={() => setModal('snapshot', false)}
            onSave={(snapshot) => {
              const snapshots = [...(novel.snapshots || []), snapshot];
              onUpdateNovel({ ...novel, snapshots });
              setModal('snapshot', false);
            }}
          />
        </Suspense>
      )}

      {/* 캐릭터 인터뷰 모달 */}
      {interviewingCharacter && (
        <CharacterInterviewModal
          character={interviewingCharacter}
          onClose={() => setInterviewingCharacter(null)}
          onUpdateCharacterLog={(newLog) => {
            const characters = series ? series.characters : novel.characters;
            const updatedCharacters = characters.map(c =>
              c.id === interviewingCharacter.id
                ? { ...c, personality: c.personality + newLog }
                : c
            );
            if (series && onUpdateSeries) {
              onUpdateSeries({ ...series, characters: updatedCharacters });
            } else {
              onUpdateNovel({ ...novel, characters: updatedCharacters });
            }
          }}
        />
      )}
    </div>
  );
}
