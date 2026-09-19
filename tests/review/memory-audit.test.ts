import { beforeEach, expect, it, vi } from 'vitest';
import type { Novel, Series } from '@core/types';
import * as summary from '@services/ai/summary';
import * as hierarchy from '@services/ai/summaryHierarchy';
import * as memory from '@services/ai/seriesMemory';
import { computeChapterSignature } from '@services/ai/utils';
import { buildWritingContext } from '@services/ai/writingContext';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), novels: [] as Novel[] }));
vi.mock('@services/ai/config', () => ({
  generateContent: mocks.generate, getAiTaskModel: () => 'mock',
  getSummaryTriggerChapters: (n: number) => n,
}));
vi.mock('@services/ai/prompts', () => ({ PLOT_ARCHIVIST_INSTRUCTION: '' }));
vi.mock('@services/novel', async () => ({
  ...await import('@services/novel/seriesVolume'),
  ...await import('@services/novel/canonLedger'),
}));
vi.mock('@stores/novelStore', () => ({
  useNovelStore: { getState: () => ({ novels: mocks.novels }) },
}));

beforeEach(() => {
  mocks.generate.mockReset();
  mocks.novels = [];
});

function fixture(id: string, count: number, covered: number): Novel {
  const chapters = Array.from({ length: count }, (_, i) => ({
    id: `${id}-${i + 1}`, title: `Chapter ${i + 1}`, content: `RAW_${i + 1}`,
  }));
  const entries = chapters.slice(0, covered).map((ch, i) => ({
    chapterId: ch.id, chapterNumber: i + 1, chapterTitle: ch.title,
    chapterSignature: summary.computeSingleChapterSignature(ch), timestamp: 1,
    summary: `<EVENT_${i + 1}> ${'x'.repeat(260)}`,
  }));
  return {
    id, title: id, subject: '', mood: '', plotSummary: '', chapters,
    history: [], characters: [], createdAt: 1, aiAuthorId: null, seriesId: 's',
    contextManagement: { isEnabled: true, fullTextChapters: 3, summaryTriggerChapters: 5 },
    contextSummary: hierarchy.attachSummaryRollups({
      content: summary.mergeEntriesToText(entries), entries, createdAt: 1,
      summarizedChapters: covered, coveredChapterIds: entries.map(e => e.chapterId),
      contentSignature: computeChapterSignature(chapters.slice(0, covered)),
    }),
  };
}

it('excludes another volume history after its source summary changes', () => {
  const a = fixture('a', 8, 5), b = fixture('b', 8, 5);
  const series = {
    id: 's', title: 's', novelIds: ['a', 'b'], characters: [], createdAt: 1,
    seriesPlotSummary: '',
  } as Series;
  series.seriesMemoryState = memory.createSeriesMemoryState([{
    novelId: a.id, volumeLabel: '1', novelTitle: a.title, generatedAt: 1,
    sourceSignature: memory.computeSeriesVolumeMemorySignature(a, series),
    content: 'OLD_A_HISTORY',
  }]);
  a.contextSummary = summary.editSummaryEntry(a.contextSummary!, 'a-1', 'CORRECTED');
  mocks.novels = [a, b];
  expect(memory.inspectSeriesMemoryState(series, mocks.novels).staleNovelIds).toContain('a');
  expect(memory.resolveSeriesMemoryForNovel(series, b, mocks.novels)).not.toContain('OLD_A_HISTORY');
  expect(buildWritingContext(b, null, series).series?.memoryCompendium).not.toContain('OLD_A_HISTORY');
});

it('retains an event from every chapter claimed by a volume rollup', () => {
  const novel = fixture('long', 73, 70);
  const context = buildWritingContext(novel, null, null);
  const resolved = context.storyMemory.summary;
  expect(context.storyMemory.status).toBe('valid');
  expect(context.storyMemory.rawChapterStart).toBe(71);
  const missing = Array.from({ length: 70 }, (_, i) => i + 1)
    .filter((n) => !resolved.includes(`<EVENT_${n}>`));
  expect(missing).toEqual([]);
});

it('preserves manual summary edits made during an incremental request', async () => {
  let release!: (text: string) => void;
  mocks.generate.mockImplementationOnce(() => new Promise<string>(r => { release = r; }));
  const before = fixture('async', 9, 5);
  const pending = summary.autoUpdateSummary(before);
  const current = { ...before, contextSummary:
    summary.editSummaryEntry(before.contextSummary!, 'async-1', 'USER_CORRECTION') };
  release('[6화] Sixth chapter summary');
  const result = await pending;
  const committed = summary.mergeSummaryResult(current, result);
  expect(committed?.content).toContain('USER_CORRECTION');
  expect(committed?.content).toContain('Sixth chapter summary');
  expect(committed?.entries).toHaveLength(6);
  expect(mocks.generate).toHaveBeenCalledTimes(1);
});

it.each(['automatic', 'manual'] as const)('merges %s refreshes without overwriting edited target entries', async (mode) => {
  let release!: (text: string) => void;
  mocks.generate.mockImplementationOnce(() => new Promise<string>(resolve => { release = resolve; }));
  const before = fixture('refresh', 9, 6);
  const originals = structuredClone(before.contextSummary!.entries);
  const pending = mode === 'automatic'
    ? summary.autoUpdateSummary(before, { force: true })
    : summary.refreshSummaryRange(before, 0, 1);
  const current = { ...before, contextSummary:
    summary.editSummaryEntry(before.contextSummary!, 'refresh-1', 'USER_TARGET_EDIT') };
  release(Array.from({ length: mode === 'automatic' ? 6 : 2 }, (_, index) => `[${index + 1}화] NEW_${index + 1}`).join('\n\n'));
  const result = await pending;
  const merged = summary.mergeSummaryResult(current, result)!;
  expect(merged.entries?.[0].summary).toBe('USER_TARGET_EDIT');
  expect(merged.entries?.[1].summary).toBe('NEW_2');
  expect(merged.entries).toHaveLength(6);
  expect(merged.milestones).toEqual(expect.arrayContaining(current.contextSummary.milestones!));
  expect(before.contextSummary!.entries).toEqual(originals);
  expect(mocks.generate).toHaveBeenCalledTimes(1);
});

it('preserves a concurrently deleted entry and leaves the gap in raw manuscript coverage', async () => {
  let release!: (text: string) => void;
  mocks.generate.mockImplementationOnce(() => new Promise<string>(resolve => { release = resolve; }));
  const before = fixture('delete', 9, 5);
  const pending = summary.autoUpdateSummary(before);
  const current = { ...before, contextSummary: summary.deleteSummaryEntry(before.contextSummary!, 'delete-2') };
  release('[6화] NEW_6');
  const merged = summary.mergeSummaryResult(current, await pending)!;
  expect(merged.entries?.map((entry) => entry.chapterId)).not.toContain('delete-2');
  expect(merged.content).toContain('NEW_6');
  expect(merged.needsRecheck).toBe(true);
  const context = buildWritingContext({ ...current, contextSummary: merged }, null, null);
  expect(context.storyMemory.rawChapterStart).toBe(2);
  expect(mocks.generate).toHaveBeenCalledTimes(1);
});

it.each(['automatic', 'manual'] as const)('rejects %s results after source manuscript edits or summary removal', async (mode) => {
  let release!: (text: string) => void;
  mocks.generate.mockImplementationOnce(() => new Promise<string>(resolve => { release = resolve; }));
  const before = fixture('source', 9, 5);
  const pending = mode === 'automatic'
    ? summary.autoUpdateSummary(before)
    : summary.refreshSummaryRange(before, 5, 5);
  const edited = { ...before, chapters: before.chapters.map((chapter, index) => index === 0
    ? { ...chapter, content: 'EDIT_1' } : chapter) };
  release('[6화] NEW_6');
  const result = await pending;
  expect(summary.mergeSummaryResult(edited, result)).toBeUndefined();
  expect(summary.mergeSummaryResult({ ...before, contextSummary: undefined }, result)).toBeUndefined();
  expect(summary.mergeSummaryResult({ ...before, contextSummary: {
    ...before.contextSummary!, content: 'USER_FREE_TEXT',
  } }, result)).toBeUndefined();
  expect(mocks.generate).toHaveBeenCalledTimes(1);
});

it('distinguishes memory-only changes from manuscript changes without timestamp dependence', () => {
  const before = fixture('signature', 8, 5);
  const edited = { ...before, contextSummary: { ...before.contextSummary!, entries:
    before.contextSummary!.entries!.map((entry, index) => index === 0 ? { ...entry, summary: 'MANUAL' } : entry) } };
  expect(summary.computeSummarySourceSignature(edited)).not.toBe(summary.computeSummarySourceSignature(before));
  expect(summary.computeSummaryManuscriptSignature(edited)).toBe(summary.computeSummaryManuscriptSignature(before));
});

it('upgrades old rollup content locally without calling AI or replacing the original chapter entries', async () => {
  const before = fixture('upgrade', 73, 70);
  const originalEntries = structuredClone(before.contextSummary!.entries);
  before.contextSummary!.rollups = before.contextSummary!.rollups!.map((rollup) => ({ ...rollup, content: 'TRUNCATED' }));
  const result = await summary.autoUpdateSummary(before);
  expect(result.mode).toBe('hierarchy_built');
  expect(result.updated).toBe(true);
  const committed = summary.mergeSummaryResult(before, result)!;
  expect(committed.entries).toEqual(originalEntries);
  expect(committed.rollups?.some((rollup) => rollup.content.includes('TRUNCATED'))).toBe(false);
  expect(mocks.generate).not.toHaveBeenCalled();
});
