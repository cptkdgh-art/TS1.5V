/**
 * ============================================================
 * @module services/ai/episode
 * @file episode.ts
 * ============================================================
 * @description 에피소드 아크 관련 AI 함수
 * ============================================================
 */

import type { EpisodeArcChapter, Novel, Series } from '@core/types';
import { generateContent } from './config';
import { EPISODE_ARCHITECT_INSTRUCTION, PREVIEW_WRITER_INSTRUCTION } from './prompts';
import { extractAndParseJson } from './utils';

/**
 * 에피소드 아크 생성
 */
export async function generateEpisodeArc(
  goal: string,
  count: number,
  context: string
): Promise<EpisodeArcChapter[]> {
  const prompt = `목표: ${goal}\n챕터 수: ${count}\n컨텍스트: ${context}\n\n반드시 JSON 배열 형식으로만 응답하세요.`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: EPISODE_ARCHITECT_INSTRUCTION,
      usePro: true,
    });
    const result = extractAndParseJson<EpisodeArcChapter[]>(response, []);
    if (!result || result.length === 0) {
      throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.');
    }
    return result;
  } catch (e) {
    throw e instanceof Error ? e : new Error('에피소드 생성 실패');
  }
}

/**
 * 중간 챕터 제안
 */
export async function suggestIntermediateChapter(
  prev: EpisodeArcChapter,
  next: EpisodeArcChapter
): Promise<EpisodeArcChapter> {
  const systemInstruction = '두 챕터 사이를 잇는 중간 챕터 계획을 JSON으로 제안하세요.';
  const prompt = `이전 챕터: ${JSON.stringify(prev)}\n다음 챕터: ${JSON.stringify(next)}\n\n반드시 JSON 형식으로만 응답하세요.`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
    });
    const result = extractAndParseJson<EpisodeArcChapter | null>(response, null);
    if (!result) {
      throw new Error('중간 챕터 제안 실패: 유효한 응답이 아닙니다.');
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    throw new Error(`중간 챕터 생성 실패: ${message}`);
  }
}

/**
 * 에피소드 목표 제안
 */
export async function suggestEpisodeGoals(context: string, lastChapter: string): Promise<string[]> {
  const systemInstruction = '다음 에피소드 목표 3가지를 JSON 배열로 제안하세요.';
  const prompt = `컨텍스트: ${context}\n마지막 챕터: ${lastChapter}\n\n반드시 JSON 배열 형식으로만 응답하세요: ["목표1", "목표2", "목표3"]`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
    });
    return extractAndParseJson<string[]>(response, []);
  } catch {
    return [];
  }
}

/**
 * 다음 챕터 예고편 생성
 */
export async function generateNextChapterPreview(novel: Novel, _series: Series | null): Promise<string> {
  const lastChapter = novel.chapters[novel.chapters.length - 1]?.content || '';
  const prompt = `--- 이전 이야기 ---\n${lastChapter}\n\n다음 챕터 예고편을 작성하세요.`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: PREVIEW_WRITER_INSTRUCTION,
    });
    return response || '';
  } catch {
    return '예고편 생성 실패';
  }
}
