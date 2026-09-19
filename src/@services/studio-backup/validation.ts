type RecordValue = Record<string, unknown>;
type Validator = (value: unknown) => boolean;

const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const id = (value: unknown): value is string => text(value) && value.trim().length > 0;
const number = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);
const integer = (value: unknown): boolean => number(value) && Number.isInteger(value) && Number(value) >= 0;
const positive = (value: unknown): boolean => integer(value) && Number(value) > 0;
const bool = (value: unknown): boolean => typeof value === 'boolean';
const array = (check: Validator): Validator => (value) => Array.isArray(value) && value.every(check);
const strings = array(text);
const optional = (value: RecordValue, fields: Record<string, Validator>): boolean =>
  Object.entries(fields).every(([key, check]) => value[key] === undefined || check(value[key]));
const fields = (value: unknown, required: Record<string, Validator>, extras: Record<string, Validator> = {}): value is RecordValue =>
  record(value) && Object.entries(required).every(([key, check]) => check(value[key])) && optional(value, extras);
const unique = (value: unknown, check: Validator, optionalId = false): boolean => {
  if (!Array.isArray(value) || !value.every((item) => check(item))) return false;
  const ids = value.map((item: RecordValue) => item.id).filter((item) => optionalId ? item !== undefined : true);
  return new Set(ids).size === ids.length;
};
const stringMap = (value: unknown): boolean => record(value) && Object.values(value).every(text);
const chat = array((value) => fields(value, {}, {
  role: text, parts: array((part) => fields(part, {}, { text })),
}));
const character = (value: unknown): boolean => fields(value, {
  id, name: text, personality: text, appearance: text, background: text, log: text,
}, { interviewHistory: chat });
const characters = (value: unknown): boolean => unique(value, character);
const worldviews = array((value) => fields(value, { filename: text, content: text }));
const trace = (value: unknown): boolean => fields(value, {
  revision: positive, createdAt: number, updatedAt: number,
  source: (source) => ['ai', 'manual', 'imported', 'legacy', 'translated'].includes(String(source)),
}, { originChapterId: id, generationBatchId: id, batchPosition: positive, batchSize: positive });
const manuscriptVersion = (value: unknown): boolean => fields(value, { title: text, content: text });
const timestamp = (value: unknown): boolean => number(value) && Number(value) >= 0 && Number(value) <= 8640000000000000;
const chapterAgentChoice = (value: unknown): boolean => fields(value, {
  id: (item) => item === 'a' || item === 'b',
  label: id,
  direction: id,
  expectedEffect: id,
});
const chapterAgentChoices = (value: unknown): boolean => Array.isArray(value)
  && value.length === 2
  && chapterAgentChoice(value[0])
  && chapterAgentChoice(value[1])
  && (value[0] as RecordValue).id === 'a'
  && (value[1] as RecordValue).id === 'b';
export const validChapterAgentPendingProposal: Validator = (value) => fields(value, {
  id,
  createdAt: timestamp,
  reason: id,
  preserve: strings,
  expectedEffect: id,
  choices: chapterAgentChoices,
  source: (item) => fields(item, { chapterId: id, revision: positive, signature: id }),
  authorId: (item) => item === null || id(item),
  authorName: text,
  model: text,
});
const revisionGrounding = (value: unknown): boolean => fields(value, {
  proposalId: id,
  reason: id,
  preserve: strings,
  expectedEffect: id,
  selectedChoice: chapterAgentChoice,
});
export const validChapterAgentRevisions: Validator = (value) => unique(value, (entry) => fields(entry, {
  id,
  createdAt: timestamp,
  kind: (item) => item === 'edit' || item === 'restore',
  authorId: (item) => item === null || id(item),
  authorName: text, model: text, instruction: text, summary: text,
  before: manuscriptVersion, after: manuscriptVersion,
}, { grounding: revisionGrounding, restoredFromId: id }));
const chapter = (value: unknown): boolean => fields(value, { title: text, content: text }, {
  id, trace, feedbackChat: chat, agentPendingProposal: validChapterAgentPendingProposal,
  agentRevisions: validChapterAgentRevisions, authorInterlude: text, chapterNumber: positive,
});
const summary = (value: unknown): boolean => fields(value, {
  content: text, summarizedChapters: integer, createdAt: number,
}, {
  coveredChapterIds: strings, contentSignature: text, needsRecheck: bool,
  entries: array((entry) => fields(entry, { chapterId: id, chapterNumber: positive, chapterTitle: text, summary: text, timestamp: number }, { chapterSignature: text })),
  milestones: array((entry) => fields(entry, { id, timestamp: number, type: text, description: text }, { affectedChapterIds: strings })),
  rollups: array((entry) => fields(entry, { id, level: text, startChapterNumber: positive, endChapterNumber: positive, sourceChapterIds: strings, sourceSignature: text, content: text, createdAt: number })),
});
const canon = (value: unknown): boolean => fields(value, {
  id, subject: text, value: text, category: text, status: text, createdAt: number, updatedAt: number,
}, { sourceChapterId: id, sourceRevision: positive, validFromChapterId: id, validUntilChapterId: id, supersedesFactId: id, locked: bool });
const cache = (value: unknown): boolean => fields(value, { isEnabled: bool, activeBufferWindow: integer, caches: record })
  && Object.values(value.caches as RecordValue).every((item) => fields(item, {
    cacheName: text, createTime: text, expireTime: text, cachedChapterCount: integer, cachedTokenCount: number, contentSignature: text,
  }));

const authorConviction: Validator = (value) => fields(value, {
  belief: text, creativeEffect: text, doubt: text,
});
const authorTaste: Validator = (value) => fields(value, {
  drawnTo: strings, avoids: strings, emotionalTexture: text,
});
const authorTension: Validator = (value) => fields(value, {
  valueA: text, valueB: text, unresolvedReason: text,
});
const authorIdentityCore: Validator = (value) => fields(value, {
  schemaVersion: (item) => item === 1,
  coreId: id,
  versionId: id,
  selfDefinition: text,
  reasonToWrite: text,
  worldview: text,
  viewOfHumanity: text,
  literaryValues: array(authorConviction),
  aestheticTaste: authorTaste,
  innerContradictions: array(authorTension),
  recurringQuestions: strings,
  readerRelationship: text,
  creativeEthics: text,
  narrativeInstincts: strings,
  voiceOrigins: text,
  readabilityPractice: text,
  plausibilityPractice: text,
  createdAt: number,
  updatedAt: number,
});

export function validAuthor(value: unknown): boolean {
  return fields(value, { id, name: text, specialty: text, writingStyle: text, coreDirectives: text, createdAt: number }, {
    tags: strings, memoryCache: strings, metaChatHistory: chat, generalChatHistory: chat,
    directorChatHistory: chat, directorChatSummary: text, isDefault: bool,
    identityCore: authorIdentityCore,
    profileVersions: (items) => unique(items, (item) => fields(item, { id, name: text, specialty: text, writingStyle: text, coreDirectives: text, createdAt: number, tags: strings }, { identityCore: authorIdentityCore })),
  });
}

export function validNovel(value: unknown, depth = 0): boolean {
  if (depth > 10) return false;
  return fields(value, {
    id, title: text, subject: text, mood: text, plotSummary: text,
    chapters: (items) => unique(items, chapter, true), history: chat, characters,
    createdAt: number, aiAuthorId: (item) => item === null || id(item),
  }, {
    subgenres: strings, themes: strings, primaryGenre: text, seriesId: id, seriesVolumeId: id,
    worldviewFiles: worldviews, contextSummary: summary, contextCaching: cache,
    contextManagement: (item) => fields(item, { isEnabled: bool, fullTextChapters: integer, summaryTriggerChapters: positive }),
    authorMemoryByAuthor: (item) => record(item) && Object.values(item).every(strings),
    canonFacts: (items) => unique(items, canon),
    snapshots: (items) => unique(items, (item) => fields(item, {
      id, createdAt: number, description: text, novelData: (data) => validNovel(data, depth + 1),
    })),
    liveFeedbackChat: chat, writingDirectives: chat, directingChatHistory: chat,
    targetChapterCount: (item) => item === null || positive(item),
    targetCharacterCount: number, preventAutoEnding: bool, targetedGenerationEnabled: bool, chapterTargetCharacters: positive, maxTokens: positive,
    foreshadowingSystem: (item) => fields(item, {
      items: (items) => unique(items, (entry) => fields(entry, {
        id, name: text, description: text, status: text, type: text, urgency: text,
        causality: (part) => fields(part, { premise: text, implication: text, consequence: text }),
        plantedAt: (part) => fields(part, { chapterIndex: integer, briefContext: text }),
        hints: array((part) => fields(part, { chapterIndex: integer, hint: text })),
        linkedCharacterIds: strings, linkedForeshadowingIds: strings,
        aiGuidance: (part) => fields(part, { doHint: strings, dontReveal: strings, payoffTiming: text }),
        createdAt: number, updatedAt: number, importance: positive,
      }, { payoff: (part) => fields(part, { chapterIndex: integer, resolution: text, readerImpact: text }), trackingKeywords: strings })),
      pacingGuide: (part) => fields(part, { currentTension: number, plantedCount: integer, awaitingPayoffCount: integer, recommendation: text, urgentPayoffs: strings }),
    }),
  });
}

export function validSeries(value: unknown): boolean {
  return fields(value, { id, title: text, seriesPlotSummary: text, characters, novelIds: strings, createdAt: number }, {
    worldviewFiles: worldviews, seriesMemoryCompendium: text,
    blueprint: (item) => item === null || fields(item, {
      worldview: text, mainConflict: text, characterArcs: text, lastUpdated: number,
      volumes: (items) => unique(items, (volume) => fields(volume, {
        volumeNumber: positive, title: text, goal: text, mainConflict: text, keyEvents: text, status: text,
      }, { id, linkedNovelId: id }), true),
    }),
    seriesMemoryState: (item) => fields(item, {
      combinedSignature: text, generatedAt: number,
      blocks: array((block) => fields(block, { novelId: id, volumeLabel: text, novelTitle: text, sourceSignature: text, content: text, generatedAt: number }, { volumeId: id })),
    }),
  });
}

export const validReceipts: Validator = array((value) => fields(value, {
  lineageId: id, packageId: id, revision: positive, importedAt: number, targetWorkspaceId: id,
  mode: (item) => item === 'copy' || item === 'merge',
  idMap: (item) => fields(item, Object.fromEntries(['authors', 'series', 'volumes', 'novels', 'chapters', 'characters', 'foreshadowings', 'snapshots'].map((key) => [key, stringMap]))),
}));

export function validWorkspaceEntities(value: RecordValue): boolean {
  if (!unique(value.novels, validNovel) || !unique(value.series, validSeries) || !unique(value.authors, validAuthor)) return false;
  const novels = value.novels as RecordValue[];
  const series = value.series as RecordValue[];
  const authors = value.authors as RecordValue[];
  const novelIds = new Set(novels.map((item) => item.id));
  const seriesIds = new Set(series.map((item) => item.id));
  const authorIds = new Set(authors.map((item) => item.id));
  return novels.every((item) => (!item.seriesId || seriesIds.has(item.seriesId)) && (!item.aiAuthorId || authorIds.has(item.aiAuthorId)))
    && series.every((item) => (item.novelIds as string[]).every((novelId) => novelIds.has(novelId))
      && (!record(item.blueprint) || (item.blueprint.volumes as RecordValue[]).every((volume) => !volume.linkedNovelId || novelIds.has(volume.linkedNovelId))));
}
