import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  GEMINI_MAX_OUTPUT_TOKENS,
  getRecommendedOutputTokens,
  getChapterOutputTokens,
  getEffectiveChapterGenerationMode,
  getGenerationModeChapterCount,
  getGenerationModeMaxCalls,
  shouldRequestChapterContinuation,
  mergeChapterContinuation,
  buildChapterContinuationPrompt,
  normalizeChapterTargetCharacters,
  normalizeMaxOutputTokens,
} from './generationPolicy';

describe('generationPolicy', () => {
  it('모델 미지정 기존 작품도 현재 Gemini 기본 모델의 출력 상한을 사용한다', () => {
    expect(normalizeMaxOutputTokens(undefined, 32768)).toBe(32768);
    expect(normalizeMaxOutputTokens(undefined, 999999)).toBe(GEMINI_MAX_OUTPUT_TOKENS);
  });

  it('목표 글자 수에 생각 토큰 여유를 더한 출력 상한을 추천한다', () => {
    expect(getRecommendedOutputTokens(6000, 'gemini-3.8-flash')).toBe(14336);
    expect(getRecommendedOutputTokens(30000, 'gemini-3.8-flash')).toBe(getRecommendedOutputTokens(15000, 'gemini-3.8-flash'));
  });

  it('비정상 저장값을 안전한 기본값과 허용 범위로 정규화한다', () => {
    expect(normalizeChapterTargetCharacters(Number.NaN)).toBe(6000);
    expect(normalizeChapterTargetCharacters(1000)).toBe(2000);
    expect(normalizeChapterTargetCharacters(30000)).toBe(15000);
    expect(normalizeMaxOutputTokens('gemini-3.8-flash', Number.NaN)).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
  });

  it('집필 방식별 실제 저장 화수와 최대 API 호출 수를 구분한다', () => {
    expect(getGenerationModeChapterCount('single')).toBe(1);
    expect(getGenerationModeChapterCount('extended')).toBe(1);
    expect(getGenerationModeChapterCount('batch2')).toBe(2);
    expect(getGenerationModeChapterCount('batch3')).toBe(3);
    expect(getGenerationModeMaxCalls('extended')).toBe(2);
    expect(getGenerationModeMaxCalls('batch3')).toBe(3);
  });

  it('자율 한 턴은 저장된 제작 설정을 보존한 채 실제 실행만 한 번으로 제한한다', () => {
    expect(getEffectiveChapterGenerationMode('batch3', false)).toBe('single');
    expect(getEffectiveChapterGenerationMode('batch3', true)).toBe('batch3');
    expect(getChapterOutputTokens(false, 15000, 'gemini-3.8-flash')).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(getChapterOutputTokens(true, 15000, 'gemini-3.8-flash')).toBeGreaterThan(DEFAULT_MAX_OUTPUT_TOKENS);
  });

  it('긴 1화는 첫 턴이 완전히 끝난 뒤 85% 미만일 때만 다음 턴을 요청한다', () => {
    expect(shouldRequestChapterContinuation(5099, 6000)).toBe(true);
    expect(shouldRequestChapterContinuation(5100, 6000)).toBe(false);
    expect(shouldRequestChapterContinuation(9000, 6000)).toBe(false);
  });

  it('이어쓰기 결과를 목표 글자에서 자르지 않고 경계 중복만 제거해 전부 합친다', () => {
    const first = '첫 장면이 이어졌다. 문이 열렸다.';
    const second = '문이 열렸다. 그는 안으로 들어갔다. 그리고 긴 대화를 끝까지 나눴다.';

    expect(mergeChapterContinuation(first, second, 20)).toBe(
      '첫 장면이 이어졌다. 문이 열렸다. 그는 안으로 들어갔다. 그리고 긴 대화를 끝까지 나눴다.'
    );
  });

  it('이어쓰기 프롬프트가 목표 도달 순간이 아니라 현재 응답 턴의 자연스러운 끝을 요구한다', () => {
    const prompt = buildChapterContinuationPrompt('마지막 장면', 6000, 4300);

    expect(prompt).toContain('같은 회차');
    expect(prompt).toContain('이번 응답 턴 전체');
    expect(prompt).toContain('중간에 끊지');
    expect(prompt).toContain('마지막 장면');
  });
});
