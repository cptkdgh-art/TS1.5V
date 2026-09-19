import { create } from 'zustand';
import type {
  CharacterChatBackupData,
  CharacterChatMessage,
  CharacterChatModel,
  CharacterChatPersona,
  CharacterChatSession,
  CharacterChatSource,
  CharacterChatUserPersona,
} from '@core/types';
import { get, set, STORAGE_KEYS } from '@services/storage';
import {
  calculateSessionAffinity,
  normalizeCharacterChatModel,
  snapshotUserPersona,
} from '@services/character-chat';

const EMPTY_BACKUP: CharacterChatBackupData = {
  schemaVersion: 2,
  sources: [],
  personas: [],
  userPersonas: [],
  sessions: [],
};

let sourceQueue = Promise.resolve();
let personaQueue = Promise.resolve();
let userPersonaQueue = Promise.resolve();
let sessionQueue = Promise.resolve();

function persistSources(sources: CharacterChatSource[]) {
  sourceQueue = sourceQueue.catch(() => undefined).then(() => set(STORAGE_KEYS.CHARACTER_CHAT_SOURCES, sources));
  return sourceQueue;
}

function persistPersonas(personas: CharacterChatPersona[]) {
  personaQueue = personaQueue.catch(() => undefined).then(() => set(STORAGE_KEYS.CHARACTER_CHAT_PERSONAS, personas));
  return personaQueue;
}

function persistUserPersonas(userPersonas: CharacterChatUserPersona[]) {
  userPersonaQueue = userPersonaQueue.catch(() => undefined).then(() => (
    set(STORAGE_KEYS.CHARACTER_CHAT_USER_PERSONAS, userPersonas)
  ));
  return userPersonaQueue;
}

function persistSessions(sessions: CharacterChatSession[]) {
  sessionQueue = sessionQueue.catch(() => undefined).then(() => set(STORAGE_KEYS.CHARACTER_CHAT_SESSIONS, sessions));
  return sessionQueue;
}

interface CharacterChatState {
  sources: CharacterChatSource[];
  personas: CharacterChatPersona[];
  userPersonas: CharacterChatUserPersona[];
  sessions: CharacterChatSession[];
  isLoading: boolean;
  load: () => Promise<void>;
  upsertSource: (source: CharacterChatSource) => Promise<void>;
  upsertPersona: (persona: CharacterChatPersona) => Promise<void>;
  upsertUserPersona: (persona: CharacterChatUserPersona) => Promise<void>;
  deleteUserPersona: (personaId: string) => Promise<void>;
  duplicatePersona: (personaId: string) => Promise<CharacterChatPersona | undefined>;
  deletePersona: (personaId: string) => Promise<void>;
  createSession: (personaId: string, model: CharacterChatModel, userPersona?: CharacterChatUserPersona) => Promise<CharacterChatSession>;
  mutateSession: (sessionId: string, updater: (session: CharacterChatSession) => CharacterChatSession) => Promise<CharacterChatSession | undefined>;
  duplicateSession: (sessionId: string, throughMessageId?: string) => Promise<CharacterChatSession | undefined>;
  deleteSession: (sessionId: string) => Promise<void>;
  appendMessage: (sessionId: string, message: CharacterChatMessage) => Promise<void>;
  replaceAll: (data: CharacterChatBackupData) => Promise<void>;
  getBackup: () => CharacterChatBackupData;
}

export const useCharacterChatStore = create<CharacterChatState>((setState, getState) => ({
  ...EMPTY_BACKUP,
  isLoading: true,

  load: async () => {
    try {
      const [sources, personas, userPersonas, sessions] = await Promise.all([
        get<CharacterChatSource[]>(STORAGE_KEYS.CHARACTER_CHAT_SOURCES),
        get<CharacterChatPersona[]>(STORAGE_KEYS.CHARACTER_CHAT_PERSONAS),
        get<CharacterChatUserPersona[]>(STORAGE_KEYS.CHARACTER_CHAT_USER_PERSONAS),
        get<CharacterChatSession[]>(STORAGE_KEYS.CHARACTER_CHAT_SESSIONS),
      ]);
      const loadedPersonas = (personas || []).map((persona) => ({
        ...persona,
        defaultModel: normalizeCharacterChatModel(persona.defaultModel),
      }));
      const loadedSessions = (sessions || []).map((session) => ({
        ...session,
        model: normalizeCharacterChatModel(session.model),
      }));
      const modelsChanged = loadedPersonas.some((persona, index) => (
        persona.defaultModel !== personas?.[index]?.defaultModel
      )) || loadedSessions.some((session, index) => (
        session.model !== sessions?.[index]?.model
      ));

      setState({
        sources: sources || [],
        personas: loadedPersonas,
        userPersonas: userPersonas || [],
        sessions: loadedSessions,
        isLoading: false,
      });
      if (modelsChanged) {
        await Promise.all([
          persistPersonas(loadedPersonas),
          persistSessions(loadedSessions),
        ]);
      }
    } catch (error) {
      console.error('[CharacterChatStore] 로드 실패:', error);
      setState({ isLoading: false });
    }
  },

  upsertSource: async (source) => {
    const sources = getState().sources.some((item) => item.id === source.id)
      ? getState().sources.map((item) => item.id === source.id ? source : item)
      : [...getState().sources, source];
    setState({ sources });
    await persistSources(sources);
  },

  upsertPersona: async (persona) => {
    const personas = getState().personas.some((item) => item.id === persona.id)
      ? getState().personas.map((item) => item.id === persona.id ? persona : item)
      : [...getState().personas, persona];
    setState({ personas });
    await persistPersonas(personas);
  },

  upsertUserPersona: async (persona) => {
    const userPersonas = getState().userPersonas.some((item) => item.id === persona.id)
      ? getState().userPersonas.map((item) => item.id === persona.id ? persona : item)
      : [...getState().userPersonas, persona];
    setState({ userPersonas });
    await persistUserPersonas(userPersonas);
  },

  deleteUserPersona: async (personaId) => {
    const userPersonas = getState().userPersonas.filter((persona) => persona.id !== personaId);
    setState({ userPersonas });
    await persistUserPersonas(userPersonas);
  },

  duplicatePersona: async (personaId) => {
    const original = getState().personas.find((persona) => persona.id === personaId);
    if (!original) return undefined;
    const now = Date.now();
    const copy: CharacterChatPersona = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} 복사본`,
      aliases: [...original.aliases],
      createdAt: now,
      updatedAt: now,
    };
    const personas = [...getState().personas, copy];
    await persistPersonas(personas);
    setState({ personas });
    return copy;
  },

  deletePersona: async (personaId) => {
    const deleted = getState().personas.find((persona) => persona.id === personaId);
    const personas = getState().personas.filter((persona) => persona.id !== personaId);
    const sessions = getState().sessions.filter((session) => session.personaId !== personaId);
    const sourceIsStillUsed = deleted
      ? personas.some((persona) => persona.sourceId === deleted.sourceId)
      : true;
    const sources = deleted && !sourceIsStillUsed
      ? getState().sources.filter((source) => source.id !== deleted.sourceId)
      : getState().sources;
    setState({ sources, personas, sessions });
    await Promise.all([
      persistSources(sources),
      persistPersonas(personas),
      persistSessions(sessions),
    ]);
  },

  createSession: async (personaId, model, userPersona) => {
    const now = Date.now();
    const session: CharacterChatSession = {
      id: crypto.randomUUID(),
      personaId,
      title: `대화 ${new Date(now).toLocaleString('ko-KR')}`,
      model,
      userPersona: snapshotUserPersona(userPersona),
      messages: [],
      memorySummary: '',
      summarizedMessageCount: 0,
      affinity: 0,
      createdAt: now,
      updatedAt: now,
    };
    const sessions = [...getState().sessions, session];
    setState({ sessions });
    await persistSessions(sessions);
    return session;
  },

  mutateSession: async (sessionId, updater) => {
    let updated: CharacterChatSession | undefined;
    const sessions = getState().sessions.map((session) => {
      if (session.id !== sessionId) return session;
      updated = { ...updater(session), id: sessionId, updatedAt: Date.now() };
      return updated;
    });
    if (!updated) return undefined;
    setState({ sessions });
    await persistSessions(sessions);
    return updated;
  },

  duplicateSession: async (sessionId, throughMessageId) => {
    const original = getState().sessions.find((session) => session.id === sessionId);
    if (!original) return undefined;
    const branchIndex = throughMessageId
      ? original.messages.findIndex((message) => message.id === throughMessageId)
      : -1;
    if (throughMessageId && branchIndex < 0) return undefined;
    const endIndex = throughMessageId ? branchIndex + 1 : original.messages.length;
    const isBranch = Boolean(throughMessageId);
    const messages = original.messages
      .slice(0, Math.max(0, endIndex))
      .map((message) => ({ ...message }));
    const now = Date.now();
    const copy: CharacterChatSession = {
      ...original,
      id: crypto.randomUUID(),
      title: isBranch ? `${original.title} 분기` : `${original.title} 복사본`,
      messages,
      memorySummary: isBranch ? '' : original.memorySummary,
      summarizedMessageCount: isBranch ? 0 : original.summarizedMessageCount,
      affinity: isBranch ? calculateSessionAffinity(messages) : original.affinity,
      createdAt: now,
      updatedAt: now,
    };
    const sessions = [...getState().sessions, copy];
    setState({ sessions });
    await persistSessions(sessions);
    return copy;
  },

  deleteSession: async (sessionId) => {
    const sessions = getState().sessions.filter((session) => session.id !== sessionId);
    setState({ sessions });
    await persistSessions(sessions);
  },

  appendMessage: async (sessionId, message) => {
    await getState().mutateSession(sessionId, (session) => ({
      ...session,
      messages: session.messages.some((item) => item.id === message.id)
        ? session.messages
        : [...session.messages, message],
    }));
  },

  replaceAll: async (data) => {
    const next = data.schemaVersion === 2 ? data : EMPTY_BACKUP;
    const personas = next.personas.map((persona) => ({
      ...persona,
      defaultModel: normalizeCharacterChatModel(persona.defaultModel),
    }));
    const sessions = next.sessions.map((session) => ({
      ...session,
      model: normalizeCharacterChatModel(session.model),
    }));
    setState({
      sources: next.sources,
      personas,
      userPersonas: next.userPersonas,
      sessions,
    });
    await Promise.all([
      persistSources(next.sources),
      persistPersonas(personas),
      persistUserPersonas(next.userPersonas),
      persistSessions(sessions),
    ]);
  },

  getBackup: () => ({
    schemaVersion: 2,
    sources: getState().sources,
    personas: getState().personas,
    userPersonas: getState().userPersonas,
    sessions: getState().sessions,
  }),
}));
