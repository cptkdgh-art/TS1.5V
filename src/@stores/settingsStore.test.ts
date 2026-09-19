import { describe, it, expect, beforeEach, vi } from 'vitest';

// @services/storage 모킹 — 인메모리 저장소
const store = new Map<string, unknown>();
vi.mock('@services/storage', () => ({
  STORAGE_KEYS: { SETTINGS: 'settings' },
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
}));

const { useSettingsStore } = await import('./settingsStore');
const {
  MODELS,
  getCurrentApiInfo,
  getProviderForGenerationEngine,
  isApiKeyConfigured,
  normalizeGeminiTextModel,
} = await import('@services/ai/config');

describe('settingsStore', () => {
  it('rejects expired keys at actual provider access without reloading', async () => {
    const { getGeminiApiKey, getXaiApiKey, getGlmApiKey } = await import('@services/ai/config');
    useSettingsStore.setState({ geminiApiKey: 'old', xaiApiKey: 'old', glmApiKey: 'old', sessionDuration: '1h', sessionStartedAt: Date.now() - 3_600_000 });
    expect(getGeminiApiKey()).toBe('');
    expect(getXaiApiKey()).toBe('');
    expect(getGlmApiKey()).toBe('');
    expect(useSettingsStore.getState().geminiApiKey).toBe('');
  });
  beforeEach(() => {
    store.clear();
    // 스토어 상태 리셋
    useSettingsStore.setState({
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
      isLoading: false,
    });
  });

  describe('persist — API 키 세터', () => {
    it('setApiKey로 gemini 키 저장 시 isApiKeyConfigured가 true가 된다', async () => {
      await useSettingsStore.getState().setApiKey('gemini-abc');
      const s = useSettingsStore.getState();
      expect(s.geminiApiKey).toBe('gemini-abc');
      expect(s.isApiKeyConfigured).toBe(true);
    });

    it('GLM 키만 있으면 Gemini 기본 AI 기능은 설정 완료로 보지 않는다', async () => {
      await useSettingsStore.getState().setGlmApiKey('glm-xyz');
      expect(useSettingsStore.getState().isApiKeyConfigured).toBe(false);
    });

    it('gemini 키를 빈 문자열로 설정하면 다른 키 없을 때 isApiKeyConfigured가 false', async () => {
      await useSettingsStore.getState().setApiKey('temp');
      await useSettingsStore.getState().setApiKey('');
      expect(useSettingsStore.getState().isApiKeyConfigured).toBe(false);
    });

    it('xAI 키가 있어도 gemini 키가 비어 있으면 isApiKeyConfigured는 false', async () => {
      await useSettingsStore.getState().setXaiApiKey('xai-key');
      await useSettingsStore.getState().setApiKey('');
      expect(useSettingsStore.getState().isApiKeyConfigured).toBe(false);
    });

    it('setXaiModel은 다른 필드를 건드리지 않는다', async () => {
      await useSettingsStore.getState().setApiKey('gemini');
      await useSettingsStore.getState().setXaiModel('grok-5');
      const s = useSettingsStore.getState();
      expect(s.xaiModel).toBe('grok-5');
      expect(s.geminiApiKey).toBe('gemini');
      expect(s.isApiKeyConfigured).toBe(true);
    });
  });

  describe('persist — 저장소 영속화', () => {
    it('setter 호출 시 저장소에 전체 AppSettings이 저장된다', async () => {
      await useSettingsStore.getState().setApiKey('k1');
      await useSettingsStore.getState().setGlmModel('glm-6');
      const saved = store.get('settings') as Record<string, unknown>;
      expect(saved.geminiApiKey).toBe('k1');
      expect(saved.glmModel).toBe('glm-6');
      expect(saved.aiProvider).toBe('gemini');
    });

    it('Vertex AI 경로 선택을 저장하고 다시 불러온다', async () => {
      await useSettingsStore.getState().setGeminiBackend('vertex');
      expect((store.get('settings') as Record<string, unknown>).geminiBackend).toBe('vertex');

      useSettingsStore.setState({ geminiBackend: 'developer' });
      await useSettingsStore.getState().loadSettings();
      expect(useSettingsStore.getState().geminiBackend).toBe('vertex');
    });

    it('기존 저장 데이터에 경로가 없으면 AI Studio 경로로 안전하게 보정한다', async () => {
      await useSettingsStore.getState().setApiKey('legacy-key');
      const saved = store.get('settings') as Record<string, unknown>;
      store.set('settings', { ...saved, geminiBackend: undefined });

      await useSettingsStore.getState().loadSettings();
      expect(useSettingsStore.getState().geminiBackend).toBe('developer');
    });
  });

  describe('집필 엔진별 API 키 판정', () => {
    it('Gemini 엔진은 Gemini 키를 기준으로 판정한다', async () => {
      await useSettingsStore.getState().setApiKey('gemini-key');
      expect(isApiKeyConfigured('gemini-3-flash-preview')).toBe(true);
      expect(getCurrentApiInfo('gemini-3-flash-preview')).toEqual({
        provider: 'Gemini',
        model: 'gemini-3.7-flash',
      });
    });

    it('xAI 엔진은 Gemini 키가 없어도 xAI 키를 기준으로 판정한다', async () => {
      await useSettingsStore.getState().setXaiApiKey('xai-key');
      expect(isApiKeyConfigured('grok-4-fast')).toBe(true);
      expect(getCurrentApiInfo('grok-4-fast')).toEqual({
        provider: 'xAI',
        model: 'grok-4-fast',
      });
    });

    it('GLM 엔진은 Gemini 키가 없어도 GLM 키를 기준으로 판정한다', async () => {
      await useSettingsStore.getState().setGlmApiKey('glm-key');
      expect(isApiKeyConfigured('glm-5')).toBe(true);
      expect(getCurrentApiInfo('glm-5')).toEqual({
        provider: 'GLM',
        model: 'glm-5',
      });
    });
  });

  describe('Gemini 모델 정규화', () => {
    it('지원 종료 Gemini 3 Flash Preview는 현재 기본 3.7 Flash로 보정한다', () => {
      expect(normalizeGeminiTextModel('gemini-3-flash-preview')).toBe(MODELS.TEXT);
    });

    it('구형 3.0 Flash 표기는 현재 기본 3.7 Flash로 보정한다', () => {
      expect(normalizeGeminiTextModel('gemini-3.0-flash')).toBe(MODELS.TEXT);
      expect(getCurrentApiInfo('gemini-3.0-flash')).toEqual({
        provider: 'Gemini',
        model: 'gemini-3.7-flash',
      });
    });

    it('구형 Pro와 Flash-Lite alias를 현재 드롭다운 모델로 보정한다', () => {
      expect(normalizeGeminiTextModel('gemini-3-pro-preview')).toBe(MODELS.PRO);
      expect(normalizeGeminiTextModel('gemini-3.0-pro')).toBe(MODELS.PRO);
      expect(normalizeGeminiTextModel('gemini-3.1-flash-lite-preview')).toBe(MODELS.FLASH_LITE);
      expect(normalizeGeminiTextModel('gemini-2.5-flash-lite')).toBe(MODELS.FLASH_LITE);
      expect(normalizeGeminiTextModel('gemini-3.1-flash-lite')).toBe(MODELS.FLASH_LITE);
    });

    it('집필 엔진 prefix로 provider를 구분한다', () => {
      expect(getProviderForGenerationEngine('grok-4-fast')).toBe('xai');
      expect(getProviderForGenerationEngine('glm-5')).toBe('glm');
      expect(getProviderForGenerationEngine('gemini-3.6-flash')).toBe('gemini');
      expect(getProviderForGenerationEngine(undefined)).toBe('gemini');
    });
  });

  describe('세션 로직', () => {
    it('세션 시작 전엔 isSessionValid = false', () => {
      expect(useSettingsStore.getState().isSessionValid()).toBe(false);
    });

    it('startSession 직후엔 isSessionValid = true', async () => {
      await useSettingsStore.getState().startSession();
      expect(useSettingsStore.getState().isSessionValid()).toBe(true);
    });

    it('4h 세션, 방금 시작한 경우 남은 시간이 거의 4h', async () => {
      await useSettingsStore.getState().startSession();
      const remaining = useSettingsStore.getState().getTimeRemaining();
      expect(remaining).toBeGreaterThan(3.9 * 60 * 60 * 1000);
      expect(remaining).toBeLessThanOrEqual(4 * 60 * 60 * 1000);
    });

    it('세션 만료되면 isSessionValid = false', () => {
      useSettingsStore.setState({
        sessionStartedAt: Date.now() - 5 * 60 * 60 * 1000, // 5시간 전
        sessionDuration: '4h',
      });
      expect(useSettingsStore.getState().isSessionValid()).toBe(false);
    });

    it('checkAndClearExpiredSession: 만료 시 API 키 전체 삭제', async () => {
      useSettingsStore.setState({
        geminiApiKey: 'k',
        xaiApiKey: 'x',
        isApiKeyConfigured: true,
        sessionStartedAt: Date.now() - 10 * 60 * 60 * 1000,
        sessionDuration: '4h',
      });
      const cleared = await useSettingsStore.getState().checkAndClearExpiredSession();
      expect(cleared).toBe(true);
      const s = useSettingsStore.getState();
      expect(s.geminiApiKey).toBe('');
      expect(s.xaiApiKey).toBe('');
      expect(s.isApiKeyConfigured).toBe(false);
    });

    it('checkAndClearExpiredSession: 세션 유효하면 그대로', async () => {
      useSettingsStore.setState({
        geminiApiKey: 'k',
        sessionStartedAt: Date.now(),
        sessionDuration: '4h',
      });
      const cleared = await useSettingsStore.getState().checkAndClearExpiredSession();
      expect(cleared).toBe(false);
      expect(useSettingsStore.getState().geminiApiKey).toBe('k');
    });
  });

  describe('clearApiKey', () => {
    it('모든 키와 설정을 기본값으로 리셋', async () => {
      await useSettingsStore.getState().setApiKey('g');
      await useSettingsStore.getState().setXaiApiKey('x');
      await useSettingsStore.getState().clearApiKey();
      const s = useSettingsStore.getState();
      expect(s.geminiApiKey).toBe('');
      expect(s.xaiApiKey).toBe('');
      expect(s.glmApiKey).toBe('');
      expect(s.isApiKeyConfigured).toBe(false);
    });
  });
});
