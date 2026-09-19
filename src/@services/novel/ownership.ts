import type { Novel, Series, Snapshot } from '@core/types';
import { captureSeriesVolumePlan, resolveSeriesVolume } from './seriesVolume';

/** 스냅샷은 현재 작품의 내용만 복원하며 작품 ID와 시리즈 소속은 바꾸지 않는다. */
export function restoreSnapshotForNovel(currentNovel: Novel, snapshot: Snapshot): Novel {
  return {
    ...snapshot.novelData,
    id: currentNovel.id,
    seriesId: currentNovel.seriesId,
    volumeNumber: currentNovel.volumeNumber,
    seriesVolumeId: currentNovel.seriesVolumeId,
    seriesVolumePlanSnapshot: currentNovel.seriesVolumePlanSnapshot,
    snapshots: currentNovel.snapshots || [],
    contextCaching: snapshot.novelData.contextCaching
      ? { ...snapshot.novelData.contextCaching, caches: {} }
      : snapshot.novelData.contextCaching,
  };
}

/** 시리즈 해체 시 공유 소유 데이터를 각 독립 작품으로 반환한다. */
export function detachNovelFromSeries(novel: Novel, series: Series): Novel {
  const volume = resolveSeriesVolume(series, novel);
  return {
    ...novel,
    seriesId: undefined,
    volumeNumber: undefined,
    seriesVolumeId: undefined,
    seriesVolumePlanSnapshot: volume
      ? captureSeriesVolumePlan(series.id, volume)
      : novel.seriesVolumePlanSnapshot,
    characters: structuredClone(series.characters || []),
    worldviewFiles: structuredClone(series.worldviewFiles || []),
  };
}

/** 권 삭제 시 시리즈의 순서 목록과 청사진 링크를 함께 정리한다. */
export function removeNovelReferencesFromSeries(series: Series, novelId: string): Series {
  return {
    ...series,
    novelIds: series.novelIds.filter((id) => id !== novelId),
    blueprint: series.blueprint ? {
      ...series.blueprint,
      volumes: series.blueprint.volumes.map((volume) =>
        volume.linkedNovelId === novelId ? { ...volume, linkedNovelId: undefined } : volume
      ),
    } : undefined,
  };
}
