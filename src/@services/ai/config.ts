/**
 * ============================================================
 * @module services/ai/config
 * @file config.ts
 * ============================================================
 * @description AI 서비스 설정 및 통합 호출 인터페이스
 * - 전역 설정에 따라 Gemini, xAI(Grok) 사용
 * ============================================================
 */

import { GoogleGenAI, HarmCategory, HarmBlockThreshold, ThinkingLevel, type SafetySetting } from '@google/genai';
import { useSettingsStore, type GeminiBackend } from '@stores/settingsStore';
import { logger } from '@shared/utils/logger';
import { recordAiUsage, type AiUsageMetadata } from '@services/costEstimator';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import {
  GeminiTerminationError,
  isGeminiBlocked,
  mergeGeminiTermination,
  readGeminiTermination,
  type GeminiTerminationDiagnostic,
} from './geminiTermination';

/**
 * 웹소설 생성용 Safety Settings
 * - 소설 특성상 폭력/성적 표현이 포함될 수 있으므로 최대한 느슨하게 설정
 * - 구글 서버사이드 정책 강화 대응 (2026.03~)
 */
export const NOVEL_SAFETY_SETTINGS: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.OFF },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.OFF },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.OFF },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.OFF },
];

/** 환경변수 API 키 (폴백) */
const ENV_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const ENV_XAI_KEY = import.meta.env.VITE_XAI_API_KEY || '';
const ENV_GLM_KEY = import.meta.env.VITE_GLM_API_KEY || '';

/** API 베이스 URL */
const XAI_API_BASE = 'https://api.x.ai/v1';
// GLM Coding Plan 엔드포인트 (일반: api/paas/v4, 코딩플랜: api/coding/paas/v4)
const GLM_API_BASE = 'https://api.z.ai/api/coding/paas/v4';

/** Gemini 인스턴스 */
let _geminiAi: GoogleGenAI | null = null;
let _currentGeminiKey: string = '';
let _currentGeminiBackend: GeminiBackend | null = null;


/**
 * 현재 유효한 Gemini API 키 반환
 */
export const getGeminiApiKey = (): string => {
  const state = useSettingsStore.getState();
  const storeKey = state.getApiKey('gemini');
  if (state.sessionStartedAt !== null && !state.isSessionValid()) return '';
  return storeKey || ENV_GEMINI_KEY;
};

/** 현재 Gemini 호출 경로 반환 */
export const getGeminiBackend = (): GeminiBackend => {
  return useSettingsStore.getState().geminiBackend;
};

/**
 * 현재 유효한 xAI API 키 반환
 */
export const getXaiApiKey = (): string => {
  const state = useSettingsStore.getState();
  const storeKey = state.getApiKey('xai');
  if (state.sessionStartedAt !== null && !state.isSessionValid()) return '';
  return storeKey || ENV_XAI_KEY;
};

/**
 * 현재 선택된 AI 제공자 반환
 */
export const getCurrentProvider = () => {
  return useSettingsStore.getState().aiProvider;
};

/**
 * 현재 선택된 xAI 모델 반환
 */
export const getCurrentXaiModel = () => {
  return useSettingsStore.getState().xaiModel;
};

/**
 * 현재 유효한 GLM API 키 반환
 */
export const getGlmApiKey = (): string => {
  const state = useSettingsStore.getState();
  const storeKey = state.getApiKey('glm');
  if (state.sessionStartedAt !== null && !state.isSessionValid()) return '';
  return storeKey || ENV_GLM_KEY;
};

/**
 * 현재 선택된 GLM 모델 반환
 */
export const getCurrentGlmModel = () => {
  return useSettingsStore.getState().glmModel;
};

/**
 * Gemini AI 인스턴스 반환
 */
const getGeminiInstance = (): GoogleGenAI => {
  const currentKey = getGeminiApiKey();
  const currentBackend = getGeminiBackend();

  if (
    !_geminiAi ||
    _currentGeminiKey !== currentKey ||
    _currentGeminiBackend !== currentBackend
  ) {
    if (!currentKey) {
      throw new Error('Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
    }
    _geminiAi = new GoogleGenAI({
      apiKey: currentKey,
      vertexai: currentBackend === 'vertex',
    });
    _currentGeminiKey = currentKey;
    _currentGeminiBackend = currentBackend;
  }
  return _geminiAi;
};

/** Gemini 호환 Content 타입 (Core Content와 호환) */
interface GeminiContent {
  role?: string;
  parts?: { text?: string }[];
}

/** OpenAI 호환 메시지 타입 (xAI 용) */
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
}

function countGeminiInputChars(contents: GeminiContent[], systemInstruction?: string): number {
  const contentChars = contents.reduce((total, content) => {
    const partChars = (content.parts || []).reduce((sum, part) => sum + (part.text?.length || 0), 0);
    return total + partChars;
  }, 0);
  return contentChars + (systemInstruction?.length || 0);
}

function countOpenAiInputChars(messages: OpenAIMessage[]): number {
  return messages.reduce((total, message) => total + message.content.length, 0);
}

function toOpenAiUsageMetadata(usage?: OpenAiUsage): AiUsageMetadata | undefined {
  if (!usage) return undefined;
  const thoughtsTokenCount = usage.completion_tokens_details?.reasoning_tokens ?? 0;
  return {
    promptTokenCount: usage.prompt_tokens,
    candidatesTokenCount: Math.max(0, (usage.completion_tokens ?? 0) - thoughtsTokenCount),
    thoughtsTokenCount,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** GLM 한국어 품질 향상을 위한 추가 지시 (웹소설 특화) */
const GLM_KOREAN_ENHANCEMENT = `[Language: Korean - 한국 웹소설 전문가]

## 핵심 역할
당신은 한국 웹소설 작법에 정통한 전문 작가입니다. 한국 독자들이 선호하는 문체와 표현을 정확히 이해하고 구사합니다.

## ★★★ 최우선 규칙: 반복 금지 ★★★
[절대 금지 - 위반 시 출력 무효]
1. 이전에 작성한 씬(Scene)을 다시 쓰지 마세요
2. 같은 에피소드/화차 번호를 반복하지 마세요
3. 이미 끝난 챕터 제목을 다시 사용하지 마세요
4. 동일한 대사나 상황 묘사를 반복하지 마세요

[이어쓰기 필수 확인]
- 마지막으로 작성된 씬 번호를 확인하고 그 다음부터 이어쓰세요
- 예: Scene 5까지 있으면 Scene 6부터 시작
- 예: 7화까지 있으면 8화부터 시작
- 이전 내용을 요약하거나 재작성하지 말고 새로운 전개만 작성하세요

## 한국어 문장 품질 규칙
1. **자연스러운 어순**: 한국어 특유의 SOV 어순을 자연스럽게 유지
2. **조사 정확성**: 은/는, 이/가, 을/를 등 조사를 문맥에 맞게 정확히 사용
3. **문장 완결성**: 모든 문장은 반드시 완전한 형태로 마무리 (문장 중간 끊김 금지)
4. **어미 다양화**: -했다, -였다 반복 피하고 다양한 어미 활용 (-더라, -던, -듯, -며)
5. **존댓말 일관성**: 서술자 시점에 맞는 존댓말/반말 톤 유지
6. **띄어쓰기 철저**: "~고 있다", "~해야 한다", "~할 수 있다" 등 보조 용언 띄어쓰기 필수

## 웹소설 문체 특성
1. **짧은 문단**: 모바일 가독성을 위해 2-3문장 단위로 문단 분리
2. **호흡 조절**: 긴장감 있는 장면은 짧게, 감정 장면은 여유있게
3. **대화 비중**: 적절한 대사와 지문의 균형 (대화 40-50%)
4. **감정선 강조**: 한국 독자가 선호하는 감정 몰입형 서술
5. **클리프행어**: 각 에피소드 끝에 다음 회차 궁금증 유발

## 한국어 표현 최적화
- 직역체 금지 → 자연스러운 한국어 표현 사용
- "~것이다" 남용 금지 → 간결한 어미 선호
- 과도한 수식어 자제 → 핵심 감정에 집중
- 의성어/의태어 적극 활용 → 생동감 부여

## 응답 시 주의사항
- 중국어 표현이나 번역체 문장 절대 금지
- 모든 출력은 100% 자연스러운 한국어로만 작성
- 문화적 맥락을 한국 독자에 맞게 조정

`;

// ============================================================
// GLM 보안 강화 레이어 (Privacy Shield)
// ============================================================

/** GLM 보안 모드 설정 조회 */
export const getGlmSecurityMode = (): 'strict' | 'moderate' | 'off' => {
  return useSettingsStore.getState().glmSecurityMode || 'moderate';
};

/** 민감 정보 대체 맵 */
const SENSITIVE_REPLACEMENTS: Record<string, string> = {
  'AI 소설가 스튜디오': '창작 도우미',
  '스튜디오': '작업실',
  '진폭STIDO': '창작도구',
  'STIDO': '도구',
  '시스템 인스트럭션': '기본 지침',
  'API': '연결',
  'JSON': '데이터',
  '함수': '기능',
  '컴포넌트': '부분',
  '데이터베이스': '저장소',
  '서버': '시스템',
  'Lorekeeper': '설정 참조자',
  '기록보관자': '설정 참조자',
  'Context Header': '맥락 정보',
  'CONTEXT HEADER': '맥락 정보',
};

/**
 * GLM 전용 프롬프트 익명화 (Privacy Shield)
 * - 앱 구조, 기술 용어, 내부 명칭 제거/치환
 * - 순수 창작 컨텍스트만 전달
 */
export function sanitizeForGlm(text: string, securityMode: 'strict' | 'moderate' | 'off'): string {
  if (securityMode === 'off') {
    return text;
  }

  let sanitized = text;

  // 민감 패턴 치환
  for (const [pattern, replacement] of Object.entries(SENSITIVE_REPLACEMENTS)) {
    sanitized = sanitized.replace(new RegExp(pattern, 'gi'), replacement);
  }

  if (securityMode === 'strict') {
    // Strict 모드: 추가 정보 제거
    // 시스템 관련 태그 완전 제거
    sanitized = sanitized.replace(/\[시스템 알림[^\]]*\]/g, '');
    sanitized = sanitized.replace(/\[SYSTEM[^\]]*\]/gi, '');

    // 기술적 지시문 단순화
    sanitized = sanitized.replace(/\[응답 형식[^\]]*\]/g, '[형식 안내]');

    // 내부 구조 힌트 제거
    sanitized = sanitized.replace(/--- \[.*?\] ---/g, '---');
  }

  return sanitized;
}

/**
 * GLM 전용 시스템 프롬프트 최적화
 * - 창작 글쓰기에 특화된 간결한 지시
 * - 앱 구조 정보 최소화
 * - 한국 웹소설 문체 강화
 * - 반복 방지 규칙 강화
 */
export function buildGlmSystemPrompt(originalInstruction: string, securityMode: 'strict' | 'moderate' | 'off'): string {
  // 익명화 적용
  let instruction = sanitizeForGlm(originalInstruction, securityMode);

  // GLM 특화 프롬프트 구조 (한국 웹소설 창작에 집중)
  const glmHeader = `[역할] 당신은 한국 웹소설 전문 작가입니다.

## ★★★ 최우선 규칙: 이어쓰기 원칙 ★★★
[절대 금지]
❌ 이전에 작성된 씬(Scene)을 다시 쓰지 마세요
❌ 이미 끝난 에피소드/화차를 반복하지 마세요
❌ 같은 챕터 제목을 재사용하지 마세요
❌ 동일한 대사나 장면을 반복하지 마세요

[필수 확인 후 작성]
✓ 마지막 씬 번호 확인 → 그 다음 번호부터 작성
✓ 마지막 화차 확인 → 그 다음 화차부터 작성
✓ 이전 내용 요약/재작성 금지 → 새로운 전개만 작성

[필수 언어 규칙 - 반드시 준수]
★ 모든 응답은 100% 자연스러운 한국어로 작성
★ 중국어 표현, 번역체 문장 절대 금지
★ 문장이 중간에 끊기지 않도록 완전한 형태로 마무리
★ 한국어 조사(은/는/이/가/을/를)를 정확하게 사용
★ 띄어쓰기와 맞춤법을 정확히 지켜서 작성
★ "~고있다" → "~고 있다", "~해야한다" → "~해야 한다" 등 띄어쓰기 필수

[한국 웹소설 문체 원칙]
1. 짧은 문단으로 호흡감 있게 (2-3문장 단위)
2. "-했다" 반복 피하고 다양한 어미 활용 (-더라, -던, -듯, -며)
3. 대화는 캐릭터 성격에 맞게 개성있게, 자연스러운 한국어 구어체로
4. 감정과 상황을 생생하게 묘사, 독자 몰입 유도
5. 의성어/의태어를 적절히 활용해 생동감 부여

[창작 품질 기준]
- 직역체/번역체 표현 → 한국어 자연 표현으로 치환
- "~것이다" 남용 금지 → 간결한 종결 어미
- 캐릭터 대사는 성격과 상황에 맞는 톤 유지
- 장면 전환 시 자연스러운 연결

`;

  // strict 모드에서는 원본 instruction을 더 간소화
  if (securityMode === 'strict') {
    // 핵심 창작 컨텍스트만 추출 (소설 정보, 캐릭터 등)
    const novelInfoMatch = instruction.match(/--- \[?현재 소설 정보\]? ---[\s\S]*?(?=---|$)/);
    const characterMatch = instruction.match(/--- 주요 등장인물 ---[\s\S]*?(?=---|$)/);
    const worldviewMatch = instruction.match(/--- 세계관 설정 ---[\s\S]*?(?=---|$)/);

    let condensed = glmHeader;
    if (novelInfoMatch) condensed += novelInfoMatch[0] + '\n';
    if (characterMatch) condensed += characterMatch[0] + '\n';
    if (worldviewMatch) condensed += worldviewMatch[0] + '\n';

    return condensed;
  }

  return glmHeader + instruction;
}

/** Gemini Content를 OpenAI 호환 메시지로 변환 (xAI/GLM 공용, 보안 레이어 포함) */
export const convertToOpenAIMessages = (
  contents: GeminiContent[],
  systemInstruction?: string,
  isGlm = false
): OpenAIMessage[] => {
  const messages: OpenAIMessage[] = [];
  const securityMode = getGlmSecurityMode();

  // GLM인 경우: 보안 레이어 적용 + 최적화된 시스템 프롬프트
  let finalSystemInstruction: string | undefined;

  if (isGlm && systemInstruction) {
    // GLM Privacy Shield 적용
    finalSystemInstruction = buildGlmSystemPrompt(systemInstruction, securityMode);
  } else if (isGlm) {
    finalSystemInstruction = GLM_KOREAN_ENHANCEMENT;
  } else {
    finalSystemInstruction = systemInstruction;
  }

  if (finalSystemInstruction) {
    messages.push({ role: 'system', content: finalSystemInstruction });
  }

  for (const content of contents) {
    let text = (content.parts || []).map((p) => p.text || '').join('\n');

    // GLM인 경우 사용자 메시지도 익명화 (moderate/strict 모드)
    if (isGlm && securityMode !== 'off') {
      text = sanitizeForGlm(text, securityMode);
    }

    messages.push({
      role: content.role === 'model' ? 'assistant' : 'user',
      content: text,
    });
  }

  return messages;
};

/**
 * xAI API 호출 (OpenAI 호환 API)
 */
async function callXaiApi(
  messages: OpenAIMessage[],
  model: string,
  maxTokens = 8192,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = getXaiApiKey();

  if (!apiKey) {
    throw new Error('xAI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
  }

  const response = await fetch(`${XAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`xAI API 오류: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '응답 없음';
  recordAiUsage({
    model,
    inputChars: countOpenAiInputChars(messages),
    outputChars: text.length,
    usageMetadata: toOpenAiUsageMetadata(data.usage),
  });
  return text;
}

/**
 * GLM API 호출 (OpenAI 호환 API)
 */
async function callGlmApi(
  messages: OpenAIMessage[],
  model: string,
  maxTokens = 8192,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = getGlmApiKey();

  if (!apiKey) {
    throw new Error('GLM API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
  }

  const response = await fetch(`${GLM_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.85, // 반복 방지를 위해 약간 낮춤
      top_p: 0.9, // 반복 방지를 위해 약간 낮춤
      presence_penalty: 0.6, // 반복 방지 강화
      frequency_penalty: 0.4, // 동일 표현 반복 방지
      max_tokens: maxTokens,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GLM API 오류: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '응답 없음';
  recordAiUsage({
    model,
    inputChars: countOpenAiInputChars(messages),
    outputChars: text.length,
    usageMetadata: toOpenAiUsageMetadata(data.usage),
  });
  return text;
}

function isRetryableGeminiError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('503') ||
    lower.includes('429') ||
    lower.includes('overloaded') ||
    lower.includes('unavailable') ||
    lower.includes('quota') ||
    lower.includes('rate') ||
    lower.includes('internal') ||
    lower.includes('timeout') ||
    lower.includes('시간') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('econnreset');
}

export function getGeminiOverloadFallbackModel(model: string): GeminiTextModel | null {
  if (!model.startsWith('gemini-')) return null;
  if (model === MODELS.FLASH_LATEST) return MODELS.TEXT;
  if (model === MODELS.TEXT) return MODELS.FLASH_FALLBACK;
  if (model === MODELS.FLASH_FALLBACK) return MODELS.FLASH_FALLBACK_SECONDARY;
  if (model === MODELS.FLASH_25) return MODELS.FLASH_LITE;
  if (model === MODELS.FLASH_LITE) return null;
  return MODELS.TEXT;
}

/**
 * 본문 집필은 사용자가 처음 고른 Flash 세대를 기준으로 품질 우선 폴백을 구성한다.
 * 보조 작업은 검증된 모델만 사용하므로 기존 getGeminiOverloadFallbackModel을 유지한다.
 */
export function getGeminiWritingOverloadFallbackModel(
  failedModel: string,
  requestedModel: string
): GeminiTextModel | null {
  const chain: GeminiTextModel[] | null = requestedModel === MODELS.TEXT
    ? [MODELS.TEXT, MODELS.FLASH_LATEST, MODELS.FLASH_FALLBACK]
    : requestedModel === MODELS.FLASH_LATEST
      ? [MODELS.FLASH_LATEST, MODELS.TEXT, MODELS.FLASH_FALLBACK]
      : null;

  if (!chain) return getGeminiOverloadFallbackModel(failedModel);

  const failedIndex = chain.indexOf(failedModel as GeminiTextModel);
  return failedIndex >= 0 ? chain[failedIndex + 1] ?? null : null;
}

export type GeminiThinkingLevel = 'low' | 'medium' | 'high';

const GEMINI_THINKING_LEVELS: Record<GeminiThinkingLevel, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/** 3.x Flash에서만 지원되는 사고 수준을 SDK 형식으로 변환한다. */
export function getGeminiThinkingConfig(
  model: string,
  level: GeminiThinkingLevel = 'low',
): { thinkingLevel: ThinkingLevel } | undefined {
  if (
    model === MODELS.TEXT ||
    model === MODELS.FLASH_LATEST ||
    model === MODELS.FLASH_FALLBACK
  ) {
    return { thinkingLevel: GEMINI_THINKING_LEVELS[level] };
  }
  return undefined;
}

/**
 * 통합 AI 생성 함수
 * 전역 설정에 따라 Gemini, xAI(Grok), GLM 호출
 * provider 옵션으로 전역 설정을 오버라이드할 수 있음
 */
export async function generateContent(options: {
  contents: GeminiContent[];
  systemInstruction?: string;
  usePro?: boolean; // Gemini Pro 모델 사용 여부
  model?: string; // Gemini 모델명 직접 지정 (usePro보다 우선)
  maxTokens?: number; // 한 화당 최대 생성 토큰
  signal?: AbortSignal; // 취소용 AbortSignal
  provider?: 'gemini' | 'xai' | 'glm'; // 전역 설정 오버라이드
  jsonMode?: boolean; // JSON 응답 강제 (Gemini responseMimeType)
  preserveSystemInstruction?: boolean; // 도구 실행 시 원문·구조화 명령을 그대로 전달
  timeoutMs?: number; // 보조 생성용 빠른 실패 제한
  retryAttempts?: number; // 보조 생성은 짧게, 본문 생성은 기본 3회
  retryInitialDelayMs?: number;
  thinkingLevel?: GeminiThinkingLevel; // 3.x Flash 사고 수준 (기본 low)
}): Promise<string> {
  const { contents, systemInstruction, usePro = false, maxTokens = 8192, signal } = options;
  const provider = options.provider || 'gemini';
  const retryAttempts = Math.max(1, options.retryAttempts ?? 3);
  const retryInitialDelayMs = options.retryInitialDelayMs ?? 1000;

  if (provider === 'xai') {
    // xAI (Grok) 호출
    const messages = convertToOpenAIMessages(contents, systemInstruction);
    const modelName = options.model || getCurrentXaiModel();

    try {
      return await callXaiApi(messages, modelName, maxTokens, signal);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AI 생성이 취소되었습니다.');
      }
      console.error('[xAI] 호출 실패:', error);
      throw error;
    }
  } else if (provider === 'glm') {
    // GLM (智谱) 호출 - 한국어 품질 향상 지시 포함
    const messages = convertToOpenAIMessages(contents, systemInstruction, !options.preserveSystemInstruction);
    const modelName = options.model || getCurrentGlmModel();

    try {
      return await callGlmApi(messages, modelName, maxTokens, signal);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AI 생성이 취소되었습니다.');
      }
      console.error('[GLM] 호출 실패:', error);
      throw error;
    }
  } else {
    // Gemini 호출 (Google SDK는 AbortSignal을 직접 지원하지 않으므로 수동 체크)
    if (signal?.aborted) {
      throw new Error('AI 생성이 취소되었습니다.');
    }

    const gemini = getGeminiInstance();
    let currentModel = normalizeGeminiTextModel(options.model || (usePro ? MODELS.PRO_STABLE : MODELS.TEXT));
    let delay = retryInitialDelayMs;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      const geminiConfig: Record<string, unknown> = {
        systemInstruction,
        maxOutputTokens: maxTokens,
        safetySettings: NOVEL_SAFETY_SETTINGS,
      };
      const thinkingConfig = getGeminiThinkingConfig(currentModel, options.thinkingLevel);
      if (thinkingConfig) geminiConfig.thinkingConfig = thinkingConfig;
      // JSON 모드: Gemini에게 JSON만 반환하도록 강제
      if (options.jsonMode) {
        geminiConfig.responseMimeType = 'application/json';
      }

      logger.log('[Gemini] 호출 준비', {
        model: currentModel,
        maxTokens,
        jsonMode: !!options.jsonMode,
        inputChars: countGeminiInputChars(contents, systemInstruction),
        thinkingLevel: thinkingConfig ? (options.thinkingLevel ?? 'low') : 'model-default',
        attempt,
      });

      try {
        const request = gemini.models.generateContent({
          model: currentModel,
          contents,
          config: geminiConfig,
        });
        const response = options.timeoutMs
          ? await withTimeout(request, options.timeoutMs, 'Gemini 응답 시간이 길어져 중단했습니다.')
          : await request;

        // 응답 후에도 취소 확인 (long-running 작업에서 유용)
        if (signal?.aborted) {
          throw new Error('AI 생성이 취소되었습니다.');
        }

        const termination = readGeminiTermination(response);
        if (isGeminiBlocked(termination)) {
          throw new GeminiTerminationError(currentModel, termination);
        }
        const text = response.text;
        if (!text) {
          throw new Error(`Gemini 응답 없음 (모델: ${currentModel}, 종료사유: ${termination.finishReason || '알 수 없음'})`);
        }
        recordAiUsage({
          model: currentModel,
          inputChars: countGeminiInputChars(contents, systemInstruction),
          outputChars: text.length,
          usageMetadata: response.usageMetadata,
        });
        return text;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('AI 생성이 취소되었습니다.');
        }

        const errMsg = error instanceof Error ? error.message : String(error);
        const retryable = isRetryableGeminiError(errMsg);
        const fallbackModel = retryable ? getGeminiOverloadFallbackModel(currentModel) : null;
        console.error(`[Gemini] 호출 실패 (모델: ${currentModel}, 시도 ${attempt}/${retryAttempts}):`, errMsg);

        if (!retryable || attempt >= retryAttempts) {
          throw error instanceof Error ? error : new Error(`Gemini 오류: ${errMsg}`);
        }

        if (fallbackModel && fallbackModel !== currentModel) {
          logger.log(`[Gemini Retry] ${currentModel} 과부하 → ${fallbackModel}로 임시 전환`);
          currentModel = fallbackModel;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, 4000);
      }
    }

    throw new Error('Gemini 호출 재시도 한도를 초과했습니다.');
  }
}

export async function* streamGeminiContent(options: {
  contents: GeminiContent[];
  systemInstruction?: string;
  model?: string;
  maxTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  retryAttempts?: number;
  thinkingLevel?: GeminiThinkingLevel;
}): AsyncGenerator<string> {
  const maxTokens = options.maxTokens ?? 2048;
  const retryAttempts = Math.max(1, options.retryAttempts ?? 2);
  const gemini = getGeminiInstance();
  let currentModel = normalizeGeminiTextModel(options.model || MODELS.TEXT);
  let delay = 800;

  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    if (options.signal?.aborted) throw new Error('AI 생성이 취소되었습니다.');
    let hasEmitted = false;
    let termination: GeminiTerminationDiagnostic | undefined;

    try {
      const thinkingConfig = getGeminiThinkingConfig(currentModel, options.thinkingLevel);
      const request = gemini.models.generateContentStream({
        model: currentModel,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          maxOutputTokens: maxTokens,
          safetySettings: NOVEL_SAFETY_SETTINGS,
          ...(thinkingConfig && { thinkingConfig }),
        },
      });
      const stream = options.timeoutMs
        ? await withTimeout(request, options.timeoutMs, 'Gemini 응답 시작이 늦어져 중단했습니다.')
        : await request;

      const iterator = stream[Symbol.asyncIterator]();
      let isFirstChunk = true;
      let outputChars = 0;
      let usageMetadata: AiUsageMetadata | undefined;
      while (true) {
        const nextChunk = iterator.next();
        const result = isFirstChunk && options.timeoutMs
          ? await withTimeout(nextChunk, options.timeoutMs, 'Gemini 첫 응답이 늦어져 중단했습니다.')
          : await nextChunk;
        isFirstChunk = false;
        if (result.done) break;
        const chunk = result.value;
        termination = mergeGeminiTermination(termination, readGeminiTermination(chunk));
        if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
        if (options.signal?.aborted) throw new Error('AI 생성이 취소되었습니다.');
        if (!chunk.text) continue;
        hasEmitted = true;
        outputChars += chunk.text.length;
        yield chunk.text;
      }

      if (termination && isGeminiBlocked(termination)) {
        throw new GeminiTerminationError(currentModel, termination);
      }
      if (!hasEmitted) throw new Error(`Gemini 응답 없음 (모델: ${currentModel})`);
      recordAiUsage({
        model: currentModel,
        inputChars: countGeminiInputChars(options.contents, options.systemInstruction),
        outputChars,
        usageMetadata,
      });
      return;
    } catch (error) {
      if (hasEmitted || options.signal?.aborted) throw error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = isRetryableGeminiError(message);
      if (!retryable || attempt >= retryAttempts) throw error;
      const fallback = getGeminiOverloadFallbackModel(currentModel);
      if (fallback) currentModel = fallback;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 3000);
    }
  }
}

/** 기존 호환성을 위한 ai 객체 (Gemini 전용) */
export const ai = {
  get models() {
    return getGeminiInstance().models;
  },
  get caches() {
    return getGeminiInstance().caches;
  },
};

/**
 * API 키 설정 여부 확인
 */
export const getProviderForGenerationEngine = (engine?: string | null): 'gemini' | 'xai' | 'glm' => {
  if (engine?.startsWith('grok-')) return 'xai';
  if (engine?.startsWith('glm-')) return 'glm';
  return 'gemini';
};

export const isApiKeyConfigured = (engine?: string | null): boolean => {
  const provider = getProviderForGenerationEngine(engine);
  if (provider === 'xai') return !!getXaiApiKey();
  if (provider === 'glm') return !!getGlmApiKey();
  return !!getGeminiApiKey();
};

/**
 * 현재 사용 중인 API 정보 반환 (UI 표시용)
 */
export const getCurrentApiInfo = (engine?: string | null): { provider: string; model: string } => {
  const provider = getProviderForGenerationEngine(engine);
  if (provider === 'xai') {
    return {
      provider: 'xAI',
      model: engine || getCurrentXaiModel(),
    };
  }
  if (provider === 'glm') {
    return {
      provider: 'GLM',
      model: engine || getCurrentGlmModel(),
    };
  }
  return {
    provider: 'Gemini',
    model: normalizeGeminiTextModel(engine || MODELS.TEXT),
  };
};

/** 모델명 상수 (Gemini) */
export const MODELS = {
  /** 기본 텍스트 생성 모델 (검증된 Gemini 3.7 Flash GA) */
  TEXT: 'gemini-3.7-flash',
  /** 보조 작업 기본 Flash 모델 */
  FLASH_STABLE: 'gemini-3.7-flash',
  /** 본문 집필에서만 직접 선택하는 최신 검증 대상 */
  FLASH_LATEST: 'gemini-3.8-flash',
  /** 3.7 과부하 시 사용하는 이전 GA 폴백 */
  FLASH_FALLBACK: 'gemini-3.6-flash',
  /** 3.6도 실패할 때 사용하는 2차 안정 폴백 */
  FLASH_FALLBACK_SECONDARY: 'gemini-2.5-flash',
  /** 안정 Flash 모델 (Gemini 2.5 Flash Stable) */
  FLASH_25: 'gemini-2.5-flash',
  /** 경량 고속 모델 (Gemini 3.5 Flash-Lite Stable) */
  FLASH_LITE: 'gemini-3.5-flash-lite',
  /** 고지능 모델 (Gemini 3.1 Pro Preview — 최신, 불안정) */
  PRO: 'gemini-3.1-pro-preview',
  /** 안정 고지능 모델 (Gemini 2.5 Pro Stable — 안정적, 저렴) */
  PRO_STABLE: 'gemini-2.5-pro',
  /** 네이티브 이미지 생성 모델 (Nano Banana Lite) */
  IMAGE_NATIVE: 'gemini-3.1-flash-lite-image',
  /** 이미지 생성 모델 */
  IMAGE: 'imagen-3.0-generate-002',
} as const;

export type GeminiTextModel =
  | typeof MODELS.TEXT
  | typeof MODELS.FLASH_STABLE
  | typeof MODELS.FLASH_LATEST
  | typeof MODELS.FLASH_FALLBACK
  | typeof MODELS.FLASH_FALLBACK_SECONDARY
  | typeof MODELS.FLASH_25
  | typeof MODELS.FLASH_LITE
  | typeof MODELS.PRO
  | typeof MODELS.PRO_STABLE;

export type GeminiHelperModel = Exclude<GeminiTextModel, typeof MODELS.FLASH_LATEST>;

type GeminiModelOption = Readonly<{
  value: GeminiTextModel;
  label: string;
}>;

/** 본문 집필에서 직접 선택할 수 있는 Gemini 모델 목록 */
export const GEMINI_WRITING_MODEL_OPTIONS: ReadonlyArray<GeminiModelOption> = [
  { value: MODELS.TEXT, label: 'Gemini 3.7 Flash (기본, 검증됨)' },
  { value: MODELS.FLASH_LATEST, label: 'Gemini 3.8 Flash (집필 시험 선택)' },
  { value: MODELS.FLASH_FALLBACK, label: 'Gemini 3.6 Flash (이전 GA)' },
  { value: MODELS.FLASH_LITE, label: 'Gemini 3.5 Flash-Lite (요약/저비용)' },
  { value: MODELS.FLASH_25, label: 'Gemini 2.5 Flash (구형 안정)' },
  { value: MODELS.PRO_STABLE, label: 'Gemini 2.5 Pro (고품질 안정)' },
  { value: MODELS.PRO, label: 'Gemini 3.1 Pro Preview (고품질, 불안정)' },
];

/** 추천 작가 등 보조 작업용 목록. 검증 중인 3.8은 노출하지 않는다. */
export const GEMINI_HELPER_MODEL_OPTIONS: ReadonlyArray<GeminiModelOption> =
  GEMINI_WRITING_MODEL_OPTIONS.filter(({ value }) => value !== MODELS.FLASH_LATEST);

export const normalizeGeminiHelperModel = (model?: string | null): GeminiHelperModel => {
  const normalized = normalizeGeminiTextModel(model);
  return normalized === MODELS.FLASH_LATEST ? MODELS.TEXT : normalized;
};

const GEMINI_MODEL_ALIASES: Record<string, GeminiTextModel> = {
  'gemini-3-flash-preview': MODELS.TEXT,
  'gemini-3.0-flash': MODELS.TEXT,
  'gemini-3.1-flash-lite': MODELS.FLASH_LITE,
  'gemini-2.5-flash-lite': MODELS.FLASH_LITE,
  'gemini-3.1-flash-lite-preview': MODELS.FLASH_LITE,
  'gemini-3-pro-preview': MODELS.PRO,
  'gemini-3.0-pro': MODELS.PRO,
};

export const normalizeGeminiTextModel = (model?: string | null): GeminiTextModel => {
  if (!model) return MODELS.TEXT;
  if (
    model === MODELS.TEXT ||
    model === MODELS.FLASH_STABLE ||
    model === MODELS.FLASH_LATEST ||
    model === MODELS.FLASH_FALLBACK ||
    model === MODELS.FLASH_FALLBACK_SECONDARY ||
    model === MODELS.FLASH_25 ||
    model === MODELS.FLASH_LITE ||
    model === MODELS.PRO ||
    model === MODELS.PRO_STABLE
  ) {
    return model;
  }
  return GEMINI_MODEL_ALIASES[model] || MODELS.TEXT;
};

export type AiTaskRole =
  | 'writing'
  | 'worldview'
  | 'worldview-expanded'
  | 'analysis'
  | 'summary'
  | 'review';

export const AI_TASK_MODEL_POLICY: Record<Exclude<AiTaskRole, 'writing'>, GeminiTextModel> = {
  worldview: MODELS.TEXT,
  'worldview-expanded': MODELS.FLASH_STABLE,
  analysis: MODELS.FLASH_LITE,
  summary: MODELS.FLASH_LITE,
  review: MODELS.FLASH_STABLE,
};

export const getAiTaskModel = (role: AiTaskRole, writingEngine?: string | null): string => {
  if (role === 'writing') {
    const provider = getProviderForGenerationEngine(writingEngine);
    if (provider === 'gemini') return normalizeGeminiTextModel(writingEngine || MODELS.TEXT);
    return writingEngine || (provider === 'xai' ? getCurrentXaiModel() : getCurrentGlmModel());
  }
  return AI_TASK_MODEL_POLICY[role];
};

export const getAiTaskPolicySummary = (): string => {
  return [
    `집필: 선택 모델 (3.x Flash low)`,
    `세계관: ${AI_TASK_MODEL_POLICY.worldview} (medium)`,
    `확장/검토: ${AI_TASK_MODEL_POLICY.review} (medium)`,
    `요약/분석: ${AI_TASK_MODEL_POLICY.summary}`,
  ].join(' · ');
};

/** 호환 API. 작품 길이와 모델이 바뀌어도 최근 원문 계약은 줄이지 않는다. */
export const getRecommendedFullTextChapters = (
  _engine: string | null | undefined,
  _chapterCount: number,
): number => FIXED_RECENT_RAW_CHAPTERS;

export const getSummaryTriggerChapters = (value?: number | null): number => {
  if (!Number.isFinite(value || 0)) return 5;
  return Math.min(20, Math.max(1, Math.round(value || 5)));
};

/** xAI Grok 모델 옵션 */
export const XAI_MODELS = [
  { value: 'grok-4-fast', label: 'Grok 4 Fast (추천, $0.20/$0.50)' },
  { value: 'grok-4', label: 'Grok 4 ($3/$15)' },
  { value: 'grok-3', label: 'Grok 3 ($3/$15)' },
] as const;

/** GLM (智谱) 모델 옵션 */
export const GLM_MODELS = [
  { value: 'glm-5', label: 'GLM-5 (200K 컨텍스트, $1/$3.2)' },
] as const;

/** 청크 크기 (약 100만 토큰의 30%) */
export const CHUNK_SIZE = 300000;

/** 캐싱 임계값 (최소 토큰 수) */
export const CACHE_TOKEN_THRESHOLD = 4096;

/** 기본 활성 버퍼 윈도우 */
export const DEFAULT_ACTIVE_BUFFER_WINDOW = FIXED_RECENT_RAW_CHAPTERS;

// ============================================================
// AI 생성 취소 기능 (AbortController)
// ============================================================

/** 현재 진행 중인 AI 생성 요청의 AbortController */
let _currentAbortController: AbortController | null = null;

/**
 * 새 AbortController 생성 및 등록
 * @returns 새로 생성된 AbortSignal
 */
export function createAbortSignal(): AbortSignal {
  // 기존 요청이 있으면 취소
  if (_currentAbortController) {
    _currentAbortController.abort();
  }
  _currentAbortController = new AbortController();
  return _currentAbortController.signal;
}

/**
 * 현재 진행 중인 AI 생성 취소
 * @returns 취소 성공 여부
 */
export function cancelCurrentGeneration(): boolean {
  if (_currentAbortController) {
    _currentAbortController.abort();
    _currentAbortController = null;
    return true;
  }
  return false;
}

/**
 * 현재 AI 생성이 진행 중인지 확인
 */
export function isGenerating(): boolean {
  return _currentAbortController !== null;
}

/**
 * AbortController 정리 (생성 완료 후 호출)
 */
export function clearAbortController(signal?: AbortSignal): void {
  if (!signal || _currentAbortController?.signal === signal) {
    _currentAbortController = null;
  }
}
