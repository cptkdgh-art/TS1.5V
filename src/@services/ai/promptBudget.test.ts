import { describe, expect, it } from 'vitest';
import type { Character } from '@core/types';
import {
  PROMPT_BUDGETS,
  buildCharacterContext,
  buildWorldviewContext,
  buildWritingDirectivesContext,
  truncateForPrompt,
} from './promptBudget';

describe('promptBudget', () => {
  it('긴 텍스트를 생략 표기와 함께 자른다', () => {
    const result = truncateForPrompt('가'.repeat(100), 20);

    expect(result.length).toBeGreaterThan(20);
    expect(result).toContain('생략');
  });

  it('등장인물은 최대 개수와 필드별 길이를 제한한다', () => {
    const characters: Character[] = Array.from({ length: 20 }, (_, index) => ({
      id: `c-${index}`,
      name: `인물${index}`,
      personality: '성격'.repeat(500),
      appearance: '외모'.repeat(500),
      background: '배경'.repeat(500),
      log: '변화'.repeat(500),
    }));

    const context = buildCharacterContext(characters);

    expect(context).toContain('외 8명');
    expect((context.match(/\[인물/g) || []).length).toBe(PROMPT_BUDGETS.maxCharacters);
    expect(context.length).toBeLessThan(15000);
  });

  it('대형 세계관은 핵심본과 기록보관자 선별 안내로 제한한다', () => {
    const files = Array.from({ length: 16 }, (_, index) => ({
      filename: `world-${index}.md`,
      content: '세계관'.repeat(3000),
    }));

    const context = buildWorldviewContext(files);

    expect(context).toContain('세계관 설정 (대형 세계관 핵심본)');
    expect(context).toContain('파일 순서는 기본 우선순위');
    expect(context).toContain('기록보관자가 현재 회차에 맞춰 로컬 원문에서 선별');
    expect(context.length).toBeLessThan(PROMPT_BUDGETS.largeWorldviewCoreChars + 1500);
  });

  it('기록보관자를 끈 대형 세계관은 일반 1만자 예산을 유지한다', () => {
    const files = Array.from({ length: 6 }, (_, index) => ({
      filename: `world-${index}.md`,
      content: '세계관'.repeat(1500),
    }));

    const context = buildWorldviewContext(files, false);

    expect(context).toContain('세계관 설정 (압축)');
    expect(context).not.toContain('대형 세계관 핵심본');
    expect(context.length).toBeGreaterThan(PROMPT_BUDGETS.largeWorldviewCoreChars);
  });

  it('지시문은 최신 항목 위주로 제한한다', () => {
    const directives = Array.from({ length: 20 }, (_, index) => ({
      role: 'user' as const,
      parts: [{ text: `지시 ${index} ` + '내용'.repeat(300) }],
    }));

    const context = buildWritingDirectivesContext(directives);

    expect(context).toContain('이전 지시 8개');
    expect(context).not.toContain('지시 0');
    expect(context).toContain('지시 19');
  });
});
