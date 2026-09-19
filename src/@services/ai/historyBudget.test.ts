import { describe, expect, it } from 'vitest';
import type { Content } from '@core/types';
import { buildPreviousBriefing } from './historyBudget';

const user = (text: string): Content => ({ role: 'user', parts: [{ text }] });

describe('buildPreviousBriefing', () => {
  it('최신 사용자 메시지만 선택하고 중복은 제거한다', () => {
    const history: Content[] = [
      user('첫 지시'),
      { role: 'model', parts: [{ text: '모델 답변' }] },
      user('같은 지시'),
      user('같은 지시'),
      user('최신 지시'),
    ];

    expect(buildPreviousBriefing(history, 3, 100)).toBe('첫 지시\n---\n같은 지시\n---\n최신 지시');
  });

  it('최신 지시를 우선하며 예산을 넘지 않는다', () => {
    const result = buildPreviousBriefing([user('오래된 지시'), user('최신 지시가 매우 길다')], 3, 8);

    expect(result.length).toBeLessThanOrEqual(8);
    expect(result.startsWith('최신 지시')).toBe(true);
    expect(result.endsWith('…')).toBe(true);
  });
});
