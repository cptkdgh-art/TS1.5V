import type { AiAuthor, AuthorIdentityCore, DirectorAuthorProposalDraft } from '@core/types';
import { createAuthorIdentityCore, createLegacyAuthorIdentityCore } from '@services/ai/authorIdentity';

export interface DirectorClioStructuredResponse {
  text: string;
  authorProposal?: DirectorAuthorProposalDraft;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean))]
    .slice(0, 8);
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringList(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(textValue).filter(Boolean))].slice(0, limit);
}

function parseIdentityCore(value: unknown, preserveMetadata: boolean): AuthorIdentityCore | null {
  if (!isRecord(value)) return null;
  const literaryValues = Array.isArray(value.literaryValues)
    ? value.literaryValues.filter(isRecord).map((item) => ({
      belief: textValue(item.belief),
      creativeEffect: textValue(item.creativeEffect),
      doubt: textValue(item.doubt),
    })).filter((item) => item.belief && item.creativeEffect)
    : [];
  const taste = isRecord(value.aestheticTaste) ? value.aestheticTaste : {};
  const innerContradictions = Array.isArray(value.innerContradictions)
    ? value.innerContradictions.filter(isRecord).map((item) => ({
      valueA: textValue(item.valueA),
      valueB: textValue(item.valueB),
      unresolvedReason: textValue(item.unresolvedReason),
    })).filter((item) => item.valueA && item.valueB && item.unresolvedReason)
    : [];
  const draft = {
    selfDefinition: textValue(value.selfDefinition),
    reasonToWrite: textValue(value.reasonToWrite),
    worldview: textValue(value.worldview),
    viewOfHumanity: textValue(value.viewOfHumanity),
    literaryValues,
    aestheticTaste: {
      drawnTo: stringList(taste.drawnTo),
      avoids: stringList(taste.avoids),
      emotionalTexture: textValue(taste.emotionalTexture),
    },
    innerContradictions,
    recurringQuestions: stringList(value.recurringQuestions),
    readerRelationship: textValue(value.readerRelationship),
    creativeEthics: textValue(value.creativeEthics),
    narrativeInstincts: stringList(value.narrativeInstincts),
    voiceOrigins: textValue(value.voiceOrigins),
    readabilityPractice: textValue(value.readabilityPractice),
    plausibilityPractice: textValue(value.plausibilityPractice),
  };
  if (!draft.selfDefinition || !draft.reasonToWrite || !draft.worldview || !draft.viewOfHumanity
    || !draft.readerRelationship || !draft.voiceOrigins
    || !draft.readabilityPractice || !draft.plausibilityPractice) return null;

  const coreId = preserveMetadata ? textValue(value.coreId) || undefined : undefined;
  const versionId = preserveMetadata ? textValue(value.versionId) || undefined : undefined;
  const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
    ? value.createdAt : undefined;
  const updatedAt = typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
    ? value.updatedAt : undefined;
  const core = createAuthorIdentityCore(draft, {
    coreId,
    versionId,
    now: preserveMetadata ? createdAt : undefined,
  });
  return !preserveMetadata || updatedAt === undefined ? core : { ...core, updatedAt };
}

function createLegacyProposalIdentity(
  name: string,
  specialty: string,
  writingStyle: string,
  coreDirectives: string,
  tags: string[],
): AuthorIdentityCore {
  const legacyAuthor: AiAuthor = {
    id: `director-proposal-${name}`,
    name,
    specialty,
    writingStyle,
    coreDirectives,
    tags,
    createdAt: 0,
  };
  return createLegacyAuthorIdentityCore(legacyAuthor);
}

export function parseDirectorAuthorProposal(
  value: unknown,
  options: { preserveIdentityMetadata?: boolean } = {},
): DirectorAuthorProposalDraft | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const specialty = typeof value.specialty === 'string' ? value.specialty.trim() : '';
  const writingStyle = typeof value.writingStyle === 'string' ? value.writingStyle.trim() : '';
  const coreDirectives = typeof value.coreDirectives === 'string' ? value.coreDirectives.trim() : '';
  if (!name || !specialty || !writingStyle || !coreDirectives) return null;
  const tags = normalizeTags(value.tags);
  const isV2 = value.schemaVersion === 2 || value.identityCore !== undefined;
  const identityCore = isV2
    ? parseIdentityCore(value.identityCore, options.preserveIdentityMetadata === true)
    : createLegacyProposalIdentity(name, specialty, writingStyle, coreDirectives, tags);
  if (!identityCore) return null;
  return {
    schemaVersion: 2,
    name,
    specialty,
    writingStyle,
    coreDirectives,
    tags,
    identityCore,
  };
}

function parseJsonResponse(response: string): unknown {
  try {
    return JSON.parse(response);
  } catch {
    const codeBlock = response.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!codeBlock) return null;
    try {
      return JSON.parse(codeBlock[1].trim());
    } catch {
      return null;
    }
  }
}

export function parseDirectorClioResponse(response: string): DirectorClioStructuredResponse {
  const parsed = parseJsonResponse(response.trim());
  if (!isRecord(parsed)) return { text: response.trim() };

  const proposal = parseDirectorAuthorProposal(parsed.authorProposal);
  const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';
  const text = message || (proposal ? `${proposal.name} 작가 설계안을 준비했습니다.` : response.trim());
  return proposal ? { text, authorProposal: proposal } : { text };
}
