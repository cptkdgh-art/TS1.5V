import { useCallback, useRef, useState } from 'react';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import type { AiAuthor, GenerationLog, Novel, PendingChapterGeneration, Series } from '@core/types';
import {
  continueNovelStream,
  convertMemoToForeshadowings,
  computeChapterSignature,
  generateChapterId,
  getCurrentApiInfo,
  isApiKeyConfigured,
} from '@services/ai';
import {
  buildChapterContinuationPrompt,
  getEffectiveChapterGenerationMode,
  getGenerationModeChapterCount,
  mergeChapterContinuation,
  shouldRequestChapterContinuation,
} from '@services/ai/generationPolicy';
import type { AutoForeshadowingMemo } from '@services/ai/foreshadowing';
import { applyWritingFocusAfterChapterCommit, createChapterTrace, reviseChapter } from '@services/novel';
import { toast } from '@shared/components';

interface DirectedChapterDirectives {
  core: string;
  mood: string;
  special: string;
}

interface GenerationErrorState {
  message: string;
}

export interface ChapterGenerationProgress {
  currentChapter: number;
  totalChapters: number;
  pass: number;
  maxPasses: number;
  label: string;
}

interface UseChapterGenerationOptions {
  novel: Novel;
  series: Series | null;
  authors: AiAuthor[];
  onMutateNovel: (id: string, updater: (current: Novel) => Novel) => Promise<Novel | undefined>;
  onGenerationSaved: (updatedNovel: Novel) => void;
}

interface GenerationPassResult {
  status: 'success' | 'error' | 'cancelled';
  content: string;
  log?: GenerationLog;
  memo?: AutoForeshadowingMemo;
  error?: string;
}

function buildContinuePrompt(type: 'natural' | 'directed', directives?: DirectedChapterDirectives) {
  if (type !== 'directed' || !directives) return '다음 챕터를 이어서 작성해주세요.';
  const parts = [];
  if (directives.core) parts.push(`핵심 방향: ${directives.core}`);
  if (directives.mood) parts.push(`분위기: ${directives.mood}`);
  if (directives.special) parts.push(`특별 지시: ${directives.special}`);
  return parts.length > 0
    ? `다음 지시사항에 따라 이어서 작성해주세요.\n\n${parts.join('\n')}`
    : '다음 챕터를 이어서 작성해주세요.';
}

function buildBatchChapterPrompt(basePrompt: string, chapterIndex: number, totalChapters: number): string {
  if (totalChapters <= 1) return basePrompt;
  return `${basePrompt}\n\n[연속 집필 ${chapterIndex}/${totalChapters}]
이번 응답에서는 현재 순서의 한 화만 완성하세요.
다음 화의 본문까지 미리 쓰거나 여러 화를 한 응답에 섞지 마세요.
현재 응답 턴은 목표 글자 수를 넘더라도 이미 시작한 장면과 문단을 자연스럽게 마무리한 뒤 끝내세요.`;
}

function decorateLog(
  log: GenerationLog | undefined,
  batchId: string,
  chapterIndex: number,
  chapterCount: number,
  continuationPass: number,
): GenerationLog | undefined {
  return log ? {
    ...log,
    batchId,
    batchChapterIndex: chapterIndex,
    batchChapterCount: chapterCount,
    continuationPass,
  } : undefined;
}

function appendGenerationLog(logs: GenerationLog[] | undefined, log: GenerationLog | undefined) {
  if (!log || logs?.some((item) => item.id === log.id)) return logs;
  return [...(logs || []), log];
}

function applyMemo(
  novel: Novel,
  memo: AutoForeshadowingMemo | undefined,
  chapterIndex: number,
): { novel: Novel; planted: number; recalled: number } {
  if (!memo) return { novel, planted: 0, recalled: 0 };
  const existingItems = novel.foreshadowingSystem?.items || [];
  const { newItems, updatedIds } = convertMemoToForeshadowings(memo, chapterIndex, existingItems);
  const updatedItems = existingItems.map((item) => {
    const update = updatedIds.find((candidate) => candidate.id === item.id);
    return update ? { ...item, status: update.newStatus, updatedAt: Date.now() } : item;
  });
  return {
    novel: {
      ...novel,
      foreshadowingSystem: {
        ...(novel.foreshadowingSystem || {
          items: [],
          pacingGuide: {
            currentTension: 50,
            plantedCount: 0,
            awaitingPayoffCount: 0,
            recommendation: 'balanced' as const,
            urgentPayoffs: [],
          },
        }),
        items: [...updatedItems, ...newItems],
      },
    },
    planted: newItems.filter((item) => item.status === 'planted').length,
    recalled: updatedIds.length,
  };
}

function removeDraftSuffix(title: string): string {
  return title.replace(/\s+\((?:이어쓰기 중|미완성)\)$/, '');
}

export function useChapterGeneration({
  novel,
  series,
  authors,
  onMutateNovel,
  onGenerationSaved,
}: UseChapterGenerationOptions) {
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [isCommittingChapter, setIsCommittingChapter] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [generationError, setGenerationError] = useState<GenerationErrorState | null>(null);
  const [generationProgress, setGenerationProgress] = useState<ChapterGenerationProgress | null>(null);
  const generationLockRef = useRef(false);

  const continueChapter = useCallback(async (type: 'natural' | 'directed', directives?: DirectedChapterDirectives) => {
    if (generationLockRef.current) {
      toast.info('이미 집필을 진행하고 있습니다.');
      return;
    }
    if (!isApiKeyConfigured(novel.generationEngine)) {
      const apiInfo = getCurrentApiInfo(novel.generationEngine);
      const message = `${apiInfo.provider} ${apiInfo.model} API 키가 설정되지 않았습니다. 상단의 API 설정에서 키를 먼저 입력해주세요.`;
      setGenerationError({ message });
      toast.warning('API 키를 먼저 설정해주세요.');
      return;
    }

    generationLockRef.current = true;
    setIsAutoLoading(true);
    setIsCommittingChapter(false);
    setStreamingContent('');
    setGenerationError(null);

    const author = novel.aiAuthorId ? authors.find((item) => item.id === novel.aiAuthorId) || null : null;
    // A persisted "running" state means the tab or app stopped before it could
    // mark the batch paused. Treat every unfinished record as resumable.
    const storedPending = novel.pendingChapterGeneration;
    const mode = storedPending?.mode ?? getEffectiveChapterGenerationMode(
      novel.chapterGenerationMode,
      novel.targetedGenerationEnabled !== false,
    );
    const totalChapters = storedPending?.totalChapters ?? getGenerationModeChapterCount(mode);
    const basePrompt = storedPending?.prompt ?? buildContinuePrompt(type, directives);
    const batchId = storedPending?.id ?? `batch-${Date.now()}`;
    let completedChapters = storedPending?.completedChapters ?? 0;
    let draftChapterId = storedPending?.draftChapterId;
    let workingNovel = novel;
    let lastSavedNovel: Novel | undefined;
    let plantedTotal = 0;
    let recalledTotal = 0;
    let stoppedEarly = false;

    const makePending = (
      status: PendingChapterGeneration['status'],
      completed = completedChapters,
      draftId = draftChapterId,
    ): PendingChapterGeneration => ({
      id: batchId,
      mode,
      totalChapters,
      completedChapters: completed,
      status,
      prompt: basePrompt,
      draftChapterId: draftId,
      startedAt: storedPending?.startedAt ?? Date.now(),
      updatedAt: Date.now(),
    });

    const persistPending = async (pending: PendingChapterGeneration | undefined) => {
      const updated = await onMutateNovel(novel.id, (currentNovel) => ({
        ...currentNovel,
        pendingChapterGeneration: pending,
      }));
      if (updated) workingNovel = updated;
    };

    const runPass = async (
      sourceNovel: Novel,
      prompt: string,
      displayPrefix: string,
      chapterIndex: number,
      pass: number,
      maxPasses: number,
    ): Promise<GenerationPassResult> => {
      let accumulatedContent = '';
      const sessionId = `${batchId}-chapter-${chapterIndex}-pass-${pass}`;
      const currentLength = sourceNovel.chapters.reduce(
        (sum, chapter) => sum + (chapter.content?.length || 0),
        displayPrefix.length,
      );
      setGenerationProgress({
        currentChapter: chapterIndex,
        totalChapters,
        pass,
        maxPasses,
        label: pass > 1 ? '같은 화 이어쓰기' : totalChapters > 1 ? '연속 집필' : '집필',
      });
      const stream = continueNovelStream(
        sessionId,
        prompt,
        sourceNovel.history || [],
        author,
        sourceNovel,
        series,
        currentLength,
      );

      for await (const chunk of stream) {
        if (chunk.streamingText) {
          accumulatedContent += chunk.streamingText;
          setStreamingContent(displayPrefix
            ? mergeChapterContinuation(displayPrefix, accumulatedContent)
            : accumulatedContent);
        }

        if (chunk.invalidatedCacheInfo) {
          const { model, cacheName } = chunk.invalidatedCacheInfo;
          const updated = await onMutateNovel(novel.id, (currentNovel) => {
            const currentCache = currentNovel.contextCaching?.caches?.[model];
            if (!currentNovel.contextCaching || currentCache?.cacheName !== cacheName) return currentNovel;
            const caches = { ...currentNovel.contextCaching.caches };
            delete caches[model];
            return { ...currentNovel, contextCaching: { ...currentNovel.contextCaching, caches } };
          });
          if (updated) workingNovel = updated;
        }

        if (chunk.newCacheInfo) {
          const { model, info } = chunk.newCacheInfo;
          const updated = await onMutateNovel(novel.id, (currentNovel) => ({
            ...currentNovel,
            contextCaching: {
              ...(currentNovel.contextCaching || { isEnabled: true, activeBufferWindow: FIXED_RECENT_RAW_CHAPTERS, caches: {} }),
              caches: { ...(currentNovel.contextCaching?.caches || {}), [model]: info },
            },
          }));
          if (updated) workingNovel = updated;
        }

        if (chunk.log) {
          const attemptLog = decorateLog(chunk.log, batchId, chapterIndex, totalChapters, pass);
          const updated = await onMutateNovel(novel.id, (current) => ({
            ...current,
            generationLogs: appendGenerationLog(current.generationLogs, attemptLog),
          }));
          if (updated) workingNovel = updated;
        }
        if (chunk.cancelled) {
          return {
            status: 'cancelled',
            content: (chunk.log?.content || accumulatedContent).trim(),
            log: decorateLog(chunk.log, batchId, chapterIndex, totalChapters, pass),
            error: 'AI 생성이 취소되었습니다.',
          };
        }
        if (!chunk.log) continue;
        if (chunk.log.status === 'success') {
          return {
            status: 'success',
            content: (chunk.cleanedContent || chunk.log.content || accumulatedContent).trim(),
            log: decorateLog(chunk.log, batchId, chapterIndex, totalChapters, pass),
            memo: chunk.foreshadowingMemo,
          };
        }
        if (chunk.willRetry) {
          accumulatedContent = '';
          setStreamingContent(displayPrefix);
          setGenerationError(null);
          const retryHint = chunk.retryModel ? `${chunk.retryModel}로 다시 시도합니다.` : '다시 시도합니다.';
          toast.info(`서버가 바빠서 ${retryHint}`);
          continue;
        }
        return {
          status: 'error',
          content: (chunk.log.content || accumulatedContent).trim(),
          log: decorateLog(chunk.log, batchId, chapterIndex, totalChapters, pass),
          error: chunk.log.error || '생성 중 오류가 발생했습니다.',
        };
      }
      return { status: 'error', content: accumulatedContent.trim(), error: '생성 응답이 종료되었습니다.' };
    };

    const commitNewChapter = async (
      content: string,
      log: GenerationLog | undefined,
      memo: AutoForeshadowingMemo | undefined,
      suffix: '' | ' (이어쓰기 중)' | ' (미완성)',
      pending: PendingChapterGeneration | undefined,
      chapterId = generateChapterId(),
    ) => {
      const expectedSignature = computeChapterSignature(workingNovel.chapters);
      let contextChanged = false;
      setIsCommittingChapter(true);
      const updated = await onMutateNovel(novel.id, (currentNovel) => {
        contextChanged = computeChapterSignature(currentNovel.chapters) !== expectedSignature;
        const chapterIndex = currentNovel.chapters.length;
        let withChapter: Novel = {
          ...currentNovel,
          chapters: [...currentNovel.chapters, {
            id: chapterId,
            title: `${chapterIndex + 1}화${suffix}`,
            content,
            trace: createChapterTrace('ai', {
              generationBatchId: log?.batchId ?? batchId,
              batchPosition: log?.batchChapterIndex ?? 1,
              batchSize: log?.batchChapterCount ?? totalChapters,
            }),
          }],
          generationLogs: appendGenerationLog(currentNovel.generationLogs, log),
          pendingChapterGeneration: pending,
        };
        withChapter = applyWritingFocusAfterChapterCommit(withChapter, suffix === '');
        const memoResult = applyMemo(withChapter, memo, chapterIndex);
        plantedTotal += memoResult.planted;
        recalledTotal += memoResult.recalled;
        return memoResult.novel;
      });
      setIsCommittingChapter(false);
      if (!updated) throw new Error('생성된 챕터를 저장할 작품을 찾지 못했습니다.');
      if (contextChanged) toast.warning('생성 중 원고가 변경되어 최신 원고 뒤에 결과를 추가했습니다. 내용을 확인해주세요.');
      workingNovel = updated;
      lastSavedNovel = updated;
      return chapterId;
    };

    const commitDraftContinuation = async (
      chapterId: string,
      content: string,
      log: GenerationLog | undefined,
      memo: AutoForeshadowingMemo | undefined,
      completed: boolean,
      pending: PendingChapterGeneration | undefined,
    ) => {
      setIsCommittingChapter(true);
      const updated = await onMutateNovel(novel.id, (currentNovel) => {
        const chapterIndex = currentNovel.chapters.findIndex((chapter) => chapter.id === chapterId);
        if (chapterIndex < 0) return currentNovel;
        const chapters = [...currentNovel.chapters];
        const currentChapter = chapters[chapterIndex];
        chapters[chapterIndex] = reviseChapter(currentChapter, {
          title: `${removeDraftSuffix(currentChapter.title)}${completed ? '' : ' (미완성)'}`,
          content: mergeChapterContinuation(currentChapter.content, content),
        });
        let withChapter: Novel = {
          ...currentNovel,
          chapters,
          generationLogs: appendGenerationLog(currentNovel.generationLogs, log),
          pendingChapterGeneration: pending,
        };
        withChapter = applyWritingFocusAfterChapterCommit(withChapter, completed);
        const memoResult = applyMemo(withChapter, memo, chapterIndex);
        plantedTotal += memoResult.planted;
        recalledTotal += memoResult.recalled;
        return memoResult.novel;
      });
      setIsCommittingChapter(false);
      if (!updated) throw new Error('이어 쓸 챕터를 찾지 못했습니다.');
      workingNovel = updated;
      lastSavedNovel = updated;
    };

    const pauseAtCurrentPosition = async (
      result: GenerationPassResult,
      chapterIndex: number,
      existingDraftId?: string,
    ) => {
      if (result.content.length > 50) {
        if (existingDraftId) {
          await commitDraftContinuation(
            existingDraftId,
            result.content,
            result.log,
            result.memo,
            false,
            makePending('paused', completedChapters, existingDraftId),
          );
        } else {
          const newDraftId = generateChapterId();
          draftChapterId = newDraftId;
          await commitNewChapter(
            result.content,
            result.log,
            result.memo,
            ' (미완성)',
            makePending('paused', completedChapters, newDraftId),
            newDraftId,
          );
        }
        toast.warning(`${chapterIndex}번째 집필이 중단되어 작성된 부분(${result.content.length.toLocaleString()}자)을 보존했습니다.`);
      } else {
        await persistPending(makePending('paused', completedChapters, existingDraftId));
      }
      setGenerationError({ message: result.error || '집필이 중단되었습니다.' });
      stoppedEarly = true;
    };

    try {
      await persistPending(makePending('running'));

      if (draftChapterId) {
        const draft = workingNovel.chapters.find((chapter) => chapter.id === draftChapterId);
        if (draft) {
          const sourceNovel = {
            ...workingNovel,
            chapters: workingNovel.chapters.filter((chapter) => chapter.id !== draftChapterId),
          };
          const result = await runPass(
            sourceNovel,
            buildChapterContinuationPrompt(draft.content, workingNovel.chapterTargetCharacters, draft.content.length),
            draft.content,
            completedChapters + 1,
            2,
            2,
          );
          if (result.status !== 'success') {
            await pauseAtCurrentPosition(result, completedChapters + 1, draftChapterId);
          } else {
            const completedDraftId = draftChapterId;
            completedChapters += 1;
            draftChapterId = undefined;
            const nextPending = completedChapters >= totalChapters
              ? undefined
              : makePending('running', completedChapters, undefined);
            await commitDraftContinuation(completedDraftId, result.content, result.log, result.memo, true, nextPending);
          }
        } else {
          draftChapterId = undefined;
          await persistPending(makePending('running', completedChapters, undefined));
        }
      }

      while (!stoppedEarly && completedChapters < totalChapters) {
        const chapterPosition = completedChapters + 1;
        const firstResult = await runPass(
          workingNovel,
          buildBatchChapterPrompt(basePrompt, chapterPosition, totalChapters),
          '',
          chapterPosition,
          1,
          mode === 'extended' ? 2 : 1,
        );
        if (firstResult.status !== 'success') {
          await pauseAtCurrentPosition(firstResult, chapterPosition);
          break;
        }

        const needsContinuation = mode === 'extended'
          && shouldRequestChapterContinuation(firstResult.content.length, workingNovel.chapterTargetCharacters);
        if (!needsContinuation) {
          completedChapters += 1;
          const nextPending = completedChapters >= totalChapters
            ? undefined
            : makePending('running', completedChapters, undefined);
          await commitNewChapter(firstResult.content, firstResult.log, firstResult.memo, '', nextPending);
          setStreamingContent('');
          continue;
        }

        const newDraftId = generateChapterId();
        draftChapterId = newDraftId;
        await commitNewChapter(
          firstResult.content,
          firstResult.log,
          firstResult.memo,
          ' (이어쓰기 중)',
          makePending('running', completedChapters, newDraftId),
          newDraftId,
        );

        const continuationSource = {
          ...workingNovel,
          chapters: workingNovel.chapters.filter((chapter) => chapter.id !== draftChapterId),
        };
        const continuationResult = await runPass(
          continuationSource,
          buildChapterContinuationPrompt(firstResult.content, workingNovel.chapterTargetCharacters, firstResult.content.length),
          firstResult.content,
          chapterPosition,
          2,
          2,
        );
        if (continuationResult.status !== 'success') {
          await pauseAtCurrentPosition(continuationResult, chapterPosition, draftChapterId);
          break;
        }

        completedChapters += 1;
        const nextPending = completedChapters >= totalChapters
          ? undefined
          : makePending('running', completedChapters, undefined);
        await commitDraftContinuation(
          draftChapterId,
          continuationResult.content,
          continuationResult.log,
          continuationResult.memo,
          true,
          nextPending,
        );
        draftChapterId = undefined;
        setStreamingContent('');
      }

      if (!stoppedEarly && completedChapters >= totalChapters) {
        await persistPending(undefined);
        toast.success(totalChapters > 1 ? `${totalChapters}화 연속 집필을 완료했습니다.` : '집필을 완료했습니다.');
      }

      const memoMessage = [
        plantedTotal > 0 ? `복선 ${plantedTotal}개 심음` : '',
        recalledTotal > 0 ? `${recalledTotal}개 회수` : '',
      ].filter(Boolean).join(', ');
      if (memoMessage) toast.info(`📝 ${memoMessage}`);
      if (lastSavedNovel) onGenerationSaved(lastSavedNovel);
    } catch (error) {
      await persistPending(makePending('paused', completedChapters, draftChapterId));
      setGenerationError({ message: (error as Error).message || '알 수 없는 오류가 발생했습니다.' });
      if (lastSavedNovel) onGenerationSaved(lastSavedNovel);
    } finally {
      generationLockRef.current = false;
      setIsCommittingChapter(false);
      setIsAutoLoading(false);
      setStreamingContent('');
      setGenerationProgress(null);
    }
  }, [authors, novel, onGenerationSaved, onMutateNovel, series]);

  return {
    isAutoLoading,
    isCommittingChapter,
    streamingContent,
    generationError,
    generationProgress,
    continueChapter,
  };
}
