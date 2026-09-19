/**
 * ============================================================
 * @module stores/seriesStore
 * @file seriesStore.ts
 * ============================================================
 * @description 시리즈 상태 관리 (Zustand)
 * ============================================================
 */

import { create } from 'zustand';
import type { Series } from '@core/types';
import { getRaw, getWorkspaceStorageKey, getActiveWorkspaceId, setRaw, migrateFromLocalStorage } from '@services/storage';
import { subscribeWorkspaceChanges, withWorkspaceWrite } from '@services/storage/workspaceCoordination';
import { STORAGE_KEYS } from '@services/storage';
import { ensureSeriesVolumeIds } from '@services/novel';

interface SeriesState {
  seriesList: Series[];
  selectedSeriesId: string | null;
  isLoading: boolean;

  // Actions
  loadSeries: () => Promise<void>;
  addSeries: (series: Series) => Promise<void>;
  updateSeries: (id: string, updates: Partial<Series>, expectedGeneration?: string) => Promise<void>;
  deleteSeries: (id: string) => Promise<void>;
  selectSeries: (id: string | null) => void;
  getSeriesById: (id: string) => Series | undefined;

  // Novel management
  addNovelToSeries: (seriesId: string, novelId: string) => Promise<void>;
  removeNovelFromSeries: (seriesId: string, novelId: string) => Promise<void>;
}

function mutatePersistedSeries(
  fallback: Series[],
  mutation: (latest: Series[]) => Series[],
  expectedGeneration?: string,
): Promise<Series[]> {
  const workspaceId = getActiveWorkspaceId();
  return withWorkspaceWrite(workspaceId, async () => {
      const key = getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.SERIES);
      const latest = await getRaw<Series[]>(key) ?? fallback;
      const next = mutation(latest);
      await setRaw(key, next);
      return next;
    }, { expectedGeneration });
}

export const useSeriesStore = create<SeriesState>((setState, getState) => ({
  seriesList: [],
  selectedSeriesId: null,
  isLoading: true,

  loadSeries: async () => {
    try {
      await migrateFromLocalStorage(STORAGE_KEYS.SERIES);
      const workspaceId = getActiveWorkspaceId();
      await withWorkspaceWrite(workspaceId, async () => {
      const key = getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.SERIES);
      const seriesList = await getRaw<Series[]>(key);
      const migratedSeries = (seriesList || []).map(ensureSeriesVolumeIds);
      if (migratedSeries.some((series, index) => series !== seriesList?.[index])) {
        await setRaw(key, migratedSeries);
      }
      setState({ seriesList: migratedSeries, isLoading: false });
      }, { refresh: true });
    } catch (error) {
      console.error('[SeriesStore] 로드 실패:', error);
      setState({ isLoading: false });
    }
  },

  addSeries: async (series) => {
    const newSeriesList = await mutatePersistedSeries(getState().seriesList, (latest) => [...latest, series]);
    setState({ seriesList: newSeriesList });
  },

  updateSeries: async (id, updates, expectedGeneration) => {
    const newSeriesList = await mutatePersistedSeries(getState().seriesList, (latest) => latest.map((series) =>
      series.id === id ? { ...series, ...updates, id } : series
    ), expectedGeneration);
    setState({ seriesList: newSeriesList });
  },

  deleteSeries: async (id) => {
    const { seriesList, selectedSeriesId } = getState();
    const newSeriesList = await mutatePersistedSeries(seriesList, (latest) =>
      latest.filter((series) => series.id !== id)
    );
    setState({
      seriesList: newSeriesList,
      selectedSeriesId: selectedSeriesId === id ? null : selectedSeriesId,
    });
  },

  selectSeries: (id) => {
    setState({ selectedSeriesId: id });
  },

  getSeriesById: (id) => {
    return getState().seriesList.find((s) => s.id === id);
  },

  addNovelToSeries: async (seriesId, novelId) => {
    const newSeriesList = await mutatePersistedSeries(getState().seriesList, (latest) => latest.map((series) => {
      if (series.id === seriesId && !series.novelIds.includes(novelId)) {
        return { ...series, novelIds: [...series.novelIds, novelId] };
      }
      return series;
    }));
    setState({ seriesList: newSeriesList });
  },

  removeNovelFromSeries: async (seriesId, novelId) => {
    const newSeriesList = await mutatePersistedSeries(getState().seriesList, (latest) => latest.map((series) => {
      if (series.id === seriesId) {
        return { ...series, novelIds: series.novelIds.filter((id) => id !== novelId) };
      }
      return series;
    }));
    setState({ seriesList: newSeriesList });
  },
}));

subscribeWorkspaceChanges(({ workspaceId, kind }) => {
  if (workspaceId !== getActiveWorkspaceId() || kind !== 'updated') return;
  void withWorkspaceWrite(workspaceId, async () => {
    const seriesList = await getRaw<Series[]>(getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.SERIES)) ?? [];
    useSeriesStore.setState({ seriesList });
  }).catch(() => undefined);
});
