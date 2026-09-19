/**
 * ============================================================
 * @module services/ai/worldview
 * @file worldview.ts
 * ============================================================
 * @description 세계관 관련 AI 함수
 * ============================================================
 */

import type { WorldviewFile } from '@core/types';
import { generateContent, MODELS } from './config';
import { extractAndParseJson, formatAiErrorForUser, stripMarkdown } from './utils';

function trimForAi(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[이하 기존 설정은 길어서 생략됨. 위 내용과 충돌하지 않게 작성하세요.]`;
}

/**
 * 세계관 초안 생성
 */
export async function generateInitialWorldviewDraft(
  title: string,
  subject: string,
  mood: string,
  plot: string
): Promise<string> {
  const systemInstruction = `소설 컨셉에 맞는 세계관 설정을 작성하세요.

[금지]
- "초안을 제시합니다", "다음과 같이 구성했습니다" 등 서문/설명/인사말 금지
- "더 궁금한 점이 있으시면" 등 마무리 멘트 금지
- 마크다운 문법 사용 금지 (**, ##, - 등)
- 세계관 설정 내용만 바로 시작하세요

[형식]
세계관 설정 텍스트를 바로 출력하세요. 카테고리별로 줄바꿈으로 구분합니다.`;
  const prompt = `제목: ${title}\n주제: ${subject}\n분위기: ${mood}\n줄거리: ${plot}`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      model: MODELS.TEXT,
      thinkingLevel: 'medium',
      maxTokens: 3072,
      timeoutMs: 25000,
      retryAttempts: 2,
    });
    const draft = stripMarkdown(response || '').trim();
    if (!draft) {
      throw new Error('AI 응답이 비어있습니다. API 키를 확인해주세요.');
    }
    return draft;
  } catch (error) {
    console.error('[generateInitialWorldviewDraft] 오류:', error);
    const message = formatAiErrorForUser(error, error instanceof Error ? error.message : '알 수 없는 오류');
    throw new Error(`기본 세계관 생성 실패: ${message}`);
  }
}

/**
 * 세계관 측면 생성
 * @param mode 'focused' = 요청한 것만 간결하게, 'expanded' = 장황하게 확장
 */
export async function generateWorldviewAspect(
  novelContext: string,
  existingWorldview: string,
  request: string,
  mode: 'focused' | 'expanded' = 'focused'
): Promise<WorldviewFile> {
  const focusedInstruction = `[집중 모드] 요청한 세계관 요소만 핵심만 간결하게 작성하세요.

★★★ 중요: 반드시 500~800자 이내로 작성 ★★★
- 길게 쓰지 마세요. 핵심만 짧게.
- 요청한 주제 외 다른 주제 확장 금지
- 기존 세계관 내용 반복 금지
- 불필요한 부연설명/서문/마무리 멘트 금지
- 마크다운 문법 사용 금지 (**, ##, -, \`\`\` 등)

반드시 JSON 형식으로만 응답: {"filename": "파일명.txt", "content": "내용"}`;

  const expandedInstruction = `[확장 모드] 요청을 바탕으로 풍부하고 상세한 세계관 설정을 작성하세요.

★★★ 분량: 2000~4000자로 상세하게 작성 ★★★
- 요청 주제를 중심으로 관련된 다양한 측면을 포괄적으로
- 하위 카테고리, 예시, 상세 설명 포함
- 기존 세계관과 자연스럽게 연결
- 새로운 아이디어와 확장된 설정 자유롭게 추가
- 불필요한 서문/마무리 멘트 금지
- 마크다운 문법 사용 금지 (**, ##, -, \`\`\` 등)

반드시 JSON 형식으로만 응답: {"filename": "파일명.txt", "content": "내용"}`;

  const systemInstruction = mode === 'focused' ? focusedInstruction : expandedInstruction;
  const prompt = `--- 소설 정보 ---\n${trimForAi(novelContext, 6000)}\n\n--- 기존 세계관 ---\n${trimForAi(existingWorldview || '(없음)', mode === 'expanded' ? 14000 : 7000)}\n\n--- 요청 ---\n${request}`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      model: mode === 'expanded' ? MODELS.FLASH_STABLE : MODELS.TEXT,
      thinkingLevel: 'medium',
      maxTokens: mode === 'expanded' ? 3072 : 1536,
      jsonMode: true,
      timeoutMs: mode === 'expanded' ? 30000 : 22000,
      retryAttempts: 2,
    });

    if (!response || response === '응답 없음') {
      throw new Error('AI 응답이 비어있습니다. API 키를 확인해주세요.');
    }

    const output = extractAndParseJson<{ filename?: string; content?: string }>(response, {});

    if (!output.content) {
      // JSON 파싱 실패 시 원본 응답을 content로 사용
      console.warn('[generateWorldviewAspect] JSON 파싱 실패, 원본 응답 사용');
      return {
        filename: `${request.substring(0, 20).replace(/[^가-힣a-zA-Z0-9]/g, '_')}.txt`,
        content: stripMarkdown(response),
      };
    }

    // 이스케이프된 줄바꿈을 실제 줄바꿈으로 변환 + 마크다운 제거
    const cleanContent = stripMarkdown(
      output.content
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
    );

    return { filename: output.filename || 'setting.txt', content: cleanContent };
  } catch (error) {
    console.error('[generateWorldviewAspect] 오류:', error);
    const message = formatAiErrorForUser(error, error instanceof Error ? error.message : '알 수 없는 오류');
    throw new Error(`세계관 생성 실패: ${message}`);
  }
}

/**
 * 종합 세계관 생성
 */
export async function generateGeneralWorldviewFromContext(
  novelContext: string,
  existingWorldview: string
): Promise<WorldviewFile> {
  const systemInstruction = `종합적인 세계관 설정을 생성하여 JSON으로 응답하세요.

[금지] 서문/설명/인사말/마무리 멘트 금지. 마크다운 문법(**, ##, -, \`\`\`) 금지.
세계관 설정 내용만 작성하세요.

반드시 JSON 형식으로만 응답하세요: {"filename": "파일명.txt", "content": "내용"}`;
  const prompt = `--- 소설 정보 ---\n${trimForAi(novelContext, 8000)}\n\n--- 기존 세계관 ---\n${trimForAi(existingWorldview, 14000)}`;

  try {
    const response = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      model: MODELS.FLASH_STABLE,
      thinkingLevel: 'medium',
      maxTokens: 3072,
      jsonMode: true,
      timeoutMs: 30000,
      retryAttempts: 2,
    });

    if (!response || response === '응답 없음') {
      throw new Error('AI 응답이 비어있습니다. API 키를 확인해주세요.');
    }

    const output = extractAndParseJson<{ filename?: string; content?: string }>(response, {});

    if (!output.content) {
      console.warn('[generateGeneralWorldviewFromContext] JSON 파싱 실패, 원본 응답 사용');
      return {
        filename: '종합_세계관.txt',
        content: stripMarkdown(response),
      };
    }

    // 이스케이프된 줄바꿈을 실제 줄바꿈으로 변환 + 마크다운 제거
    const cleanContent = stripMarkdown(
      output.content
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
    );

    return { filename: output.filename || 'general_worldview.txt', content: cleanContent };
  } catch (error) {
    console.error('[generateGeneralWorldviewFromContext] 오류:', error);
    const message = formatAiErrorForUser(error, error instanceof Error ? error.message : '알 수 없는 오류');
    throw new Error(`종합 세계관 생성 실패: ${message}`);
  }
}
