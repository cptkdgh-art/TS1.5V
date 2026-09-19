/**
 * ============================================================
 * @module services/tts/types
 * @file types.ts
 * ============================================================
 * @description TTS 서비스 내부 타입 정의
 * ============================================================
 */

// @core/types에서 재export
export type {
  TTSEngineType,
  TTSEngineStatus,
  VoiceModel,
  WebSpeechVoice,
  TTSPlaybackState,
  TTSControls,
  TTSSettings,
  TTSEvent,
  TTSEventHandler,
  ITTSEngine,
} from '@core/types/tts.types';

export { DEFAULT_TTS_SETTINGS } from '@core/types/tts.types';

// ========================================
// 서비스 전용 타입
// ========================================

/** 텍스트를 문장으로 분할한 결과 */
export interface ParsedText {
  sentences: string[];
  totalLength: number;
}

/** 엔진 생성 옵션 */
export interface EngineOptions {
  onEvent?: (event: import('@core/types/tts.types').TTSEvent) => void;
}

/** 로컬 엔진 설정 */
export interface LocalEngineConfig {
  serverUrl: string;
  modelPath: string;
  useGpu: boolean;
}

/** API 엔진 설정 */
export interface ApiEngineConfig {
  apiKey: string;
  voiceId: string;
}
