import { describe, expect, it } from 'vitest';
import type { Novel } from '@core/types';
import { calculateCost, calculateUsageCost, estimateNovelContextCost } from './costEstimator';

function makeNovel(chapterLengths: number[]): Novel {
  return {
    id: 'n1',
    title: '비용 테스트',
    subject: '장편 판타지',
    mood: '긴장감',
    plotSummary: '거대한 제국과 몰락한 기사단의 이야기',
    chapters: chapterLengths.map((length, index) => ({
      id: `ch-${index + 1}`,
      title: `${index + 1}화`,
      content: '가'.repeat(length),
    })),
    history: [],
    createdAt: Date.now(),
    aiAuthorId: null,
    characters: [],
    contextManagement: {
      isEnabled: true,
      fullTextChapters: 3,
      summaryTriggerChapters: 5,
    },
    contextSummary: {
      content: '요약 '.repeat(500),
      summarizedChapters: 7,
      createdAt: Date.now(),
    },
  };
}

describe('estimateNovelContextCost', () => {
  it('Gemini 3.8 Flash 2026년 프로모션 입출력 단가를 적용한다', () => {
    const duringPromotion = Date.UTC(2026, 11, 31);
    expect(calculateCost('gemini-3.8-flash', 1_000_000, 1_000_000, duringPromotion)).toBe(4.5 * 1450);
  });

  it('Gemini 3.8 Flash 프로모션 종료 뒤 표준 단가로 전환한다', () => {
    const afterPromotion = Date.UTC(2027, 0, 1);
    expect(calculateCost('gemini-3.8-flash', 1_000_000, 1_000_000, afterPromotion)).toBe(9 * 1450);
  });

  it('캐시 적중 토큰에는 할인 단가를 적용하고 절감액을 분리한다', () => {
    const duringPromotion = Date.UTC(2026, 11, 31);
    const usage = calculateUsageCost('gemini-3.8-flash', 10_000, 2_000, 8_000, duringPromotion);
    const withoutCache = calculateCost('gemini-3.8-flash', 10_000, 2_000, duringPromotion);

    expect(usage.costKRW).toBeLessThan(withoutCache);
    expect(usage.costKRW + usage.cacheSavingsKRW).toBeCloseTo(withoutCache, 8);
  });

  it('예전 옵션이 달라도 고정 원문 계약의 비용을 같게 추정한다', () => {
    const novel = makeNovel([4000, 4000, 4000, 4000, 4000]);

    const wide = estimateNovelContextCost(novel, 'gemini-3-flash-preview', { fullTextChapters: 3 });
    const tight = estimateNovelContextCost(novel, 'gemini-3-flash-preview', { fullTextChapters: 1 });

    expect(wide.parts.recentRawTokens).toBe(tight.parts.recentRawTokens);
    expect(wide.inputTokens).toBe(tight.inputTokens);
  });

  it('세계관과 지시문이 커지면 호출용으로 압축하고 경고한다', () => {
    const novel = {
      ...makeNovel([1000, 1000, 1000]),
      worldviewFiles: [
        { filename: 'world.md', content: '세계관'.repeat(18000) },
      ],
      writingDirectives: [
        { role: 'user' as const, parts: [{ text: '지시문'.repeat(18000) }] },
      ],
    };

    const estimate = estimateNovelContextCost(novel, 'gemini-3.6-flash');

    expect(estimate.parts.systemTokens).toBeLessThan(12000);
    expect(estimate.warnings).toContain('세계관/지시문 일부가 호출용으로 압축됩니다. 원본은 앱 데이터에 유지됩니다.');
  });

  it('대형 세계관은 기록보관자의 회차별 로컬 선별분을 비용에 포함한다', () => {
    const base = makeNovel([1000]);
    const large = {
      ...base,
      worldviewFiles: [{ filename: '대형 세계관.md', content: '세계관'.repeat(6000) }],
    };

    const baseEstimate = estimateNovelContextCost(base, 'gemini-3.8-flash');
    const largeEstimate = estimateNovelContextCost(large, 'gemini-3.8-flash');

    expect(largeEstimate.parts.briefingTokens).toBeGreaterThan(baseEstimate.parts.briefingTokens);
    expect(largeEstimate.parts.systemTokens).toBeGreaterThan(baseEstimate.parts.systemTokens);
  });

  it('요약이 없는 긴 작품은 맥락 약화 경고를 표시한다', () => {
    const novel = {
      ...makeNovel([1000, 1000, 1000, 1000, 1000]),
      contextSummary: undefined,
    };

    const estimate = estimateNovelContextCost(novel, 'gemini-3-flash-preview', { fullTextChapters: 2 });

    expect(estimate.warnings).toContain('요약본이 없어 긴 작품에서 최근 원문 밖 맥락이 약해질 수 있습니다.');
  });

  it('요약 완료 지점 이후의 갱신 대기 챕터도 원문 비용에 포함한다', () => {
    const novel = makeNovel([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]);
    novel.contextSummary = {
      content: '1화 요약', summarizedChapters: 1, createdAt: 1,
      coveredChapterIds: ['ch-1'],
    };

    const estimate = estimateNovelContextCost(novel, 'gemini-3-flash-preview');
    expect(estimate.parts.recentRawTokens).toBeGreaterThanOrEqual(1750);
  });

  it('에피소드 아크가 없어도 집중 모드 목표를 입력 비용에 포함한다', () => {
    const base = makeNovel([1000]);
    const focused = {
      ...base,
      episodePacing: { isEnabled: true, goal: '두 사람의 협상이 결렬되는 과정을 쓴다.'.repeat(30), speed: 'slow' as const },
    };

    const baseEstimate = estimateNovelContextCost(base, 'gemini-3.8-flash');
    const focusedEstimate = estimateNovelContextCost(focused, 'gemini-3.8-flash');

    expect(focusedEstimate.parts.systemTokens).toBeGreaterThan(baseEstimate.parts.systemTokens);
  });
});
