export { prepareChapterRemoval } from './chapterRecovery';
export {
  createChapterTrace,
  getChapterDisplayId,
  getChapterSourceLabel,
  reviseChapter,
} from './chapterIdentity';
export {
  buildCanonBriefing,
  inspectCanonFacts,
  reconcileCanonAfterChapterRemoval,
} from './canonLedger';
export type { CanonFactState } from './canonLedger';
export type { ChapterRemovalMode } from './chapterRecovery';
export {
  detachNovelFromSeries,
  removeNovelReferencesFromSeries,
  restoreSnapshotForNovel,
} from './ownership';
export {
  bindNovelToSeriesVolume,
  captureSeriesVolumePlan,
  clearNovelSeriesVolume,
  createVolumeBlueprint,
  ensureSeriesVolumeIds,
  getVolumeDisplayLabel,
  reconcileSeriesVolumeBindings,
  replaceSeriesBlueprint,
  resolveSeriesVolume,
} from './seriesVolume';
export {
  DEFAULT_WRITING_FOCUS_SCOPE,
  applyWritingFocusAfterChapterCommit,
  getWritingFocusScope,
} from './writingFocus';
