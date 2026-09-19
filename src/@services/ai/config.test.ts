import { describe, expect, it } from 'vitest';
import {
  MODELS,
  NOVEL_SAFETY_SETTINGS,
  GEMINI_HELPER_MODEL_OPTIONS,
  GEMINI_WRITING_MODEL_OPTIONS,
  getAiTaskModel,
  getRecommendedFullTextChapters,
  getGeminiOverloadFallbackModel,
  getGeminiWritingOverloadFallbackModel,
  getGeminiThinkingConfig,
  getSummaryTriggerChapters,
  normalizeGeminiHelperModel,
  normalizeGeminiTextModel,
} from './config';

describe('Gemini model contracts', () => {
  it('keeps every currently adjustable text safety filter explicitly off', () => {
    expect(NOVEL_SAFETY_SETTINGS).toHaveLength(4);
    expect(NOVEL_SAFETY_SETTINGS.every(({ threshold }) => threshold === 'OFF')).toBe(true);
    expect(NOVEL_SAFETY_SETTINGS.map(({ category }) => category)).not.toContain('HARM_CATEGORY_CIVIC_INTEGRITY');
  });

  it('기본 및 안정 Flash는 Gemini 3.7 GA 모델을 사용하고 3.8은 집필 선택지로만 둔다', () => {
    expect(MODELS.TEXT).toBe('gemini-3.7-flash');
    expect(MODELS.FLASH_STABLE).toBe(MODELS.TEXT);
    expect(getAiTaskModel('writing')).toBe(MODELS.TEXT);
    expect(GEMINI_WRITING_MODEL_OPTIONS.some(({ value }) => value === 'gemini-3.8-flash')).toBe(true);
    expect(GEMINI_HELPER_MODEL_OPTIONS.some(({ value }) => value === 'gemini-3.8-flash')).toBe(false);
    expect(normalizeGeminiHelperModel('gemini-3.8-flash')).toBe(MODELS.TEXT);
  });

  it('fallback 순서는 비용/안정성 순서로 고정한다', () => {
    expect(getGeminiOverloadFallbackModel(MODELS.FLASH_LATEST)).toBe(MODELS.TEXT);
    expect(getGeminiOverloadFallbackModel(MODELS.TEXT)).toBe(MODELS.FLASH_FALLBACK);
    expect(getGeminiOverloadFallbackModel(MODELS.FLASH_FALLBACK)).toBe(MODELS.FLASH_FALLBACK_SECONDARY);
    expect(getGeminiOverloadFallbackModel(MODELS.FLASH_FALLBACK_SECONDARY)).toBe(MODELS.FLASH_LITE);
    expect(getGeminiOverloadFallbackModel(MODELS.FLASH_LITE)).toBeNull();
  });

  it('본문 집필은 선택한 최신 Flash 사이에서 품질 우선으로 폴백한다', () => {
    expect(getGeminiWritingOverloadFallbackModel(MODELS.TEXT, MODELS.TEXT)).toBe(MODELS.FLASH_LATEST);
    expect(getGeminiWritingOverloadFallbackModel(MODELS.FLASH_LATEST, MODELS.TEXT)).toBe(MODELS.FLASH_FALLBACK);
    expect(getGeminiWritingOverloadFallbackModel(MODELS.FLASH_LATEST, MODELS.FLASH_LATEST)).toBe(MODELS.TEXT);
    expect(getGeminiWritingOverloadFallbackModel(MODELS.TEXT, MODELS.FLASH_LATEST)).toBe(MODELS.FLASH_FALLBACK);
    expect(getGeminiWritingOverloadFallbackModel(MODELS.FLASH_FALLBACK, MODELS.TEXT)).toBeNull();
  });

  it('3.x Flash에만 요청한 사고 수준을 적용한다', () => {
    expect(getGeminiThinkingConfig(MODELS.TEXT, 'low')?.thinkingLevel).toBe('LOW');
    expect(getGeminiThinkingConfig(MODELS.FLASH_LATEST, 'low')?.thinkingLevel).toBe('LOW');
    expect(getGeminiThinkingConfig(MODELS.FLASH_FALLBACK, 'medium')?.thinkingLevel).toBe('MEDIUM');
    expect(getGeminiThinkingConfig(MODELS.FLASH_25, 'high')).toBeUndefined();
  });

  it('Pro 계열 과부하 fallback은 안정 Flash로 보낸다', () => {
    expect(getGeminiOverloadFallbackModel(MODELS.PRO)).toBe(MODELS.TEXT);
    expect(getGeminiOverloadFallbackModel(MODELS.PRO_STABLE)).toBe(MODELS.TEXT);
  });

  it('비 Gemini 모델은 Gemini fallback을 만들지 않는다', () => {
    expect(getGeminiOverloadFallbackModel('grok-4-fast')).toBeNull();
    expect(getGeminiOverloadFallbackModel('glm-5')).toBeNull();
  });

  it('unknown Gemini 문자열은 기본 텍스트 모델로 정규화된다', () => {
    expect(normalizeGeminiTextModel('gemini-unknown')).toBe(MODELS.TEXT);
  });

  it('집필 모델은 사용자 선택을 유지하고 helper는 역할별 저비용 정책을 쓴다', () => {
    expect(getAiTaskModel('writing', MODELS.PRO_STABLE)).toBe(MODELS.PRO_STABLE);
    expect(getAiTaskModel('writing', 'grok-4-fast')).toBe('grok-4-fast');
    expect(getAiTaskModel('worldview')).toBe(MODELS.TEXT);
    expect(getAiTaskModel('summary')).toBe(MODELS.FLASH_LITE);
    expect(getAiTaskModel('analysis')).toBe(MODELS.FLASH_LITE);
    expect(getAiTaskModel('review')).toBe(MODELS.FLASH_STABLE);
  });

  it('작품 길이와 모델이 바뀌어도 최근 3화 원문 계약을 유지한다', () => {
    expect(getRecommendedFullTextChapters(MODELS.TEXT, 10)).toBe(3);
    expect(getRecommendedFullTextChapters(MODELS.TEXT, 90)).toBe(3);
    expect(getRecommendedFullTextChapters(MODELS.PRO_STABLE, 3)).toBe(3);
    expect(getRecommendedFullTextChapters(MODELS.PRO_STABLE, 120)).toBe(3);
    expect(getRecommendedFullTextChapters('grok-4-fast', 80)).toBe(3);
  });

  it('자동 요약 주기는 1~20 범위로 고정한다', () => {
    expect(getSummaryTriggerChapters(undefined)).toBe(5);
    expect(getSummaryTriggerChapters(0)).toBe(5);
    expect(getSummaryTriggerChapters(-3)).toBe(1);
    expect(getSummaryTriggerChapters(4.6)).toBe(5);
    expect(getSummaryTriggerChapters(99)).toBe(20);
  });
});
