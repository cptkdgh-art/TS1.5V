/**
 * ============================================================
 * @module services/tts/engines
 * @file index.ts
 * ============================================================
 * @description TTS 엔진 export
 * ============================================================
 */

export { WebSpeechEngine, getWebSpeechEngine } from './webSpeech';
export { KokoroEngine, getKokoroEngine } from './kokoroEngine';
export { ONNXEngine, getONNXEngine } from './onnxEngine';
export { MmsTtsKorEngine, getMmsTtsKorEngine } from './mmsTtsKorEngine';

// 추후 추가될 엔진들
// export { ElevenLabsEngine } from './elevenLabs';
// export { OpenAIEngine } from './openai';
