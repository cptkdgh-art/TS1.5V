import type { CanonFact, Novel } from '@core/types';

export interface CanonFactState {
  fact: CanonFact;
  active: boolean;
  sourceChanged: boolean;
}

function chapterIndexById(novel: Novel): Map<string, number> {
  return new Map(novel.chapters.flatMap((chapter, index) => chapter.id ? [[chapter.id, index] as const] : []));
}

export function inspectCanonFacts(novel: Novel, targetIndex = novel.chapters.length): CanonFactState[] {
  const indexes = chapterIndexById(novel);
  const facts = novel.canonFacts ?? [];
  const baseStates = facts.map((fact) => {
    const source = fact.sourceChapterId
      ? novel.chapters[indexes.get(fact.sourceChapterId) ?? -1]
      : undefined;
    const sourceChanged = !!fact.sourceChapterId && (
      !source
      || (fact.sourceRevision !== undefined && (source.trace?.revision ?? 1) !== fact.sourceRevision)
    );
    const fromIndex = fact.validFromChapterId ? indexes.get(fact.validFromChapterId) : undefined;
    const untilIndex = fact.validUntilChapterId ? indexes.get(fact.validUntilChapterId) : undefined;
    const inRange = (fromIndex === undefined || targetIndex >= fromIndex)
      && (untilIndex === undefined || targetIndex < untilIndex);
    const active = fact.status === 'confirmed'
      && inRange
      && (!sourceChanged || (!!fact.locked && !!source));
    return { fact, active, sourceChanged };
  });
  const supersededIds = new Set(
    baseStates
      .filter((item) => item.active && item.fact.supersedesFactId)
      .map((item) => item.fact.supersedesFactId as string),
  );
  return baseStates.map((item) => ({
    ...item,
    active: item.active && !supersededIds.has(item.fact.id),
  }));
}

export function buildCanonBriefing(novel: Novel, maxChars = 4000): string {
  const lines = inspectCanonFacts(novel)
    .filter((item) => item.active)
    .sort((a, b) => Number(b.fact.locked) - Number(a.fact.locked) || b.fact.updatedAt - a.fact.updatedAt)
    .map(({ fact }) => `- ${fact.locked ? '[잠금] ' : ''}${fact.subject}: ${fact.value}`);
  if (lines.length === 0) return '';
  const text = `[현재 시점 확정 Canon]\n${lines.join('\n')}`;
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n[이하 Canon 생략]`;
}

export function reconcileCanonAfterChapterRemoval(
  facts: CanonFact[] | undefined,
  retainedChapterIds: Set<string>,
  now = Date.now(),
): CanonFact[] | undefined {
  if (!facts) return undefined;
  return facts.map((fact) => {
    const sourceLost = !!fact.sourceChapterId && !retainedChapterIds.has(fact.sourceChapterId);
    const fromLost = !!fact.validFromChapterId && !retainedChapterIds.has(fact.validFromChapterId);
    const untilLost = !!fact.validUntilChapterId && !retainedChapterIds.has(fact.validUntilChapterId);
    if (!sourceLost && !fromLost && !untilLost) return fact;
    return {
      ...fact,
      status: 'draft' as const,
      sourceChapterId: sourceLost ? undefined : fact.sourceChapterId,
      sourceRevision: sourceLost ? undefined : fact.sourceRevision,
      validFromChapterId: fromLost ? undefined : fact.validFromChapterId,
      validUntilChapterId: untilLost ? undefined : fact.validUntilChapterId,
      updatedAt: now,
    };
  });
}
