/**
 * ============================================================
 * @module services/tts/engines/onnxEngine
 * @file onnxEngine.ts
 * ============================================================
 * @description ONNX Runtime Web 기반 TTS 엔진
 * - Piper TTS ONNX 모델 지원
 * - 브라우저에서 로컬 실행 (서버 불필요)
 * - WebGPU/WASM 백엔드 자동 선택
 * ============================================================
 */

import * as ort from 'onnxruntime-web';
import type {
  ITTSEngine,
  TTSEngineType,
  TTSEngineStatus,
  TTSEvent,
  TTSEventHandler,
  VoiceModel,
} from '../types';
import { loadModel, getAllModelMetadata } from '../modelStore';

// ONNX Runtime 설정
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

export class ONNXEngine implements ITTSEngine {
  type: TTSEngineType = 'local';
  private session: ort.InferenceSession | null = null;
  private currentModelId: string | null = null;
  private currentVoiceId: string = '';
  private status: TTSEngineStatus = 'idle';
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;

  // 설정
  private rate: number = 1.0;
  private pitch: number = 1.0;
  private volume: number = 1.0;

  // 이벤트 핸들러
  private eventHandlers: Set<TTSEventHandler> = new Set();

  // ========================================
  // 초기화
  // ========================================

  async init(): Promise<void> {
    try {
      this.setStatus('loading');

      // AudioContext 생성
      this.audioContext = new AudioContext();

      // 사용 가능한 모델 확인
      const models = await getAllModelMetadata();
      if (models.length > 0) {
        // 첫 번째 모델 로드
        await this.loadONNXModel(models[0].id);
      }

      this.setStatus('ready');
    } catch (error) {
      this.setStatus('error');
      this.emitEvent({ type: 'error', error: error instanceof Error ? error.message : 'ONNX 초기화 실패' });
      throw error;
    }
  }

  destroy(): void {
    this.stop();

    if (this.session) {
      this.session.release();
      this.session = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.eventHandlers.clear();
  }

  // ========================================
  // 모델 관리
  // ========================================

  private async loadONNXModel(modelId: string): Promise<void> {
    try {
      this.setStatus('loading');

      // 기존 세션 정리
      if (this.session) {
        await this.session.release();
        this.session = null;
      }

      // IndexedDB에서 모델 로드
      const modelData = await loadModel(modelId);
      if (!modelData) {
        throw new Error(`모델을 찾을 수 없습니다: ${modelId}`);
      }

      // ONNX 세션 생성
      this.session = await ort.InferenceSession.create(modelData, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      this.currentModelId = modelId;
      this.currentVoiceId = modelId;
      this.setStatus('ready');
    } catch (error) {
      this.setStatus('error');
      this.emitEvent({ type: 'error', error: error instanceof Error ? error.message : '모델 로드 실패' });
      throw error;
    }
  }

  // ========================================
  // 음성 목록
  // ========================================

  async getVoices(): Promise<VoiceModel[]> {
    const models = await getAllModelMetadata();

    return models.map((model): VoiceModel => ({
      id: model.id,
      name: model.name,
      engine: 'local',
      language: model.language,
      modelPath: model.id,
    }));
  }

  setVoice(voiceId: string): void {
    if (voiceId !== this.currentVoiceId) {
      this.currentVoiceId = voiceId;
      // 비동기로 모델 로드 (에러 무시)
      this.loadONNXModel(voiceId).catch(console.error);
    }
  }

  // ========================================
  // TTS 실행
  // ========================================

  async speak(text: string): Promise<void> {
    // ⚠️ 현재 ONNX/Piper 구현은 실험적 - phoneme 변환 미완성
    // 항상 Web Speech API로 폴백
    if (!this.session || !this.audioContext) {
      console.warn('[ONNXEngine] 모델 없음, Web Speech API로 폴백');
      return this.fallbackSpeak(text);
    }

    // ONNX 모델이 있어도 phoneme 변환이 미완성이므로 폴백
    // TODO: espeak-ng WASM 또는 piper-wasm 통합 필요
    console.warn('[ONNXEngine] Piper phoneme 변환 미구현, Web Speech API로 폴백');
    return this.fallbackSpeak(text);

    // 아래는 향후 완성될 ONNX 실행 코드 (현재 비활성화)
    /*
    try {
      this.setStatus('speaking');
      this.emitEvent({ type: 'start', text });

      // 텍스트를 phoneme으로 변환 (Piper 모델용)
      const phonemeIds = this.textToPhonemes(text);

      // 입력 텐서 생성
      const inputTensor = new ort.Tensor('int64', BigInt64Array.from(phonemeIds.map(BigInt)), [
        1,
        phonemeIds.length,
      ]);

      // 추론 실행
      const results = await this.session.run({
        input: inputTensor,
      });

      // 오디오 데이터 추출
      const audioData = results.output?.data as Float32Array;
      if (!audioData) {
        throw new Error('오디오 출력 없음');
      }

      // 오디오 재생
      await this.playAudio(audioData);

      this.setStatus('idle');
      this.emitEvent({ type: 'end' });
    } catch (error) {
      this.setStatus('error');
      this.emitEvent({ type: 'error', error: error instanceof Error ? error.message : 'TTS 실행 실패' });
      throw error;
    }
    */
  }

  // ========================================
  // 오디오 재생
  // ========================================

  private async playAudio(audioData: Float32Array): Promise<void> {
    if (!this.audioContext) return;

    // AudioContext가 suspended 상태면 resume
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // AudioBuffer 생성
    const sampleRate = 22050; // Piper 기본 샘플레이트
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

  // ========================================
  // 텍스트 처리
  // ========================================

  private textToPhonemes(text: string): number[] {
    // 간단한 문자-ID 매핑 (실제 Piper는 espeak-ng 사용)
    const phonemeMap: Record<string, number> = {
      ' ': 1,
      '.': 2,
      ',': 3,
      '?': 4,
      '!': 5,
    };

    const ids: number[] = [0]; // 시작 토큰
    for (const char of text) {
      const id = phonemeMap[char] || 100 + char.charCodeAt(0) % 100;
      ids.push(id);
    }
    ids.push(0); // 종료 토큰

    return ids;
  }

  // ========================================
  // Web Speech API 폴백
  // ========================================

  private fallbackSpeak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('Web Speech API 지원 안됨'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;
      utterance.lang = 'ko-KR';

      utterance.onstart = () => {
        this.emitEvent({ type: 'start', text });
      };

      utterance.onend = () => {
        this.setStatus('idle');
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
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    window.speechSynthesis?.pause();
    this.setStatus('paused');
    this.emitEvent({ type: 'pause' });
  }

  resume(): void {
    window.speechSynthesis?.resume();
    this.setStatus('speaking');
    this.emitEvent({ type: 'resume' });
  }

  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    window.speechSynthesis?.cancel();
    this.setStatus('idle');
  }

  // ========================================
  // 설정
  // ========================================

  setRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  setPitch(pitch: number): void {
    this.pitch = Math.max(0.5, Math.min(2.0, pitch));
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

  isModelLoaded(): boolean {
    return this.session !== null;
  }

  getCurrentModelId(): string | null {
    return this.currentModelId;
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
let onnxEngineInstance: ONNXEngine | null = null;

export function getONNXEngine(): ONNXEngine {
  if (!onnxEngineInstance) {
    onnxEngineInstance = new ONNXEngine();
  }
  return onnxEngineInstance;
}
