import { describe, expect, it } from 'vitest';
import type { ContextSummary, SummaryEntry } from '@core/types';
import { attachSummaryRollups, resolveHierarchicalSummary } from './summaryHierarchy';

const entries = (count: number): SummaryEntry[] => Array.from({ length: count }, (_, index) => ({
  chapterId: `ch-${index + 1}`,
  chapterNumber: index + 1,
  chapterTitle: `${index + 1}화`,
  summary: `${index + 1}화에서 일어난 핵심 사건과 인물 상태 변화 `.repeat(12),
  timestamp: 1,
  chapterSignature: `sig-${index + 1}`,
}));

const makeSummary = (count: number): ContextSummary => ({
  content: entries(count).map((entry) => `[${entry.chapterNumber}화] ${entry.summary}`).join('\n\n'),
  summarizedChapters: count,
  createdAt: 1,
  entries: entries(count),
});

describe('summary hierarchy', () => {
  it('keeps short works on the original chapter summaries', () => {
    const summary = attachSummaryRollups(makeSummary(20));
    expect(summary.rollups).toEqual([]);
    expect(resolveHierarchicalSummary(summary)).toBe(summary.content.trim());
  });

  it('creates derived episode and volume rollups while preserving every source entry', () => {
    const summary = attachSummaryRollups(makeSummary(60));
    expect(summary.entries).toHaveLength(60);
    expect(summary.rollups?.filter((item) => item.level === 'episode')).toHaveLength(6);
    expect(summary.rollups?.filter((item) => item.level === 'volume')).toHaveLength(1);
    expect(resolveHierarchicalSummary(summary).length).toBeLessThan(summary.content.length);
    expect(resolveHierarchicalSummary(summary)).toContain('[최근 화별 기억]');
  });

  it('rebuilds only the rollup whose source summary changed', () => {
    const first = attachSummaryRollups(makeSummary(40));
    const changed: ContextSummary = {
      ...first,
      entries: first.entries?.map((entry) => entry.chapterId === 'ch-15' ? { ...entry, summary: '수정된 사건' } : entry),
    };
    const second = attachSummaryRollups(changed);
    const firstIds = first.rollups?.filter((item) => item.level === 'episode').map((item) => item.id);
    const secondIds = second.rollups?.filter((item) => item.level === 'episode').map((item) => item.id);
    expect(secondIds?.[0]).toBe(firstIds?.[0]);
    expect(secondIds?.[1]).not.toBe(firstIds?.[1]);
    expect(secondIds?.[2]).toBe(firstIds?.[2]);
  });

  it('rebuilds persisted truncated rollups at read time without changing source entries', () => {
    const summary = attachSummaryRollups(makeSummary(70));
    const originals = structuredClone(summary.entries);
    summary.rollups = summary.rollups?.map((rollup) => ({ ...rollup, content: 'OLD_TRUNCATED' }));
    const resolved = resolveHierarchicalSummary(summary);
    expect(resolved).not.toContain('OLD_TRUNCATED');
    for (let number = 1; number <= 70; number++) {
      expect(resolved).toContain(`${number}화에서 일어난`);
    }
    expect(summary.entries).toEqual(originals);
    expect(resolved.length).toBeLessThan(summary.content.length);
  });

  it('rebuilds the affected rollup when chapter numbering changes after deletion', () => {
    const first = attachSummaryRollups(makeSummary(40));
    const renumbered: ContextSummary = {
      ...first,
      entries: first.entries?.map((entry) => entry.chapterId === 'ch-25'
        ? { ...entry, chapterNumber: 24, chapterTitle: '24화' }
        : entry),
    };
    const second = attachSummaryRollups(renumbered);
    const firstEpisodes = first.rollups?.filter((item) => item.level === 'episode');
    const secondEpisodes = second.rollups?.filter((item) => item.level === 'episode');
    expect(secondEpisodes?.[0].id).toBe(firstEpisodes?.[0].id);
    expect(secondEpisodes?.[2].id).not.toBe(firstEpisodes?.[2].id);
  });
});
