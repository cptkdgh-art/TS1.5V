/**
 * ============================================================
 * @module services/tts/engines/kokoroEngine
 * @file kokoroEngine.ts
 * ============================================================
 * @description Kokoro TTS 엔진 (브라우저 로컬 AI)
 * - 82M 파라미터 고품질 TTS
 * - WASM/WebGPU로 100% 로컬 실행
 * - 21개 음성 지원
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

// Kokoro.js 동적 import (WASM 로딩 최적화)
let KokoroTTS: typeof import('kokoro-js').KokoroTTS | null = null;

// Kokoro 음성 목록 (최신 버전)
const KOKORO_VOICES: VoiceModel[] = [
  // American Female
  { id: 'af_bella', name: 'Bella (미국 여성)', engine: 'kokoro', language: 'en-US', gender: 'female' },
  { id: 'af_heart', name: 'Heart (미국 여성)', engine: 'kokoro', language: 'en-US', gender: 'female' },
  { id: 'af_jessica', name: 'Jessica (미국 여성)', engine: 'kokoro', language: 'en-US', gender: 'female' },
  { id: 'af_nicole', name: 'Nicole (미국 여성)', engine: 'kokoro', language: 'en-US', gender: 'female' },
  { id: 'af_nova', name: 'Nova (미국 여성)', engine: 'kokoro', language: 'en-US', gender: 'female' },
  { id: 'af_sarah', name: 'Sarah (미국 여성)', engine: 'kokoro', language: 'en-US', gender: 'female' },
  { id: 'af_sky', name: 'Sky (미국 여성)', engine: 'kokoro', language: 'en-US', gender: 'female' },
  // American Male
  { id: 'am_adam', name: 'Adam (미국 남성)', engine: 'kokoro', language: 'en-US', gender: 'male' },
  { id: 'am_michael', name: 'Michael (미국 남성)', engine: 'kokoro', language: 'en-US', gender: 'male' },
  { id: 'am_echo', name: 'Echo (미국 남성)', engine: 'kokoro', language: 'en-US', gender: 'male' },
  // British Female
  { id: 'bf_emma', name: 'Emma (영국 여성)', engine: 'kokoro', language: 'en-GB', gender: 'female' },
  { id: 'bf_isabella', name: 'Isabella (영국 여성)', engine: 'kokoro', language: 'en-GB', gender: 'female' },
  { id: 'bf_alice', name: 'Alice (영국 여성)', engine: 'kokoro', language: 'en-GB', gender: 'female' },
  { id: 'bf_lily', name: 'Lily (영국 여성)', engine: 'kokoro', language: 'en-GB', gender: 'female' },
  // British Male
  { id: 'bm_george', name: 'George (영국 남성)', engine: 'kokoro', language: 'en-GB', gender: 'male' },
  { id: 'bm_lewis', name: 'Lewis (영국 남성)', engine: 'kokoro', language: 'en-GB', gender: 'male' },
  { id: 'bm_daniel', name: 'Daniel (영국 남성)', engine: 'kokoro', language: 'en-GB', gender: 'male' },
];

export class KokoroEngine implements ITTSEngine {
  type: TTSEngineType = 'kokoro';
  private tts: InstanceType<typeof import('kokoro-js').KokoroTTS> | null = null;
  private status: TTSEngineStatus = 'idle';
  private currentVoiceId: string = 'af_bella';
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isInitialized = false;

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
      logger.log('[KokoroEngine] 초기화 시작...');

      // 동적 import
      logger.log('[KokoroEngine] kokoro-js 모듈 로드 중...');
      if (!KokoroTTS) {
        try {
          const kokoro = await import('kokoro-js');
          KokoroTTS = kokoro.KokoroTTS;
          logger.log('[KokoroEngine] kokoro-js 모듈 로드 완료');
        } catch (importError) {
          console.error('[KokoroEngine] kokoro-js import 실패:', importError);
          throw new Error('Kokoro 모듈을 로드할 수 없습니다. 페이지를 새로고침해주세요.');
        }
      }

      // 모델 로드 (q8 양자화, WASM 백엔드)
      logger.log('[KokoroEngine] AI 모델 다운로드 중... (약 150MB, 첫 실행 시에만)');
      try {
        this.tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
          dtype: 'q8',
          device: 'wasm',
        });
        logger.log('[KokoroEngine] AI 모델 로드 완료');
      } catch (modelError) {
        console.error('[KokoroEngine] 모델 로드 실패:', modelError);
        throw new Error('AI 모델 다운로드 실패. 인터넷 연결을 확인하고 다시 시도해주세요.');
      }

      // AudioContext 생성
      this.audioContext = new AudioContext();

      this.isInitialized = true;
      this.setStatus('ready');
      logger.log('[KokoroEngine] 초기화 완료!');
    } catch (error) {
      this.setStatus('error');
      const message = error instanceof Error ? error.message : 'Kokoro 초기화 실패';
      console.error('[KokoroEngine] 초기화 실패:', error);
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

    this.tts = null;
    this.isInitialized = false;
    this.eventHandlers.clear();
  }

  // ========================================
  // 음성 목록
  // ========================================

  async getVoices(): Promise<VoiceModel[]> {
    return KOKORO_VOICES;
  }

  setVoice(voiceId: string): void {
    const voice = KOKORO_VOICES.find(v => v.id === voiceId);
    if (voice) {
      this.currentVoiceId = voiceId;
    }
  }

  // ========================================
  // TTS 실행
  // ========================================

  async speak(text: string): Promise<void> {
    if (!this.tts || !this.audioContext) {
      throw new Error('Kokoro TTS가 초기화되지 않았습니다.');
    }

    try {
      this.setStatus('speaking');
      this.emitEvent({ type: 'start', text });

      // Kokoro TTS 생성 (voice 타입은 kokoro-js 내부 리터럴 타입으로 제한됨)
      const audio = await this.tts.generate(text, {
        voice: this.currentVoiceId,
        speed: this.rate,
      } as any);

      // Float32Array로 변환
      const audioData = audio.audio;
      const sampleRate = audio.sampling_rate;

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
    // Kokoro는 pitch 조절을 직접 지원하지 않음
    // 무시
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
let kokoroEngineInstance: KokoroEngine | null = null;

export function getKokoroEngine(): KokoroEngine {
  if (!kokoroEngineInstance) {
    kokoroEngineInstance = new KokoroEngine();
  }
  return kokoroEngineInstance;
}
