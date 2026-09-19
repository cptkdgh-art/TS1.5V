/**
 * ============================================================
 * @module stores/novelStore
 * @file novelStore.ts
 * ============================================================
 * @description 소설 상태 관리 (Zustand)
 * ============================================================
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Novel, Chapter } from '@core/types';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import { getRaw, getWorkspaceStorageKey, getActiveWorkspaceId, setRaw, migrateFromLocalStorage } from '@services/storage';
import { subscribeWorkspaceChanges, withWorkspaceWrite } from '@services/storage/workspaceCoordination';
import { reviseChapter } from '@services/novel/chapterIdentity';
import { prepareChapterRemoval } from '@services/novel/chapterRecovery';
import { STORAGE_KEYS } from '@services/storage';
import { computeChapterSignature, ensureChapterIds, matchesChapterSignature } from '@services/ai/utils';
import { MODELS, normalizeGeminiTextModel } from '@services/ai/config';
import {
  DEFAULT_CHAPTER_TARGET_CHARACTERS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  normalizeChapterGenerationMode,
  normalizeChapterTargetCharacters,
  normalizeMaxOutputTokens,
} from '@services/ai/generationPolicy';
import { logger } from '@shared/utils/logger';

function mutatePersistedNovels<T>(
  fallback: Novel[],
  mutation: (latest: Novel[]) => { novels: Novel[]; result: T },
  expectedGeneration?: string,
): Promise<{ novels: Novel[]; result: T }> {
  const workspaceId = getActiveWorkspaceId();
  return withWorkspaceWrite(workspaceId, async () => {
      const key = getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.NOVELS);
      const latest = await getRaw<Novel[]>(key) ?? fallback;
      const outcome = mutation(latest);
      await setRaw(key, outcome.novels);
      return outcome;
    }, { expectedGeneration });
}

function withCurrentGenerationEngine(novel: Novel): Novel {
  if (!novel.generationEngine) {
    return { ...novel, generationEngine: MODELS.TEXT };
  }
  if (!novel.generationEngine.startsWith('gemini-')) {
    return novel;
  }

  const generationEngine = normalizeGeminiTextModel(novel.generationEngine);
  return generationEngine === novel.generationEngine
    ? novel
    : { ...novel, generationEngine };
}

function withFixedWritingMemory(novel: Novel): Novel {
  const shouldNormalizeContext = !!novel.contextManagement
    && novel.contextManagement.fullTextChapters !== FIXED_RECENT_RAW_CHAPTERS;
  const shouldNormalizeCache = !!novel.contextCaching
    && novel.contextCaching.activeBufferWindow !== FIXED_RECENT_RAW_CHAPTERS;
  if (!shouldNormalizeContext && !shouldNormalizeCache) return novel;

  return {
    ...novel,
    ...(novel.contextManagement ? {
      contextManagement: {
        ...novel.contextManagement,
        fullTextChapters: FIXED_RECENT_RAW_CHAPTERS,
      },
    } : {}),
    ...(novel.contextCaching ? {
      contextCaching: {
        ...novel.contextCaching,
        activeBufferWindow: FIXED_RECENT_RAW_CHAPTERS,
      },
    } : {}),
    ...(shouldNormalizeContext && novel.contextSummary ? {
      contextSummary: { ...novel.contextSummary, needsRecheck: true },
    } : {}),
  };
}

function withCurrentGenerationSettings(novel: Novel): Novel {
  const engineNormalized = withFixedWritingMemory(withCurrentGenerationEngine(novel));
  const targetedGenerationEnabled = engineNormalized.targetedGenerationEnabled !== false;
  const chapterTargetCharacters = normalizeChapterTargetCharacters(
    engineNormalized.chapterTargetCharacters ?? DEFAULT_CHAPTER_TARGET_CHARACTERS
  );
  const maxTokens = normalizeMaxOutputTokens(
    engineNormalized.generationEngine,
    engineNormalized.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
  );
  const chapterGenerationMode = normalizeChapterGenerationMode(engineNormalized.chapterGenerationMode);
  if (engineNormalized.targetedGenerationEnabled === targetedGenerationEnabled
    && engineNormalized.chapterTargetCharacters === chapterTargetCharacters
    && engineNormalized.chapterGenerationMode === chapterGenerationMode
    && engineNormalized.maxTokens === maxTokens) {
    return engineNormalized;
  }
  return { ...engineNormalized, targetedGenerationEnabled, chapterGenerationMode, chapterTargetCharacters, maxTokens };
}

interface NovelState {
  novels: Novel[];
  selectedNovelId: string | null;
  isLoading: boolean;

  // Actions
  loadNovels: () => Promise<void>;
  addNovel: (novel: Novel) => Promise<void>;
  updateNovel: (id: string, updates: Partial<Novel>) => Promise<void>;
  mutateNovel: (id: string, updater: (current: Novel) => Novel, expectedGeneration?: string) => Promise<Novel | undefined>;
  deleteNovel: (id: string) => Promise<void>;
  selectNovel: (id: string | null) => void;
  getNovelById: (id: string) => Novel | undefined;

  // Chapter Actions
  addChapter: (novelId: string, chapter: Chapter) => Promise<Novel>;
  updateChapter: (novelId: string, chapterId: string | number, updates: Partial<Chapter>, expectedRevision?: number) => Promise<Novel>;
  deleteChapter: (novelId: string, chapterId: string | number, expectedRevision?: number) => Promise<void>;
}

export const useNovelStore = create<NovelState>((setState, getState) => ({
  novels: [],
  selectedNovelId: null,
  isLoading: true,

  loadNovels: async () => {
    try {
      await migrateFromLocalStorage(STORAGE_KEYS.NOVELS);
      const workspaceId = getActiveWorkspaceId();
      await withWorkspaceWrite(workspaceId, async () => {
      const key = getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.NOVELS);
      const novels = await getRaw<Novel[]>(key);
      if (!novels) {
        setState({ novels: [], isLoading: false });
        return;
      }

      // 마이그레이션: 기존 챕터에 ID가 없으면 자동 부여
      let needsSave = false;
      const migratedNovels = novels.map((novel) => {
        const { chapters, changed } = ensureChapterIds(novel.chapters);
        let migratedNovel = changed ? { ...novel, chapters } : novel;
        const modelNormalizedNovel = withCurrentGenerationSettings(migratedNovel);
        if (modelNormalizedNovel !== migratedNovel) {
          migratedNovel = modelNormalizedNovel;
          needsSave = true;
        }

        const summary = migratedNovel.contextSummary;
        if (summary?.contentSignature && !summary.contentSignature.startsWith('v2:')) {
          const coveredIds = new Set(summary.coveredChapterIds || []);
          const coveredChapters = coveredIds.size > 0
            ? chapters.filter((chapter) => chapter.id && coveredIds.has(chapter.id))
            : chapters.slice(0, summary.summarizedChapters);

          if (matchesChapterSignature(summary.contentSignature, coveredChapters)) {
            migratedNovel = {
              ...migratedNovel,
              contextSummary: {
                ...summary,
                contentSignature: computeChapterSignature(coveredChapters),
              },
            };
            needsSave = true;
          }
        }

        if (changed) {
          needsSave = true;
        }
        return migratedNovel;
      });

      if (needsSave) {
        await setRaw(key, migratedNovels);
        logger.log('[NovelStore] 작품 데이터 마이그레이션 완료');
      }

      setState({ novels: migratedNovels, isLoading: false });
      }, { refresh: true });
    } catch (error) {
      console.error('[NovelStore] 로드 실패:', error);
      setState({ isLoading: false });
    }
  },

  addNovel: async (novel) => {
    const identified = ensureChapterIds(novel.chapters);
    const normalizedNovel = withCurrentGenerationSettings({ ...novel, chapters: identified.chapters });
    const outcome = await mutatePersistedNovels(getState().novels, (latest) => ({
      novels: [...latest, normalizedNovel],
      result: undefined,
    }));
    setState({ novels: outcome.novels });
  },

  updateNovel: async (id, updates) => {
    const outcome = await mutatePersistedNovels(getState().novels, (latest) => ({
      novels: latest.map((novel) => novel.id === id ? { ...novel, ...updates, id } : novel),
      result: undefined,
    }));
    setState({ novels: outcome.novels });
  },

  mutateNovel: async (id, updater, expectedGeneration) => {
    const outcome = await mutatePersistedNovels(getState().novels, (latest) => {
      let updatedNovel: Novel | undefined;
      const novels = latest.map((novel) => {
        if (novel.id !== id) return novel;
        const candidate = updater(novel);
        updatedNovel = candidate.id === id ? candidate : { ...candidate, id };
        return updatedNovel;
      });
      return { novels, result: updatedNovel };
    }, expectedGeneration);
    setState({ novels: outcome.novels });
    return outcome.result;
  },

  deleteNovel: async (id) => {
    const { novels, selectedNovelId } = getState();
    const outcome = await mutatePersistedNovels(novels, (latest) => ({
      novels: latest.filter((novel) => novel.id !== id),
      result: undefined,
    }));
    setState({
      novels: outcome.novels,
      selectedNovelId: selectedNovelId === id ? null : selectedNovelId,
    });
  },

  selectNovel: (id) => {
    setState({ selectedNovelId: id });
  },

  getNovelById: (id) => {
    return getState().novels.find((n) => n.id === id);
  },

  addChapter: async (novelId, chapter) => {
    const identified = ensureChapterIds([chapter]).chapters[0];
    const updated = await getState().mutateNovel(novelId, (novel) => {
      if (novel.chapters.some((item) => item.id === identified.id)) throw new Error('이미 존재하는 회차 ID예요.');
      return { ...novel, chapters: [...novel.chapters, identified] };
    });
    if (!updated) throw new Error('작품을 찾지 못했어요.');
    return updated;
  },

  updateChapter: async (novelId, target, updates, expectedRevision) => {
    const captured = getState().getNovelById(novelId)?.chapters;
    const chapterId = typeof target === 'string' ? target : captured?.[target]?.id;
    if (!chapterId) throw new Error('수정할 회차 ID를 찾지 못했어요.');
    const expected = expectedRevision ?? captured?.find((item) => item.id === chapterId)?.trace?.revision;
    const updated = await getState().mutateNovel(novelId, (novel) => {
      const chapters = [...novel.chapters];
      const index = chapters.findIndex((item) => item.id === chapterId);
      if (index < 0) throw new Error('수정할 회차가 삭제되었어요.');
      if (expected !== undefined && (chapters[index].trace?.revision ?? 1) !== expected) throw new Error('회차가 변경되었어요. 최신 원고를 다시 확인해 주세요.');
      const chapter = ensureChapterIds([chapters[index]]).chapters[0];
      const { id: _id, trace: _trace, ...fields } = updates;
      chapters[index] = { ...chapter, ...fields, ...reviseChapter(chapter, fields), id: chapterId };
      const contentChanged = chapter.content !== chapters[index].content;
      return {
        ...novel, chapters,
        ...(contentChanged ? {
          history: [], lorekeeperCache: undefined,
          contextCaching: novel.contextCaching ? { ...novel.contextCaching, caches: {} } : undefined,
          contextSummary: novel.contextSummary ? { ...novel.contextSummary, needsRecheck: true } : undefined,
        } : {}),
      };
    });
    if (!updated) throw new Error('작품을 찾지 못했어요.');
    return updated;
  },

  deleteChapter: async (novelId, target, expectedRevision) => {
    const captured = getState().getNovelById(novelId)?.chapters;
    const chapterId = typeof target === 'string' ? target : captured?.[target]?.id;
    if (!chapterId) throw new Error('삭제할 회차 ID를 찾지 못했어요.');
    const expected = expectedRevision ?? captured?.find((item) => item.id === chapterId)?.trace?.revision;
    const updated = await getState().mutateNovel(novelId, (novel) => {
      const chapter = novel.chapters.find((item) => item.id === chapterId);
      if (!chapter) throw new Error('삭제할 회차가 이미 없어졌어요.');
      if (expected !== undefined && (chapter.trace?.revision ?? 1) !== expected) throw new Error('회차가 변경되었어요. 최신 원고를 다시 확인해 주세요.');
      return prepareChapterRemoval(novel, chapterId, -1, 'delete');
    });
    if (!updated) throw new Error('작품을 찾지 못했어요.');
  },
}));

subscribeWorkspaceChanges(({ workspaceId, kind }) => {
  if (workspaceId !== getActiveWorkspaceId() || kind !== 'updated') return;
  void withWorkspaceWrite(workspaceId, async () => {
    const novels = await getRaw<Novel[]>(getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.NOVELS)) ?? [];
    useNovelStore.setState({ novels });
  }).catch(() => undefined);
});

// ============================================================
// Selectors - 성능 최적화를 위한 선택적 구독
// ============================================================

/** 전체 소설 목록만 구독 */
export const useNovels = () => useNovelStore((state) => state.novels);

/** 선택된 소설 ID만 구독 */
export const useSelectedNovelId = () => useNovelStore((state) => state.selectedNovelId);

/** 로딩 상태만 구독 */
export const useNovelLoading = () => useNovelStore((state) => state.isLoading);

/** 선택된 소설 객체 구독 */
export const useSelectedNovel = () =>
  useNovelStore((state) =>
    state.selectedNovelId
      ? state.novels.find(n => n.id === state.selectedNovelId)
      : undefined
  );

/** 시리즈에 속하지 않은 독립 소설들만 구독 */
export const useStandaloneNovels = () =>
  useNovelStore((state) => state.novels.filter(n => !n.seriesId));

/** 특정 시리즈의 소설들만 구독 */
export const useSeriesNovels = (seriesId: string) =>
  useNovelStore((state) => state.novels.filter(n => n.seriesId === seriesId));

/** Actions만 구독 (상태 변경 없이 함수만 사용) */
export const useNovelActions = () =>
  useNovelStore(
    useShallow((state) => ({
      loadNovels: state.loadNovels,
      addNovel: state.addNovel,
      updateNovel: state.updateNovel,
      mutateNovel: state.mutateNovel,
      deleteNovel: state.deleteNovel,
      selectNovel: state.selectNovel,
      getNovelById: state.getNovelById,
      addChapter: state.addChapter,
      updateChapter: state.updateChapter,
      deleteChapter: state.deleteChapter,
    }))
  );
