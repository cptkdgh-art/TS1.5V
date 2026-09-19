import { describe, expect, it } from 'vitest';
import type { Novel } from '@core/types';
import { computeSingleChapterSignature } from './summary';
import { inspectNovelMemory } from './memoryHealth';

function makeNovel(count: number): Novel {
  const chapters = Array.from({ length: count }, (_, index) => ({
    id: `ch-${index + 1}`,
    title: `${index + 1}화`,
    content: `본문 ${index + 1}`,
  }));
  return {
    id: 'novel-1', title: '테스트', subject: '', mood: '', plotSummary: '', chapters,
    history: [], createdAt: 1, aiAuthorId: null, characters: [],
    contextManagement: { isEnabled: true, fullTextChapters: 3, summaryTriggerChapters: 5 },
  };
}

describe('inspectNovelMemory', () => {
  it('과거 요약과 최근 원문을 합쳐 전 화 보호율을 계산한다', () => {
    const novel = makeNovel(8);
    const archived = novel.chapters.slice(0, 5);
    novel.contextSummary = {
      content: '요약', summarizedChapters: 5, createdAt: 1,
      coveredChapterIds: archived.map((chapter) => chapter.id!),
      entries: archived.map((chapter, index) => ({
        chapterId: chapter.id!, chapterNumber: index + 1, chapterTitle: chapter.title,
        summary: '요약', timestamp: 1, chapterSignature: computeSingleChapterSignature(chapter),
      })),
    };

    const report = inspectNovelMemory(novel);
    expect(report.coveragePercent).toBe(100);
    expect(report.archiveRangeLabel).toBe('1~5화 요약 완료');
    expect(report.recentRangeLabel).toBe('6~8화 원문');
    expect(report.status).toBe('healthy');
  });

  it('요약 이후 수정된 화는 재구축 대상으로 표시한다', () => {
    const novel = makeNovel(6);
    const chapter = novel.chapters[0];
    novel.contextSummary = {
      content: '요약', summarizedChapters: 1, createdAt: 1,
      coveredChapterIds: [chapter.id!],
      entries: [{
        chapterId: chapter.id!, chapterNumber: 1, chapterTitle: chapter.title,
        summary: '요약', timestamp: 1, chapterSignature: computeSingleChapterSignature(chapter),
      }],
    };
    novel.chapters[0] = { ...chapter, content: '수정된 본문' };

    const report = inspectNovelMemory(novel);
    expect(report.status).toBe('rebuild');
    expect(report.staleEntryCount).toBe(1);
    expect(report.coveragePercent).toBe(100);
    expect(report.recentRangeLabel).toBe('1~6화 원문');
  });

  it('요약 주기를 기다리는 화는 원문 구간에 포함해 기억 공백을 만들지 않는다', () => {
    const novel = makeNovel(8);
    const chapter = novel.chapters[0];
    novel.contextSummary = {
      content: '1화 요약', summarizedChapters: 1, createdAt: 1,
      coveredChapterIds: [chapter.id!],
      contentSignature: undefined,
      entries: [{
        chapterId: chapter.id!, chapterNumber: 1, chapterTitle: chapter.title,
        summary: '요약', timestamp: 1, chapterSignature: computeSingleChapterSignature(chapter),
      }],
    };

    const report = inspectNovelMemory(novel);
    expect(report.validArchiveCount).toBe(1);
    expect(report.recentRawCount).toBe(7);
    expect(report.recentRangeLabel).toBe('2~8화 원문');
    expect(report.pendingArchiveRangeLabel).toBe('2~5화 요약 대기 원문');
    expect(report.latestRawRangeLabel).toBe('6~8화 최근 원문 유지');
    expect(report.nextAutoSyncChapter).toBe(9);
    expect(report.nextSaveWillTrigger).toBe(true);
    expect(report.coveragePercent).toBe(100);
  });
});
