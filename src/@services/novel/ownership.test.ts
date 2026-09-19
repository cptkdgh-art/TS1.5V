import { describe, expect, it } from 'vitest';
import type { Novel, Series, Snapshot } from '@core/types';
import {
  detachNovelFromSeries,
  removeNovelReferencesFromSeries,
  restoreSnapshotForNovel,
} from './ownership';

function makeNovel(id = 'novel-current'): Novel {
  return {
    id,
    title: '현재 작품',
    subject: '',
    mood: '',
    plotSummary: '',
    chapters: [],
    history: [],
    createdAt: 1,
    aiAuthorId: null,
    characters: [],
  };
}

describe('novel ownership boundaries', () => {
  it('복제본이 상속한 스냅샷을 복원해도 현재 작품 ID를 유지한다', () => {
    const current = { ...makeNovel('duplicate-id'), seriesId: 'series-1', volumeNumber: 2 };
    const snapshot: Snapshot = {
      id: 'snapshot-1',
      createdAt: 1,
      description: '원본 시절',
      novelData: { ...makeNovel('original-id'), title: '과거 제목' },
    };
    const restored = restoreSnapshotForNovel(current, snapshot);

    expect(restored.id).toBe('duplicate-id');
    expect(restored.seriesId).toBe('series-1');
    expect(restored.volumeNumber).toBe(2);
    expect(restored.title).toBe('과거 제목');
  });

  it('시리즈 해체 시 공유 인물과 세계관을 독립 작품에 반환한다', () => {
    const series: Series = {
      id: 'series-1',
      title: '시리즈',
      seriesPlotSummary: '',
      characters: [{
        id: 'character-1', name: '주인공', personality: '', appearance: '', background: '', log: '',
      }],
      worldviewFiles: [{ filename: '세계관.txt', content: '설정' }],
      novelIds: ['novel-1'],
      createdAt: 1,
      blueprint: {
        worldview: '', mainConflict: '', characterArcs: '', lastUpdated: 1,
        volumes: [{
          id: 'volume-1', volumeNumber: 1, displayLabel: '첫 번째 권', title: '시작',
          goal: '문을 연다', mainConflict: '내부 갈등', keyEvents: '첫 만남',
          status: 'drafting', linkedNovelId: 'novel-1',
        }],
      },
    };
    const detached = detachNovelFromSeries({
      ...makeNovel('novel-1'), seriesId: series.id, seriesVolumeId: 'volume-1', volumeNumber: 1,
    }, series);

    expect(detached.seriesId).toBeUndefined();
    expect(detached.seriesVolumeId).toBeUndefined();
    expect(detached.volumeNumber).toBeUndefined();
    expect(detached.seriesVolumePlanSnapshot).toMatchObject({
      sourceVolumeId: 'volume-1', displayLabel: '첫 번째 권', goal: '문을 연다',
    });
    expect(detached.characters).toEqual(series.characters);
    expect(detached.worldviewFiles).toEqual(series.worldviewFiles);
    expect(detached.characters).not.toBe(series.characters);
  });

  it('권 삭제 시 시리즈 순서와 청사진 링크를 같이 제거한다', () => {
    const series: Series = {
      id: 'series-1', title: '시리즈', seriesPlotSummary: '', characters: [],
      novelIds: ['novel-1', 'novel-2'], createdAt: 1,
      blueprint: {
        worldview: '', mainConflict: '', characterArcs: '', lastUpdated: 1,
        volumes: [{
          volumeNumber: 1, title: '1권', goal: '', mainConflict: '', keyEvents: '',
          status: 'drafting', linkedNovelId: 'novel-1',
        }],
      },
    };
    const updated = removeNovelReferencesFromSeries(series, 'novel-1');

    expect(updated.novelIds).toEqual(['novel-2']);
    expect(updated.blueprint?.volumes[0].linkedNovelId).toBeUndefined();
  });
});
