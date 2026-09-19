/**
 * ============================================================
 * @module services/ai/character
 * @file character.ts
 * ============================================================
 * @description 캐릭터 관련 AI 함수
 * ============================================================
 */

import type { Character } from '@core/types';
import { generateContent, MODELS } from './config';
import { CHARACTER_ARTIST_INSTRUCTION } from './prompts';
import { extractAndParseJson } from './utils';

interface CharacterHints {
  name?: string;
  role?: string;
  keywords?: string[];
}

/**
 * 캐릭터 프로필 생성
 */
export async function generateCharacterProfile(
  context: string,
  worldview: string,
  existing: string,
  hints: CharacterHints
): Promise<Omit<Character, 'id'>> {
  const trimmedWorldview = worldview.length > 8000
    ? `${worldview.slice(0, 8000)}\n\n[이하 세계관은 길어서 생략됨. 위 설정과 충돌하지 않게 작성하세요.]`
    : worldview;
  const prompt = `컨텍스트: ${context}\n세계관: ${trimmedWorldview}\n기존 인물: ${existing}\n힌트: ${JSON.stringify(hints)}\n\n반드시 JSON 형식으로만 응답하세요.`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: CHARACTER_ARTIST_INSTRUCTION,
      model: MODELS.FLASH_LITE,
      maxTokens: 1536,
      jsonMode: true,
      timeoutMs: 12000,
      retryAttempts: 1,
    });
    const result = extractAndParseJson<Omit<Character, 'id'> | null>(response, null);
    if (!result) {
      throw new Error('캐릭터 생성 실패: 유효한 응답이 아닙니다.');
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    throw new Error(`캐릭터 생성 실패: ${message}`);
  }
}
