/**
 * ============================================================
 * @module modules/tts
 * @file index.ts
 * ============================================================
 * @description TTS 모듈 export
 * ============================================================
 */

// Hooks
export { useTTS } from './hooks/useTTS';
export type { UseTTSOptions, UseTTSReturn } from './hooks/useTTS';

// Components
export { TTSPlayer } from './components/TTSPlayer';
export { VoiceSelector } from './components/VoiceSelector';
export { ModelUploader } from './components/ModelUploader';
