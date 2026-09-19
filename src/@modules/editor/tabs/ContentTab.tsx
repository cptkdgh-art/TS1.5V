/**
 * ============================================================
 * @module modules/editor/tabs
 * @file ContentTab.tsx
 * ============================================================
 * @description 집필 탭 - 챕터 내용 편집 및 조회
 * ============================================================
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import type { Novel } from '@core/types';
import type { ChapterGenerationProgress } from '../hooks/useChapterGeneration';
import { useReadingSettings } from '@shared/hooks';
import {
  WriterAgentIcon,
  PencilIcon,
  EyeIcon,
  TrashIcon,
  WandSparklesIcon,
  SparklesIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  toast,
} from '@shared/components';
import { TranslateButton } from '@shared/components/TranslateButton';
import { reviewText, autoCorrect, getHighlightedSegments, getIssueClassName } from '@services/ai/review';
import type { TextIssue } from '@services/ai/review';
import type { EditingChapter } from '../types';
import { getChapterDisplayId, getChapterSourceLabel } from '@services/novel';
import { shouldAutoScrollToStreaming } from './streamingScroll';

/** 플로팅 선택 툴바 상태 */
interface SelectionPopup {
  text: string;
  chapterIndex: number;
  context: string;
  x: number;
  y: number;
}

/** 교정 미리보기 상태 */
interface CorrectionPreview {
  index: number;
  original: string;
  corrected: string;
  issues: TextIssue[];
  stats: { translation: number; slop: number; markdown: number; total: number };
}

interface ContentTabProps {
  novel: Novel;
  editingChapter: EditingChapter | null;
  setEditingChapter: (editing: EditingChapter | null) => void;
  onSaveChapter: () => void;
  onStartChapterChat: (index: number) => void;
  isAutoLoading: boolean;
  isCommittingChapter: boolean;
  generationError: { message: string } | null;
  generationProgress?: ChapterGenerationProgress | null;
  onRetry: () => void;
  onCancelGeneration?: () => void;
  streamingContent?: string;
  onTextSelected: (selectedText: string, chapterIndex: number, context: string) => void;
  onOpenReadingRoom: (index: number) => void;
  onDeleteChapter: (index: number, title: string) => void;
  onReconstructChapter: (index: number, title: string, content: string) => void;
  onVisibleChapterChange?: (index: number) => void;
  onAddEmptyChapter?: () => void;
  onAddChapter?: () => void;
  onGetEditorFeedback?: (index: number) => void;
  onUpdateChapterContent?: (index: number, content: string) => void;
}

export function ContentTab({
  novel,
  editingChapter,
  setEditingChapter,
  onSaveChapter,
  onStartChapterChat,
  isAutoLoading,
  isCommittingChapter,
  generationError,
  generationProgress,
  streamingContent,
  onRetry,
  onCancelGeneration,
  onTextSelected,
  onOpenReadingRoom,
  onDeleteChapter,
  onReconstructChapter,
  onVisibleChapterChange,
  onAddEmptyChapter,
  onAddChapter,
  onGetEditorFeedback,
  onUpdateChapterContent,
}: ContentTabProps) {
  const [settings] = useReadingSettings();
  const streamingContainerRef = useRef<HTMLDivElement>(null);
  const wasAutoLoadingRef = useRef(isAutoLoading);
  const [selectionPopup, setSelectionPopup] = useState<SelectionPopup | null>(null);
  const [correctionPreview, setCorrectionPreview] = useState<CorrectionPreview | null>(null);

  // 교정 미리보기 스크롤 동기화용 refs
  const beforeScrollRef = useRef<HTMLDivElement>(null);
  const afterScrollRef = useRef<HTMLDivElement>(null);
  const isScrollSyncing = useRef(false);

  // 스크롤 동기화 핸들러
  const handleSyncScroll = useCallback((source: 'before' | 'after') => {
    if (isScrollSyncing.current) return;
    isScrollSyncing.current = true;

    const sourceRef = source === 'before' ? beforeScrollRef : afterScrollRef;
    const targetRef = source === 'before' ? afterScrollRef : beforeScrollRef;

    if (sourceRef.current && targetRef.current) {
      const scrollRatio = sourceRef.current.scrollTop /
        (sourceRef.current.scrollHeight - sourceRef.current.clientHeight || 1);
      targetRef.current.scrollTop = scrollRatio *
        (targetRef.current.scrollHeight - targetRef.current.clientHeight);
    }

    requestAnimationFrame(() => {
      isScrollSyncing.current = false;
    });
  }, []);

  /** 자동 교정 미리보기 */
  const handleAutoCorrectPreview = useCallback((index: number, content: string) => {
    const review = reviewText(content);
    const { corrected } = autoCorrect(content);

    if (corrected === content) {
      toast.info('교정할 내용이 없습니다.');
      return;
    }

    const correctableIssues = review.issues.filter(
      issue => issue.type === 'translation' || issue.type === 'slop' || issue.type === 'markdown'
    );

    setCorrectionPreview({
      index,
      original: content,
      corrected,
      issues: correctableIssues,
      stats: {
        translation: review.stats.translation,
        slop: review.stats.slop,
        markdown: review.stats.markdown,
        total: review.stats.translation + review.stats.slop + review.stats.markdown,
      },
    });
  }, []);

  /** 교정 적용 */
  const handleApplyCorrection = useCallback(() => {
    if (!correctionPreview || !onUpdateChapterContent) return;
    onUpdateChapterContent(correctionPreview.index, correctionPreview.corrected);
    setCorrectionPreview(null);
  }, [correctionPreview, onUpdateChapterContent]);

  useEffect(() => {
    const shouldScroll = shouldAutoScrollToStreaming(
      wasAutoLoadingRef.current,
      isAutoLoading,
      isCommittingChapter,
    );
    wasAutoLoadingRef.current = isAutoLoading;

    if (shouldScroll) {
      const timer = setTimeout(() => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const isMobile = window.matchMedia('(max-width: 1023px)').matches;
        streamingContainerRef.current?.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: isMobile ? 'nearest' : 'center',
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAutoLoading, isCommittingChapter]);

  // 선택 해제 시 팝업 닫기
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        setSelectionPopup(null);
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // 스크롤 시 현재 보이는 챕터 감지
  useEffect(() => {
    if (!onVisibleChapterChange) return;

    const handleScroll = () => {
      const chapterElements = document.querySelectorAll('[id^="chapter-"]');
      let visibleChapter = 0;

      chapterElements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight / 3) {
          visibleChapter = index;
        }
      });

      onVisibleChapterChange(visibleChapter);
    };

    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll, true);
    return () => window.removeEventListener('scroll', throttledScroll, true);
  }, [onVisibleChapterChange]);

  const handleMouseUp = useCallback((e: React.MouseEvent, chapterIndex: number, fullContent: string) => {
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      if (selectedText && selectedText.length > 0) {
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        if (rect) {
          setSelectionPopup({
            text: selectedText,
            chapterIndex,
            context: fullContent,
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
          });
        }
      }
    }, 100);
  }, []);

  const handleRewriteClick = useCallback(() => {
    if (selectionPopup) {
      onTextSelected(selectionPopup.text, selectionPopup.chapterIndex, selectionPopup.context);
      setSelectionPopup(null);
    }
  }, [selectionPopup, onTextSelected]);

  const readingStyles: React.CSSProperties = {
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    fontFamily: settings.fontFamily === 'serif' ? "'Lora', serif" : "'Inter', sans-serif",
  };

  const themeWrapperClasses = {
    dark: 'bg-[#1f2437] text-gray-300',
    light: 'bg-white text-gray-800',
    sepia: 'bg-[#fbf0d9] text-[#5b4636]',
  };

  const isLight = settings.theme !== 'dark';
  const titleColorClass = isLight ? 'text-indigo-700' : 'text-indigo-400';
  const borderColorClass = isLight ? 'border-gray-300' : 'border-gray-600';
  const iconColorClass = isLight ? 'text-gray-500' : 'text-gray-400';
  const iconHoverColorClass = isLight ? 'hover:text-indigo-600' : 'hover:text-indigo-400';
  const iconDeleteHoverColorClass = isLight ? 'hover:text-red-600' : 'hover:text-red-500';
  const textareaBgClass = isLight ? 'bg-gray-50' : 'bg-gray-900';
  const streamingPulsingTitleClass = isLight ? 'text-gray-500' : 'text-indigo-400';
  const streamingCursorClass = isLight ? 'bg-indigo-500' : 'bg-indigo-400';

  // 빈 상태 UI
  if (novel.chapters.length === 0 && !isAutoLoading) {
    return (
      <div className={`p-6 md:p-8 -m-6 md:-m-8 min-h-[60vh] flex items-center justify-center ${themeWrapperClasses[settings.theme]}`}>
        <div className="text-center max-w-md mx-auto">
          <DocumentTextIcon className={`w-16 h-16 mx-auto mb-6 ${isLight ? 'text-gray-400' : 'text-gray-600'}`} />
          <h3 className={`text-2xl font-bold mb-3 ${isLight ? 'text-gray-700' : 'text-gray-200'}`}>
            첫 번째 챕터를 시작하세요
          </h3>
          <p className={`mb-8 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
            직접 작성하거나 AI의 도움을 받아 이야기를 시작해보세요
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {onAddEmptyChapter && (
              <button
                onClick={onAddEmptyChapter}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <PencilIcon className="w-5 h-5" />
                직접 작성
              </button>
            )}
            {onAddChapter && (
              <button
                onClick={onAddChapter}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <SparklesIcon className="w-5 h-5" />
                AI로 시작하기
              </button>
            )}
          </div>
          <p className={`mt-6 text-sm ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
            💡 외부에서 가져온 1화가 있다면 "직접 작성"을 선택하고 붙여넣기 하세요
          </p>
          {generationError && (
            <div className={`mt-6 p-4 rounded-lg text-left ${isLight ? 'bg-red-100 border border-red-300 text-red-800' : 'bg-red-900/50 border border-red-700 text-red-300'} font-sans`}>
              <div className="flex justify-between items-center gap-3">
                <p className="font-semibold">글 생성 오류</p>
                <button onClick={onRetry} className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors">
                  재시도
                </button>
              </div>
              <p className="text-sm mt-2">{generationError.message}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-w-0 overflow-x-hidden p-6 md:p-8 -m-6 md:-m-8 ${themeWrapperClasses[settings.theme]}`}>
      {novel.chapters.map((chapter, index) => (
        <div key={chapter.id || index} id={`chapter-${index}`} className="mb-8 group relative scroll-mt-24">
          <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 border-b ${borderColorClass} pb-2 mb-4`}>
            <div className="min-w-0">
              <h3 className={`break-words text-xl font-semibold leading-snug ${titleColorClass}`}>{chapter.title}</h3>
              <div
                className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[11px] ${isLight ? 'text-gray-500' : 'text-gray-400'}`}
                title={`회차 원본 ID: ${chapter.id || '마이그레이션 전'}${chapter.trace?.originChapterId ? `\n가져온 원본 ID: ${chapter.trace.originChapterId}` : ''}`}
              >
                <span className="font-medium">{getChapterDisplayId(chapter)}</span>
                <span>v{chapter.trace?.revision ?? 1}</span>
                <span>{getChapterSourceLabel(chapter.trace?.source)}</span>
                {chapter.trace?.generationBatchId && (chapter.trace.batchSize ?? 1) > 1 && (
                  <span>묶음 {chapter.trace.batchPosition ?? '?'}/{chapter.trace.batchSize}</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1 sm:shrink-0">
              <button onClick={() => onReconstructChapter(index, chapter.title, chapter.content)} title="챕터 재구성" className={`p-1 ${iconColorClass} ${iconHoverColorClass}`}>
                <WandSparklesIcon className="w-5 h-5" />
              </button>
              <button onClick={() => onOpenReadingRoom(index)} title="독서실에서 보기" className={`p-1 ${iconColorClass} ${iconHoverColorClass}`}>
                <EyeIcon className="w-5 h-5" />
              </button>
              <button onClick={() => onStartChapterChat(index)} title={editingChapter?.index === index ? '직접 편집한 원고를 먼저 저장해 주세요' : '작가와 작업'}
                disabled={editingChapter?.index === index || isAutoLoading || isCommittingChapter}
                aria-label={`${index + 1}화 작가와 작업`}
                className={`flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-sans text-xs font-medium ${isLight ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25'} disabled:opacity-40`}>
                <WriterAgentIcon aria-hidden="true" className="w-5 h-5" />
                작가와 작업
              </button>
              {onGetEditorFeedback && (
                <button onClick={() => onGetEditorFeedback(index)} title="편집자 피드백" className={`p-1 ${iconColorClass} ${iconHoverColorClass}`}>
                  <ClipboardDocumentListIcon className="w-5 h-5" />
                </button>
              )}
              {onUpdateChapterContent && (
                <button
                  onClick={() => handleAutoCorrectPreview(index, chapter.content)}
                  title="자동 교정 (번역체/AI투 제거)"
                  className={`p-1 ${iconColorClass} hover:text-green-400`}
                >
                  <CheckCircleIcon className="w-5 h-5" />
                </button>
              )}
              {editingChapter?.index !== index && (
                <>
                  <button onClick={() => setEditingChapter({ index, content: chapter.content })} title="챕터 수정" className={`p-1 ${iconColorClass} ${iconHoverColorClass}`}>
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => onDeleteChapter(index, chapter.title)} title="챕터 삭제" className={`p-1 ${iconColorClass} ${iconDeleteHoverColorClass}`}>
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
          {editingChapter?.index === index ? (
            <div>
              <textarea
                value={editingChapter.content}
                onChange={(e) => setEditingChapter({ ...editingChapter, content: e.target.value })}
                style={readingStyles}
                className={`w-full max-w-full h-96 border ${borderColorClass} rounded-md p-3 leading-relaxed focus:ring-indigo-500 focus:border-indigo-500 ${textareaBgClass}`}
                autoFocus
              />
              <div className="flex justify-between items-center mt-2">
                <TranslateButton
                  text={editingChapter.content}
                  onTranslated={(translated) => setEditingChapter({ ...editingChapter, content: translated })}
                />
                <div className="flex space-x-2">
                  <button onClick={() => setEditingChapter(null)} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">취소</button>
                  <button onClick={onSaveChapter} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">저장</button>
                </div>
              </div>
            </div>
          ) : (
            <p
              onMouseUp={(e) => handleMouseUp(e, index, chapter.content)}
              style={readingStyles}
              className="jinpok-manuscript-text whitespace-pre-wrap leading-relaxed chapter-content rounded-md select-text"
            >
              {chapter.content}
            </p>
          )}
        </div>
      ))}

      {isAutoLoading && !isCommittingChapter && (
        <div
          ref={streamingContainerRef}
          aria-live="polite"
          className="mb-8 group relative scroll-mt-24"
          style={{ overflowAnchor: 'none' }}
        >
          <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b ${borderColorClass} pb-2 mb-4`}>
            <h3 className={`text-xl font-semibold animate-pulse ${streamingPulsingTitleClass}`}>
              {generationProgress
                ? `${generationProgress.label} ${generationProgress.currentChapter}/${generationProgress.totalChapters}${generationProgress.maxPasses > 1 ? ` · ${generationProgress.pass}/${generationProgress.maxPasses}차` : ''}`
                : `챕터 ${novel.chapters.length + 1} (생성 중...)`}
            </h3>
            {onCancelGeneration && (
              <button
                onClick={onCancelGeneration}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                취소
              </button>
            )}
          </div>
          <p style={readingStyles} className="jinpok-manuscript-text whitespace-pre-wrap leading-relaxed chapter-content rounded-md">
            {streamingContent}
            <span className={`inline-block w-2 h-5 ${streamingCursorClass} animate-pulse ml-1`}></span>
          </p>
        </div>
      )}

      {generationError && (
        <div className={`mt-4 p-4 rounded-lg ${isLight ? 'bg-red-100 border border-red-300 text-red-800' : 'bg-red-900/50 border border-red-700 text-red-300'} font-sans`}>
          <div className="flex justify-between items-center">
            <p className="font-semibold">글 생성 오류</p>
            <button onClick={onRetry} className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors">
              재시도
            </button>
          </div>
          <p className="text-sm mt-2">{generationError.message}</p>
        </div>
      )}

      {/* 선택 시 플로팅 다시쓰기 버튼 */}
      {selectionPopup && (
        <div
          className="fixed z-50 transform -translate-x-1/2 -translate-y-full"
          style={{ left: selectionPopup.x, top: selectionPopup.y }}
        >
          <button
            onClick={handleRewriteClick}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg shadow-lg flex items-center gap-1.5 whitespace-nowrap"
          >
            <WandSparklesIcon className="w-4 h-4" />
            다시쓰기
          </button>
        </div>
      )}

      {/* 자동 교정 미리보기 모달 */}
      {correctionPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`max-w-4xl w-full h-[85vh] flex flex-col rounded-xl shadow-2xl ${isLight ? 'bg-white' : 'bg-gray-800'}`}>
            {/* 헤더 */}
            <div className={`p-4 border-b flex-shrink-0 ${isLight ? 'border-gray-200 bg-green-50' : 'border-gray-700 bg-green-900/30'}`}>
              <h3 className={`text-lg font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>
                ✨ 자동 교정 미리보기
              </h3>
              <p className={`text-sm mt-1 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                번역체 <span className="text-orange-500 font-bold">{correctionPreview.stats.translation}</span>개,
                AI투 <span className="text-red-500 font-bold">{correctionPreview.stats.slop}</span>개,
                마크다운 <span className="text-purple-500 font-bold">{correctionPreview.stats.markdown}</span>개
                → 총 <span className="font-bold">{correctionPreview.stats.total}</span>개 수정
              </p>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-orange-300 dark:bg-orange-500/50"></span> 번역체
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-300 dark:bg-red-500/50"></span> AI투
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-purple-300 dark:bg-purple-500/50"></span> 마크다운
                </span>
              </div>
            </div>

            {/* 비교 영역 */}
            <div className="flex-1 min-h-0 grid grid-cols-2 gap-0">
              {/* 전 */}
              <div className={`flex flex-col min-h-0 border-r ${isLight ? 'border-gray-200 bg-red-50/50' : 'border-gray-700 bg-red-900/10'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider p-4 pb-2 flex-shrink-0 ${isLight ? 'text-red-600' : 'text-red-400'}`}>
                  Before (삭제/변경될 부분)
                </p>
                <div
                  ref={beforeScrollRef}
                  className="flex-1 overflow-y-auto px-4 pb-4"
                  onScroll={() => handleSyncScroll('before')}
                >
                  <div className={`text-sm whitespace-pre-wrap leading-relaxed ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                    {getHighlightedSegments(correctionPreview.original, correctionPreview.issues).map((segment, i) => (
                      segment.type ? (
                        <mark
                          key={i}
                          className={`${getIssueClassName(segment.type)} px-0.5 rounded`}
                          title={segment.suggestion}
                        >
                          {segment.text}
                        </mark>
                      ) : (
                        <span key={i}>{segment.text}</span>
                      )
                    ))}
                  </div>
                </div>
              </div>

              {/* 후 */}
              <div className={`flex flex-col min-h-0 ${isLight ? 'bg-green-50/50' : 'bg-green-900/10'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider p-4 pb-2 flex-shrink-0 ${isLight ? 'text-green-600' : 'text-green-400'}`}>
                  After (교정 결과)
                </p>
                <div
                  ref={afterScrollRef}
                  className="flex-1 overflow-y-auto px-4 pb-4"
                  onScroll={() => handleSyncScroll('after')}
                >
                  <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                    {correctionPreview.corrected}
                  </p>
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className={`p-4 border-t flex-shrink-0 ${isLight ? 'border-gray-200' : 'border-gray-700'} flex justify-end gap-3`}>
              <button
                onClick={() => setCorrectionPreview(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isLight ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
              >
                취소
              </button>
              <button
                onClick={handleApplyCorrection}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors"
              >
                적용하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
