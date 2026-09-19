import { describe, expect, it } from 'vitest';
import type { Novel, Series, VolumeBlueprint } from '@core/types';
import {
  bindNovelToSeriesVolume,
  clearNovelSeriesVolume,
  ensureSeriesVolumeIds,
  reconcileSeriesVolumeBindings,
} from './seriesVolume';

function makeNovel(id: string, volumeNumber?: number): Novel {
  return {
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
    volumeNumber,
  };
}

function makeVolume(id: string | undefined, volumeNumber: number, linkedNovelId?: string): VolumeBlueprint {
  return {
    id,
    volumeNumber,
    displayLabel: `${volumeNumber}권`,
    title: `${volumeNumber}권 계획`,
    goal: `${volumeNumber}권 목표`,
    mainConflict: `${volumeNumber}권 갈등`,
    keyEvents: `${volumeNumber}권 사건`,
    status: 'planned',
    linkedNovelId,
  };
}

function makeSeries(volumes: VolumeBlueprint[]): Series {
  return {
    id: 'series-1',
    title: '장편 시리즈',
    seriesPlotSummary: '',
    characters: [],
    novelIds: ['novel-1', 'novel-2', 'duplicate-1'],
    createdAt: 1,
    blueprint: {
      worldview: '',
      mainConflict: '',
      characterArcs: '',
      volumes,
      lastUpdated: 1,
    },
  };
}

describe('stable series volume mapping', () => {
  it('기존 번호 기반 데이터에 권 ID를 만들고 같은 번호의 작품을 자동 연결한다', () => {
    const series = makeSeries([makeVolume(undefined, 1), makeVolume(undefined, 2)]);
    const novels = [makeNovel('novel-1', 1), makeNovel('novel-2', 2)];

    const result = reconcileSeriesVolumeBindings(series, novels);

    expect(result.series.blueprint?.volumes.every((volume) => volume.id)).toBe(true);
    expect(result.novels[0].seriesVolumeId).toBe(result.series.blueprint?.volumes[0].id);
    expect(result.novels[1].seriesVolumeId).toBe(result.series.blueprint?.volumes[1].id);
  });

  it('권 번호를 서로 교환해도 작품은 번호가 아니라 청사진 ID를 따라간다', () => {
    const novel1 = { ...makeNovel('novel-1', 1), seriesVolumeId: 'volume-a' };
    const novel2 = { ...makeNovel('novel-2', 3), seriesVolumeId: 'volume-b' };
    const series = makeSeries([
      makeVolume('volume-a', 3, novel1.id),
      makeVolume('volume-b', 1, novel2.id),
    ]);

    const result = reconcileSeriesVolumeBindings(series, [novel1, novel2]);

    expect(result.novels.find((novel) => novel.id === novel1.id)).toMatchObject({
      seriesVolumeId: 'volume-a',
      volumeNumber: 3,
    });
    expect(result.novels.find((novel) => novel.id === novel2.id)).toMatchObject({
      seriesVolumeId: 'volume-b',
      volumeNumber: 1,
    });
  });

  it('연결된 권 계획이 삭제되면 원고를 남기고 마지막 계획 스냅샷을 유지한다', () => {
    const originalSeries = makeSeries([makeVolume('volume-a', 1, 'novel-1')]);
    const bound = bindNovelToSeriesVolume(originalSeries, makeNovel('novel-1'), 'volume-a');
    const seriesWithoutPlan = makeSeries([]);

    const result = reconcileSeriesVolumeBindings(seriesWithoutPlan, [bound.novel]);
    const novel = result.novels[0];

    expect(novel.id).toBe('novel-1');
    expect(novel.seriesId).toBe('series-1');
    expect(novel.seriesVolumeId).toBeUndefined();
    expect(novel.volumeNumber).toBeUndefined();
    expect(novel.seriesVolumePlanSnapshot).toMatchObject({
      sourceVolumeId: 'volume-a',
      goal: '1권 목표',
    });
  });

  it('복제본을 원하는 빈 권에 연결하고 다시 미지정으로 돌릴 수 있다', () => {
    const series = ensureSeriesVolumeIds(makeSeries([
      makeVolume('volume-a', 1, 'novel-1'),
      makeVolume('volume-b', 2),
    ]));
    const duplicate = makeNovel('duplicate-1');

    const bound = bindNovelToSeriesVolume(series, duplicate, 'volume-b');
    expect(bound.novel).toMatchObject({
      id: 'duplicate-1',
      seriesId: 'series-1',
      seriesVolumeId: 'volume-b',
      volumeNumber: 2,
    });
    expect(bound.series.blueprint?.volumes[1].linkedNovelId).toBe('duplicate-1');

    const cleared = clearNovelSeriesVolume(bound.series, bound.novel);
    expect(cleared.novel.seriesVolumeId).toBeUndefined();
    expect(cleared.novel.seriesVolumePlanSnapshot?.sourceVolumeId).toBe('volume-b');
    expect(cleared.series.blueprint?.volumes[1].linkedNovelId).toBeUndefined();
  });
});
