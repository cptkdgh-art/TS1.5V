import type {
  ContextSummary,
  Foreshadowing,
  ForeshadowingSystem,
  Novel,
  Snapshot,
} from '@core/types';
import { computeChapterSignature } from '@services/ai/utils';
import { attachSummaryRollups } from '@services/ai/summaryHierarchy';
import { mergeEntriesToText } from '@services/ai/summary';
import { updatePacingGuide } from '@services/ai/foreshadowing';
import { reconcileCanonAfterChapterRemoval } from './canonLedger';

export type ChapterRemovalMode = 'rollback' | 'delete';

const AUTO_RECOVERY_LIMIT = 5;

function createRecoverySnapshot(
  novel: Novel,
  targetIndex: number,
  mode: ChapterRemovalMode,
  now: number,
): Snapshot {
  const { snapshots: _snapshots, ...novelData } = structuredClone(novel);
  const target = novel.chapters[targetIndex];
  const targetNumber = target?.chapterNumber ?? targetIndex + 1;
  const operationLabel = mode === 'rollback' ? '되돌리기' : '삭제';

  return {
    id: `auto-recovery-${now}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    description: `자동 복구 · ${targetNumber}화 ${operationLabel} 전 (${novel.chapters.length}화 상태)`,
    novelData,
    kind: 'auto-recovery',
    recoveryMeta: {
      operation: mode,
      targetChapterId: target?.id,
      targetChapterNumber: targetNumber,
      chapterCountBefore: novel.chapters.length,
    },
  };
}

function appendRecoverySnapshot(existing: Snapshot[], recovery: Snapshot): Snapshot[] {
  const autoRecovery = existing.filter((snapshot) => snapshot.kind === 'auto-recovery');
  const removeCount = Math.max(0, autoRecovery.length - AUTO_RECOVERY_LIMIT + 1);
  const removeIds = new Set(autoRecovery.slice(0, removeCount).map((snapshot) => snapshot.id));
  return [...existing.filter((snapshot) => !removeIds.has(snapshot.id)), recovery];
}

function reconcileSummary(
  summary: ContextSummary | undefined,
  chapters: Novel['chapters'],
  removedChapterIds: string[],
  mode: ChapterRemovalMode,
  targetIndex: number,
  now: number,
): ContextSummary | undefined {
  if (!summary) return undefined;

  const chapterById = new Map(chapters.map((chapter, index) => [chapter.id, { chapter, index }]));
  const oldCoveredIds = summary.coveredChapterIds || [];
  const coveredSet = new Set(oldCoveredIds);
  const deleteCutsSummary = mode === 'delete' && removedChapterIds.some((id) => coveredSet.has(id));
  const retainedCoveredIds = chapters
    .map((chapter, index) => ({ id: chapter.id, index }))
    .filter(({ id, index }) => !!id && coveredSet.has(id) && (!deleteCutsSummary || index < targetIndex))
    .map(({ id }) => id as string);
  const wasStructured = !!summary.entries?.length;

  if (!wasStructured) {
    const affected = removedChapterIds.some((id) => coveredSet.has(id));
    return {
      ...summary,
      coveredChapterIds: retainedCoveredIds,
      summarizedChapters: Math.min(summary.summarizedChapters, retainedCoveredIds.length || chapters.length),
      needsRecheck: summary.needsRecheck || affected,
      createdAt: now,
    };
  }

  const entries = (summary.entries || [])
    .filter((entry) => {
      const current = chapterById.get(entry.chapterId);
      return !!current && (!deleteCutsSummary || current.index < targetIndex);
    })
    .map((entry) => {
      const current = chapterById.get(entry.chapterId)!;
      return {
        ...entry,
        chapterNumber: current.chapter.chapterNumber ?? current.index + 1,
        chapterTitle: current.chapter.title,
      };
    })
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  if (entries.length === 0 && retainedCoveredIds.length === 0) return undefined;

  const retainedEntryIds = new Set(entries.map((entry) => entry.chapterId));
  const coveredChapters = retainedCoveredIds
    .map((id) => chapterById.get(id)?.chapter)
    .filter((chapter): chapter is Novel['chapters'][number] => !!chapter);
  const milestone = {
    id: `milestone-${now}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    type: 'chapter_deleted' as const,
    description: mode === 'rollback'
      ? `회차 되돌리기: ${removedChapterIds.length}화 정리`
      : '회차 단일 삭제: 1화 정리',
    affectedChapterIds: removedChapterIds,
  };

  return attachSummaryRollups({
    ...summary,
    content: mergeEntriesToText(entries),
    entries,
    coveredChapterIds: retainedCoveredIds,
    summarizedChapters: retainedCoveredIds.length,
    contentSignature: computeChapterSignature(coveredChapters),
    milestones: [...(summary.milestones || []), milestone].slice(-20),
    needsRecheck: summary.needsRecheck
      || deleteCutsSummary
      || retainedCoveredIds.some((id) => !retainedEntryIds.has(id)),
    createdAt: now,
  });
}

function translateChapterIndex(
  chapterIndex: number,
  targetIndex: number,
  mode: ChapterRemovalMode,
): number | null {
  if (mode === 'rollback') return chapterIndex >= targetIndex ? null : chapterIndex;
  if (chapterIndex === targetIndex) return null;
  return chapterIndex > targetIndex ? chapterIndex - 1 : chapterIndex;
}

function reconcileForeshadowingItem(
  item: Foreshadowing,
  targetIndex: number,
  mode: ChapterRemovalMode,
): Foreshadowing | null {
  const plantedIndex = translateChapterIndex(item.plantedAt.chapterIndex, targetIndex, mode);
  if (plantedIndex === null) return null;

  const hints = item.hints.flatMap((hint) => {
    const chapterIndex = translateChapterIndex(hint.chapterIndex, targetIndex, mode);
    return chapterIndex === null ? [] : [{ ...hint, chapterIndex }];
  });
  const payoffIndex = item.payoff
    ? translateChapterIndex(item.payoff.chapterIndex, targetIndex, mode)
    : null;
  const payoff = item.payoff && payoffIndex !== null
    ? { ...item.payoff, chapterIndex: payoffIndex }
    : undefined;
  const lostPayoff = !!item.payoff && !payoff;

  return {
    ...item,
    plantedAt: { ...item.plantedAt, chapterIndex: plantedIndex },
    hints,
    payoff,
    status: lostPayoff && item.status === 'fully_paid'
      ? hints.length > 0 ? 'hinted' : 'planted'
      : item.status,
  };
}

function reconcileForeshadowing(
  system: ForeshadowingSystem | undefined,
  targetIndex: number,
  mode: ChapterRemovalMode,
): ForeshadowingSystem | undefined {
  if (!system) return undefined;
  const shiftedItems = system.items
    .map((item) => reconcileForeshadowingItem(item, targetIndex, mode))
    .filter((item): item is Foreshadowing => !!item);
  const retainedIds = new Set(shiftedItems.map((item) => item.id));
  const items = shiftedItems.map((item) => ({
    ...item,
    linkedForeshadowingIds: item.linkedForeshadowingIds.filter((id) => retainedIds.has(id)),
  }));
  const reconciled = { ...system, items, coherenceCheck: undefined };
  return { ...reconciled, pacingGuide: updatePacingGuide(reconciled) };
}

/**
 * 파괴적 회차 작업을 한 번의 Novel 변경으로 준비한다.
 * 표시 순서가 아닌 고유 chapterId를 정리 기준으로 사용한다.
 */
export function prepareChapterRemoval(
  novel: Novel,
  targetChapterId: string,
  fallbackIndex: number,
  mode: ChapterRemovalMode,
  now = Date.now(),
): Novel {
  const matchedIndex = novel.chapters.findIndex((chapter) => chapter.id === targetChapterId);
  const targetIndex = matchedIndex >= 0 ? matchedIndex : fallbackIndex;
  if (targetIndex < 0 || targetIndex >= novel.chapters.length) return novel;

  const removedChapters = mode === 'rollback'
    ? novel.chapters.slice(targetIndex)
    : [novel.chapters[targetIndex]];
  const removedChapterIds = removedChapters
    .map((chapter) => chapter.id)
    .filter((id): id is string => !!id);
  const chapters = mode === 'rollback'
    ? novel.chapters.slice(0, targetIndex)
    : novel.chapters.filter((_, index) => index !== targetIndex);
  const recovery = createRecoverySnapshot(novel, targetIndex, mode, now);
  const retainedChapterIds = new Set(chapters.flatMap((chapter) => chapter.id ? [chapter.id] : []));

  return {
    ...novel,
    chapters,
    history: [],
    snapshots: appendRecoverySnapshot(novel.snapshots || [], recovery),
    contextSummary: reconcileSummary(
      novel.contextSummary,
      chapters,
      removedChapterIds,
      mode,
      targetIndex,
      now,
    ),
    contextCaching: novel.contextCaching
      ? { ...novel.contextCaching, caches: {} }
      : novel.contextCaching,
    foreshadowingSystem: reconcileForeshadowing(novel.foreshadowingSystem, targetIndex, mode),
    canonFacts: reconcileCanonAfterChapterRemoval(novel.canonFacts, retainedChapterIds, now),
  };
}
