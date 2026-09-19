/**
 * TTS (Text-to-Speech) 타입 정의
 *
 * 진폭스튜디오 TTS 모듈의 핵심 타입들
 * - 음성 모델, 재생 상태, 설정 등
 */

// ========================================
// 음성 엔진 타입
// ========================================

/** 지원하는 TTS 엔진 종류 */
export type TTSEngineType =
  | 'webSpeech'    // 브라우저 내장 (무료, 품질 보통)
  | 'local'        // 로컬 엔진 (RVC, XTTS 등)
  | 'kokoro'       // Kokoro TTS (로컬 AI, WASM, 고품질, 영어만)
  | 'mms'          // Facebook MMS-TTS (로컬 AI, WASM, 한국어)
  | 'elevenLabs'   // ElevenLabs API (고품질, 유료)
  | 'openai';      // OpenAI TTS (고품질, 유료)

/** 엔진 상태 */
export type TTSEngineStatus =
  | 'idle'         // 대기 중
  | 'loading'      // 로딩 중
  | 'ready'        // 준비 완료
  | 'speaking'     // 읽는 중
  | 'paused'       // 일시정지
  | 'error';       // 에러

// ========================================
// 음성 모델 타입
// ========================================

/** 음성 모델 정보 */
export interface VoiceModel {
  id: string;
  name: string;              // "내 목소리", "성우 A"
  engine: TTSEngineType;
  language: string;          // 'ko-KR', 'en-US'
  gender?: 'male' | 'female' | 'neutral';

  // 로컬 모델용
  modelPath?: string;        // .pth 파일 경로
  samplePath?: string;       // 원본 샘플 경로

  // API 모델용
  voiceId?: string;          // API에서 사용하는 ID
}

/** 기본 음성 (Web Speech API) */
export interface WebSpeechVoice {
  voice: SpeechSynthesisVoice;
  name: string;
  lang: string;
  isDefault: boolean;
}

// ========================================
// 재생 상태 타입
// ========================================

/** 재생 상태 */
export interface TTSPlaybackState {
  status: TTSEngineStatus;
  currentText: string;       // 현재 읽고 있는 텍스트
  currentIndex: number;      // 현재 위치 (문장 인덱스)
  totalSentences: number;    // 전체 문장 수
  progress: number;          // 0-100 진행률
  error?: string;
}

/** 재생 컨트롤 */
export interface TTSControls {
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipForward: () => void;   // 다음 문장
  skipBackward: () => void;  // 이전 문장
  seekTo: (index: number) => void;
}

// ========================================
// 설정 타입
// ========================================

/** TTS 설정 */
export interface TTSSettings {
  // 기본 설정
  engine: TTSEngineType;
  voiceId: string;           // 선택된 음성 ID

  // 재생 옵션
  rate: number;              // 0.5 ~ 2.0 (기본 1.0)
  pitch: number;             // 0.5 ~ 2.0 (기본 1.0)
  volume: number;            // 0 ~ 1 (기본 1.0)

  // 고급 옵션
  autoPlay: boolean;         // 자동 재생
  highlightText: boolean;    // 읽는 부분 하이라이트
  sentenceDelay: number;     // 문장 사이 딜레이 (ms)

  // 로컬 엔진 설정
  localEngineUrl?: string;   // 로컬 서버 URL
  gpuEnabled?: boolean;      // GPU 사용 여부
}

/** 기본 설정값 */
export const DEFAULT_TTS_SETTINGS: TTSSettings = {
  engine: 'webSpeech',
  voiceId: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  autoPlay: false,
  highlightText: true,
  sentenceDelay: 300,
};

// ========================================
// 이벤트 타입
// ========================================

/** TTS 이벤트 */
export type TTSEvent =
  | { type: 'start'; text: string }
  | { type: 'end' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'boundary'; charIndex: number; charLength: number }
  | { type: 'error'; error: string };

/** 이벤트 핸들러 */
export type TTSEventHandler = (event: TTSEvent) => void;

// ========================================
// 엔진 인터페이스
// ========================================

/** TTS 엔진 공통 인터페이스 */
export interface ITTSEngine {
  type: TTSEngineType;

  // 초기화
  init(): Promise<void>;
  destroy(): void;

  // 음성 목록
  getVoices(): Promise<VoiceModel[]>;
  setVoice(voiceId: string): void;

  // 재생
  speak(text: string): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;

  // 설정
  setRate(rate: number): void;
  setPitch(pitch: number): void;
  setVolume(volume: number): void;

  // 상태
  getStatus(): TTSEngineStatus;

  // 이벤트
  onEvent(handler: TTSEventHandler): void;
  offEvent(handler: TTSEventHandler): void;
}
