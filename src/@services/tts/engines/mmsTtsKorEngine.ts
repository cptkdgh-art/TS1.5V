/**
 * ============================================================
 * @module services/tts/engines/mmsTtsKorEngine
 * @file mmsTtsKorEngine.ts
 * ============================================================
 * @description Facebook MMS-TTS 한국어 엔진 (브라우저 WASM)
 * - Xenova/mms-tts-kor ONNX 모델 사용
 * - Transformers.js로 100% 로컬 실행
 * - 고품질 한국어 음성 합성
 * ============================================================
 */

import type {
  ITTSEngine,
  TTSEngineType,
  TTSEngineStatus,
  TTSEvent,
  TTSEventHandler,
  VoiceModel,
} from '../types';
import { logger } from '@shared/utils/logger';

type TransformersModule = {
  env: {
    backends: { onnx: { wasm: { numThreads: number } } };
    useBrowserCache: boolean;
    useCustomCache: boolean;
    remoteHost: string;
    remotePathTemplate: string;
    localModelPath: string;
    allowLocalModels: boolean;
  };
  pipeline: (
    task: string,
    model: string,
    options?: Record<string, unknown>
  ) => Promise<(text: string) => Promise<{ audio: Float32Array; sampling_rate: number }>>;
};

// Transformers.js is optional. The package currently pulls vulnerable legacy
// onnx/protobuf deps, so production builds fall back to Web Speech when absent.
let transformersModule: TransformersModule | null = null;
let synthesizer: ((text: string) => Promise<{ audio: Float32Array; sampling_rate: number }>) | null = null;
let isEnvConfigured = false;

export class MmsTtsKorEngine implements ITTSEngine {
  type: TTSEngineType = 'mms';

  private status: TTSEngineStatus = 'idle';
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isInitialized = false;
  private loadingProgress = 0;

  // 설정
  private rate: number = 1.0;
  private volume: number = 1.0;

  // 이벤트 핸들러
  private eventHandlers: Set<TTSEventHandler> = new Set();

  // ========================================
  // 초기화
  // ========================================

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.setStatus('loading');
      logger.log('[MmsTtsKorEngine] 초기화 시작...');

      // Transformers.js 동적 import 및 환경 설정
      logger.log('[MmsTtsKorEngine] Transformers.js 로드 중...');
      if (!transformersModule) {
        try {
          const moduleName = '@xenova/transformers';
          transformersModule = (await import(/* @vite-ignore */ moduleName)) as TransformersModule;
          logger.log('[MmsTtsKorEngine] Transformers.js 로드 완료');

          // 환경 설정 (최초 1회만)
          if (!isEnvConfigured) {
            const { env } = transformersModule;

            // WASM 백엔드 사용 (브라우저 호환성)
            env.backends.onnx.wasm.numThreads = 1;

            // 캐시 설정 - IndexedDB 사용
            env.useBrowserCache = true;
            env.useCustomCache = false;

            // 모델 다운로드 경로 (Hugging Face CDN)
            env.remoteHost = 'https://huggingface.co';
            env.remotePathTemplate = '{model}/resolve/{revision}/';

            // 로컬 모델 비활성화 (항상 원격에서 다운로드)
            env.localModelPath = '';
            env.allowLocalModels = false;

            isEnvConfigured = true;
            logger.log('[MmsTtsKorEngine] Transformers.js 환경 설정 완료');
          }
        } catch (importError) {
          console.error('[MmsTtsKorEngine] Transformers.js import 실패:', importError);
          this.audioContext = new AudioContext();
          this.isInitialized = true;
          this.setStatus('ready');
          this.emitEvent({
            type: 'error',
            error: 'MMS 한국어 AI 엔진을 사용할 수 없어 브라우저 기본 TTS로 대체합니다.',
          });
          return;
        }
      }

      // MMS-TTS-KOR 모델 로드 (약 50MB, 첫 실행 시 다운로드)
      logger.log('[MmsTtsKorEngine] 한국어 TTS 모델 다운로드 중... (약 50MB, 첫 실행 시에만)');

      try {
        const { pipeline } = transformersModule;
        synthesizer = await pipeline('text-to-speech', 'Xenova/mms-tts-kor', {
          quantized: true, // 양자화 모델 사용 (더 작은 용량)
          progress_callback: (progress: { progress: number; status: string }) => {
            this.loadingProgress = Math.round(progress.progress || 0);
            if (progress.status) {
              logger.log(`[MmsTtsKorEngine] ${progress.status}: ${this.loadingProgress}%`);
            }
          },
        });
        logger.log('[MmsTtsKorEngine] 모델 로드 완료!');
      } catch (modelError) {
        console.error('[MmsTtsKorEngine] 모델 로드 실패:', modelError);
        synthesizer = null;
        this.emitEvent({
          type: 'error',
          error: '한국어 AI TTS 모델을 불러오지 못해 브라우저 기본 TTS로 대체합니다.',
        });
      }

      // AudioContext 생성
      this.audioContext = new AudioContext();

      this.isInitialized = true;
      this.setStatus('ready');
      logger.log('[MmsTtsKorEngine] 초기화 완료!');
    } catch (error) {
      this.setStatus('error');
      const message = error instanceof Error ? error.message : 'MMS-TTS 초기화 실패';
      console.error('[MmsTtsKorEngine] 초기화 실패:', error);
      this.emitEvent({ type: 'error', error: message });
      throw error;
    }
  }

  destroy(): void {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isInitialized = false;
    this.eventHandlers.clear();
  }

  // ========================================
  // 음성 목록
  // ========================================

  async getVoices(): Promise<VoiceModel[]> {
    return [
      {
        id: 'mms-tts-kor',
        name: 'MMS 한국어 (AI)',
        engine: 'mms',
        language: 'ko-KR',
        gender: 'neutral',
      },
    ];
  }

  setVoice(_voiceId: string): void {
    // MMS-TTS-KOR은 단일 음성만 지원
  }

  // ========================================
  // TTS 실행
  // ========================================

  async speak(text: string): Promise<void> {
    if (!synthesizer || !this.audioContext) {
      return this.fallbackSpeak(text);
    }

    try {
      this.setStatus('speaking');
      this.emitEvent({ type: 'start', text });

      // TTS 생성
      logger.log('[MmsTtsKorEngine] 음성 생성 중:', text.substring(0, 50) + '...');
      const result = await (synthesizer as any)(text) as { audio: Float32Array; sampling_rate: number };

      // 오디오 데이터 추출
      const audioData = result.audio;
      const sampleRate = result.sampling_rate;

      // 오디오 재생
      await this.playAudio(audioData, sampleRate);

      this.setStatus('ready');
      this.emitEvent({ type: 'end' });
    } catch (error) {
      this.setStatus('error');
      const message = error instanceof Error ? error.message : 'TTS 실행 실패';
      this.emitEvent({ type: 'error', error: message });
      throw error;
    }
  }

  // ========================================
  // 오디오 재생
  // ========================================

  private async playAudio(audioData: Float32Array, sampleRate: number): Promise<void> {
    if (!this.audioContext) return;

    // AudioContext가 suspended 상태면 resume
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // AudioBuffer 생성
    const audioBuffer = this.audioContext.createBuffer(1, audioData.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    channelData.set(audioData);

    // GainNode로 볼륨 조절
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.volume;
    gainNode.connect(this.audioContext.destination);

    // AudioBufferSourceNode로 재생
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = this.rate;
    source.connect(gainNode);

    this.currentSource = source;

    return new Promise((resolve) => {
      source.onended = () => {
        this.currentSource = null;
        resolve();
      };
      source.start();
    });
  }

  private fallbackSpeak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('Web Speech API 지원 안됨'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.rate;
      utterance.volume = this.volume;
      utterance.lang = 'ko-KR';

      utterance.onstart = () => {
        this.setStatus('speaking');
        this.emitEvent({ type: 'start', text });
      };

      utterance.onend = () => {
        this.setStatus('ready');
        this.emitEvent({ type: 'end' });
        resolve();
      };

      utterance.onerror = (event) => {
        this.setStatus('error');
        this.emitEvent({ type: 'error', error: event.error });
        reject(new Error(event.error));
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  // ========================================
  // 제어
  // ========================================

  pause(): void {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
      this.setStatus('paused');
      this.emitEvent({ type: 'pause' });
    }
  }

  resume(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
      this.setStatus('speaking');
      this.emitEvent({ type: 'resume' });
    }
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // 이미 정지된 경우 무시
      }
      this.currentSource = null;
    }
    this.setStatus('ready');
  }

  // ========================================
  // 설정
  // ========================================

  setRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  setPitch(_pitch: number): void {
    // MMS-TTS는 pitch 조절 미지원
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1.0, volume));
  }

  // ========================================
  // 상태 관리
  // ========================================

  getStatus(): TTSEngineStatus {
    return this.status;
  }

  private setStatus(status: TTSEngineStatus): void {
    this.status = status;
  }

  getLoadingProgress(): number {
    return this.loadingProgress;
  }

  // ========================================
  // 이벤트
  // ========================================

  onEvent(handler: TTSEventHandler): void {
    this.eventHandlers.add(handler);
  }

  offEvent(handler: TTSEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  private emitEvent(event: TTSEvent): void {
    this.eventHandlers.forEach((handler) => handler(event));
  }
}

// 싱글톤 인스턴스
let mmsTtsKorEngineInstance: MmsTtsKorEngine | null = null;

export function getMmsTtsKorEngine(): MmsTtsKorEngine {
  if (!mmsTtsKorEngineInstance) {
    mmsTtsKorEngineInstance = new MmsTtsKorEngine();
  }
  return mmsTtsKorEngineInstance;
}
