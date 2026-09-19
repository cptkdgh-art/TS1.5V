import { create } from 'zustand';
import type {
  AiAuthor,
  DirectorClioBackupData,
  DirectorClioReadMode,
  DirectorClioSession,
} from '@core/types';
import { get, set, STORAGE_KEYS } from '@services/storage';
import { parseDirectorClioBackup } from '@services/director-clio';

const EMPTY_DATA: DirectorClioBackupData = {
  schemaVersion: 1,
  memories: [],
  sessions: {},
  activeNovelId: null,
  legacyMigrationCompleted: false,
};

let persistQueue: Promise<void> = Promise.resolve();

function sessionKey(novelId: string | null): string {
  return novelId || 'studio';
}

function persist(data: DirectorClioBackupData): Promise<void> {
  persistQueue = persistQueue
    .catch(() => undefined)
    .then(() => set(STORAGE_KEYS.DIRECTOR_CLIO, data));
  return persistQueue;
}

function createSession(novelId: string | null, readMode: DirectorClioReadMode = 'recent'): DirectorClioSession {
  return {
    novelId,
    history: [],
    readMode,
    updatedAt: Date.now(),
  };
}

export interface DirectorClioRequest {
  id: string;
  revision: DirectorClioSession | undefined;
}

interface DirectorClioState extends DirectorClioBackupData {
  requests: Record<string, DirectorClioRequest>;
  beginRequest: (novelId: string | null) => DirectorClioRequest | null;
  applyRequest: (novelId: string | null, request: DirectorClioRequest, updater: (session: DirectorClioSession) => Partial<DirectorClioSession>) => Promise<boolean>;
  finishRequest: (novelId: string | null, request: DirectorClioRequest) => void;
  isLoading: boolean;
  load: () => Promise<void>;
  setActiveNovel: (novelId: string | null) => Promise<void>;
  updateSession: (novelId: string | null, updates: Partial<Omit<DirectorClioSession, 'novelId'>>) => Promise<void>;
  clearSession: (novelId: string | null) => Promise<void>;
  clearAllSessions: () => Promise<void>;
  setMemories: (memories: string[]) => Promise<void>;
  migrateLegacySession: (authors: AiAuthor[]) => Promise<void>;
  replaceAll: (data: DirectorClioBackupData) => Promise<void>;
  getBackup: () => DirectorClioBackupData;
}

function snapshot(state: DirectorClioState): DirectorClioBackupData {
  return {
    schemaVersion: 1,
    memories: [...state.memories],
    sessions: structuredClone(state.sessions),
    activeNovelId: state.activeNovelId,
    legacyMigrationCompleted: state.legacyMigrationCompleted ?? false,
  };
}

export const useDirectorClioStore = create<DirectorClioState>((setState, getState) => ({
  ...EMPTY_DATA,
  isLoading: true,
  requests: {},

  beginRequest: (novelId) => {
    const key = sessionKey(novelId);
    if (getState().requests[key]) return null;
    const request = { id: crypto.randomUUID(), revision: getState().sessions[key] };
    setState((state) => ({ requests: { ...state.requests, [key]: request } }));
    return request;
  },

  applyRequest: async (novelId, request, updater) => {
    const key = sessionKey(novelId);
    const state = getState();
    if (state.requests[key] !== request || state.sessions[key] !== request.revision) return false;
    const current = state.sessions[key] || createSession(novelId);
    const next = { ...current, ...updater(current), novelId, updatedAt: Date.now() };
    request.revision = next;
    setState({ sessions: { ...state.sessions, [key]: next } });
    await persist(snapshot(getState()));
    return getState().requests[key] === request && getState().sessions[key] === next;
  },

  finishRequest: (novelId, request) => {
    const key = sessionKey(novelId);
    if (getState().requests[key] !== request) return;
    const requests = { ...getState().requests };
    delete requests[key];
    setState({ requests });
  },

  load: async () => {
    try {
      const stored = await get<DirectorClioBackupData>(STORAGE_KEYS.DIRECTOR_CLIO);
      const parsed = stored ? parseDirectorClioBackup(stored) : EMPTY_DATA;
      setState({ ...(parsed || EMPTY_DATA), isLoading: false });
    } catch (error) {
      console.error('[DirectorClioStore] 로드 실패:', error);
      setState({ ...EMPTY_DATA, isLoading: false });
    }
  },

  setActiveNovel: async (novelId) => {
    setState({ activeNovelId: novelId });
    await persist(snapshot(getState()));
  },

  updateSession: async (novelId, updates) => {
    const key = sessionKey(novelId);
    const current = getState().sessions[key] || createSession(novelId);
    setState((state) => ({
      sessions: {
        ...state.sessions,
        [key]: {
          ...current,
          ...updates,
          novelId,
          updatedAt: Date.now(),
        },
      },
    }));
    await persist(snapshot(getState()));
  },

  clearSession: async (novelId) => {
    const key = sessionKey(novelId);
    setState((state) => {
      const sessions = { ...state.sessions };
      delete sessions[key];
      const requests = { ...state.requests };
      delete requests[key];
      return { sessions, requests };
    });
    await persist(snapshot(getState()));
  },

  clearAllSessions: async () => {
    setState({ sessions: {}, activeNovelId: null, requests: {} });
    await persist(snapshot(getState()));
  },

  setMemories: async (memories) => {
    setState({ memories: [...memories] });
    await persist(snapshot(getState()));
  },

  migrateLegacySession: async (authors) => {
    if (getState().legacyMigrationCompleted) return;
    const legacyOwner = authors.find((author) => (
      (author.directorChatHistory?.length || 0) > 0 || !!author.directorChatSummary
    ));
    if (legacyOwner && !getState().sessions.studio) {
      await getState().updateSession(null, {
        history: legacyOwner.directorChatHistory || [],
        summary: legacyOwner.directorChatSummary,
        readMode: 'recent',
      });
    }
    setState({ legacyMigrationCompleted: true });
    await persist(snapshot(getState()));
  },

  replaceAll: async (data) => {
    const parsed = parseDirectorClioBackup(data);
    if (!parsed) throw new Error('Invalid director Clio backup');
    setState({ ...structuredClone(parsed), isLoading: false, requests: {} });
    await persist(snapshot(getState()));
  },

  getBackup: () => snapshot(getState()),
}));
