import type { Novel, Series, SeriesMemoryBlock, SeriesMemoryState } from '@core/types';
import { getVolumeDisplayLabel, resolveSeriesVolume } from '@services/novel';
import { computeStableSignature } from './utils';

export interface SeriesMemoryInspection {
  current: Array<{
    novel: Novel;
    volumeId?: string;
    volumeLabel: string;
    sourceSignature: string;
    reusableBlock?: SeriesMemoryBlock;
  }>;
  staleNovelIds: string[];
  removedBlocks: SeriesMemoryBlock[];
  reusedCount: number;
}

function summarySource(novel: Novel): unknown {
  const summary = novel.contextSummary;
  if (!summary) return null;
  return {
    contentSignature: summary.contentSignature || '',
    summarizedChapters: summary.summarizedChapters,
    entries: summary.entries?.map((entry) => [
      entry.chapterId,
      entry.chapterNumber,
      entry.chapterTitle,
      entry.chapterSignature || '',
      entry.summary,
    ]) ?? [],
    content: summary.content,
  };
}

export function computeSeriesVolumeMemorySignature(novel: Novel, series?: Series): string {
  const volume = resolveSeriesVolume(series, novel);
  const volumeId = volume?.id || novel.seriesVolumeId || novel.seriesVolumePlanSnapshot?.sourceVolumeId || '';
  return computeStableSignature(JSON.stringify({
    novelId: novel.id,
    volumeId,
    summary: summarySource(novel),
  }));
}

export function getSeriesMemoryVolumeLabel(series: Series | undefined, novel: Novel, index = 0): string {
  const volume = resolveSeriesVolume(series, novel);
  if (volume) return getVolumeDisplayLabel(volume);
  if (novel.volumeNumber) return `${novel.volumeNumber}권`;
  if (novel.seriesVolumePlanSnapshot) return `권 미지정 (이전 ${novel.seriesVolumePlanSnapshot.displayLabel} 계획)`;
  return `권 미지정 ${index + 1}`;
}

export function orderSeriesNovels(series: Series | undefined, novels: Novel[]): Novel[] {
  const seriesOrder = new Map((series?.novelIds ?? []).map((id, index) => [id, index]));
  return [...novels].sort((a, b) => {
    const aVolume = resolveSeriesVolume(series, a)?.volumeNumber ?? a.volumeNumber;
    const bVolume = resolveSeriesVolume(series, b)?.volumeNumber ?? b.volumeNumber;
    if (aVolume != null && bVolume != null && aVolume !== bVolume) return aVolume - bVolume;
    if (aVolume != null) return -1;
    if (bVolume != null) return 1;
    return (seriesOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (seriesOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER);
  });
}

export function inspectSeriesMemoryState(series: Series, novels: Novel[]): SeriesMemoryInspection {
  const currentNovelIds = new Set(series.novelIds);
  const relevant = orderSeriesNovels(series, novels.filter((novel) => currentNovelIds.has(novel.id) && novel.contextSummary?.content));
  const blocks = series.seriesMemoryState?.blocks ?? [];
  const current = relevant.map((novel, index) => {
    const volume = resolveSeriesVolume(series, novel);
    const sourceSignature = computeSeriesVolumeMemorySignature(novel, series);
    const reusableBlock = blocks.find((block) => block.novelId === novel.id && block.sourceSignature === sourceSignature);
    return {
      novel,
      volumeId: volume?.id || novel.seriesVolumeId || novel.seriesVolumePlanSnapshot?.sourceVolumeId,
      volumeLabel: getSeriesMemoryVolumeLabel(series, novel, index),
      sourceSignature,
      reusableBlock,
    };
  });
  const relevantIds = new Set(relevant.map((novel) => novel.id));
  return {
    current,
    staleNovelIds: current.filter((item) => !item.reusableBlock).map((item) => item.novel.id),
    removedBlocks: blocks.filter((block) => !currentNovelIds.has(block.novelId) || !relevantIds.has(block.novelId)),
    reusedCount: current.filter((item) => !!item.reusableBlock).length,
  };
}

export function composeSeriesMemory(blocks: SeriesMemoryBlock[]): string {
  return blocks.map((block) => (
    `--- ${block.volumeLabel} (${block.novelTitle}) 연대기 ---\n${block.content.trim()}`
  )).join('\n\n');
}

export function createSeriesMemoryState(blocks: SeriesMemoryBlock[]): SeriesMemoryState {
  return {
    blocks,
    combinedSignature: computeStableSignature(JSON.stringify(blocks.map((block) => [
      block.novelId,
      block.volumeId || '',
      block.sourceSignature,
      block.content,
    ]))),
    generatedAt: Date.now(),
  };
}

/** Every referenced volume must pass the same source check used by the memory inspector. */
export function resolveSeriesMemoryForNovel(series: Series | undefined, novel: Novel, novels: Novel[] = [novel]): string {
  if (!series) return '';
  const state = series.seriesMemoryState;
  if (!state) return series.seriesMemoryCompendium?.trim() || '';
  const sources = [...novels.filter((item) => item.id !== novel.id), novel];
  const validBlocks = inspectSeriesMemoryState(series, sources).current.flatMap((item) => {
    if (!item.reusableBlock) return [];
    return [{
      ...item.reusableBlock,
      volumeLabel: item.volumeLabel,
      novelTitle: item.novel.title,
    }];
  });
  return composeSeriesMemory(validBlocks);
}
