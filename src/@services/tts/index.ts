/**
 * ============================================================
 * @module services/tts
 * @file index.ts
 * ============================================================
 * @description TTS 서비스 메인 모듈
 * - 엔진 팩토리
 * - 텍스트 파싱 유틸
 * - 통합 TTS 서비스
 * ============================================================
 */

import type { ITTSEngine, TTSEngineType, ParsedText } from './types';
import { WebSpeechEngine, KokoroEngine, ONNXEngine, MmsTtsKorEngine } from './engines';

// ========================================
// 엔진 팩토리
// ========================================

const engineInstances: Map<TTSEngineType, ITTSEngine> = new Map();

/**
 * TTS 엔진 인스턴스 가져오기 (싱글톤)
 */
export function getEngine(type: TTSEngineType): ITTSEngine {
  let engine = engineInstances.get(type);

  if (!engine) {
    switch (type) {
      case 'webSpeech':
        engine = new WebSpeechEngine();
        break;
      case 'kokoro':
        engine = new KokoroEngine();
        break;
      case 'local':
        engine = new ONNXEngine();
        break;
      case 'mms':
        engine = new MmsTtsKorEngine();
        break;
      case 'elevenLabs':
        throw new Error('ElevenLabs 엔진은 아직 구현되지 않았습니다.');
      case 'openai':
        throw new Error('OpenAI 엔진은 아직 구현되지 않았습니다.');
      default:
        throw new Error(`알 수 없는 엔진 타입: ${type}`);
    }
    engineInstances.set(type, engine);
  }

  return engine;
}

/**
 * 엔진 인스턴스 제거
 */
export function destroyEngine(type: TTSEngineType): void {
  const engine = engineInstances.get(type);
  if (engine) {
    engine.destroy();
    engineInstances.delete(type);
  }
}

/**
 * 모든 엔진 인스턴스 제거
 */
export function destroyAllEngines(): void {
  engineInstances.forEach((engine) => engine.destroy());
  engineInstances.clear();
}

// ========================================
// 텍스트 파싱 유틸
// ========================================

/**
 * 텍스트를 문장 단위로 분할
 */
export function parseText(text: string): ParsedText {
  if (!text.trim()) {
    return { sentences: [], totalLength: 0 };
  }

  // 문장 분리 정규식 (한국어/영어 대응)
  const sentenceRegex = /[^.!?。！？\n]+[.!?。！？]?/g;
  const matches = text.match(sentenceRegex) || [];

  const sentences = matches
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return {
    sentences,
    totalLength: text.length,
  };
}

/**
 * 대사와 지문 분리
 * 예: "안녕"이라고 그가 말했다. → 대사: "안녕", 지문: 이라고 그가 말했다.
 */
export interface DialoguePart {
  type: 'dialogue' | 'narration';
  text: string;
}

export function parseDialogue(text: string): DialoguePart[] {
  const parts: DialoguePart[] = [];
  const regex = /("[^"]+"|"[^"]+"|'[^']+'|「[^」]+」|『[^』]+』)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 대사 앞의 지문
    if (match.index > lastIndex) {
      const narration = text.slice(lastIndex, match.index).trim();
      if (narration) {
        parts.push({ type: 'narration', text: narration });
      }
    }

    // 대사
    parts.push({ type: 'dialogue', text: match[0] });
    lastIndex = regex.lastIndex;
  }

  // 마지막 지문
  if (lastIndex < text.length) {
    const narration = text.slice(lastIndex).trim();
    if (narration) {
      parts.push({ type: 'narration', text: narration });
    }
  }

  return parts;
}

// ========================================
// 고수준 TTS 서비스
// ========================================

export interface TTSService {
  engine: ITTSEngine;
  isInitialized: boolean;

  init: () => Promise<void>;
  destroy: () => void;
  speakText: (text: string) => Promise<void>;
  speakSentences: (
    sentences: string[],
    options?: { delay?: number; onProgress?: (index: number) => void }
  ) => Promise<void>;
}

/**
 * TTS 서비스 생성
 */
export function createTTSService(engineType: TTSEngineType): TTSService {
  const engine = getEngine(engineType);
  let isInitialized = false;
  let isStopped = false;

  return {
    engine,
    get isInitialized() {
      return isInitialized;
    },

    async init() {
      if (!isInitialized) {
        await engine.init();
        isInitialized = true;
      }
    },

    destroy() {
      isStopped = true;
      engine.stop();
    },

    async speakText(text: string) {
      if (!isInitialized) await this.init();
      await engine.speak(text);
    },

    async speakSentences(sentences, options = {}) {
      if (!isInitialized) await this.init();

      const { delay = 300, onProgress } = options;
      isStopped = false;

      for (let i = 0; i < sentences.length; i++) {
        if (isStopped) break;

        onProgress?.(i);
        await engine.speak(sentences[i]);

        // 문장 사이 딜레이
        if (delay > 0 && i < sentences.length - 1) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    },
  };
}

// ========================================
// Export
// ========================================

export * from './types';
export * from './engines';
export * from './engines/onnxEngine';
export * from './modelStore';
