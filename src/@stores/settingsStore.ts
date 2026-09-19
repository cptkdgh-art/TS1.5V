/**
 * ============================================================
 * @module stores/settingsStore
 * @file settingsStore.ts
 * ============================================================
 * @description 앱 설정 상태 관리 (API 키, 세션 시간 등)
 * ============================================================
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { get, set } from '@services/storage';
import { STORAGE_KEYS } from '@services/storage';
import { logger } from '@shared/utils/logger';

export type SessionDuration = '1h' | '2h' | '4h' | '8h';
export type AiProvider = 'gemini' | 'xai' | 'glm';
export type GeminiBackend = 'developer' | 'vertex';
export type GlmSecurityMode = 'strict' | 'moderate' | 'off';

export interface AppSettings {
  /** Gemini API 키 */
  geminiApiKey: string;
  /** Gemini 호출 경로 (AI Studio Developer API / Google Cloud Vertex AI) */
  geminiBackend: GeminiBackend;
  /** xAI API 키 */
  xaiApiKey: string;
  /** GLM (智谱) API 키 */
  glmApiKey: string;
  /** 현재 사용 중인 AI 제공자 */
  aiProvider: AiProvider;
  /** xAI Grok 모델 선택 */
  xaiModel: string;
  /** GLM 모델 선택 */
  glmModel: string;
  /** ChatGPT 모델 선택 */
  chatgptModel: string;
  /** 세션 지속 시간 */
  sessionDuration: SessionDuration;
  /** 마지막 세션 시작 시간 */
  sessionStartedAt: number | null;
  /** API 키 설정 완료 여부 */
  isApiKeyConfigured: boolean;
  /** GLM 보안 모드 (중국 모델 프라이버시 보호) */
  glmSecurityMode: GlmSecurityMode;
}

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  geminiBackend: 'developer',
  xaiApiKey: '',
  glmApiKey: '',
  aiProvider: 'gemini',
  xaiModel: 'grok-4-fast',
  glmModel: 'glm-5',
  chatgptModel: 'gpt-4o',
  sessionDuration: '4h',
  sessionStartedAt: null,
  isApiKeyConfigured: false,
  glmSecurityMode: 'moderate',
};

/** SessionDuration → ms */
const SESSION_MS: Record<SessionDuration, number> = {
  '1h': 1 * 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
};

interface SettingsState extends AppSettings {
  isLoading: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  setApiKey: (apiKey: string) => Promise<void>;
  setGeminiBackend: (backend: GeminiBackend) => Promise<void>;
  setXaiApiKey: (apiKey: string) => Promise<void>;
  setGlmApiKey: (apiKey: string) => Promise<void>;
  setAiProvider: (provider: AiProvider) => Promise<void>;
  setXaiModel: (model: string) => Promise<void>;
  setGlmModel: (model: string) => Promise<void>;
  setGlmSecurityMode: (mode: GlmSecurityMode) => Promise<void>;
  setChatgptModel: (model: string) => Promise<void>;
  setSessionDuration: (duration: SessionDuration) => Promise<void>;
  startSession: () => Promise<void>;
  clearApiKey: () => Promise<void>;
  isSessionValid: () => boolean;
  getTimeRemaining: () => number;
  /** 만료된 세션 체크 후 API 키 삭제 */
  checkAndClearExpiredSession: () => Promise<boolean>;
  getApiKey: (provider: AiProvider) => string;
}

/** SettingsState에서 AppSettings 필드만 추출 (새 필드 추가 시 컴파일 에러로 보호) */
function extractSettings(state: SettingsState): AppSettings {
  return {
    geminiApiKey: state.geminiApiKey,
    geminiBackend: state.geminiBackend,
    xaiApiKey: state.xaiApiKey,
    glmApiKey: state.glmApiKey,
    aiProvider: state.aiProvider,
    xaiModel: state.xaiModel,
    glmModel: state.glmModel,
    chatgptModel: state.chatgptModel,
    sessionDuration: state.sessionDuration,
    sessionStartedAt: state.sessionStartedAt,
    isApiKeyConfigured: state.isApiKeyConfigured,
    glmSecurityMode: state.glmSecurityMode,
  };
}

export const useSettingsStore = create<SettingsState>((setState, getState) => {
  /** 설정 patch를 저장소에 영속화 + 상태 동기화 */
  const persist = async (patch: Partial<AppSettings>) => {
    const current = extractSettings(getState());
    const next: AppSettings = { ...current, ...patch };
    await set(STORAGE_KEYS.SETTINGS, next);
    setState(patch);
  };

  /** AI 기능 기본 경로는 Gemini이므로 Gemini 키 기준으로 판정. */
  const computeConfigured = (keyPatch: Partial<Pick<AppSettings, 'geminiApiKey' | 'xaiApiKey' | 'glmApiKey'>>): boolean => {
    const s = getState();
    const gemini = keyPatch.geminiApiKey ?? s.geminiApiKey;
    return gemini.length > 0;
  };

  return {
    ...DEFAULT_SETTINGS,
    isLoading: true,

    loadSettings: async () => {
      try {
        const settings = await get<AppSettings>(STORAGE_KEYS.SETTINGS);
        if (settings) {
          setState({
            ...settings,
            geminiBackend: settings.geminiBackend === 'vertex' ? 'vertex' : 'developer',
            aiProvider: 'gemini',
            isApiKeyConfigured: !!settings.geminiApiKey,
            isLoading: false,
          });
          // 세션 만료 체크 - 만료 시 API 키 삭제
          await getState().checkAndClearExpiredSession();
        } else {
          setState({ isLoading: false });
        }
      } catch (error) {
        logger.error('[SettingsStore] 설정 로드 실패:', error);
        setState({ isLoading: false });
      }
    },

    setApiKey: async (geminiApiKey) =>
      persist({ geminiApiKey, isApiKeyConfigured: computeConfigured({ geminiApiKey }) }),

    setGeminiBackend: async (geminiBackend) => persist({ geminiBackend }),

    setXaiApiKey: async (xaiApiKey) =>
      persist({ xaiApiKey, isApiKeyConfigured: computeConfigured({ xaiApiKey }) }),

    setGlmApiKey: async (glmApiKey) =>
      persist({ glmApiKey, isApiKeyConfigured: computeConfigured({ glmApiKey }) }),

    setAiProvider: async () =>
      persist({ aiProvider: 'gemini', isApiKeyConfigured: computeConfigured({}) }),

    setXaiModel: async (xaiModel) => persist({ xaiModel }),
    setGlmModel: async (glmModel) => persist({ glmModel }),
    setGlmSecurityMode: async (glmSecurityMode) => persist({ glmSecurityMode }),
    setChatgptModel: async (chatgptModel) => persist({ chatgptModel }),
    setSessionDuration: async (sessionDuration) => persist({ sessionDuration }),
    startSession: async () => persist({ sessionStartedAt: Date.now() }),

    clearApiKey: async () => {
      await set(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
      setState(DEFAULT_SETTINGS);
    },

    isSessionValid: () => {
      const { sessionDuration, sessionStartedAt } = getState();
      if (!sessionStartedAt) return false;
      return Date.now() - sessionStartedAt < SESSION_MS[sessionDuration];
    },

    getTimeRemaining: () => {
      const { sessionDuration, sessionStartedAt } = getState();
      if (!sessionStartedAt) return 0;
      return Math.max(0, SESSION_MS[sessionDuration] - (Date.now() - sessionStartedAt));
    },

    getApiKey: (provider) => {
      const state = getState();
      if (state.sessionStartedAt !== null && !state.isSessionValid()) {
        void state.checkAndClearExpiredSession().catch((error) => {
          logger.error('[SettingsStore] 만료 키 삭제 저장 실패:', error);
        });
        return '';
      }
      return provider === 'gemini' ? state.geminiApiKey : provider === 'xai' ? state.xaiApiKey : state.glmApiKey;
    },

    /** 만료된 세션 체크 후 API 키 삭제 */
    checkAndClearExpiredSession: async () => {
      const state = getState();
      if (state.sessionStartedAt === null) return false;
      if (state.isSessionValid()) return false;

      // 세션 만료 - API 키 전체 삭제
      const cleared = { geminiApiKey: '', xaiApiKey: '', glmApiKey: '', isApiKeyConfigured: false };
      setState(cleared);
      await set(STORAGE_KEYS.SETTINGS, extractSettings(getState()));
      logger.log('[SettingsStore] 세션 만료로 API 키 삭제됨');
      return true;
    },
  };
});

// ============================================================
// Selectors - 성능 최적화를 위한 선택적 구독
// ============================================================

/** 현재 AI 제공자만 구독 */
export const useAiProvider = () => useSettingsStore((state) => state.aiProvider);

/** API 키 설정 여부만 구독 */
export const useIsApiKeyConfigured = () => useSettingsStore((state) => state.isApiKeyConfigured);

/** 로딩 상태만 구독 */
export const useSettingsLoading = () => useSettingsStore((state) => state.isLoading);

/** 현재 제공자의 API 키 구독 */
export const useCurrentApiKey = () =>
  useSettingsStore((state) => {
    switch (state.aiProvider) {
      case 'gemini': return state.geminiApiKey;
      case 'xai': return state.xaiApiKey;
      case 'glm': return state.glmApiKey;
      default: return '';
    }
  });

/** GLM 보안 모드만 구독 */
export const useGlmSecurityMode = () => useSettingsStore((state) => state.glmSecurityMode);

/** Actions만 구독 */
export const useSettingsActions = () =>
  useSettingsStore(
    useShallow((state) => ({
      loadSettings: state.loadSettings,
      setApiKey: state.setApiKey,
      setGeminiBackend: state.setGeminiBackend,
      setXaiApiKey: state.setXaiApiKey,
      setGlmApiKey: state.setGlmApiKey,
      setAiProvider: state.setAiProvider,
      setXaiModel: state.setXaiModel,
      setGlmModel: state.setGlmModel,
      setGlmSecurityMode: state.setGlmSecurityMode,
      setChatgptModel: state.setChatgptModel,
      setSessionDuration: state.setSessionDuration,
      startSession: state.startSession,
      clearApiKey: state.clearApiKey,
      isSessionValid: state.isSessionValid,
      getTimeRemaining: state.getTimeRemaining,
    }))
  );
