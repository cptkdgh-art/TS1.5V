import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Novel } from '@core/types';
import * as aiConfig from './config';
import { computeChapterSignature } from './utils';
import {
  autoUpdateSummary,
  buildSummaryChunks,
  computeSingleChapterSignature,
  computeSummarySourceSignature,
  getAutoSummarySchedule,
  refreshSummaryRange,
  shouldAutoSummarize,
} from './summary';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeNovel(chapterCount: number, summaryTriggerChapters = 5, coveredCount = 0): Novel {
  const chapters = Array.from({ length: chapterCount }, (_, index) => ({
    id: `ch-${index + 1}`,
    title: `${index + 1}화`,
    content: `본문 ${index + 1}`.repeat(20),
  }));

  return {
    id: 'novel-1',
    title: '테스트',
    subject: '테스트',
    mood: '테스트',
    plotSummary: '테스트 줄거리',
    chapters,
    history: [],
    createdAt: Date.now(),
    aiAuthorId: null,
    characters: [],
    contextManagement: {
      isEnabled: true,
      fullTextChapters: 2,
      summaryTriggerChapters,
    },
    contextSummary: coveredCount > 0 ? {
      content: '기존 요약',
      summarizedChapters: coveredCount,
      createdAt: Date.now(),
      coveredChapterIds: chapters.slice(0, coveredCount).map((chapter) => chapter.id!),
    } : undefined,
  };
}

describe('summary trigger policy', () => {
  it('작품별 자동 요약 주기 설정을 따른다', () => {
    expect(shouldAutoSummarize(makeNovel(6, 5, 2))).toBe(false);
    expect(shouldAutoSummarize(makeNovel(7, 2, 2))).toBe(true);
  });

  it('문맥 관리가 꺼져 있으면 요약하지 않는다', () => {
    const novel = makeNovel(10, 1, 0);
    novel.contextManagement = { ...novel.contextManagement!, isEnabled: false };

    expect(shouldAutoSummarize(novel)).toBe(false);
  });

  it('첫 요약도 설정한 누적 주기까지 기다린다', () => {
    expect(shouldAutoSummarize(makeNovel(6, 5, 0))).toBe(false);
    expect(shouldAutoSummarize(makeNovel(8, 5, 0))).toBe(true);
  });

  it('요약 대기 중인 과거 화가 하나뿐이면 불필요한 단건 호출을 하지 않는다', () => {
    expect(shouldAutoSummarize(makeNovel(3, 5, 0))).toBe(false);
  });

  it('다음 저장 턴과 다음 요약 범위를 계산한다', () => {
    const waiting = getAutoSummarySchedule(makeNovel(5, 5, 0));
    expect(waiting.pendingCount).toBe(2);
    expect(waiting.nextRunAtChapter).toBe(8);
    expect(waiting.nextSaveWillTrigger).toBe(false);
    expect(waiting.nextSummaryStartChapter).toBe(1);
    expect(waiting.nextSummaryEndChapter).toBe(5);

    const nextTurn = getAutoSummarySchedule(makeNovel(7, 5, 0));
    expect(nextTurn.nextSaveWillTrigger).toBe(true);
    expect(nextTurn.chaptersUntilNextRun).toBe(1);
  });
});

describe('summary source signature', () => {
  it('요약 실행 중 챕터가 추가되면 결과 적용 대상을 다르게 본다', () => {
    const before = makeNovel(6, 2, 2);
    const after = { ...before, chapters: [...before.chapters, { id: 'ch-7', title: '7화', content: '새 원고' }] };

    expect(computeSummarySourceSignature(before)).not.toBe(computeSummarySourceSignature(after));
  });
});

describe('incremental summary repair', () => {
  it('삭제된 화는 AI 전체 재생성 없이 기존 화별 요약을 이어맞춘다', async () => {
    const novel = makeNovel(6, 5, 4);
    novel.contextSummary = {
      ...novel.contextSummary!,
      entries: novel.chapters.slice(0, 4).map((chapter, index) => ({
        chapterId: chapter.id!,
        chapterNumber: index + 1,
        chapterTitle: chapter.title,
        summary: `${index + 1}화 요약`,
        timestamp: 1,
        chapterSignature: computeSingleChapterSignature(chapter),
      })),
    };
    novel.chapters.splice(3, 1);

    const result = await autoUpdateSummary(novel);

    expect(result.mode).toBe('reconciled');
    expect(result.newEntriesCount).toBe(0);
    expect(result.contextSummary.entries?.map((entry) => entry.chapterId))
      .toEqual(['ch-1', 'ch-2']);
    expect(result.contextSummary.milestones?.slice(-1)[0]?.description)
      .toContain('필요한 화만 보수');
  });
});

describe('adaptive summary chunks', () => {
  it('화수가 적어도 원문량이 크면 여러 요청으로 나눈다', () => {
    const novel = makeNovel(3);
    novel.chapters = novel.chapters.map((chapter) => ({ ...chapter, content: '가'.repeat(30_000) }));

    const chunks = buildSummaryChunks(novel.chapters, 1, 10, 60_000);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.startNumber)).toEqual([1, 2, 3]);
  });

  it('일반 원고는 최대 화수 단위로 묶는다', () => {
    const novel = makeNovel(12);
    const chunks = buildSummaryChunks(novel.chapters, 4, 10, 60_000);

    expect(chunks.map((chunk) => chunk.chapters.length)).toEqual([10, 2]);
    expect(chunks.map((chunk) => chunk.startNumber)).toEqual([4, 14]);
  });
});

describe('manual summary refresh', () => {
  it('선택 구간만 다시 만들고 앞쪽의 빈 기억은 함께 채워 연속 체크포인트를 유지한다', async () => {
    const novel = makeNovel(6, 5, 0);
    novel.contextSummary = {
      content: '[1화] 기존 1화\n\n[2화] 기존 2화',
      summarizedChapters: 2,
      createdAt: 1,
      coveredChapterIds: ['ch-1', 'ch-2'],
      contentSignature: computeChapterSignature(novel.chapters.slice(0, 2)),
      entries: novel.chapters.slice(0, 2).map((chapter, index) => ({
        chapterId: chapter.id!,
        chapterNumber: index + 1,
        chapterTitle: chapter.title,
        summary: `기존 ${index + 1}화`,
        timestamp: 1,
        chapterSignature: computeSingleChapterSignature(chapter),
      })),
    };
    vi.spyOn(aiConfig, 'generateContent').mockResolvedValue('[3화] 새 3화\n\n[4화] 공백을 채운 4화');

    const result = await refreshSummaryRange(novel, 2, 2);

    expect(result.refreshedCount).toBe(1);
    expect(result.filledGapCount).toBe(0);
    expect(result.contextSummary.coveredChapterIds).toEqual(['ch-1', 'ch-2', 'ch-3']);
    expect(result.contextSummary.entries?.map((entry) => entry.summary))
      .toEqual(['기존 1화', '기존 2화', '새 3화']);
    expect(result.contextSummary.contentSignature)
      .toBe(computeChapterSignature(novel.chapters.slice(0, 3)));
  });
});
