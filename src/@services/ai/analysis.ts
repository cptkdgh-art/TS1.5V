/**
 * ============================================================
 * @module services/ai/analysis
 * @file analysis.ts
 * ============================================================
 * @description 분석 관련 AI 함수
 * ============================================================
 */

import type { Chapter, Character, CharacterAnalysisResult, WorldviewAnalysisResult, ClonedAuthorDetails, Content, ScannedCharacter } from '@core/types';
import { MODELS, CHUNK_SIZE, generateContent } from './config';
import { withRetry, extractTextFromContent, extractAndParseJson } from './utils';
import {
  PLOT_ARCHIVIST_INSTRUCTION,
  SUMMARY_INTEGRATOR_INSTRUCTION,
  PROFILER_INSTRUCTION,
  NOVEL_ANALYST_INSTRUCTION,
  CHARACTER_SCOUTER_INSTRUCTION,
  MANUSCRIPT_ARCHITECT_INSTRUCTION,
  WORLDVIEW_ARCHAEOLOGIST_INSTRUCTION,
} from './prompts';
import { normalizeGeneratedAuthorProfile } from './author';

/** xAI용 문체 분석 강화 프롬프트 */
const ENHANCED_PROFILER_SCHEMA = `
[중요: JSON 응답 규칙]
반드시 아래 형식의 JSON만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "name": "분석된 문체를 대표하는 가상 작가 필명",
  "specialty": "이 텍스트에서 드러나는 장르적 특성과 강점 (최소 50자 이상)",
  "writingStyle": "문체, 톤, 서술 방식, 문장 리듬, 단어 선택의 특징 (최소 100자 이상)",
  "coreDirectives": "이 문체를 재현하기 위한 구체적인 집필 지침 (최소 100자 이상)",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
  "identityCore": {
    "selfDefinition": "이 글을 쓰는 작가는 자신을 어떤 존재로 보는가",
    "reasonToWrite": "왜 이런 이야기를 쓰는가",
    "worldview": "세계와 삶을 해석하는 관점",
    "viewOfHumanity": "인간의 욕망과 선택을 보는 관점",
    "literaryValues": [{ "belief": "문학적 믿음", "creativeEffect": "글의 선택에 미치는 영향", "doubt": "의심 또는 반례" }],
    "aestheticTaste": { "drawnTo": ["끌리는 미감"], "avoids": ["피하는 미감"], "emotionalTexture": "감정의 질감" },
    "innerContradictions": [{ "valueA": "가치 A", "valueB": "가치 B", "unresolvedReason": "해결되지 않는 이유" }],
    "recurringQuestions": ["반복해서 탐구하는 질문"],
    "readerRelationship": "독자를 대하는 태도",
    "creativeEthics": "창작 윤리",
    "narrativeInstincts": ["본능적인 서사 선택"],
    "voiceOrigins": "문체가 생겨난 내적 이유",
    "readabilityPractice": "술술 읽히게 만드는 방식",
    "plausibilityPractice": "인과와 감정의 개연성을 만드는 방식"
  }
}

[분석 지침]
1. 문장의 평균 길이와 호흡을 파악하세요 (짧고 날카로운가? 길고 서정적인가?)
2. 자주 사용되는 표현, 비유, 수사법을 찾으세요
3. 시점(1인칭/3인칭)과 서술 거리를 분석하세요
4. 감정 표현 방식을 살피세요 (직접 서술? 간접 암시?)
5. 대화와 지문의 비율, 대화체의 특징을 파악하세요
6. identityCore에는 특정 작품의 인물·설정을 옮기지 말고, 여러 작품에서도 유지될 창작자의 관점과 판단 원인을 추론하세요

[예시 - 이 수준으로 상세하게 작성하세요]
{
  "name": "심야의 필경사",
  "specialty": "일상 속에 숨겨진 비극과 희극을 포착하는 감성 드라마. 평범한 인물들의 내면을 깊이 파고들어 독자의 공감을 이끌어내는 데 탁월하다. 특히 관계의 미묘한 긴장과 화해의 순간을 섬세하게 그려낸다.",
  "writingStyle": "3~4개의 짧은 문장 후 긴 문장으로 리듬을 만든다. 감각적 디테일(빛, 소리, 냄새)을 즐겨 사용하며, 인물의 감정을 환경과 날씨에 투영한다. 대화는 간결하고 함축적이며, 말하지 않은 것이 더 많은 느낌을 준다. 현재형 서술로 생동감을 살리고, 문장 끝을 열린 형태로 마무리하여 여운을 남긴다.",
  "coreDirectives": "1. 모든 장면에 날씨나 시간대를 언급하여 분위기를 설정하라. 2. 인물의 감정은 신체 반응(떨림, 숨, 시선)으로 보여줘라. 3. 대화 사이의 침묵과 행동 묘사로 긴장감을 만들어라. 4. 결말은 완전한 해결보다 암시와 여운을 남겨라.",
  "tags": ["감성드라마", "일상비극", "섬세한묘사", "함축적대화", "열린결말"]
}

위 예시처럼 모든 필드를 풍부하고 구체적으로 작성하세요.`;

/**
 * 소설 히스토리 요약 (타임라인)
 */
export async function summarizeNovelHistory(textToSummarize: string): Promise<string> {
  const basePrompt = `--- 요청 ---\n위 텍스트를 읽고, 사건의 타임라인을 추출하세요.`;

  if (textToSummarize.length <= CHUNK_SIZE) {
    const prompt = `--- 내용 ---\n${textToSummarize}\n\n${basePrompt}`;
    const response = await withRetry(() =>
      generateContent({
        model: MODELS.FLASH_LITE,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: PLOT_ARCHIVIST_INSTRUCTION,
      })
    );
    return response || '';
  }

  // 청크 분할 처리
  const chunks: string[] = [];
  for (let i = 0; i < textToSummarize.length; i += CHUNK_SIZE) {
    chunks.push(textToSummarize.substring(i, i + CHUNK_SIZE));
  }

  // 병렬 처리로 모든 청크 동시 분석 (성능 최적화)
  const chunkPromises = chunks.map((chunk, i) => {
    const chunkPrompt = `--- 내용 (Part ${i + 1}/${chunks.length}) ---\n${chunk}\n\n${basePrompt}`;
    return withRetry(() =>
      generateContent({
        model: MODELS.FLASH_LITE,
        contents: [{ role: 'user', parts: [{ text: chunkPrompt }] }],
        systemInstruction: PLOT_ARCHIVIST_INSTRUCTION,
      })
    ).then(response => response || '');
  });

  const chunkSummaries = await Promise.all(chunkPromises);

  // 통합
  const combinedSummaries = chunkSummaries.join('\n\n');
  const finalPrompt = `--- 분할된 타임라인 ---\n${combinedSummaries}\n\n--- 요청 ---\n위 목록을 하나로 병합하세요.`;
  const finalResponse = await withRetry(() =>
    generateContent({
      model: MODELS.FLASH_LITE,
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      systemInstruction: SUMMARY_INTEGRATOR_INSTRUCTION,
    })
  );

  return finalResponse || '';
}

/**
 * 작가 프로필 생성 (텍스트 분석)
 * @param text 분석할 텍스트
 * @param isLongNovel 장편 소설 여부
 * @param options 분석 옵션 (API 제공자 선택 등)
 */
export async function createAuthorProfileFromNovel(
  text: string | Content[],
  isLongNovel = false
): Promise<ClonedAuthorDetails> {
  const inputText = typeof text === 'string' ? text : extractTextFromContent(text);
  const prompt = `다음 텍스트를 분석하여 작가 프로필을 생성하세요:\n\n${inputText.substring(0, isLongNovel ? 100000 : 30000)}`;

  let result: ClonedAuthorDetails;

  // 프로필 생성 (Flash로도 충분한 정밀도)
  const enhancedPrompt = `${prompt}\n\n${ENHANCED_PROFILER_SCHEMA}`;
  const responseText = await generateContent({
    model: MODELS.FLASH_LITE,
    maxTokens: 2048,
    contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
    systemInstruction: PROFILER_INSTRUCTION,
    jsonMode: true,
    timeoutMs: 25000,
    retryAttempts: 2,
    retryInitialDelayMs: 500,
  });
  const parsed = extractAndParseJson<Record<string, unknown>>(responseText, {});
  result = normalizeGeneratedAuthorProfile(parsed) ?? {};

  return result;
}

/**
 * 소설 분석 (관계도, 타임라인)
 */
export async function analyzeNovel(
  title: string,
  characters: Character[],
  chapters: Chapter[]
): Promise<unknown> {
  const fullText = chapters.map((c) => c.content).join('\n\n');
  const prompt = `제목: ${title}\n등장인물: ${characters.map((c) => c.name).join(', ')}\n\n본문:\n${fullText.substring(0, 50000)}\n\n반드시 JSON 형식으로만 응답하세요.`;

  const response = await generateContent({
    model: MODELS.FLASH_LITE,
    maxTokens: 4096,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: NOVEL_ANALYST_INSTRUCTION,
    jsonMode: true,
  });

  return extractAndParseJson<Record<string, unknown>>(response, {});
}

/**
 * 캐릭터 분석
 */
export async function analyzeCharactersFromText(
  text: string,
  existingCharacters: Character[]
): Promise<CharacterAnalysisResult> {
  const existingNames = existingCharacters.map((c) => c.name).join(', ');
  const prompt = `기존 인물: ${existingNames}\n\n본문:\n${text.substring(0, 50000)}\n\n반드시 JSON 형식으로만 응답하세요.`;

  try {
    const response = await generateContent({
      model: MODELS.FLASH_LITE,
      maxTokens: 4096,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: CHARACTER_SCOUTER_INSTRUCTION,
      jsonMode: true,
    });
    return extractAndParseJson<CharacterAnalysisResult>(response, { newCharacters: [], characterUpdates: [] });
  } catch {
    return { newCharacters: [], characterUpdates: [] };
  }
}

/**
 * ScannedCharacter를 Character로 변환
 */
export function scannedToCharacter(scanned: ScannedCharacter): Character {
  return {
    id: crypto.randomUUID(),
    name: scanned.name,
    personality: scanned.personality || '불명',
    appearance: scanned.appearance || '불명',
    background: scanned.background || '불명',
    log: '본문 분석으로 발견됨',
  };
}

/**
 * 분석 결과의 새 캐릭터들을 Character 배열로 변환
 */
export function convertScannedCharacters(scannedList: ScannedCharacter[]): Character[] {
  return scannedList.map(scannedToCharacter);
}

/**
 * 원고 분석 (소설 정보 + 등장인물 추출)
 */
export async function analyzeAndCharacterizeNovel(
  manuscript: string,
  isLongMode: boolean
): Promise<unknown> {
  const text = manuscript.substring(0, isLongMode ? 100000 : 30000);
  const prompt = `원고:\n${text}\n\n반드시 JSON 형식으로만 응답하세요.`;

  const response = await generateContent({
    model: MODELS.FLASH_LITE,
    maxTokens: 4096,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: MANUSCRIPT_ARCHITECT_INSTRUCTION,
    jsonMode: true,
  });

  return extractAndParseJson<Record<string, unknown>>(response, {});
}

/**
 * 세계관 분석
 */
export async function analyzeWorldviewFromNovel(text: string): Promise<WorldviewAnalysisResult> {
  const prompt = `본문:\n${text.substring(0, 50000)}\n\n반드시 JSON 형식으로만 응답하세요.`;

  const response = await generateContent({
    model: MODELS.FLASH_LITE,
    maxTokens: 4096,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: WORLDVIEW_ARCHAEOLOGIST_INSTRUCTION,
    jsonMode: true,
  });

  const result = extractAndParseJson<WorldviewAnalysisResult | null>(response, null);
  if (!result) {
    throw new Error('세계관 분석 실패: 유효한 응답이 아닙니다.');
  }
  return result;
}

/**
 * 줄거리 개선 제안
 */
export async function enhancePlotSummary(novelInfo: unknown): Promise<string[]> {
  const context = JSON.stringify(novelInfo);
  const prompt = `${context}\n\n반드시 JSON 배열 형식으로만 응답하세요: ["방향1", "방향2", "방향3"]`;

  try {
    const response = await generateContent({
      model: MODELS.FLASH_LITE,
      maxTokens: 1024,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: '설계도를 분석하여 3가지 발전 방향을 JSON 배열로 제안하세요.',
      jsonMode: true,
    });
    return extractAndParseJson<string[]>(response, []);
  } catch {
    throw new Error('설계도 강화 실패');
  }
}
