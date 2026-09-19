/**
 * ============================================================
 * @module services/ai/image
 * @file image.ts
 * ============================================================
 * @description 이미지 생성 관련 AI 함수
 * - Gemini 나노바나나 Lite (gemini-3.1-flash-lite-image) 사용
 * ============================================================
 */

import { ai, MODELS, NOVEL_SAFETY_SETTINGS } from './config';
import { ART_DIRECTOR_INSTRUCTION } from './prompts';
import { extractAndParseJson } from './utils';
import type { CharacterChatPersona, CharacterChatSource } from '@core/types';

/** 이미지 생성 모델 (Nano Banana Lite) */
const IMAGE_MODEL = MODELS.IMAGE_NATIVE;
const IMAGE_FALLBACK_MODEL = 'gemini-2.5-flash-image';

async function generateNativeImage(prompt: string, model: string = IMAGE_MODEL): Promise<string | null> {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: ['IMAGE'],
      safetySettings: NOVEL_SAFETY_SETTINGS,
    },
  });
  const parts = response.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find((part: { inlineData?: { data?: string; mimeType?: string } }) => (
    part.inlineData?.data
  ));
  if (!imagePart?.inlineData?.data) return null;
  const mimeType = imagePart.inlineData.mimeType || 'image/png';
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

async function generateImageWithFallback(prompt: string): Promise<string | null> {
  try {
    const image = await generateNativeImage(prompt);
    if (image) return image;
  } catch (error) {
    console.warn('[이미지 생성] 기본 모델 호출 실패, 안정 모델로 재시도:', error);
  }
  return generateNativeImage(prompt, IMAGE_FALLBACK_MODEL);
}

/**
 * 표지 이미지 생성 (나노바나나)
 * Gemini 네이티브 이미지 생성 — Imagen 대비 고품질 + 텍스트 렌더링 지원
 */
export async function generateCoverImage(
  prompt: string,
  aspectRatio: string
): Promise<string | null> {
  try {
    return await generateImageWithFallback(`Generate a novel cover image (aspect ratio: ${aspectRatio}): ${prompt}`);
  } catch (error) {
    console.error('[이미지 생성] 표지 생성 실패:', error);
    return null;
  }
}

export async function generateCharacterChatImage(
  persona: CharacterChatPersona,
  source: CharacterChatSource,
  kind: 'portrait' | 'background'
): Promise<string | null> {
  const character = [
    `Name: ${persona.name}`,
    `Role: ${persona.role.value}`,
    `Appearance: ${persona.appearance.value}`,
    `Personality: ${persona.personality.value}`,
    `Background: ${persona.background.value}`,
  ].filter((line) => !line.endsWith(': ')).join('\n');
  const world = (persona.worldContext.value || source.worldview).slice(0, 3000);

  const prompt = kind === 'portrait'
    ? `Create a polished Korean webnovel character illustration for roleplay chat.
Vertical 3:4 composition, one character only, waist-up or full-body, front three-quarter view.
Keep the face and costume distinctive and reusable across later expression edits.
Clean silhouette, readable lighting, detailed eyes, no frame, no lettering, no logo, no watermark-like text.

Character:
${character}

World context:
${world || 'Original fictional setting.'}`
    : `Create a polished Korean webnovel roleplay background.
Wide 16:9 composition, environment only, absolutely no people or characters.
Leave visual breathing room for a character sprite in the foreground.
Atmospheric but clearly readable, no frame, no lettering, no logo, no watermark-like text.

Current scene:
${persona.storyContext.value || persona.background.value || source.title}

World context:
${world || 'Original fictional setting.'}`;

  try {
    return await generateImageWithFallback(prompt);
  } catch (error) {
    console.error('[캐릭터챗] 이미지 생성 실패:', error);
    return null;
  }
}

/**
 * 소설 정보로 이미지 프롬프트 생성
 */
export async function generatePromptsFromTitle(
  title: string,
  novelInfo?: { subject?: string; plotSummary?: string; synopsis?: string }
): Promise<string[]> {
  const parts = [`제목: ${title}`];
  if (novelInfo?.subject) parts.push(`장르/주제: ${novelInfo.subject}`);
  if (novelInfo?.plotSummary) parts.push(`줄거리: ${novelInfo.plotSummary.substring(0, 500)}`);
  if (novelInfo?.synopsis) parts.push(`시놉시스: ${novelInfo.synopsis.substring(0, 500)}`);

  try {
    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
      contents: parts.join('\n'),
      config: {
        systemInstruction: ART_DIRECTOR_INSTRUCTION,
        responseMimeType: 'application/json',
        safetySettings: NOVEL_SAFETY_SETTINGS,
      },
    });
    return extractAndParseJson<string[]>(response.text || '', []);
  } catch {
    return [];
  }
}

/**
 * 상징적 이미지 프롬프트 생성
 */
export async function generateSymbolicPrompt(info: unknown): Promise<string[]> {
  const systemInstruction = '상징적인 이미지 프롬프트 3가지를 JSON 배열(영어)로 제안하세요.';
  const prompt = JSON.stringify(info);

  try {
    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        safetySettings: NOVEL_SAFETY_SETTINGS,
      },
    });
    return extractAndParseJson<string[]>(response.text || '', []);
  } catch {
    return [];
  }
}

/**
 * 핵심 장면 프롬프트 추출
 */
export async function extractKeyScene(text: string): Promise<string[]> {
  const systemInstruction = '핵심 장면 이미지 프롬프트 3가지를 JSON 배열(영어)로 제안하세요.';

  try {
    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
      contents: text.substring(0, 10000),
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        safetySettings: NOVEL_SAFETY_SETTINGS,
      },
    });
    return extractAndParseJson<string[]>(response.text || '', []);
  } catch {
    return [];
  }
}
