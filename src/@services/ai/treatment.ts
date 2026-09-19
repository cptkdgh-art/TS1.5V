/**
 * ============================================================
 * @module services/ai/treatment
 * @file treatment.ts
 * ============================================================
 * @description 트리트먼트 (총괄설계도 v2) AI 생성
 * ============================================================
 */

import type { Treatment, TreatmentEpisode } from '@core/types';
import { generateContent } from './config';
import { extractAndParseJson, stripMarkdown } from './utils';

const TREATMENT_ARCHITECT_INSTRUCTION = `당신은 웹소설 트리트먼트 설계 전문가입니다.

[임무]
소설의 설계도(줄거리), 세계관, 등장인물, 장르 정보를 종합 분석하여
에피소드(챕터) 단위의 상세 트리트먼트를 JSON으로 생성하세요.

[트리트먼트 원칙]
1. 로그라인: 한 문장으로 이 소설의 핵심을 압축
2. 시놉시스: 전체 흐름을 3~5문장으로 요약
3. 톤: 이 소설의 분위기/무드 방향
4. 장르 전략: 장르 특성에 맞는 집필 전략 (독자 기대, 필수 요소)
5. 에피소드: 각 화별로 구체적인 목표, 장면, 등장인물, 감정선, 엔딩 훅 설계

[에피소드 설계 원칙]
- 기승전결 리듬: 연속으로 같은 속도 금지. 긴장→이완→폭발 리듬 유지
- 절단마공: 매 화 끝은 "다음 화를 열지 않으면 못 배기는" 훅
- 캐릭터 중심: 사건보다 캐릭터의 선택과 감정 변화를 중심으로
- 장면 구체화: "어디서 누가 무엇을" 수준으로 구체적으로

[금지]
- 서문/설명/인사말/마무리 멘트 금지
- 마크다운 문법 금지
- 추상적 목표 금지 (예: "성장한다" → "패배 후 스승의 비밀 훈련법을 깨닫는다")

[JSON 스키마]
{
  "premise": "한줄 로그라인",
  "synopsis": "전체 시놉시스 (3~5문장)",
  "tone": "톤/무드 방향",
  "genreStrategy": "장르 전략",
  "episodes": [
    {
      "episodeNumber": 1,
      "title": "화 제목",
      "goal": "이 화의 핵심 목표 (구체적으로)",
      "scenes": "주요 장면/전개 (어디서 누가 무엇을, 2~3개 장면)",
      "characters": ["등장인물1", "등장인물2"],
      "emotion": "감정선/분위기 (긴장, 설렘, 비장 등)",
      "hook": "엔딩 훅 (절단마공)"
    }
  ]
}`;

/**
 * 트리트먼트 생성
 */
export async function generateTreatment(params: {
  plotSummary: string;
  title: string;
  subject: string;
  mood: string;
  worldviewSummary: string;
  charactersSummary: string;
  episodeCount: number;
}): Promise<Treatment> {
  const { plotSummary, title, subject, mood, worldviewSummary, charactersSummary, episodeCount } = params;

  const prompt = `--- 소설 정보 ---
제목: ${title}
주제/장르: ${subject}
분위기: ${mood}

--- 총괄 설계도 ---
${plotSummary || '(없음)'}

--- 세계관 ---
${worldviewSummary || '(없음)'}

--- 등장인물 ---
${charactersSummary || '(없음)'}

--- 요청 ---
${episodeCount}화 분량의 트리트먼트를 생성해주세요.
반드시 JSON 형식으로만 응답하세요.`;

  const response = await generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: TREATMENT_ARCHITECT_INSTRUCTION,
    usePro: true,
  });

  const result = extractAndParseJson<{
    premise?: string;
    synopsis?: string;
    tone?: string;
    genreStrategy?: string;
    episodes?: TreatmentEpisode[];
  } | null>(response, null);

  if (!result || !result.episodes || result.episodes.length === 0) {
    throw new Error('트리트먼트 생성 실패: 유효한 응답이 아닙니다.');
  }

  // 마크다운 클린업
  return {
    premise: stripMarkdown(result.premise || ''),
    synopsis: stripMarkdown(result.synopsis || ''),
    tone: stripMarkdown(result.tone || ''),
    genreStrategy: stripMarkdown(result.genreStrategy || ''),
    episodes: result.episodes.map((ep, i) => ({
      episodeNumber: ep.episodeNumber || i + 1,
      title: stripMarkdown(ep.title || `${i + 1}화`),
      goal: stripMarkdown(ep.goal || ''),
      scenes: stripMarkdown(ep.scenes || ''),
      characters: ep.characters || [],
      emotion: stripMarkdown(ep.emotion || ''),
      hook: stripMarkdown(ep.hook || ''),
    })),
    createdAt: Date.now(),
  };
}
