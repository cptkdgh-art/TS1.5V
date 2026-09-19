import type {
  CharacterChatBackupData,
  CharacterChatMessage,
  CharacterChatPersona,
  CharacterChatPersonaField,
  CharacterChatSession,
  CharacterChatSource,
  CharacterChatUserPersona,
  PersonaField,
} from '@core/types';
import { normalizeCharacterChatModel } from './constants';

const SOURCE_TYPES = new Set(['novel', 'text', 'manual']);
const FIELD_ORIGINS = new Set(['source', 'ai', 'user']);
const MESSAGE_BLOCK_TYPES = new Set(['narration', 'dialogue']);
const EMOTIONS = new Set(['neutral', 'warm', 'happy', 'shy', 'sad', 'angry', 'surprised', 'tense']);
const PERSONA_FIELDS: CharacterChatPersonaField[] = [
  'role',
  'personality',
  'speakingStyle',
  'values',
  'behaviorRules',
  'appearance',
  'background',
  'forbiddenTopics',
  'storyContext',
  'worldContext',
  'greeting',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isPersonaField(value: unknown): value is PersonaField {
  return isRecord(value)
    && typeof value.value === 'string'
    && typeof value.origin === 'string'
    && FIELD_ORIGINS.has(value.origin);
}

function isSource(value: unknown): value is CharacterChatSource {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.type === 'string'
    && SOURCE_TYPES.has(value.type)
    && typeof value.title === 'string'
    && typeof value.text === 'string'
    && typeof value.worldview === 'string'
    && isOptionalString(value.novelId)
    && isOptionalString(value.seriesId)
    && Number.isInteger(value.sourceChapterCount)
    && Number(value.sourceChapterCount) >= 0
    && Number.isInteger(value.knowledgeChapterCount)
    && Number(value.knowledgeChapterCount) >= 0
    && Number(value.knowledgeChapterCount) <= Number(value.sourceChapterCount)
    && typeof value.isFullCanon === 'boolean'
    && isFiniteNumber(value.createdAt);
}

function isPersona(value: unknown): value is CharacterChatPersona {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.sourceId === 'string'
    && isOptionalString(value.sourceCharacterId)
    && typeof value.name === 'string'
    && PERSONA_FIELDS.every((field) => isPersonaField(value[field]))
    && Array.isArray(value.aliases)
    && value.aliases.every((alias) => typeof alias === 'string')
    && isOptionalString(value.portrait)
    && isOptionalString(value.backgroundImage)
    && typeof value.defaultModel === 'string'
    && isFiniteNumber(value.createdAt)
    && isFiniteNumber(value.updatedAt);
}

function isUserPersona(value: unknown): value is CharacterChatUserPersona {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.role === 'string'
    && typeof value.personality === 'string'
    && typeof value.speakingStyle === 'string'
    && typeof value.background === 'string'
    && typeof value.goal === 'string'
    && isOptionalString(value.portrait)
    && isFiniteNumber(value.createdAt)
    && isFiniteNumber(value.updatedAt);
}

function isMessageBlock(value: unknown): boolean {
  return isRecord(value)
    && typeof value.type === 'string'
    && MESSAGE_BLOCK_TYPES.has(value.type)
    && typeof value.text === 'string';
}

function isMessage(value: unknown): value is CharacterChatMessage {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && (value.role === 'user' || value.role === 'assistant')
    && typeof value.content === 'string'
    && (value.blocks === undefined || (Array.isArray(value.blocks) && value.blocks.every(isMessageBlock)))
    && (value.emotion === undefined || (typeof value.emotion === 'string' && EMOTIONS.has(value.emotion)))
    && isFiniteNumber(value.createdAt)
    && (value.editedAt === undefined || isFiniteNumber(value.editedAt))
    && (value.isPinned === undefined || typeof value.isPinned === 'boolean');
}

function isSession(value: unknown): value is CharacterChatSession {
  if (!isRecord(value) || !Array.isArray(value.messages) || !value.messages.every(isMessage)) return false;
  const messageIds = value.messages.map((message) => message.id);
  return typeof value.id === 'string'
    && typeof value.personaId === 'string'
    && typeof value.title === 'string'
    && typeof value.model === 'string'
    && (value.userPersona === undefined || isUserPersona(value.userPersona))
    && new Set(messageIds).size === messageIds.length
    && typeof value.memorySummary === 'string'
    && Number.isInteger(value.summarizedMessageCount)
    && Number(value.summarizedMessageCount) >= 0
    && Number(value.summarizedMessageCount) <= value.messages.length
    && isFiniteNumber(value.affinity)
    && value.affinity >= -100
    && value.affinity <= 100
    && isFiniteNumber(value.createdAt)
    && isFiniteNumber(value.updatedAt);
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

export function parseCharacterChatBackup(value: unknown): CharacterChatBackupData | null {
  if (!isRecord(value)
    || (value.schemaVersion !== 1 && value.schemaVersion !== 2)
    || !Array.isArray(value.sources)
    || !value.sources.every(isSource)
    || !Array.isArray(value.personas)
    || !value.personas.every(isPersona)
    || (value.schemaVersion === 2 && (!Array.isArray(value.userPersonas) || !value.userPersonas.every(isUserPersona)))
    || !Array.isArray(value.sessions)
    || !value.sessions.every(isSession)) {
    return null;
  }

  const sources = value.sources;
  const personas = value.personas.map((persona) => ({
    ...persona,
    defaultModel: normalizeCharacterChatModel(persona.defaultModel),
  }));
  const userPersonas = value.schemaVersion === 2 ? value.userPersonas as CharacterChatUserPersona[] : [];
  const sessions = value.sessions.map((session) => ({
    ...session,
    model: normalizeCharacterChatModel(session.model),
  }));
  if (!hasUniqueIds(sources) || !hasUniqueIds(personas) || !hasUniqueIds(userPersonas) || !hasUniqueIds(sessions)) return null;

  const sourceIds = new Set(sources.map((source) => source.id));
  const personaIds = new Set(personas.map((persona) => persona.id));
  if (personas.some((persona) => !sourceIds.has(persona.sourceId))) return null;
  if (sessions.some((session) => !personaIds.has(session.personaId))) return null;

  return { schemaVersion: 2, sources, personas, userPersonas, sessions };
}
