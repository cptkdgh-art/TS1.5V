/**
 * ============================================================
 * @module services/tts/engines/webSpeech
 * @file webSpeech.ts
 * ============================================================
 * @description Web Speech API 기반 TTS 엔진
 * - 브라우저 내장, 무료
 * - 품질은 보통이지만 즉시 사용 가능
 * ============================================================
 */

import type {
  ITTSEngine,
  TTSEngineType,
  TTSEngineStatus,
  VoiceModel,
  TTSEvent,
  TTSEventHandler,
} from '../types';
import { logger } from '@shared/utils/logger';

export class WebSpeechEngine implements ITTSEngine {
  type: TTSEngineType = 'webSpeech';

  private synth: SpeechSynthesis;
  private utterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;

  private status: TTSEngineStatus = 'idle';
  private eventHandlers: Set<TTSEventHandler> = new Set();

  // 설정값
  private rate = 1.0;
  private pitch = 1.0;
  private volume = 1.0;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  // ========================================
  // 초기화
  // ========================================

  async init(): Promise<void> {
    this.status = 'loading';
    this.emit({ type: 'start', text: '' });

    return new Promise((resolve) => {
      // 음성 목록 로드
      const loadVoices = () => {
        this.voices = this.synth.getVoices();

        if (this.voices.length > 0) {
          // 한국어 고품질 음성 우선 선택
          this.selectedVoice = this.selectBestKoreanVoice();

          this.status = 'ready';
          logger.log('[WebSpeechEngine] 초기화 완료, 음성:', this.voices.length);
          logger.log('[WebSpeechEngine] 선택된 음성:', this.selectedVoice?.name);
          resolve();
        }
      };

      // Chrome은 비동기로 음성 로드
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = loadVoices;
      }

      // 즉시 로드 시도
      loadVoices();

      // 타임아웃
      setTimeout(() => {
        if (this.status === 'loading') {
          this.status = 'ready';
          resolve();
        }
      }, 1000);
    });
  }

  destroy(): void {
    this.stop();
    this.eventHandlers.clear();
    this.status = 'idle';
  }

  // ========================================
  // 음성 목록
  // ========================================

  async getVoices(): Promise<VoiceModel[]> {
    return this.voices.map((voice) => ({
      id: voice.voiceURI,
      name: voice.name,
      engine: 'webSpeech' as TTSEngineType,
      language: voice.lang,
      gender: this.guessGender(voice.name),
    }));
  }

  setVoice(voiceId: string): void {
    const voice = this.voices.find((v) => v.voiceURI === voiceId);
    if (voice) {
      this.selectedVoice = voice;
    }
  }

  // ========================================
  // 재생
  // ========================================

  async speak(text: string): Promise<void> {
    // 기존 재생 중지
    this.stop();

    return new Promise((resolve, reject) => {
      if (!text.trim()) {
        resolve();
        return;
      }

      this.utterance = new SpeechSynthesisUtterance(text);

      // 설정 적용
      if (this.selectedVoice) {
        this.utterance.voice = this.selectedVoice;
      }
      this.utterance.rate = this.rate;
      this.utterance.pitch = this.pitch;
      this.utterance.volume = this.volume;

      // 이벤트 핸들러
      this.utterance.onstart = () => {
        this.status = 'speaking';
        this.emit({ type: 'start', text });
      };

      this.utterance.onend = () => {
        this.status = 'ready';
        this.emit({ type: 'end' });
        resolve();
      };

      this.utterance.onerror = (event) => {
        this.status = 'error';
        const errorMsg = `TTS 오류: ${event.error}`;
        this.emit({ type: 'error', error: errorMsg });
        reject(new Error(errorMsg));
      };

      this.utterance.onpause = () => {
        this.status = 'paused';
        this.emit({ type: 'pause' });
      };

      this.utterance.onresume = () => {
        this.status = 'speaking';
        this.emit({ type: 'resume' });
      };

      this.utterance.onboundary = (event) => {
        this.emit({
          type: 'boundary',
          charIndex: event.charIndex,
          charLength: event.charLength || 0,
        });
      };

      // 재생 시작
      this.synth.speak(this.utterance);
    });
  }

  pause(): void {
    if (this.status === 'speaking') {
      this.synth.pause();
    }
  }

  resume(): void {
    if (this.status === 'paused') {
      this.synth.resume();
    }
  }

  stop(): void {
    this.synth.cancel();
    this.utterance = null;
    this.status = 'ready';
  }

  // ========================================
  // 설정
  // ========================================

  setRate(rate: number): void {
    this.rate = Math.max(0.1, Math.min(10, rate));
  }

  setPitch(pitch: number): void {
    this.pitch = Math.max(0, Math.min(2, pitch));
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  // ========================================
  // 상태
  // ========================================

  getStatus(): TTSEngineStatus {
    return this.status;
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

  private emit(event: TTSEvent): void {
    this.eventHandlers.forEach((handler) => handler(event));
  }

  // ========================================
  // 유틸
  // ========================================

  /**
   * 한국어 고품질 음성 자동 선택
   * 우선순위: Online/Natural > Microsoft > Google > 기타
   */
  private selectBestKoreanVoice(): SpeechSynthesisVoice | null {
    const koreanVoices = this.voices.filter((v) => v.lang.startsWith('ko'));

    if (koreanVoices.length === 0) {
      // 한국어 없으면 기본 음성
      return this.voices.find((v) => v.default) || this.voices[0] || null;
    }

    // 1. "Online" 또는 "Natural" 키워드 (Edge/Chrome 고품질)
    const naturalVoice = koreanVoices.find(
      (v) => v.name.includes('Online') || v.name.includes('Natural')
    );
    if (naturalVoice) {
      logger.log('[WebSpeechEngine] 고품질 Natural 음성 발견:', naturalVoice.name);
      return naturalVoice;
    }

    // 2. Microsoft 음성 (일반적으로 고품질)
    const microsoftVoice = koreanVoices.find((v) => v.name.includes('Microsoft'));
    if (microsoftVoice) {
      logger.log('[WebSpeechEngine] Microsoft 음성 발견:', microsoftVoice.name);
      return microsoftVoice;
    }

    // 3. Google 음성
    const googleVoice = koreanVoices.find((v) => v.name.includes('Google'));
    if (googleVoice) {
      logger.log('[WebSpeechEngine] Google 음성 발견:', googleVoice.name);
      return googleVoice;
    }

    // 4. 원격 음성 (localService=false, 보통 더 고품질)
    const remoteVoice = koreanVoices.find((v) => !v.localService);
    if (remoteVoice) {
      logger.log('[WebSpeechEngine] 원격 음성 발견:', remoteVoice.name);
      return remoteVoice;
    }

    // 5. 아무 한국어 음성
    logger.log('[WebSpeechEngine] 기본 한국어 음성 사용:', koreanVoices[0].name);
    return koreanVoices[0];
  }

  private guessGender(name: string): 'male' | 'female' | 'neutral' {
    const lowerName = name.toLowerCase();
    if (
      lowerName.includes('female') ||
      lowerName.includes('woman') ||
      lowerName.includes('여성') ||
      lowerName.includes('yuna') ||
      lowerName.includes('sunhi')
    ) {
      return 'female';
    }
    if (
      lowerName.includes('male') ||
      lowerName.includes('man') ||
      lowerName.includes('남성')
    ) {
      return 'male';
    }
    return 'neutral';
  }
}

// 싱글톤 인스턴스 (선택적)
let instance: WebSpeechEngine | null = null;

export function getWebSpeechEngine(): WebSpeechEngine {
  if (!instance) {
    instance = new WebSpeechEngine();
  }
  return instance;
}
