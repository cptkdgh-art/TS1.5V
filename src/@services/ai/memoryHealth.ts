import type { Novel } from '@core/types';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import { getAutoSummarySchedule, matchesSingleChapterSignature } from './summary';

export type MemoryHealthStatus = 'disabled' | 'empty' | 'healthy' | 'update' | 'rebuild';

export interface MemoryHealthReport {
  status: MemoryHealthStatus;
  totalChapters: number;
  archiveTargetCount: number;
  validArchiveCount: number;
  recentRawCount: number;
  missingSummaryCount: number;
  pendingSummaryCount: number;
  staleEntryCount: number;
  deletedEntryCount: number;
  protectedChapterCount: number;
  coveragePercent: number;
  nextAutoSyncIn: number;
  nextAutoSyncChapter: number | null;
  nextSaveWillTrigger: boolean;
  nextSummaryRangeLabel: string;
  activeCacheCount: number;
  expiredCacheCount: number;
  cachedTokenCount: number;
  archiveRangeLabel: string;
  recentRangeLabel: string;
  pendingArchiveRangeLabel: string;
  latestRawRangeLabel: string;
}

export function inspectNovelMemory(novel: Novel, now = Date.now()): MemoryHealthReport {
  const totalChapters = novel.chapters.length;
  const fullTextChapters = Math.min(totalChapters, FIXED_RECENT_RAW_CHAPTERS);
  const archiveTargetCount = Math.max(0, totalChapters - fullTextChapters);
  const archiveChapters = novel.chapters.slice(0, archiveTargetCount);
  const coveredIds = new Set(novel.contextSummary?.coveredChapterIds || []);
  const entries = novel.contextSummary?.entries || [];

  const staleIds = new Set<string>();
  let deletedEntryCount = 0;
  for (const entry of entries) {
    const currentChapter = novel.chapters.find((chapter) => chapter.id === entry.chapterId);
    if (!currentChapter) {
      deletedEntryCount += 1;
      continue;
    }
    if (entry.chapterSignature && !matchesSingleChapterSignature(entry.chapterSignature, currentChapter)) {
      staleIds.add(entry.chapterId);
    }
  }

  const validArchiveCount = archiveChapters.filter((chapter) =>
    !!chapter.id && coveredIds.has(chapter.id) && !staleIds.has(chapter.id)
  ).length;
  const missingArchiveNumbers = archiveChapters
    .map((chapter, index) => ({ chapter, number: index + 1 }))
    .filter(({ chapter }) => !chapter.id || !coveredIds.has(chapter.id) || staleIds.has(chapter.id))
    .map(({ number }) => number);
  const missingSummaryCount = Math.max(0, archiveTargetCount - validArchiveCount);
  const needsRebuild = !!(
    novel.contextSummary?.needsRecheck
    || staleIds.size > 0
    || deletedEntryCount > 0
    || (novel.contextSummary?.content && coveredIds.size === 0)
  );
  const safeSummaryCount = needsRebuild ? 0 : validArchiveCount;
  // 요약 갱신 전의 미반영 화도 원문으로 전달하므로 실제 원문 구간은 요약 완료 지점 다음부터다.
  const recentRawCount = totalChapters - safeSummaryCount;
  const protectedChapterCount = novel.contextManagement?.isEnabled
    ? totalChapters
    : Math.min(totalChapters, validArchiveCount + Math.min(totalChapters, fullTextChapters));
  const coveragePercent = totalChapters === 0 ? 100 : Math.round((protectedChapterCount / totalChapters) * 100);
  const schedule = getAutoSummarySchedule(novel);
  const nextAutoSyncIn = schedule.chaptersUntilNextRun ?? 0;

  let activeCacheCount = 0;
  let expiredCacheCount = 0;
  let cachedTokenCount = 0;
  for (const cache of Object.values(novel.contextCaching?.caches || {})) {
    if (new Date(cache.expireTime).getTime() > now) {
      activeCacheCount += 1;
      cachedTokenCount += cache.cachedTokenCount;
    } else {
      expiredCacheCount += 1;
    }
  }

  let status: MemoryHealthStatus = 'healthy';
  if (!novel.contextManagement?.isEnabled) status = 'disabled';
  else if (totalChapters === 0) status = 'empty';
  else if (needsRebuild) status = 'rebuild';
  else if (missingSummaryCount > 0) status = 'update';

  return {
    status,
    totalChapters,
    archiveTargetCount,
    validArchiveCount,
    recentRawCount,
    missingSummaryCount,
    pendingSummaryCount: schedule.pendingCount,
    staleEntryCount: staleIds.size,
    deletedEntryCount,
    protectedChapterCount,
    coveragePercent,
    nextAutoSyncIn,
    nextAutoSyncChapter: schedule.nextRunAtChapter,
    nextSaveWillTrigger: schedule.nextSaveWillTrigger,
    nextSummaryRangeLabel: schedule.nextSummaryStartChapter !== null
      && schedule.nextSummaryEndChapter !== null
      ? `${schedule.nextSummaryStartChapter}~${schedule.nextSummaryEndChapter}화 요약 예정`
      : '자동 요약 꺼짐',
    activeCacheCount,
    expiredCacheCount,
    cachedTokenCount,
    archiveRangeLabel: safeSummaryCount > 0
      ? `1~${safeSummaryCount}화 요약 완료`
      : archiveTargetCount > 0 ? `1~${archiveTargetCount}화 요약 대기` : '요약 대상 없음',
    recentRangeLabel: totalChapters > 0
      ? `${safeSummaryCount + 1}~${totalChapters}화 원문`
      : '원고 없음',
    pendingArchiveRangeLabel: missingSummaryCount > 0
      ? `${missingArchiveNumbers[0]}~${missingArchiveNumbers[missingArchiveNumbers.length - 1]}화 요약 대기 원문`
      : '요약 대기 원문 없음',
    latestRawRangeLabel: totalChapters > archiveTargetCount
      ? `${archiveTargetCount + 1}~${totalChapters}화 최근 원문 유지`
      : '최근 원문 없음',
  };
}
