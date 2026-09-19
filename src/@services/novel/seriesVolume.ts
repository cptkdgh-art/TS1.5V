import type {
  Novel,
  Series,
  SeriesBlueprint,
  SeriesVolumePlanSnapshot,
  VolumeBlueprint,
} from '@core/types';

const createId = () => crypto.randomUUID();

export function getVolumeDisplayLabel(volume: VolumeBlueprint): string {
  return volume.displayLabel?.trim() || `${volume.volumeNumber}권`;
}

export function createVolumeBlueprint(volumeNumber: number): VolumeBlueprint {
  return {
    id: createId(),
    volumeNumber,
    displayLabel: `${volumeNumber}권`,
    title: `${volumeNumber}권`,
    localSetting: '',
    goal: '',
    mainConflict: '',
    keyEvents: '',
    status: 'planned',
  };
}

export function ensureSeriesVolumeIds(series: Series): Series {
  if (!series.blueprint?.volumes.some((volume) => !volume.id)) return series;
  return {
    ...series,
    blueprint: {
      ...series.blueprint,
      volumes: series.blueprint.volumes.map((volume) => ({
        ...volume,
        id: volume.id || createId(),
      })),
    },
  };
}

export function resolveSeriesVolume(
  series: Series | null | undefined,
  novel: Novel,
): VolumeBlueprint | undefined {
  const volumes = series?.blueprint?.volumes;
  if (!volumes?.length) return undefined;
  return volumes.find((volume) => volume.id && volume.id === novel.seriesVolumeId)
    ?? volumes.find((volume) => volume.linkedNovelId === novel.id)
    ?? volumes.find((volume) => volume.volumeNumber === novel.volumeNumber);
}

export function captureSeriesVolumePlan(
  seriesId: string,
  volume: VolumeBlueprint,
): SeriesVolumePlanSnapshot {
  return {
    sourceSeriesId: seriesId,
    sourceVolumeId: volume.id || createId(),
    volumeNumber: volume.volumeNumber,
    displayLabel: getVolumeDisplayLabel(volume),
    title: volume.title,
    localSetting: volume.localSetting,
    goal: volume.goal,
    mainConflict: volume.mainConflict,
    keyEvents: volume.keyEvents,
    capturedAt: Date.now(),
  };
}

export function bindNovelToSeriesVolume(
  sourceSeries: Series,
  novel: Novel,
  volumeId: string,
): { series: Series; novel: Novel } {
  const series = ensureSeriesVolumeIds(sourceSeries);
  const volume = series.blueprint?.volumes.find((item) => item.id === volumeId);
  if (!series.blueprint || !volume) return { series, novel };

  const volumes = series.blueprint.volumes.map((item) => {
    if (item.linkedNovelId === novel.id) return { ...item, linkedNovelId: undefined };
    if (item.id === volumeId) return { ...item, linkedNovelId: novel.id };
    return item;
  });
  return {
    series: { ...series, blueprint: { ...series.blueprint, volumes } },
    novel: {
      ...novel,
      seriesId: series.id,
      seriesVolumeId: volume.id,
      volumeNumber: volume.volumeNumber,
      seriesVolumePlanSnapshot: captureSeriesVolumePlan(series.id, volume),
    },
  };
}

export function clearNovelSeriesVolume(
  sourceSeries: Series,
  novel: Novel,
): { series: Series; novel: Novel } {
  const series = ensureSeriesVolumeIds(sourceSeries);
  const volume = resolveSeriesVolume(series, novel);
  const blueprint = series.blueprint ? {
    ...series.blueprint,
    volumes: series.blueprint.volumes.map((item) =>
      item.linkedNovelId === novel.id ? { ...item, linkedNovelId: undefined } : item
    ),
  } : undefined;
  return {
    series: { ...series, blueprint },
    novel: {
      ...novel,
      seriesVolumeId: undefined,
      volumeNumber: undefined,
      seriesVolumePlanSnapshot: volume
        ? captureSeriesVolumePlan(series.id, volume)
        : novel.seriesVolumePlanSnapshot,
    },
  };
}

export function reconcileSeriesVolumeBindings(
  sourceSeries: Series,
  sourceNovels: Novel[],
): { series: Series; novels: Novel[]; changed: boolean } {
  const series = ensureSeriesVolumeIds(sourceSeries);
  if (!series.blueprint) {
    return { series, novels: sourceNovels, changed: series !== sourceSeries };
  }

  const novels = sourceNovels.filter((novel) => novel.seriesId === series.id);
  const novelById = new Map(novels.map((novel) => [novel.id, novel]));
  const claimedNovels = new Set<string>();
  const claimedVolumes = new Set<string>();
  const links = new Map<string, string>();

  for (const volume of series.blueprint.volumes) {
    if (!volume.id || !volume.linkedNovelId || claimedNovels.has(volume.linkedNovelId)) continue;
    if (!novelById.has(volume.linkedNovelId)) continue;
    links.set(volume.id, volume.linkedNovelId);
    claimedVolumes.add(volume.id);
    claimedNovels.add(volume.linkedNovelId);
  }

  for (const novel of novels) {
    if (!novel.seriesVolumeId || claimedNovels.has(novel.id)) continue;
    const volume = series.blueprint.volumes.find((item) => item.id === novel.seriesVolumeId);
    if (!volume?.id || claimedVolumes.has(volume.id)) continue;
    links.set(volume.id, novel.id);
    claimedVolumes.add(volume.id);
    claimedNovels.add(novel.id);
  }

  for (const novel of novels) {
    if (!novel.volumeNumber || claimedNovels.has(novel.id)) continue;
    const volume = series.blueprint.volumes.find((item) =>
      item.volumeNumber === novel.volumeNumber && item.id && !claimedVolumes.has(item.id)
    );
    if (!volume?.id) continue;
    links.set(volume.id, novel.id);
    claimedVolumes.add(volume.id);
    claimedNovels.add(novel.id);
  }

  const volumes = series.blueprint.volumes.map((volume) => ({
    ...volume,
    linkedNovelId: volume.id ? links.get(volume.id) : undefined,
  }));
  const nextSeries: Series = {
    ...series,
    blueprint: { ...series.blueprint, volumes },
  };
  const volumeByNovel = new Map(
    volumes
      .filter((volume) => volume.id && volume.linkedNovelId)
      .map((volume) => [volume.linkedNovelId as string, volume]),
  );
  const nextNovels = sourceNovels.map((novel) => {
    if (novel.seriesId !== series.id) return novel;
    const volume = volumeByNovel.get(novel.id);
    if (!volume?.id) {
      if (!novel.seriesVolumeId) return novel;
      return { ...novel, seriesVolumeId: undefined, volumeNumber: undefined };
    }
    if (novel.seriesVolumeId === volume.id && novel.volumeNumber === volume.volumeNumber) return novel;
    return {
      ...novel,
      seriesVolumeId: volume.id,
      volumeNumber: volume.volumeNumber,
      seriesVolumePlanSnapshot: captureSeriesVolumePlan(series.id, volume),
    };
  });
  const changed = JSON.stringify(nextSeries) !== JSON.stringify(sourceSeries)
    || nextNovels.some((novel, index) => novel !== sourceNovels[index]);
  return { series: nextSeries, novels: nextNovels, changed };
}

export function replaceSeriesBlueprint(
  series: Series,
  blueprint: SeriesBlueprint,
  novels: Novel[],
): { series: Series; novels: Novel[] } {
  return reconcileSeriesVolumeBindings({ ...series, blueprint }, novels);
}
