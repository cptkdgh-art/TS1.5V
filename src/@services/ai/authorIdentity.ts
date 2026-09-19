import type { AiAuthor, AuthorIdentityCore } from '@core/types';

export type AuthorIdentityDraft = Omit<
  AuthorIdentityCore,
  'schemaVersion' | 'coreId' | 'versionId' | 'createdAt' | 'updatedAt'
>;

const STUDIO_READABILITY =
  '독자가 지시 대상, 공간, 행동과 정보의 순서를 놓치지 않도록 자연스러운 호흡으로 쓴다.';
const STUDIO_PLAUSIBILITY =
  '사건은 앞선 원인과 설정에서, 인물의 선택은 욕망과 두려움과 경험에서 나오게 한다.';

const EMPTY_DRAFT: AuthorIdentityDraft = {
  selfDefinition: '',
  reasonToWrite: '',
  worldview: '',
  viewOfHumanity: '',
  literaryValues: [],
  aestheticTaste: { drawnTo: [], avoids: [], emotionalTexture: '' },
  innerContradictions: [],
  recurringQuestions: [],
  readerRelationship: '',
  creativeEthics: '',
  narrativeInstincts: [],
  voiceOrigins: '',
  readabilityPractice: STUDIO_READABILITY,
  plausibilityPractice: STUDIO_PLAUSIBILITY,
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isAuthorIdentityCore(value: unknown): value is AuthorIdentityCore {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  const textFields = [
    'coreId', 'versionId', 'selfDefinition', 'reasonToWrite', 'worldview', 'viewOfHumanity',
    'readerRelationship', 'creativeEthics', 'voiceOrigins', 'readabilityPractice', 'plausibilityPractice',
  ];
  if (!textFields.every((field) => typeof value[field] === 'string')) return false;
  if (!isStringArray(value.recurringQuestions) || !isStringArray(value.narrativeInstincts)) return false;
  if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)
    || typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return false;
  if (!Array.isArray(value.literaryValues) || !value.literaryValues.every((item) =>
    isRecord(item) && typeof item.belief === 'string'
    && typeof item.creativeEffect === 'string' && typeof item.doubt === 'string')) return false;
  if (!isRecord(value.aestheticTaste) || !isStringArray(value.aestheticTaste.drawnTo)
    || !isStringArray(value.aestheticTaste.avoids)
    || typeof value.aestheticTaste.emotionalTexture !== 'string') return false;
  return Array.isArray(value.innerContradictions) && value.innerContradictions.every((item) =>
    isRecord(item) && typeof item.valueA === 'string'
    && typeof item.valueB === 'string' && typeof item.unresolvedReason === 'string');
}

/** AI JSON이나 import 데이터에서 알려진 필드만 꺼내 안전한 초안으로 만든다. */
export function normalizeAuthorIdentityDraft(
  value: unknown,
  fallback: AuthorIdentityDraft = EMPTY_DRAFT
): AuthorIdentityDraft {
  const raw = isRecord(value) ? value : {};
  const text = (field: keyof AuthorIdentityDraft): string =>
    typeof raw[field] === 'string' ? raw[field] as string : fallback[field] as string;
  const strings = (field: 'recurringQuestions' | 'narrativeInstincts'): string[] =>
    isStringArray(raw[field]) ? [...raw[field]] : [...fallback[field]];
  const literaryValues = Array.isArray(raw.literaryValues)
    ? raw.literaryValues.filter((item) => isRecord(item)).map((item) => ({
      belief: typeof item.belief === 'string' ? item.belief : '',
      creativeEffect: typeof item.creativeEffect === 'string' ? item.creativeEffect : '',
      doubt: typeof item.doubt === 'string' ? item.doubt : '',
    }))
    : fallback.literaryValues.map((item) => ({ ...item }));
  const rawTaste = isRecord(raw.aestheticTaste) ? raw.aestheticTaste : {};
  const rawTensions = Array.isArray(raw.innerContradictions) ? raw.innerContradictions : null;

  return {
    selfDefinition: text('selfDefinition'),
    reasonToWrite: text('reasonToWrite'),
    worldview: text('worldview'),
    viewOfHumanity: text('viewOfHumanity'),
    literaryValues,
    aestheticTaste: {
      drawnTo: isStringArray(rawTaste.drawnTo) ? [...rawTaste.drawnTo] : [...fallback.aestheticTaste.drawnTo],
      avoids: isStringArray(rawTaste.avoids) ? [...rawTaste.avoids] : [...fallback.aestheticTaste.avoids],
      emotionalTexture: typeof rawTaste.emotionalTexture === 'string'
        ? rawTaste.emotionalTexture : fallback.aestheticTaste.emotionalTexture,
    },
    innerContradictions: rawTensions
      ? rawTensions.filter((item) => isRecord(item)).map((item) => ({
        valueA: typeof item.valueA === 'string' ? item.valueA : '',
        valueB: typeof item.valueB === 'string' ? item.valueB : '',
        unresolvedReason: typeof item.unresolvedReason === 'string' ? item.unresolvedReason : '',
      }))
      : fallback.innerContradictions.map((item) => ({ ...item })),
    recurringQuestions: strings('recurringQuestions'),
    readerRelationship: text('readerRelationship'),
    creativeEthics: text('creativeEthics'),
    narrativeInstincts: strings('narrativeInstincts'),
    voiceOrigins: text('voiceOrigins'),
    readabilityPractice: text('readabilityPractice'),
    plausibilityPractice: text('plausibilityPractice'),
  };
}

function stablePart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9가-힣_-]+/g, '-').replace(/^-+|-+$/g, '') || 'author';
}

function randomPart(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createAuthorIdentityCore(
  draft: AuthorIdentityDraft,
  options: { coreId?: string; versionId?: string; now?: number } = {}
): AuthorIdentityCore {
  const now = options.now ?? Date.now();
  const coreId = options.coreId ?? `author-core-${now}-${randomPart()}`;
  return {
    schemaVersion: 1,
    coreId,
    versionId: options.versionId ?? `${coreId}-v-${now}-${randomPart()}`,
    ...draft,
    literaryValues: draft.literaryValues.map((value) => ({ ...value })),
    aestheticTaste: {
      drawnTo: [...draft.aestheticTaste.drawnTo],
      avoids: [...draft.aestheticTaste.avoids],
      emotionalTexture: draft.aestheticTaste.emotionalTexture,
    },
    innerContradictions: draft.innerContradictions.map((value) => ({ ...value })),
    recurringQuestions: [...draft.recurringQuestions],
    narrativeInstincts: [...draft.narrativeInstincts],
    createdAt: now,
    updatedAt: now,
  };
}

/** 기존 네 필드를 해석해서 덮어쓰지 않고 그대로 연결하는 결정론적 호환 코어다. */
export function createLegacyAuthorIdentityCore(author: AiAuthor): AuthorIdentityCore {
  const id = stablePart(author.id);
  const createdAt = Number.isFinite(author.createdAt) ? author.createdAt : 0;
  return {
    schemaVersion: 1,
    coreId: `legacy-core-${id}`,
    versionId: `legacy-core-${id}-v1`,
    selfDefinition: `${author.name}은(는) ${author.specialty}을(를) 다루는 작가다.`,
    reasonToWrite: author.coreDirectives,
    worldview: '',
    viewOfHumanity: '',
    literaryValues: author.coreDirectives
      ? [{ belief: author.coreDirectives, creativeEffect: '기존 핵심 지시사항을 창작 판단에 반영한다.', doubt: '' }]
      : [],
    aestheticTaste: {
      drawnTo: author.tags ? [...author.tags] : [],
      avoids: [],
      emotionalTexture: '',
    },
    innerContradictions: [],
    recurringQuestions: [],
    readerRelationship: '',
    creativeEthics: '',
    narrativeInstincts: author.writingStyle ? [author.writingStyle] : [],
    voiceOrigins: author.writingStyle,
    readabilityPractice: STUDIO_READABILITY,
    plausibilityPractice: STUDIO_PLAUSIBILITY,
    createdAt,
    updatedAt: createdAt,
  };
}

/** 저장 데이터를 바꾸지 않고 현재 사용할 수 있는 코어를 반환한다. */
export function resolveAuthorIdentityCore(author: AiAuthor): AuthorIdentityCore {
  return isAuthorIdentityCore(author.identityCore)
    ? author.identityCore
    : createLegacyAuthorIdentityCore(author);
}

/** legacy 작가를 저장 가능한 형태로 한 번만 승격한다. 기존 flat 필드는 보존한다. */
export function ensureAuthorIdentity(author: AiAuthor): AiAuthor {
  if (isAuthorIdentityCore(author.identityCore)) return author;
  return { ...author, identityCore: createLegacyAuthorIdentityCore(author) };
}

/**
 * 저장된 기본 작가에는 최신 공식 코어를 심고, 사용자 legacy 작가에는 flat 필드 기반 코어를 심는다.
 * 이미 코어가 있는 작가는 절대 덮어쓰지 않는다. 변경이 없으면 원래 배열 참조를 반환한다.
 */
export function migrateAuthorIdentities(
  authors: AiAuthor[],
  defaultAuthors: readonly AiAuthor[] = []
): AiAuthor[] {
  const defaultsById = new Map(defaultAuthors.map((author) => [author.id, author]));
  let changed = false;
  const migrated = authors.map((author) => {
    if (isAuthorIdentityCore(author.identityCore)) return author;
    const seededCore = defaultsById.get(author.id)?.identityCore;
    changed = true;
    return seededCore
      ? { ...author, identityCore: cloneAuthorIdentityCore(seededCore) }
      : ensureAuthorIdentity(author);
  });
  return changed ? migrated : authors;
}

export function cloneAuthorIdentityCore(core: AuthorIdentityCore): AuthorIdentityCore {
  return {
    schemaVersion: 1,
    coreId: core.coreId,
    versionId: core.versionId,
    selfDefinition: core.selfDefinition,
    reasonToWrite: core.reasonToWrite,
    worldview: core.worldview,
    viewOfHumanity: core.viewOfHumanity,
    literaryValues: core.literaryValues.map((value) => ({ ...value })),
    aestheticTaste: {
      ...core.aestheticTaste,
      drawnTo: [...core.aestheticTaste.drawnTo],
      avoids: [...core.aestheticTaste.avoids],
    },
    innerContradictions: core.innerContradictions.map((value) => ({ ...value })),
    recurringQuestions: [...core.recurringQuestions],
    readerRelationship: core.readerRelationship,
    creativeEthics: core.creativeEthics,
    narrativeInstincts: [...core.narrativeInstincts],
    voiceOrigins: core.voiceOrigins,
    readabilityPractice: core.readabilityPractice,
    plausibilityPractice: core.plausibilityPractice,
    createdAt: core.createdAt,
    updatedAt: core.updatedAt,
  };
}

/** 작가 복제 시 내용은 잇되 원본과 독립된 존재 ID와 첫 버전을 발급한다. */
export function forkAuthorIdentityCore(
  core: AuthorIdentityCore,
  options: { coreId?: string; versionId?: string; now?: number } = {}
): AuthorIdentityCore {
  const now = options.now ?? Date.now();
  const coreId = options.coreId ?? `author-core-${now}-${randomPart()}`;
  const copy = cloneAuthorIdentityCore(core);
  return {
    ...copy,
    coreId,
    versionId: options.versionId ?? `${coreId}-v1`,
    createdAt: now,
    updatedAt: now,
  };
}
