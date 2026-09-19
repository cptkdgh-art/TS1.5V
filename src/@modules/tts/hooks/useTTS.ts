/**
 * ============================================================
 * @module modules/tts/hooks/useTTS
 * @file useTTS.ts
 * ============================================================
 * @description TTS 기능을 위한 커스텀 훅
 * - 엔진 초기화/관리
 * - 재생 컨트롤
 * - 상태 동기화
 * ============================================================
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useTTSStore } from '@stores/ttsStore';
import {
  createTTSService,
  parseText,
  type TTSService,
  type TTSEvent,
  type TTSEngineType,
} from '@services/tts';
import { logger } from '@shared/utils/logger';

export interface UseTTSOptions {
  autoInit?: boolean;
}

export interface UseTTSReturn {
  // 상태
  isReady: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  progress: number;
  currentText: string;
  error: string | undefined;

  // 엔진 정보
  engineType: TTSEngineType;
  setEngineType: (type: TTSEngineType) => Promise<void>;

  // 음성 목록
  voices: Array<{ id: string; name: string; lang: string }>;
  selectedVoiceId: string;

  // 설정
  rate: number;
  pitch: number;
  volume: number;

  // 재생 컨트롤
  speak: (text: string) => Promise<void>;
  speakEpisode: (text: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;

  // 설정 컨트롤
  setVoice: (voiceId: string) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const { autoInit = true } = options;

  // 스토어
  const {
    settings,
    playback,
    availableVoices,
    loadSettings,
    setAvailableVoices,
    setPlaybackStatus,
    setCurrentText,
    setProgress,
    setError,
    resetPlayback,
    updateSettings,
  } = useTTSStore();

  // 서비스 레퍼런스
  const serviceRef = useRef<TTSService | null>(null);
  const sentencesRef = useRef<string[]>([]);
  const [currentEngineType, setCurrentEngineType] = useState<TTSEngineType>(settings.engine);

  // ========================================
  // 이벤트 핸들러
  // ========================================

  const handleTTSEvent = useCallback(
    (event: TTSEvent) => {
      switch (event.type) {
        case 'start':
          setPlaybackStatus('speaking');
          setCurrentText(event.text);
          break;
        case 'end':
          setPlaybackStatus('ready');
          break;
        case 'pause':
          setPlaybackStatus('paused');
          break;
        case 'resume':
          setPlaybackStatus('speaking');
          break;
        case 'error':
          setPlaybackStatus('error');
          setError(event.error);
          break;
      }
    },
    [setPlaybackStatus, setCurrentText, setError]
  );

  // ========================================
  // 엔진 초기화 함수
  // ========================================

  const initEngine = useCallback(async (engineType: TTSEngineType) => {
    // 기존 서비스 정리
    if (serviceRef.current) {
      serviceRef.current.destroy();
      serviceRef.current = null;
    }

    setPlaybackStatus('loading');

    // 새 서비스 생성 및 초기화
    const service = createTTSService(engineType);
    serviceRef.current = service;

    try {
      await service.init();

      // 음성 목록 로드
      const voices = await service.engine.getVoices();
      setAvailableVoices(voices);

      // 이벤트 핸들러 등록
      service.engine.onEvent(handleTTSEvent);

      setPlaybackStatus('ready');
      setCurrentEngineType(engineType);
      logger.log(`[useTTS] 엔진 초기화 완료: ${engineType}`);
    } catch (err) {
      console.error('[useTTS] 초기화 실패:', err);
      setError('TTS 초기화에 실패했습니다.');
      setPlaybackStatus('error');
    }
  }, [setAvailableVoices, setPlaybackStatus, setError, handleTTSEvent]);

  // ========================================
  // 초기화
  // ========================================

  useEffect(() => {
    if (!autoInit) return;

    const init = async () => {
      // 설정 로드
      await loadSettings();
      await initEngine(settings.engine);
    };

    init();

    return () => {
      if (serviceRef.current) {
        serviceRef.current.destroy();
      }
    };
  }, [autoInit, initEngine, loadSettings, settings.engine]);

  // ========================================
  // 엔진 타입 변경
  // ========================================

  const setEngineType = useCallback(async (type: TTSEngineType) => {
    if (type === currentEngineType) return;

    // 재생 중이면 정지
    if (serviceRef.current) {
      serviceRef.current.engine.stop();
    }
    resetPlayback();

    try {
      // 설정 저장
      await updateSettings({ engine: type });

      // 새 엔진 초기화
      await initEngine(type);
    } catch (err) {
      console.error(`[useTTS] ${type} 엔진 초기화 실패, webSpeech로 폴백:`, err);

      // 실패 시 webSpeech로 폴백
      if (type !== 'webSpeech') {
        setError(`${type} 엔진 초기화 실패. 브라우저 기본 TTS로 전환합니다.`);
        await updateSettings({ engine: 'webSpeech' });
        await initEngine('webSpeech');
      }
    }
  }, [currentEngineType, resetPlayback, updateSettings, initEngine, setError]);

  // ========================================
  // 재생 컨트롤
  // ========================================

  const speak = useCallback(
    async (text: string) => {
      if (!serviceRef.current) {
        setError('TTS가 초기화되지 않았습니다.');
        return;
      }

      try {
        resetPlayback();
        await serviceRef.current.speakText(text);
      } catch (err) {
        console.error('[useTTS] 재생 실패:', err);
      }
    },
    [resetPlayback, setError]
  );

  const speakEpisode = useCallback(
    async (text: string) => {
      if (!serviceRef.current) {
        setError('TTS가 초기화되지 않았습니다.');
        return;
      }

      try {
        resetPlayback();
        const { sentences } = parseText(text);
        sentencesRef.current = sentences;

        await serviceRef.current.speakSentences(sentences, {
          delay: settings.sentenceDelay,
          onProgress: (index) => {
            setProgress(index, sentences.length);
            setCurrentText(sentences[index]);
          },
        });

        setPlaybackStatus('ready');
      } catch (err) {
        console.error('[useTTS] 에피소드 재생 실패:', err);
      }
    },
    [settings.sentenceDelay, resetPlayback, setProgress, setCurrentText, setPlaybackStatus, setError]
  );

  const pause = useCallback(() => {
    serviceRef.current?.engine.pause();
  }, []);

  const resume = useCallback(() => {
    serviceRef.current?.engine.resume();
  }, []);

  const stop = useCallback(() => {
    serviceRef.current?.engine.stop();
    resetPlayback();
  }, [resetPlayback]);

  // ========================================
  // 설정 컨트롤
  // ========================================

  const setVoice = useCallback(
    (voiceId: string) => {
      serviceRef.current?.engine.setVoice(voiceId);
      updateSettings({ voiceId });
    },
    [updateSettings]
  );

  const setRate = useCallback(
    (rate: number) => {
      serviceRef.current?.engine.setRate(rate);
      updateSettings({ rate });
    },
    [updateSettings]
  );

  const setPitch = useCallback(
    (pitch: number) => {
      serviceRef.current?.engine.setPitch(pitch);
      updateSettings({ pitch });
    },
    [updateSettings]
  );

  const setVolume = useCallback(
    (volume: number) => {
      serviceRef.current?.engine.setVolume(volume);
      updateSettings({ volume });
    },
    [updateSettings]
  );

  // ========================================
  // 반환값
  // ========================================

  return {
    // 상태
    isReady: playback.status === 'ready' || playback.status === 'idle',
    isLoading: playback.status === 'loading',
    isPlaying: playback.status === 'speaking',
    isPaused: playback.status === 'paused',
    progress: playback.progress,
    currentText: playback.currentText,
    error: playback.error,

    // 엔진 정보
    engineType: currentEngineType,
    setEngineType,

    // 음성 목록
    voices: availableVoices.map((v) => ({
      id: v.id,
      name: v.name,
      lang: v.language,
    })),
    selectedVoiceId: settings.voiceId,

    // 설정
    rate: settings.rate,
    pitch: settings.pitch,
    volume: settings.volume,

    // 재생 컨트롤
    speak,
    speakEpisode,
    pause,
    resume,
    stop,

    // 설정 컨트롤
    setVoice,
    setRate,
    setPitch,
    setVolume,
  };
}
