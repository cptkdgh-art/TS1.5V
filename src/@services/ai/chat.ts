/**
 * ============================================================
 * @module services/ai/chat
 * @file chat.ts
 * ============================================================
 * @description 대화 관련 AI 함수 (전역 설정에 따라 Gemini/xAI 자동 선택)
 * ============================================================
 */

import type {
  Content,
  AiAuthor,
  Character,
  DirectorAuthorProposal,
  DirectorAuthorProposalDraft,
  DirectorNovelReference,
  Novel,
} from '@core/types';
import { parseDirectorClioResponse } from '@services/director-clio/authorProposal';
import { generateContent, getAiTaskModel } from './config';
import {
  AUTHOR_CHAT_INSTRUCTION,
  STRATEGIC_DIRECTOR_INSTRUCTION,
  LIVE_FEEDBACK_INSTRUCTION,
  GENERAL_CHAT_INSTRUCTION,
  AFTERWORD_CHAT_INSTRUCTION,
  CHARACTER_PERSONA_INSTRUCTION,
  DIRECTOR_CLIO_INSTRUCTION,
  BRIEFING_SCRIBE_INSTRUCTION,
  MEETING_SCRIBE_INSTRUCTION,
  MEMORY_SCRIBE_INSTRUCTION,
  findMentionedModule,
} from './prompts';

/** Content 타입을 generateContent용으로 변환 */
const toGenerateContents = (contents: Content[]) => {
  return contents.map((c) => ({
    role: c.role as 'user' | 'model',
    parts: c.parts as { text: string }[],
  }));
};

function formatAiFailure(prefix: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${message}`;
}

/**
 * 작가와 챕터에 대해 대화
 */
export async function chatWithAuthor(
  prompt: string,
  chatHistory: Content[],
  author: AiAuthor | null,
  chapterContent: string
): Promise<string> {
  const systemInstruction = AUTHOR_CHAT_INSTRUCTION(author, chapterContent);
  const contents = [...chatHistory, { role: 'user', parts: [{ text: prompt }] }] as Content[];

  try {
    return await generateContent({
      contents: toGenerateContents(contents),
      systemInstruction,
    });
  } catch (error) {
    console.error('[chatWithAuthor] 실패:', error);
    return formatAiFailure('대화 실패', error);
  }
}

/**
 * 총괄 디렉터와 전략 대화
 */
export async function haveStrategicChat(
  prompt: string,
  chatHistory: Content[],
  author: AiAuthor | null,
  novel: Novel
): Promise<string> {
  const systemInstruction = STRATEGIC_DIRECTOR_INSTRUCTION(author, novel);
  const contents = [...chatHistory, { role: 'user', parts: [{ text: prompt }] }] as Content[];

  try {
    return await generateContent({
      contents: toGenerateContents(contents),
      systemInstruction,
    });
  } catch (error) {
    console.error('[haveStrategicChat] 실패:', error);
    return formatAiFailure('대화 실패', error);
  }
}

/**
 * 실시간 피드백 대화
 */
export async function getLiveFeedback(
  prompt: string,
  chatHistory: Content[],
  author: AiAuthor | null,
  novelTitle: string
): Promise<string> {
  const systemInstruction = LIVE_FEEDBACK_INSTRUCTION(author, novelTitle);
  const contents = [...chatHistory, { role: 'user', parts: [{ text: prompt }] }] as Content[];

  try {
    return await generateContent({
      contents: toGenerateContents(contents),
      systemInstruction,
    });
  } catch (error) {
    console.error('[getLiveFeedback] 실패:', error);
    return formatAiFailure('대화 실패', error);
  }
}

/**
 * 작가와 일반 대화
 */
export async function haveGeneralChatWithAuthor(
  prompt: string,
  chatHistory: Content[],
  author: AiAuthor
): Promise<string> {
  const systemInstruction = GENERAL_CHAT_INSTRUCTION(author);
  const contents = [...chatHistory, { role: 'user', parts: [{ text: prompt }] }] as Content[];

  try {
    return await generateContent({
      contents: toGenerateContents(contents),
      systemInstruction,
    });
  } catch (error) {
    console.error('[haveGeneralChatWithAuthor] 실패:', error);
    return formatAiFailure('대화 실패', error);
  }
}

/**
 * 성장 회고 대화
 */
export async function haveAfterwordChat(
  prompt: string,
  chatHistory: Content[],
  author: AiAuthor
): Promise<string> {
  const systemInstruction = AFTERWORD_CHAT_INSTRUCTION(author);
  const contents = [...chatHistory, { role: 'user', parts: [{ text: prompt }] }] as Content[];

  try {
    return await generateContent({
      contents: toGenerateContents(contents),
      systemInstruction,
    });
  } catch (error) {
    console.error('[haveAfterwordChat] 실패:', error);
    return formatAiFailure('대화 실패', error);
  }
}

/**
 * 등장인물 인터뷰
 */
export async function interviewCharacter(
  question: string,
  history: Content[],
  character: Character
): Promise<string> {
  const systemInstruction = CHARACTER_PERSONA_INSTRUCTION(character);
  const contents = [...history, { role: 'user', parts: [{ text: question }] }] as Content[];

  try {
    return await generateContent({
      contents: toGenerateContents(contents),
      systemInstruction,
    });
  } catch (error) {
    console.error('[interviewCharacter] 실패:', error);
    return formatAiFailure('대화 실패', error);
  }
}

/**
 * 사용자 메시지에서 언급된 작가 찾기 (이름 기반 매핑)
 */
function findMentionedAuthor(prompt: string, authors: AiAuthor[]): AiAuthor | undefined {
  const lowerPrompt = prompt.toLowerCase();
  return authors.find((author) => {
    const lowerName = author.name.toLowerCase();
    const localizedName = lowerName.split('(')[0].trim();
    const englishName = lowerName.match(/\(([^)]+)\)/)?.[1]?.trim() || '';

    if (author.id === 'clio-01') {
      return lowerPrompt.includes(lowerName)
        || /기본\s*작가\s*클리오|작가\s*클리오|클리오\s*작가/.test(lowerPrompt);
    }

    return lowerPrompt.includes(lowerName)
      || (!!localizedName && lowerPrompt.includes(localizedName))
      || (!!englishName && lowerPrompt.includes(englishName));
  });
}

/**
 * 클리오(총괄 감독)와 대화
 *
 * 클리오가 아는 것:
 * - 앱 구조/모듈 (정적)
 * - 작가 프로필 (실시간 - 이름만 평소, 언급 시 상세)
 * - 작품 명부 (실시간 - 제목/ID/화수/담당 작가)
 * - 앱 사용법/전략 가이드 (정적)
 *
 * 선택한 작품만 개요, 최근 원문 또는 명시적으로 선택한 전권 원문을 읽는다.
 */
export interface DirectorClioChatOptions {
  summary?: string;
  memories?: string[];
  authors?: AiAuthor[];
  workCatalog?: DirectorNovelReference[];
  activeWorkContext?: string;
  authorProposals?: DirectorAuthorProposal[];
}

export interface DirectorClioChatResult {
  text: string;
  authorProposal?: DirectorAuthorProposalDraft;
}

export async function chatWithDirectorClio(
  prompt: string,
  history: Content[],
  options: DirectorClioChatOptions = {}
): Promise<DirectorClioChatResult> {
  const {
    summary,
    memories,
    authors,
    workCatalog,
    activeWorkContext,
    authorProposals,
  } = options;
  // 작가 이름 목록만 추출 (토큰 절약)
  const authorNames = authors?.map((a) => a.name) || [];

  // 사용자 메시지에서 언급된 작가 찾기 (지연 로딩)
  const mentionedAuthor = authors ? findMentionedAuthor(prompt, authors) : undefined;

  // 사용자 메시지에서 언급된 모듈 찾기 (지연 로딩)
  const mentionedModule = findMentionedModule(prompt);

  const catalogLines = workCatalog?.map((work, index) => {
    const seriesLabel = work.seriesTitle
      ? ` / ${work.seriesTitle} ${work.volumeNumber ?? '?'}권`
      : '';
    return `${index + 1}. ${work.title}${seriesLabel} / ID ${work.displayId} / ${work.chapterCount}화 / ${work.authorName}`;
  });
  const systemInstruction = DIRECTOR_CLIO_INSTRUCTION({
    summary,
    memories,
    authorNames,
    mentionedAuthor,
    mentionedModule,
    workCatalog: catalogLines,
    activeWorkContext,
    authorProposals,
  });
  const contents = [...history, { role: 'user', parts: [{ text: prompt }] }] as Content[];

  try {
    const response = await generateContent({
      contents: toGenerateContents(contents),
      systemInstruction,
      model: getAiTaskModel('review'),
      thinkingLevel: 'medium',
      maxTokens: 4096,
      jsonMode: true,
    });
    return parseDirectorClioResponse(response);
  } catch (error) {
    console.error('[chatWithDirectorClio] 실패:', error);
    return { text: formatAiFailure('대화 실패', error) };
  }
}

/**
 * 브리핑 대화 요약
 */
export async function summarizeBriefingChat(history: Content[]): Promise<string> {
  try {
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: '지금까지의 논의를 연출 노트로 정리해줘.' }] },
    ] as Content[];
    return await generateContent({
      contents: toGenerateContents(contents),
      systemInstruction: BRIEFING_SCRIBE_INSTRUCTION,
    });
  } catch (error) {
    console.error('[summarizeBriefingChat] 실패:', error);
    return formatAiFailure('요약 실패', error);
  }
}

/**
 * 클리오 대화 히스토리 요약
 */
export async function summarizeClioChatHistory(history: Content[]): Promise<string> {
  try {
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: '이 대화를 요약해줘.' }] },
    ] as Content[];
    return await generateContent({
      contents: toGenerateContents(contents),
      systemInstruction: MEETING_SCRIBE_INSTRUCTION,
      model: getAiTaskModel('summary'),
    });
  } catch (error) {
    console.error('[summarizeClioChatHistory] 실패:', error);
    return formatAiFailure('요약 실패', error);
  }
}

/**
 * 메모리 요약
 */
export async function summarizeMemoryFromChat(history: Content[]): Promise<string> {
  try {
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: '핵심 기억 요약.' }] },
    ] as Content[];
    return await generateContent({
      contents: toGenerateContents(contents),
      systemInstruction: MEMORY_SCRIBE_INSTRUCTION,
    });
  } catch (error) {
    console.error('[summarizeMemoryFromChat] 실패:', error);
    return formatAiFailure('요약 실패', error);
  }
}
