import { describe, expect, it } from 'vitest';
import type { CharacterChatBackupData } from '@core/types';
import { parseCharacterChatBackup } from './backup';

const validBackup: CharacterChatBackupData = {
  schemaVersion: 2,
  sources: [{
    id: 'source-1',
    type: 'manual',
    title: '직접 만든 캐릭터',
    text: '',
    worldview: '',
    sourceChapterCount: 0,
    knowledgeChapterCount: 0,
    isFullCanon: true,
    createdAt: 1,
  }],
  personas: [{
    id: 'persona-1',
    sourceId: 'source-1',
    name: '윤서',
    role: { value: '기록관', origin: 'user' },
    personality: { value: '신중하다', origin: 'source' },
    speakingStyle: { value: '', origin: 'source' },
    values: { value: '', origin: 'source' },
    behaviorRules: { value: '', origin: 'source' },
    appearance: { value: '', origin: 'source' },
    background: { value: '', origin: 'source' },
    forbiddenTopics: { value: '', origin: 'user' },
    storyContext: { value: '', origin: 'source' },
    worldContext: { value: '', origin: 'source' },
    greeting: { value: '왔어?', origin: 'user' },
    aliases: [],
    defaultModel: 'gemini-3.7-flash',
    createdAt: 1,
    updatedAt: 1,
  }],
  userPersonas: [{
    id: 'user-persona-1',
    name: '카일',
    role: '왕실 기록관',
    personality: '신중하다',
    speakingStyle: '차분한 존댓말',
    background: '변방 출신',
    goal: '사라진 기록을 찾는다',
    createdAt: 1,
    updatedAt: 1,
  }],
  sessions: [{
    id: 'session-1',
    personaId: 'persona-1',
    title: '첫 대화',
    model: 'gemini-3.7-flash',
    userPersona: {
      id: 'user-persona-1', name: '카일', role: '왕실 기록관', personality: '신중하다',
      speakingStyle: '차분한 존댓말', background: '변방 출신', goal: '사라진 기록을 찾는다',
      createdAt: 1, updatedAt: 1,
    },
    messages: [{ id: 'message-1', role: 'assistant', content: '왔어?', createdAt: 1 }],
    memorySummary: '',
    summarizedMessageCount: 0,
    affinity: 0,
    createdAt: 1,
    updatedAt: 1,
  }],
};

describe('parseCharacterChatBackup', () => {
  it('정상 백업과 참조 관계를 그대로 통과시킨다', () => {
    expect(parseCharacterChatBackup(validBackup)).toEqual(validBackup);
  });

  it('구버전 백업은 사용자 역할이 없는 새 형식으로 변환한다', () => {
    const legacy = structuredClone(validBackup) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    delete legacy.userPersonas;

    expect(parseCharacterChatBackup(legacy)).toMatchObject({ schemaVersion: 2, userPersonas: [] });
  });

  it('지원 종료된 Gemini 모델 저장값은 현재 기본 모델로 정규화한다', () => {
    const legacy = structuredClone(validBackup) as unknown as Record<string, unknown>;
    const personas = legacy.personas as Array<Record<string, unknown>>;
    const sessions = legacy.sessions as Array<Record<string, unknown>>;
    personas[0].defaultModel = 'gemini-obsolete-flash';
    sessions[0].model = 'gemini-obsolete-flash';

    const parsed = parseCharacterChatBackup(legacy);
    expect(parsed?.personas[0].defaultModel).toBe('gemini-3.7-flash');
    expect(parsed?.sessions[0].model).toBe('gemini-3.7-flash');
  });

  it('필수 페르소나 필드가 깨진 백업을 거부한다', () => {
    const malformed = structuredClone(validBackup) as unknown as Record<string, unknown>;
    const personas = malformed.personas as Array<Record<string, unknown>>;
    personas[0].personality = '신중하다';

    expect(parseCharacterChatBackup(malformed)).toBeNull();
  });

  it('존재하지 않는 캐릭터를 가리키는 대화 백업을 거부한다', () => {
    const malformed = structuredClone(validBackup);
    malformed.sessions[0].personaId = 'missing-persona';

    expect(parseCharacterChatBackup(malformed)).toBeNull();
  });
});
