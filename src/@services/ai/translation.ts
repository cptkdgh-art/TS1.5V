/**
 * ============================================================
 * @module services/ai/translation
 * @file translation.ts
 * ============================================================
 * @description AI 기반 번역 서비스 (GLM/Gemini 활용)
 * ============================================================
 */

import { generateContent } from './config';

export type LanguageCode = 'ko' | 'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'es' | 'fr' | 'de';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'ko', name: '한국어', nativeName: '한국어' },
  { code: 'en', name: '영어', nativeName: 'English' },
  { code: 'ja', name: '일본어', nativeName: '日本語' },
  { code: 'zh-CN', name: '중국어(간체)', nativeName: '简体中文' },
  { code: 'zh-TW', name: '중국어(번체)', nativeName: '繁體中文' },
  { code: 'es', name: '스페인어', nativeName: 'Español' },
  { code: 'fr', name: '프랑스어', nativeName: 'Français' },
  { code: 'de', name: '독일어', nativeName: 'Deutsch' },
];

/** 언어 코드를 자연어로 변환 */
function getLanguageFullName(code: LanguageCode | 'auto'): string {
  const names: Record<string, string> = {
    'ko': '한국어',
    'en': '영어',
    'ja': '일본어',
    'zh-CN': '중국어(간체)',
    'zh-TW': '중국어(번체)',
    'es': '스페인어',
    'fr': '프랑스어',
    'de': '독일어',
    'auto': '원본 언어'
  };
  return names[code] || code;
}

/** 번역 시스템 인스트럭션 */
const TRANSLATOR_INSTRUCTION = `당신은 전문 문학 번역가입니다.

[핵심 규칙]
1. 원문의 문학적 뉘앙스, 감정, 분위기를 최대한 보존하세요.
2. 직역보다는 자연스러운 의역을 선호하되, 원문의 의미를 왜곡하지 마세요.
3. 캐릭터 대사의 말투와 성격이 드러나도록 번역하세요.
4. 고유명사(인명, 지명)는 원문 그대로 유지하거나 해당 언어의 일반적인 표기법을 따르세요.
5. 번역문만 출력하세요. 설명, 주석, 원문 인용을 포함하지 마세요.
6. 줄바꿈과 문단 구조를 원문과 동일하게 유지하세요.`;

/**
 * AI 기반 번역
 * @param text 번역할 텍스트
 * @param targetLang 목표 언어 코드
 * @param sourceLang 원본 언어 코드 (auto = 자동 감지)
 * @returns 번역된 텍스트
 */
export async function translate(
  text: string,
  targetLang: LanguageCode,
  sourceLang: LanguageCode | 'auto' = 'auto'
): Promise<string> {
  if (!text.trim()) return '';

  const targetLangName = getLanguageFullName(targetLang);
  const sourceLangName = getLanguageFullName(sourceLang);

  const prompt = sourceLang === 'auto'
    ? `다음 텍스트를 ${targetLangName}로 번역하세요:\n\n${text}`
    : `다음 ${sourceLangName} 텍스트를 ${targetLangName}로 번역하세요:\n\n${text}`;

  try {
    const translated = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: TRANSLATOR_INSTRUCTION,
    });

    return translated.trim();
  } catch (error) {
    console.error('[Translation Error]', error);
    throw new Error(
      error instanceof Error
        ? `번역 실패: ${error.message}`
        : '번역 중 알 수 없는 오류가 발생했습니다.'
    );
  }
}

/**
 * 긴 텍스트를 청크로 나눠서 번역
 * @param text 번역할 텍스트
 * @param targetLang 목표 언어 코드
 * @param sourceLang 원본 언어 코드
 * @param chunkSize 청크 크기 (기본 3000자 - AI 컨텍스트 고려)
 * @returns 번역된 텍스트
 */
export async function translateLongText(
  text: string,
  targetLang: LanguageCode,
  sourceLang: LanguageCode | 'auto' = 'auto',
  chunkSize = 3000
): Promise<string> {
  if (!text.trim()) return '';

  // 짧은 텍스트는 바로 번역
  if (text.length <= chunkSize) {
    return translate(text, targetLang, sourceLang);
  }

  // 긴 텍스트는 문단 단위로 분할
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if ((currentChunk + '\n\n' + paragraph).length > chunkSize) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  // 순차 번역 (API 부하 방지를 위해 딜레이 추가)
  const translatedChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms 딜레이
    }
    const translated = await translate(chunks[i], targetLang, sourceLang);
    translatedChunks.push(translated);
  }

  return translatedChunks.join('\n\n');
}

/**
 * 언어 자동 감지 (AI 기반)
 * @param text 감지할 텍스트
 * @returns 감지된 언어 코드
 */
export async function detectLanguage(text: string): Promise<LanguageCode | 'unknown'> {
  if (!text.trim()) return 'unknown';

  const prompt = `다음 텍스트의 언어를 감지하고, 해당하는 언어 코드만 출력하세요.
가능한 코드: ko, en, ja, zh-CN, zh-TW, es, fr, de
해당하지 않으면 unknown을 출력하세요.

텍스트: ${text.substring(0, 500)}`;

  try {
    const result = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: '언어 코드만 출력하세요. 설명하지 마세요.',
    });

    const detected = result.trim().toLowerCase();
    const validCodes: LanguageCode[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de'];

    if (validCodes.includes(detected as LanguageCode)) {
      return detected as LanguageCode;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * 언어 이름 가져오기
 */
export function getLanguageName(code: LanguageCode): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang?.name || code;
}
