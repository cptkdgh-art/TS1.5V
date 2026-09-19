/**
 * ============================================================
 * @module services/ai/utils
 * @file utils.ts
 * ============================================================
 * @description AI 서비스 유틸리티 함수
 * ============================================================
 */

import type { Content } from '@core/types';

/**
 * Gemini API 에러 처리
 */
export function processGeminiError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const rawMessage = String((error as { message: string }).message);
    const message = rawMessage.toLowerCase();

    if (message.includes('api 키가 설정되지 않았습니다')) {
      return rawMessage;
    }

    if (message.includes('503') || message.includes('overloaded') || message.includes('unavailable')) {
      console.warn('[Gemini API Warning]', error);
      return 'AI 서버 과부하 — 선택한 모델 호출에 실패했습니다. 잠시 후 재시도하거나 집필 엔진에서 다른 모델을 선택하세요.';
    }
    if (message.includes('429') || message.includes('rate') || message.includes('quota')) {
      console.warn('[Gemini API Warning]', error);
      return 'API 한도 초과 — 선택한 모델의 요청 한도에 걸렸습니다. 잠시 후 재시도하거나 다른 모델을 선택하세요.';
    }
    console.error('[Gemini API Error]', error);
    return `API 오류가 발생했습니다: ${rawMessage}`;
  }

  console.error('[Gemini API Error]', error);
  return '알 수 없는 오류가 발생했습니다.';
}

export function formatAiErrorForUser(error: unknown, fallback = 'AI 요청에 실패했습니다.'): string {
  const rawMessage = error && typeof error === 'object' && 'message' in error
    ? String((error as { message: string }).message)
    : String(error || '');
  const message = rawMessage.toLowerCase();

  if (message.includes('api 키가 설정되지 않았습니다') || message.includes('api key')) {
    return 'Gemini API 키를 먼저 확인해주세요.';
  }
  if (message.includes('503') || message.includes('overloaded') || message.includes('unavailable')) {
    return 'Gemini 서버가 붐비는 중입니다. 잠시 후 다시 시도해주세요.';
  }
  if (message.includes('429') || message.includes('rate') || message.includes('quota')) {
    return '요청 한도에 걸렸습니다. 잠시 쉬었다가 다시 시도해주세요.';
  }
  if (message.includes('응답 시간이 길어져') || message.includes('timeout') || message.includes('timed out')) {
    return '응답이 너무 늦어 중단했습니다. 다시 시도해주세요.';
  }
  if (message.includes('json') || message.includes('필수 필드') || message.includes('유효한 응답')) {
    return 'AI 응답 형식이 맞지 않았습니다. 다시 시도해주세요.';
  }
  if (message.includes('취소')) {
    return 'AI 생성이 취소되었습니다.';
  }

  return fallback;
}

/**
 * Content 배열에서 텍스트 추출
 */
export function extractTextFromContent(content: string | Content[]): string {
  if (typeof content === 'string') return content;
  return content
    .map((c) => c.parts?.map((p) => ('text' in p ? p.text : '')).join('') || '')
    .join('');
}

/**
 * 토큰 수 추정 (대략 4자 = 1토큰)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * AI 응답에서 JSON 추출 및 파싱 (v2 - 강화된 추출 로직)
 * - 마크다운 코드블록 (```json ... ```) 처리
 * - 일반 JSON 객체/배열 추출
 * - 불완전한 JSON 복구 시도
 * - 파싱 실패 시 기본값 반환
 */
export function extractAndParseJson<T = Record<string, unknown>>(
  response: string,
  defaultValue: T
): T {
  if (!response || typeof response !== 'string') {
    return defaultValue;
  }

  // 1단계: 원본 직접 파싱 (repair 없이)
  try {
    const parsed = JSON.parse(response);
    return parsed as T;
  } catch { /* 원본 파싱 실패 - 계속 시도 */ }

  try {
    // 2. 마크다운 코드블록에서 JSON 추출 시도
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      const jsonStr = codeBlockMatch[1].trim();
      const parsed = JSON.parse(jsonStr);
      return parsed as T;
    }

    // 3. 응답 안의 첫 번째 완성 JSON 값 추출 (배열/객체 모두 보존)
    const candidates = extractJsonCandidates(response);
    for (const jsonStr of candidates) {
      try {
        return JSON.parse(jsonStr) as T;
      } catch {
        try {
          const repaired = repairJsonString(jsonStr);
          return JSON.parse(repaired) as T;
        } catch {
          // 다음 후보 시도
        }
      }
    }

    return defaultValue;
  } catch (error) {
    console.warn('[JSON Parse Warning] 파싱 실패, 최종 복구 시도...', error);

    // 최종 복구 시도
    try {
      const repaired = repairJsonString(response);
      const parsed = JSON.parse(repaired);
      return parsed as T;
    } catch {
      console.warn('[JSON Parse Error] 복구 실패, 기본값 반환');
      return defaultValue;
    }
  }
}

function extractJsonCandidates(text: string): string[] {
  const candidates: string[] = [];

  for (let start = 0; start < text.length; start++) {
    const opener = text[start];
    if (opener !== '{' && opener !== '[') continue;

    const stack: string[] = [];
    let inString = false;
    let escapeNext = false;

    for (let i = start; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        stack.push('}');
        continue;
      }
      if (char === '[') {
        stack.push(']');
        continue;
      }

      if (char === '}' || char === ']') {
        const expected = stack.pop();
        if (expected !== char) break;
        if (stack.length === 0) {
          candidates.push(text.slice(start, i + 1).trim());
          start = i;
          break;
        }
      }
    }
  }

  return candidates;
}

/**
 * 불완전한 JSON 문자열 복구
 * - 트레일링 콤마 제거
 * - 따옴표 누락 복구
 * - 줄바꿈 이스케이프 처리
 */
function repairJsonString(jsonStr: string): string {
  let repaired = jsonStr;

  // 1. 문자열 내 이스케이프되지 않은 줄바꿈 처리
  // JSON 문자열 값 내부의 실제 줄바꿈을 \n으로 변환
  repaired = repaired.replace(/"([^"\\]|\\.)*"/g, (match) => {
    return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  });

  // 2. 트레일링 콤마 제거 (배열과 객체 모두)
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  // 3. 키에 따옴표 누락된 경우 추가 (흔한 AI 실수)
  repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');

  // 4. 단일 따옴표를 이중 따옴표로 변환 (값 내부 제외)
  // 주의: 이미 문자열 내부가 아닌 경우에만
  repaired = repaired.replace(/'([^'\\]|\\.)*'/g, (match) => {
    return '"' + match.slice(1, -1).replace(/"/g, '\\"') + '"';
  });

  return repaired;
}

/**
 * 지수 백오프 재시도 래퍼
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 2000
): Promise<T> {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: unknown) {
      attempt++;
      const msg = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: string }).message).toLowerCase()
        : '';

      // 재시도 가능한 에러가 아니면 즉시 throw
      if (!msg.includes('503') && !msg.includes('429') && !msg.includes('overloaded') && !msg.includes('internal')) {
        throw error;
      }

      if (attempt >= maxRetries) throw error;

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * 마크다운 문법을 일반 텍스트로 변환
 * - **굵게** → 굵게
 * - *기울임* → 기울임
 * - # 헤더 → 헤더
 * - ``` 코드블록 ``` → 코드블록
 */
export function stripMarkdown(text: string): string {
  return text
    // 코드블록 제거
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').trim())
    // 인라인 코드 제거
    .replace(/`([^`]+)`/g, '$1')
    // 굵은 텍스트 (**text** 또는 __text__) - 공백 포함 허용
    .replace(/\*\*\s*([^*]+?)\s*\*\*/g, '$1')
    .replace(/__\s*([^_]+?)\s*__/g, '$1')
    // 기울임 텍스트 (*text* 또는 _text_) - 단어 경계 체크
    .replace(/(?<!\*)\*\s*([^*\n]+?)\s*\*(?!\*)/g, '$1')
    .replace(/(?<!_)_\s*([^_\n]+?)\s*_(?!_)/g, '$1')
    // 헤더 제거 (# ## ### 등)
    .replace(/^#{1,6}\s+/gm, '')
    // 링크 [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 이미지 ![alt](url) 제거
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // 리스트 마커 제거
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // 블록인용 제거
    .replace(/^>\s+/gm, '')
    // 수평선 제거
    .replace(/^[-*_]{3,}$/gm, '')
    .trim();
}

/**
 * 반복되는 표현을 다양한 동의어로 변환
 * - "단순한"이 여러 번 나오면 일부를 다른 표현으로 교체
 * - 금지가 아닌 다양화 목적
 */
export function diversifyExpressions(text: string): string {
  // 동의어 그룹 정의 (첫 번째가 기본어, 나머지가 대체어)
  const synonymGroups: { pattern: RegExp; alternatives: string[] }[] = [
    {
      pattern: /단순한/g,
      alternatives: ['평범한', '소박한', '기초적인', '있는 그대로의', '꾸밈없는', '단출한'],
    },
    {
      pattern: /단순히/g,
      alternatives: ['그저', '다만', '오직', '순전히', '단지'],
    },
    {
      pattern: /단지/g,
      alternatives: ['그저', '다만', '오직', '순전히', '그냥'],
    },
    {
      pattern: /그저/g,
      alternatives: ['단지', '다만', '그냥', '담담히', '아무렇지도 않게'],
    },
    {
      pattern: /불과한/g,
      alternatives: ['지나지 않는', '그칠 뿐인', '한낱', '보잘것없는'],
    },
    {
      pattern: /불과했다/g,
      alternatives: ['지나지 않았다', '그쳤을 뿐이었다', '뿐이었다'],
    },
  ];

  let result = text;

  for (const group of synonymGroups) {
    const matches = result.match(group.pattern);
    if (!matches || matches.length <= 1) continue;

    // 2번째부터 대체어로 변환 (첫 번째는 유지)
    let count = 0;
    let altIndex = 0;
    result = result.replace(group.pattern, (match) => {
      count++;
      if (count === 1) return match; // 첫 번째는 유지
      const replacement = group.alternatives[altIndex % group.alternatives.length];
      altIndex++;
      return replacement;
    });
  }

  return result;
}

// ============================================================
// 챕터 ID & 요약 체크포인트 시스템
// ============================================================

import type { Chapter, ContextSummary } from '@core/types';

/** 챕터 고유 ID 생성 */
export function generateChapterId(): string {
  return `ch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 챕터 배열에 ID 없는 항목이 있으면 자동 부여 (마이그레이션)
 * 원본을 변경하지 않고 새 배열 반환 (변경된 경우에만)
 */
export function ensureChapterIds(chapters: Chapter[]): { chapters: Chapter[]; changed: boolean } {
  let changed = false;
  const result = chapters.map((ch) => {
    if (ch.id && ch.trace) return ch;
    changed = true;
    const now = Date.now();
    return {
      ...ch,
      id: ch.id || generateChapterId(),
      trace: ch.trace || {
        revision: 1,
        createdAt: now,
        updatedAt: now,
        source: 'legacy' as const,
      },
    };
  });
  return { chapters: result, changed };
}

/** 원문을 저장하지 않고 전체 내용을 비교하기 위한 안정적인 FNV-1a 서명 */
export function computeStableSignature(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v2:${value.length}:${(hash >>> 0).toString(36)}`;
}

function computeLegacyChapterSignature(chapters: Chapter[]): string {
  return chapters
    .map((ch) => `${ch.id || '?'}:${ch.title}:${ch.content.length}:${ch.content.slice(0, 16)}`)
    .join('|');
}

/** 챕터 ID, 제목, 본문 전체를 반영하는 변경 감지용 서명 */
export function computeChapterSignature(chapters: Chapter[]): string {
  const source = chapters.map((chapter) => [
    chapter.id || '?',
    chapter.title,
    chapter.content,
  ]);
  return computeStableSignature(JSON.stringify(source));
}

/** 기존 V1 서명도 읽되 새 저장부터는 전체 내용 서명으로 자연스럽게 전환한다. */
export function matchesChapterSignature(signature: string | undefined, chapters: Chapter[]): boolean {
  if (!signature) return false;
  return signature === computeChapterSignature(chapters)
    || signature === computeLegacyChapterSignature(chapters);
}

/** 요약이 실제로 보장하는 연속 구간. 이후 챕터는 갱신 전까지 원문으로 전달한다. */
export function getSummaryCoveredCount(
  summary: ContextSummary | undefined,
  totalChapters: number,
  fullTextChapters: number,
  checkpointValid = true
): number {
  if (!summary?.content || !checkpointValid) return 0;
  const archiveTargetCount = Math.max(0, totalChapters - fullTextChapters);
  const storedCount = summary.coveredChapterIds?.length || summary.summarizedChapters || 0;
  return Math.min(archiveTargetCount, storedCount);
}

/** 체크포인트 검증 결과 */
export interface CheckpointValidation {
  isValid: boolean;
  reason?: 'no_checkpoint' | 'chapters_deleted' | 'chapters_edited' | 'chapters_added' | 'legacy_valid' | 'needs_recheck';
  /** 요약이 커버하지 않는 새 챕터 수 (추가된 경우) */
  newChaptersCount?: number;
}

/**
 * 요약 체크포인트가 현재 챕터 상태와 일치하는지 검증
 *
 * [비용 최적화]
 * - API 호출 없이 로컬에서 즉시 판단
 * - 불일치 시 "왜 다른지" reason을 반환하여 적절한 대응 가능
 *   - chapters_deleted → 요약 무효, 재생성 필요
 *   - chapters_edited → 요약 무효, 재생성 필요
 *   - chapters_added → 요약 유효 + 새 챕터만 추가 요약 (증분)
 */
export function validateSummaryCheckpoint(
  summary: ContextSummary | undefined,
  chapters: Chapter[],
  recentChaptersCount: number
): CheckpointValidation {
  if (!summary) {
    return { isValid: false, reason: 'no_checkpoint' };
  }

  if (summary.needsRecheck) {
    return { isValid: false, reason: 'needs_recheck' };
  }

  // 체크포인트 메타데이터 없지만 content가 있으면 → 레거시 요약 (사용은 하되 갱신 불가)
  // 사용자가 수동으로 넣은 요약은 구조화 전이라도 AI에게 전달되어야 함
  if (!summary.coveredChapterIds || !summary.contentSignature) {
    if (summary.content && summary.content.trim().length > 0) {
      return { isValid: true, reason: 'legacy_valid' };
    }
    return { isValid: false, reason: 'no_checkpoint' };
  }

  // 요약이 커버하는 범위: 전체 - 최근N화
  const coveredEnd = Math.max(0, chapters.length - recentChaptersCount);
  const coveredChapters = chapters.slice(0, coveredEnd);

  // 1. 삭제 감지: 요약이 알고 있는 ID가 현재 요약 대상 구간에 없으면
  const currentIds = new Set(coveredChapters.map((ch) => ch.id).filter(Boolean));
  const deletedIds = summary.coveredChapterIds.filter((id) => !currentIds.has(id));
  if (deletedIds.length > 0) {
    return { isValid: false, reason: 'chapters_deleted' };
  }

  // 2. 기존 요약이 실제로 커버한 챕터만 비교한다.
  // 새 챕터까지 포함해 비교하면 단순 추가를 수정으로 오인해 전체 재요약하게 된다.
  const chaptersById = new Map(coveredChapters.map((chapter) => [chapter.id, chapter]));
  const previouslyCoveredChapters = summary.coveredChapterIds
    .map((id) => chaptersById.get(id))
    .filter((chapter): chapter is Chapter => !!chapter);
  if (!matchesChapterSignature(summary.contentSignature, previouslyCoveredChapters)) {
    return { isValid: false, reason: 'chapters_edited' };
  }

  // 3. 추가 감지: 요약이 커버하는 것보다 챕터가 많아졌으면
  if (coveredChapters.length > summary.coveredChapterIds.length) {
    return {
      isValid: true, // 기존 요약은 유효, 새 챕터만 추가 필요
      reason: 'chapters_added',
      newChaptersCount: coveredChapters.length - summary.coveredChapterIds.length,
    };
  }

  // 모두 일치 → 요약 유효
  return { isValid: true };
}
