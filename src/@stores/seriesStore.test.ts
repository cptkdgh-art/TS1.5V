import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Series } from '@core/types';

const storage = new Map<string, unknown>();
vi.mock('@services/storage', () => ({
  STORAGE_KEYS: { SERIES: 'series' },
  get: vi.fn(async (key: string) => storage.get(key)),
  getRaw: vi.fn(async (key: string) => storage.get(key)),
  getWorkspaceStorageKey: (_workspaceId: string, key: string) => key,
  set: vi.fn(async (key: string, value: unknown) => storage.set(key, value)),
  setRaw: vi.fn(async (key: string, value: unknown) => storage.set(key, value)),
  getActiveWorkspaceId: vi.fn(() => 'workspace-test'),
  migrateFromLocalStorage: vi.fn(async () => undefined),
}));

const { useSeriesStore } = await import('./seriesStore');

const makeSeries = (): Series => ({
  id: 'series-1',
  title: '시리즈',
  seriesPlotSummary: '',
  characters: [],
  novelIds: ['novel-1'],
  createdAt: 1,
});

describe('seriesStore persisted mutation', () => {
  beforeEach(() => {
    storage.clear();
    useSeriesStore.setState({ seriesList: [makeSeries()], selectedSeriesId: null, isLoading: false });
  });

  it('저장소 최신본에 부분 변경을 합쳐 다른 창의 필드를 보존한다', async () => {
    const latest = { ...makeSeries(), seriesPlotSummary: '다른 창 수정', novelIds: ['novel-1', 'novel-2'] };
    storage.set('series', [latest]);

    await useSeriesStore.getState().updateSeries('series-1', {
      characters: [{
        id: 'character-1', name: '주인공', personality: '', appearance: '', background: '', log: '',
      }],
    });

    const saved = (storage.get('series') as Series[])[0];
    expect(saved.seriesPlotSummary).toBe('다른 창 수정');
    expect(saved.novelIds).toEqual(['novel-1', 'novel-2']);
    expect(saved.characters).toHaveLength(1);
  });

  it('rejects a pre-restore series callback even after reloading the same series ID', async () => {
    storage.set('series', [makeSeries()]);
    storage.set('__lifecycle', { generation: 'before' });
    await useSeriesStore.getState().loadSeries();
    storage.set('__lifecycle', { generation: 'after' });
    storage.set('series', [{ ...makeSeries(), title: 'Restored' }]);
    await useSeriesStore.getState().loadSeries();
    await expect(useSeriesStore.getState().updateSeries('series-1', { title: 'Old request' }, 'before')).rejects.toThrow();
    expect((storage.get('series') as Series[])[0].title).toBe('Restored');
  });
});
