import { describe, expect, it } from 'vitest';
import {
  GeminiTerminationError,
  describeGeminiTermination,
  isGeminiBlocked,
  mergeGeminiTermination,
  readGeminiTermination,
} from './geminiTermination';

describe('Gemini termination diagnostics', () => {
  it('preserves prompt-level block reasons that have no candidate', () => {
    const diagnostic = readGeminiTermination({
      promptFeedback: {
        blockReason: 'PROHIBITED_CONTENT',
        safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'HIGH', blocked: true }],
      },
    } as never);

    expect(isGeminiBlocked(diagnostic)).toBe(true);
    expect(describeGeminiTermination(diagnostic, 'gemini-3.8-flash')).toContain('입력 프롬프트 차단');
    expect(describeGeminiTermination(diagnostic, 'gemini-3.8-flash')).toContain('PROHIBITED_CONTENT');
  });

  it('keeps the final candidate reason and safe category-only diagnostics', () => {
    const first = readGeminiTermination({ promptFeedback: { blockReason: 'SAFETY' } } as never);
    const last = readGeminiTermination({
      candidates: [{ finishReason: 'BLOCKLIST', finishMessage: 'blocked term', safetyRatings: [] }],
    } as never);
    const diagnostic = mergeGeminiTermination(first, last);
    const error = new GeminiTerminationError('gemini-3.7-flash', diagnostic);

    expect(diagnostic.promptBlockReason).toBe('SAFETY');
    expect(diagnostic.finishReason).toBe('BLOCKLIST');
    expect(error.message).toContain('SAFETY');
  });

  it('does not classify ordinary completion limits as content blocks', () => {
    const diagnostic = readGeminiTermination({ candidates: [{ finishReason: 'MAX_TOKENS' }] } as never);
    expect(isGeminiBlocked(diagnostic)).toBe(false);
  });
});
