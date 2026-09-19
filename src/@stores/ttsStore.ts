/**
 * ============================================================
 * @module stores/ttsStore
 * @file ttsStore.ts
 * ============================================================
 * @description TTS 상태 관리 (Zustand)
 * - 음성 설정, 재생 상태, 음성 모델 관리
 * ============================================================
 */

import { create } from 'zustand';
import type {
  TTSSettings,
  TTSPlaybackState,
  TTSEngineType,
  TTSEngineStatus,
  VoiceModel,
} from '@core/types/tts.types';
import { DEFAULT_TTS_SETTINGS } from '@core/types/tts.types';
import { get, set } from '@services/storage';
import { logger } from '@shared/utils/logger';

// ========================================
// Storage Key
// ========================================

const TTS_SETTINGS_KEY = 'tts_settings';
const TTS_VOICES_KEY = 'tts_custom_voices';

// ========================================
// State Interface
// ========================================

interface TTSState {
  // 설정
  settings: TTSSettings;

  // 재생 상태
  playback: TTSPlaybackState;

  // 사용 가능한 음성 목록
  availableVoices: VoiceModel[];

  // 커스텀 음성 (로컬 모델)
  customVoices: VoiceModel[];

  // 초기화 상태
  isInitialized: boolean;

  // ========================================
  // Settings Actions
  // ========================================
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<TTSSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  setEngine: (engine: TTSEngineType) => Promise<void>;
  setVoice: (voiceId: string) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
  setPitch: (pitch: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;

  // ========================================
  // Playback Actions
  // ========================================
  setPlaybackStatus: (status: TTSEngineStatus) => void;
  setCurrentText: (text: string) => void;
  setProgress: (index: number, total: number) => void;
  setError: (error: string | undefined) => void;
  resetPlayback: () => void;

  // ========================================
  // Voice Management
  // ========================================
  setAvailableVoices: (voices: VoiceModel[]) => void;
  loadCustomVoices: () => Promise<void>;
  addCustomVoice: (voice: VoiceModel) => Promise<void>;
  removeCustomVoice: (voiceId: string) => Promise<void>;
  getVoiceById: (voiceId: string) => VoiceModel | undefined;
}

// ========================================
// Initial States
// ========================================

const initialPlayback: TTSPlaybackState = {
  status: 'idle',
  currentText: '',
  currentIndex: 0,
  totalSentences: 0,
  progress: 0,
  error: undefined,
};

// ========================================
// Store
// ========================================

export const useTTSStore = create<TTSState>((setState, getState) => ({
  // Initial state
  settings: DEFAULT_TTS_SETTINGS,
  playback: initialPlayback,
  availableVoices: [],
  customVoices: [],
  isInitialized: false,

  // ========================================
  // Settings Actions
  // ========================================

  loadSettings: async () => {
    try {
      const [savedSettings, customVoices] = await Promise.all([
        get<TTSSettings>(TTS_SETTINGS_KEY),
        get<VoiceModel[]>(TTS_VOICES_KEY),
      ]);

      setState({
        settings: savedSettings
          ? { ...DEFAULT_TTS_SETTINGS, ...savedSettings }
          : DEFAULT_TTS_SETTINGS,
        customVoices: customVoices || [],
        isInitialized: true,
      });

      logger.log('[TTSStore] 설정 로드 완료');
    } catch (error) {
      console.error('[TTSStore] 설정 로드 실패:', error);
      setState({ isInitialized: true });
    }
  },

  updateSettings: async (updates) => {
    const { settings } = getState();
    const newSettings = { ...settings, ...updates };
    await set(TTS_SETTINGS_KEY, newSettings);
    setState({ settings: newSettings });
  },

  resetSettings: async () => {
    await set(TTS_SETTINGS_KEY, DEFAULT_TTS_SETTINGS);
    setState({ settings: DEFAULT_TTS_SETTINGS });
  },

  setEngine: async (engine) => {
    await getState().updateSettings({ engine });
  },

  setVoice: async (voiceId) => {
    await getState().updateSettings({ voiceId });
  },

  setRate: async (rate) => {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    await getState().updateSettings({ rate: clampedRate });
  },

  setPitch: async (pitch) => {
    const clampedPitch = Math.max(0.5, Math.min(2.0, pitch));
    await getState().updateSettings({ pitch: clampedPitch });
  },

  setVolume: async (volume) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    await getState().updateSettings({ volume: clampedVolume });
  },

  // ========================================
  // Playback Actions
  // ========================================

  setPlaybackStatus: (status) => {
    setState((state) => ({
      playback: { ...state.playback, status },
    }));
  },

  setCurrentText: (text) => {
    setState((state) => ({
      playback: { ...state.playback, currentText: text },
    }));
  },

  setProgress: (index, total) => {
    const progress = total > 0 ? Math.round((index / total) * 100) : 0;
    setState((state) => ({
      playback: {
        ...state.playback,
        currentIndex: index,
        totalSentences: total,
        progress,
      },
    }));
  },

  setError: (error) => {
    setState((state) => ({
      playback: {
        ...state.playback,
        status: error ? 'error' : state.playback.status,
        error,
      },
    }));
  },

  resetPlayback: () => {
    setState({ playback: initialPlayback });
  },

  // ========================================
  // Voice Management
  // ========================================

  setAvailableVoices: (voices) => {
    setState({ availableVoices: voices });
  },

  loadCustomVoices: async () => {
    try {
      const customVoices = await get<VoiceModel[]>(TTS_VOICES_KEY);
      setState({ customVoices: customVoices || [] });
    } catch (error) {
      console.error('[TTSStore] 커스텀 음성 로드 실패:', error);
    }
  },

  addCustomVoice: async (voice) => {
    const { customVoices } = getState();

    // 중복 체크
    if (customVoices.some((v) => v.id === voice.id)) {
      console.warn('[TTSStore] 이미 존재하는 음성:', voice.id);
      return;
    }

    const newVoices = [...customVoices, voice];
    await set(TTS_VOICES_KEY, newVoices);
    setState({ customVoices: newVoices });
  },

  removeCustomVoice: async (voiceId) => {
    const { customVoices, settings } = getState();
    const newVoices = customVoices.filter((v) => v.id !== voiceId);
    await set(TTS_VOICES_KEY, newVoices);

    // 현재 선택된 음성이면 해제
    if (settings.voiceId === voiceId) {
      await getState().updateSettings({ voiceId: '' });
    }

    setState({ customVoices: newVoices });
  },

  getVoiceById: (voiceId) => {
    const { availableVoices, customVoices } = getState();
    return (
      availableVoices.find((v) => v.id === voiceId) ||
      customVoices.find((v) => v.id === voiceId)
    );
  },
}));
