import type { ChapterGenerationMode } from '@core/types';

export const DEFAULT_CHAPTER_TARGET_CHARACTERS = 6000;
export const MIN_CHAPTER_TARGET_CHARACTERS = 2000;
export const MAX_CHAPTER_TARGET_CHARACTERS = 15000;

export const DEFAULT_MAX_OUTPUT_TOKENS = 16384;
export const MIN_MAX_OUTPUT_TOKENS = 2048;
export const GEMINI_MAX_OUTPUT_TOKENS = 65536;
export const FALLBACK_MAX_OUTPUT_TOKENS = 16384;
export const DEFAULT_CHAPTER_GENERATION_MODE: ChapterGenerationMode = 'single';
export const MINIMUM_CHAPTER_COMPLETION_RATIO = 0.85;
export const CONTINUATION_CONTEXT_CHARACTERS = 6000;

export function getModelOutputTokenLimit(model?: string): number {
  return !model || model.startsWith('gemini-')
    ? GEMINI_MAX_OUTPUT_TOKENS
    : FALLBACK_MAX_OUTPUT_TOKENS;
}

export function normalizeChapterTargetCharacters(value?: number): number {
  const safeValue = Number.isFinite(value) ? Number(value) : DEFAULT_CHAPTER_TARGET_CHARACTERS;
  return Math.min(MAX_CHAPTER_TARGET_CHARACTERS, Math.max(MIN_CHAPTER_TARGET_CHARACTERS, Math.round(safeValue)));
}

export function normalizeMaxOutputTokens(model?: string, value?: number): number {
  const safeValue = Number.isFinite(value) ? Number(value) : DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.min(getModelOutputTokenLimit(model), Math.max(MIN_MAX_OUTPUT_TOKENS, Math.round(safeValue)));
}

export function getRecommendedOutputTokens(targetCharacters?: number, model?: string): number {
  const target = normalizeChapterTargetCharacters(targetCharacters);
  const withThinkingRoom = target * 2 + 2048;
  const rounded = Math.ceil(withThinkingRoom / 1024) * 1024;
  return normalizeMaxOutputTokens(model, rounded);
}

export function normalizeChapterGenerationMode(mode?: string): ChapterGenerationMode {
  return mode === 'extended' || mode === 'batch2' || mode === 'batch3'
    ? mode
    : DEFAULT_CHAPTER_GENERATION_MODE;
}

/** OFF에서는 저장된 제작 설정을 지우지 않고 새 요청만 자율 한 턴으로 실행한다. */
export function getEffectiveChapterGenerationMode(
  mode?: ChapterGenerationMode,
  targetedGenerationEnabled = true,
): ChapterGenerationMode {
  return targetedGenerationEnabled ? normalizeChapterGenerationMode(mode) : 'single';
}

/** 자율 한 턴은 숫자 목표를 주지 않되 응답이 잘리지 않을 기본 출력 여유는 유지한다. */
export function getChapterOutputTokens(
  targetedGenerationEnabled: boolean,
  targetCharacters?: number,
  model?: string,
): number {
  return targetedGenerationEnabled
    ? getRecommendedOutputTokens(targetCharacters, model)
    : normalizeMaxOutputTokens(model, DEFAULT_MAX_OUTPUT_TOKENS);
}

export function getGenerationModeChapterCount(mode?: ChapterGenerationMode): number {
  if (mode === 'batch2') return 2;
  if (mode === 'batch3') return 3;
  return 1;
}

export function getGenerationModeMaxCalls(mode?: ChapterGenerationMode): number {
  return mode === 'extended' ? 2 : getGenerationModeChapterCount(mode);
}

export function shouldRequestChapterContinuation(
  completedCharacters: number,
  targetCharacters?: number,
): boolean {
  const target = normalizeChapterTargetCharacters(targetCharacters);
  return completedCharacters < Math.ceil(target * MINIMUM_CHAPTER_COMPLETION_RATIO);
}

export function mergeChapterContinuation(
  existingContent: string,
  continuationContent: string,
  maxOverlap = 1200,
): string {
  const existing = existingContent.trimEnd();
  const continuation = continuationContent.trimStart();
  if (!existing) return continuation;
  if (!continuation) return existing;

  const overlapLimit = Math.min(maxOverlap, existing.length, continuation.length);
  let overlap = 0;
  for (let size = overlapLimit; size >= 4; size -= 1) {
    if (existing.slice(-size) === continuation.slice(0, size)) {
      overlap = size;
      break;
    }
  }

  const remainder = continuation.slice(overlap).trimStart();
  if (!remainder) return existing;
  const separator = /\n$/.test(existing) || /^\n/.test(continuation) ? '\n' : ' ';
  return `${existing}${separator}${remainder}`;
}

export function buildChapterContinuationPrompt(
  existingContent: string,
  targetCharacters?: number,
  completedCharacters = existingContent.length,
): string {
  const target = normalizeChapterTargetCharacters(targetCharacters);
  const tail = existingContent.slice(-CONTINUATION_CONTEXT_CHARACTERS);
  const remaining = Math.max(0, target - completedCharacters);
  return `[같은 회차 자동 이어쓰기]
아래는 방금 작성한 같은 회차의 마지막 부분입니다.

--- 이어쓰기 기준 원문 ---
${tail}
--- 기준 원문 끝 ---

새 화를 시작하거나 제목·요약·앞부분 회상을 출력하지 말고 마지막 문장 바로 다음부터 이어 쓰세요.
현재 ${completedCharacters.toLocaleString('ko-KR')}자이며 목표까지 약 ${remaining.toLocaleString('ko-KR')}자가 남았지만, 이 숫자는 다음 호출 여부를 판단하는 기준일 뿐 절단선이 아닙니다.
이번 응답 턴 전체를 끝까지 작성하세요. 목표 분량을 넘더라도 이미 시작한 장면과 문단을 중간에 끊지 말고 자연스러운 장면 단위까지 마무리하세요.
같은 표현이나 사건을 되풀이해 분량을 채우지 마세요.`;
}
