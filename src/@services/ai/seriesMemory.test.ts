import { describe, expect, it, vi } from 'vitest';
import type { Novel, Series, SeriesMemoryBlock } from '@core/types';
import { useNovelStore } from '@stores/novelStore';
import { buildWriterStableInstruction, buildWriterSystemInstruction } from './prompts';
import {
  computeSeriesVolumeMemorySignature,
  createSeriesMemoryState,
  inspectSeriesMemoryState,
  resolveSeriesMemoryForNovel,
} from './seriesMemory';

const novel = (id: string, summary: string, volumeId: string): Novel => ({
  id,
  title: id,
  subject: '',
  mood: '',
  plotSummary: '',
  chapters: [],
  history: [],
  createdAt: 1,
  aiAuthorId: null,
  characters: [],
  seriesId: 'series-1',
  seriesVolumeId: volumeId,
  contextSummary: {
    content: summary,
    summarizedChapters: 1,
    createdAt: 1,
    entries: [{ chapterId: `${id}-ch`, chapterNumber: 1, chapterTitle: '1화', summary, timestamp: 1 }],
  },
});

const baseSeries = (novels: Novel[], blocks: SeriesMemoryBlock[] = []): Series => ({
  id: 'series-1',
  title: '시리즈',
  seriesPlotSummary: '',
  characters: [],
  novelIds: novels.map((item) => item.id),
  createdAt: 1,
  blueprint: {
    worldview: '',
    mainConflict: '',
    characterArcs: '',
    lastUpdated: 1,
    volumes: novels.map((item, index) => ({
      id: item.seriesVolumeId,
      volumeNumber: index + 1,
      title: item.title,
      goal: '',
      mainConflict: '',
      keyEvents: '',
      status: 'drafting',
      linkedNovelId: item.id,
    })),
  },
  seriesMemoryState: createSeriesMemoryState(blocks),
});

const blockFor = (item: Novel, series: Series, content = '권 기억'): SeriesMemoryBlock => ({
  novelId: item.id,
  volumeId: item.seriesVolumeId,
  volumeLabel: `${item.volumeNumber ?? 1}권`,
  novelTitle: item.title,
  sourceSignature: computeSeriesVolumeMemorySignature(item, series),
  content,
  generatedAt: 1,
});

describe('series memory signatures', () => {
  it('reuses an unchanged volume and marks only the edited volume stale', () => {
    const first = novel('n1', '첫 요약', 'v1');
    const second = novel('n2', '둘째 요약', 'v2');
    const shell = baseSeries([first, second]);
    const series = baseSeries([first, second], [blockFor(first, shell), blockFor(second, shell)]);
    const edited = novel('n2', '수정된 둘째 요약', 'v2');
    const inspection = inspectSeriesMemoryState(series, [first, edited]);
    expect(inspection.reusedCount).toBe(1);
    expect(inspection.staleNovelIds).toEqual(['n2']);
  });

  it('drops a deleted volume block without invalidating surviving volumes', () => {
    const first = novel('n1', '첫 요약', 'v1');
    const removed = novel('n2', '둘째 요약', 'v2');
    const shell = baseSeries([first, removed]);
    const survivorOnly = baseSeries([first], [blockFor(first, shell), blockFor(removed, shell)]);
    const inspection = inspectSeriesMemoryState(survivorOnly, [first]);
    expect(inspection.reusedCount).toBe(1);
    expect(inspection.removedBlocks.map((item) => item.novelId)).toEqual(['n2']);
  });

  it('reuses blocks after volume reordering but invalidates a work remapped to another volume ID', () => {
    const first = novel('n1', '첫 요약', 'v1');
    const second = novel('n2', '둘째 요약', 'v2');
    const shell = baseSeries([first, second]);
    const series = baseSeries([first, second], [blockFor(first, shell), blockFor(second, shell)]);
    const reordered: Series = {
      ...series,
      novelIds: ['n2', 'n1'],
      blueprint: series.blueprint ? {
        ...series.blueprint,
        volumes: series.blueprint.volumes.map((volume) => ({
          ...volume,
          volumeNumber: volume.id === 'v1' ? 2 : 1,
        })),
      } : undefined,
    };
    expect(inspectSeriesMemoryState(reordered, [first, second]).reusedCount).toBe(2);

    const remappedFirst = { ...first, seriesVolumeId: 'v2' };
    const remappedSeries: Series = {
      ...reordered,
      blueprint: reordered.blueprint ? {
        ...reordered.blueprint,
        volumes: reordered.blueprint.volumes.map((volume) => ({
          ...volume,
          linkedNovelId: volume.id === 'v2' ? 'n1' : undefined,
        })),
      } : undefined,
    };
    const remappedInspection = inspectSeriesMemoryState(remappedSeries, [remappedFirst, second]);
    expect(remappedInspection.staleNovelIds).toContain('n1');
  });

  it('does not inject a stale current-volume block', () => {
    const first = novel('n1', '첫 요약', 'v1');
    const second = novel('n2', '둘째 요약', 'v2');
    const shell = baseSeries([first, second]);
    const series = baseSeries([first, second], [
      blockFor(first, shell, '첫 권 확정 기억'),
      blockFor(second, shell, '둘째 권 낡은 기억'),
    ]);
    const editedSecond = novel('n2', '수정된 둘째 요약', 'v2');
    const resolved = resolveSeriesMemoryForNovel(series, editedSecond, [first, editedSecond]);
    expect(resolved).toContain('첫 권 확정 기억');
    expect(resolved).not.toContain('둘째 권 낡은 기억');
  });

  it('requires a current source for every other volume and retains valid ones', () => {
    const first = novel('n1', 'First', 'v1');
    const second = novel('n2', 'Second', 'v2');
    const third = novel('n3', 'Third', 'v3');
    const shell = baseSeries([first, second, third]);
    const series = baseSeries([first, second, third], [
      blockFor(first, shell, 'OLD_FIRST'),
      blockFor(second, shell, 'VALID_SECOND'),
    ]);
    const editedFirst = novel('n1', 'Edited', 'v1');
    expect(resolveSeriesMemoryForNovel(series, third, [editedFirst, second, third])).toContain('VALID_SECOND');
    expect(resolveSeriesMemoryForNovel(series, third, [editedFirst, second, third])).not.toContain('OLD_FIRST');
    expect(resolveSeriesMemoryForNovel(series, third, [third])).toBe('');
    expect(resolveSeriesMemoryForNovel(series, third)).toBe('');
  });

  it('does not resurrect the legacy compendium after all signed blocks have been removed', () => {
    const first = novel('n1', 'First', 'v1');
    const series = { ...baseSeries([first]), seriesMemoryCompendium: 'REMOVED_HISTORY' };
    expect(resolveSeriesMemoryForNovel(series, first, [first])).toBe('');
    expect(resolveSeriesMemoryForNovel({ ...series, seriesMemoryState: undefined }, first)).toBe('REMOVED_HISTORY');
  });

  it('filters stale other-volume history in both live and cached writer instructions', () => {
    const first = novel('n1', 'First', 'v1');
    const second = novel('n2', 'Second', 'v2');
    const shell = baseSeries([first, second]);
    const series = baseSeries([first, second], [
      blockFor(first, shell, 'OUTDATED_VOLUME_HISTORY'),
      blockFor(second, shell, 'VALID_VOLUME_HISTORY'),
    ]);
    const currentNovels = [novel('n1', 'User corrected first volume', 'v1'), second];
    const store = vi.spyOn(useNovelStore, 'getState').mockReturnValue({ ...useNovelStore.getState(), novels: currentNovels });
    try {
      for (const build of [buildWriterSystemInstruction, buildWriterStableInstruction]) {
        const prompt = build(null, second, series, {});
        expect(prompt).not.toContain('OUTDATED_VOLUME_HISTORY');
        expect(prompt).toContain('VALID_VOLUME_HISTORY');
      }
    } finally {
      store.mockRestore();
    }
  });
});
