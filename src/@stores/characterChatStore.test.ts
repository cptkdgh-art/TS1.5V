import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CharacterChatPersona,
  CharacterChatSession,
  CharacterChatSource,
  CharacterChatUserPersona,
  PersonaField,
} from '@core/types';

const storage = new Map<string, unknown>();
vi.mock('@services/storage', () => ({
  STORAGE_KEYS: {
    CHARACTER_CHAT_SOURCES: 'character-chat-sources',
    CHARACTER_CHAT_PERSONAS: 'character-chat-personas',
    CHARACTER_CHAT_USER_PERSONAS: 'character-chat-user-personas',
    CHARACTER_CHAT_SESSIONS: 'character-chat-sessions',
  },
  get: vi.fn(async (key: string) => storage.get(key)),
  set: vi.fn(async (key: string, value: unknown) => storage.set(key, value)),
}));

const { useCharacterChatStore } = await import('./characterChatStore');
const field = (value = ''): PersonaField => ({ value, origin: 'user' });

const source: CharacterChatSource = {
  id: 'source-1', type: 'manual', title: '직접 만든 캐릭터', text: '', worldview: '',
  sourceChapterCount: 0, knowledgeChapterCount: 0, isFullCanon: true, createdAt: 1,
};

const persona: CharacterChatPersona = {
  id: 'persona-1', sourceId: source.id, name: '윤서', role: field(), personality: field('신중하다'),
  speakingStyle: field(), values: field(), behaviorRules: field(), appearance: field(), background: field(),
  forbiddenTopics: field(), storyContext: field(), worldContext: field(), greeting: field(), aliases: [],
  defaultModel: 'gemini-3.6-flash', createdAt: 1, updatedAt: 1,
};

const session: CharacterChatSession = {
  id: 'session-1', personaId: persona.id, title: '첫 대화', model: 'gemini-3.6-flash',
  messages: [
    { id: 'message-1', role: 'user', content: '안녕', createdAt: 1 },
    { id: 'message-2', role: 'assistant', content: '왔어?', createdAt: 2 },
    { id: 'message-3', role: 'user', content: '기억나?', createdAt: 3 },
  ],
  memorySummary: '첫 인사를 나눴다.', summarizedMessageCount: 2, affinity: 5,
  createdAt: 1, updatedAt: 3,
};

const userPersona: CharacterChatUserPersona = {
  id: 'user-persona-1', name: '카일', role: '기록관', personality: '신중하다',
  speakingStyle: '차분하게 말한다', background: '변방 출신', goal: '기록을 찾는다',
  createdAt: 1, updatedAt: 1,
};

describe('characterChatStore', () => {
  it('retries a failed response persist with the same ID exactly once', async () => {
    useCharacterChatStore.setState({ sessions: [{ ...session, messages: [] }] });
    const { set } = await import('@services/storage');
    vi.mocked(set).mockRejectedValueOnce(new Error('disk failure'));
    const message = { id: 'stable-reply', role: 'assistant' as const, content: 'reply', createdAt: 1 };
    await expect(useCharacterChatStore.getState().appendMessage(session.id, message)).rejects.toThrow('disk failure');
    await useCharacterChatStore.getState().appendMessage(session.id, message);
    expect(useCharacterChatStore.getState().sessions[0].messages).toEqual([message]);
    expect((storage.get('character-chat-sessions') as CharacterChatSession[])[0].messages).toEqual([message]);
  });
  beforeEach(() => {
    storage.clear();
    useCharacterChatStore.setState({
      sources: [source],
      personas: [persona],
      userPersonas: [],
      sessions: [session],
      isLoading: false,
    });
  });

  it('캐릭터를 독립 ID로 복제하고 원본을 보존한다', async () => {
    const copy = await useCharacterChatStore.getState().duplicatePersona(persona.id);

    expect(copy?.id).not.toBe(persona.id);
    expect(copy?.name).toBe('윤서 복사본');
    expect(useCharacterChatStore.getState().personas).toHaveLength(2);
    expect(storage.get('character-chat-personas')).toHaveLength(2);
  });

  it('새 대화에는 선택한 사용자 페르소나의 스냅샷을 저장한다', async () => {
    const selected = { ...userPersona };
    const created = await useCharacterChatStore.getState().createSession(
      persona.id,
      persona.defaultModel,
      selected
    );
    selected.name = '수정된 이름';

    expect(created.userPersona?.name).toBe('카일');
    expect(created.userPersona).not.toBe(selected);
  });

  it('캐릭터챗에 저장된 3.8을 현재 기본 3.7로 치환해 저장한다', async () => {
    storage.set('character-chat-personas', [{ ...persona, defaultModel: 'gemini-3.8-flash' }]);
    storage.set('character-chat-sessions', [{ ...session, model: 'gemini-3.8-flash' }]);

    await useCharacterChatStore.getState().load();

    expect(useCharacterChatStore.getState().personas[0].defaultModel).toBe('gemini-3.7-flash');
    expect(useCharacterChatStore.getState().sessions[0].model).toBe('gemini-3.7-flash');
    expect((storage.get('character-chat-personas') as CharacterChatPersona[])[0].defaultModel).toBe('gemini-3.7-flash');
    expect((storage.get('character-chat-sessions') as CharacterChatSession[])[0].model).toBe('gemini-3.7-flash');
  });

  it('선택 메시지까지의 대화만 새 분기로 복제하고 요약 기억은 초기화한다', async () => {
    const branch = await useCharacterChatStore.getState().duplicateSession(session.id, 'message-2');

    expect(branch?.id).not.toBe(session.id);
    expect(branch?.messages.map((message) => message.id)).toEqual(['message-1', 'message-2']);
    expect(branch?.memorySummary).toBe('');
    expect(branch?.summarizedMessageCount).toBe(0);
    expect(branch?.affinity).toBe(0);
    expect(useCharacterChatStore.getState().sessions).toHaveLength(2);
  });

  it('존재하지 않는 메시지 ID로 빈 분기를 만들지 않는다', async () => {
    const branch = await useCharacterChatStore.getState().duplicateSession(session.id, 'missing-message');

    expect(branch).toBeUndefined();
    expect(useCharacterChatStore.getState().sessions).toHaveLength(1);
  });

  it('캐릭터 삭제 시 연결된 대화도 함께 제거한다', async () => {
    await useCharacterChatStore.getState().deletePersona(persona.id);

    expect(useCharacterChatStore.getState().personas).toEqual([]);
    expect(useCharacterChatStore.getState().sessions).toEqual([]);
    expect(useCharacterChatStore.getState().sources).toEqual([]);
  });
});
