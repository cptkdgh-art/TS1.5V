import { describe, expect, it } from 'vitest';
import type { CharacterChatPersona, PersonaField } from '@core/types';
import { applyPersonaPatch, updatePersonaField } from './persona';

const field = (value = ''): PersonaField => ({ value, origin: 'source' });

function makePersona(): CharacterChatPersona {
  return {
    id: 'persona-1', sourceId: 'source-1', name: '윤서',
    role: field('기록관'), personality: field('신중하다'), speakingStyle: field(),
    values: field(), behaviorRules: field(), appearance: field(), background: field(),
    forbiddenTopics: field(), storyContext: field(), worldContext: field(), greeting: field(),
    aliases: [], defaultModel: 'gemini-3.6-flash', createdAt: 1, updatedAt: 1,
  };
}

describe('character chat persona editing', () => {
  it('사용자가 수정한 필드의 출처를 user로 기록한다', () => {
    const updated = updatePersonaField(makePersona(), 'speakingStyle', '짧게 말한다');

    expect(updated.speakingStyle).toEqual({ value: '짧게 말한다', origin: 'user' });
  });

  it('AI 제안 중 사용자가 선택한 필드만 적용한다', () => {
    const updated = applyPersonaPatch(makePersona(), {
      personality: '차갑지만 책임감이 강하다',
      speakingStyle: '말끝을 짧게 맺는다',
    }, ['speakingStyle']);

    expect(updated.personality.value).toBe('신중하다');
    expect(updated.speakingStyle).toEqual({ value: '말끝을 짧게 맺는다', origin: 'ai' });
  });
});
