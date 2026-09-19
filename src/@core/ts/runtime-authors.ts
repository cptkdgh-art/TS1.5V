import { DEFAULT_AUTHORS as LEGACY_DEFAULT_AUTHORS } from '../constants/defaultAuthors';
import { DEFAULT_TS_AUTHORS } from './authors';
import { TS_TYPES, TS_SUBGENRES, TS_MOODS } from './work-design';
import { TS_VOICE_FINGERPRINTS } from './voice-fingerprints';
import { combineDefaultAuthorCatalogs, toRuntimeAuthor } from './runtime-author-adapter';

const typeLabels = new Map(TS_TYPES.map((item) => [item.id, item.ko]));
const genreLabels = new Map(TS_SUBGENRES.map((item) => [item.id, item.ko]));
const moodLabels = new Map(TS_MOODS.map((item) => [item.id, item.ko]));
const ids = (primary: string | null, secondary: string[]) =>
  [...new Set([primary, ...secondary])].filter((id): id is string => Boolean(id));

/** Native editable/versionable author records; no user data is migrated here. */
export const DEFAULT_TS_RUNTIME_AUTHORS = DEFAULT_TS_AUTHORS.map((author) => {
  const expertiseLabels = ids(author.tsType.primary, author.tsType.secondary)
    .map((id) => typeLabels.get(id) ?? id);
  const displayLabels = [...expertiseLabels,
    ...ids(author.subgenre.primary, author.subgenre.secondary).map((id) => genreLabels.get(id) ?? id),
    ...ids(author.mood.primary, author.mood.secondary).map((id) => moodLabels.get(id) ?? id)];
  return toRuntimeAuthor({
    ...author,
    voiceFingerprint: TS_VOICE_FINGERPRINTS[author.id],
    expertiseLabels,
    displayTags: displayLabels.map((label) => `#${label}`),
  });
});

/** Additive during migration: legacy IDs and saved/custom profiles are never overwritten. */
export const DEFAULT_AUTHORS = combineDefaultAuthorCatalogs(LEGACY_DEFAULT_AUTHORS, DEFAULT_TS_RUNTIME_AUTHORS);
