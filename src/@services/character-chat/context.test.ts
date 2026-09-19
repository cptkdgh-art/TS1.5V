import { describe, expect, it } from 'vitest';
import type {
  CharacterChatPersona,
  CharacterChatSession,
  CharacterChatSource,
  PersonaField,
} from '@core/types';
import {
  buildCharacterChatSystemInstruction,
  buildCharacterChatSummaryTranscript,
  canApplyCharacterChatSummary,
  calculateAffinityDelta,
  calculateSessionAffinity,
  getRecentChatContents,
  getRelationshipStage,
  shouldSummarizeSession,
} from './context';

const field = (value: string): PersonaField => ({ value, origin: 'user' });

const persona: CharacterChatPersona = {
  id: 'persona-1',
  sourceId: 'source-1',
  name: '윤서',
  role: field('기록관'),
  personality: field('신중하다'),
  speakingStyle: field('짧고 차분하게 말한다'),
  values: field('약속을 중시한다'),
  behaviorRules: field('쉽게 속내를 밝히지 않는다'),
  appearance: field('검은 머리'),
  background: field('왕실 기록원'),
  forbiddenTopics: field('왕의 병세'),
  storyContext: field('3화에서 사용자와 처음 만났다'),
  worldContext: field('기억이 화폐인 도시'),
  greeting: field('왔어?'),
  aliases: [],
  defaultModel: 'gemini-3.6-flash',
  createdAt: 1,
  updatedAt: 1,
};

const source: CharacterChatSource = {
  id: 'source-1',
  type: 'novel',
  title: '기억 도시',
  text: '1화부터 3화까지의 본문',
  worldview: '',
  sourceChapterCount: 10,
  knowledgeChapterCount: 3,
  isFullCanon: false,
  createdAt: 1,
};

function makeSession(): CharacterChatSession {
  return {
    id: 'session-1',
    personaId: persona.id,
    title: '첫 대화',
    model: 'gemini-3.6-flash',
    messages: [{
      id: 'message-1',
      role: 'user',
      content: '비밀은 지킬게',
      createdAt: 1,
      isPinned: true,
    }],
    memorySummary: '서로 비밀을 지키기로 했다.',
    summarizedMessageCount: 0,
    affinity: 45,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('character chat context', () => {
  it('진행도 경계, 관계, 고정 기억을 시스템 지침에 포함한다', () => {
    const prompt = buildCharacterChatSystemInstruction(persona, source, makeSession());

    expect(prompt).toContain('3화까지 공개된 범위');
    expect(prompt).toContain('관계 단계: 신뢰');
    expect(prompt).toContain('사용자: 비밀은 지킬게');
    expect(prompt).toContain('허용 범위 이후의 사건');
    expect(prompt).toContain('참고 데이터입니다');
  });

  it('사용자 역할과 상호작용 주도권 규칙을 시스템 지침에 포함한다', () => {
    const session = makeSession();
    session.userPersona = {
      id: 'user-persona-1',
      name: '카일',
      role: '왕실 기록관',
      personality: '신중하다',
      speakingStyle: '차분한 존댓말',
      background: '변방에서 올라왔다',
      goal: '사라진 기록을 찾는다',
      createdAt: 1,
      updatedAt: 1,
    };
    const prompt = buildCharacterChatSystemInstruction(persona, source, session);

    expect(prompt).toContain('이름: 카일');
    expect(prompt).toContain('사용자의 대사, 행동, 생각, 감정, 선택 결과를 대신 확정하지 마세요');
    expect(prompt).toContain('한 차례 반응만 작성');
    expect(prompt).toContain("'짧은 지문 1개 + 대사 1개'");
    expect(prompt).toContain('대사는 최대 1개 블록');
    expect(prompt).toContain('[표정:중립]');
  });

  it('호감도 단계와 간단한 반응 변화량을 경계값에 맞게 계산한다', () => {
    expect(getRelationshipStage(-30)).toBe('적대적');
    expect(getRelationshipStage(40)).toBe('신뢰');
    expect(getRelationshipStage(70)).toBe('깊은 유대');
    expect(calculateAffinityDelta('오늘도 고마워')).toBe(2);
    expect(calculateAffinityDelta('꺼져')).toBe(-2);
  });

  it('남아 있는 사용자 메시지만으로 호감도를 다시 계산한다', () => {
    const session = makeSession();
    session.messages = [
      { id: 'positive', role: 'user', content: '정말 고마워', createdAt: 1 },
      { id: 'reply', role: 'assistant', content: '별말을.', createdAt: 2 },
      { id: 'negative', role: 'user', content: '이제는 싫어', createdAt: 3 },
    ];

    expect(calculateSessionAffinity(session.messages)).toBe(0);
  });

  it('긴 최근 대화는 최신 메시지를 보존하면서 호출 예산 안으로 줄인다', () => {
    const session = makeSession();
    session.messages = Array.from({ length: 18 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `${index}:` + '가'.repeat(10_000),
      createdAt: index,
    }));

    const contents = getRecentChatContents(session);
    const totalChars = contents.reduce((total, content) => (
      total + (content.parts[0]?.text.length || 0)
    ), 0);

    expect(totalChars).toBeLessThanOrEqual(48_000);
    expect(contents[contents.length - 1]?.parts[0]?.text).toContain('17:');
  });

  it('예산 끝에 몇 글자만 남아도 최근 대화 하드 캡을 넘지 않는다', () => {
    const session = makeSession();
    session.messages = [
      { id: 'oldest', role: 'user', content: '가'.repeat(500), createdAt: 1 },
      { id: 'almost', role: 'assistant', content: '나'.repeat(11_995), createdAt: 2 },
      { id: 'third', role: 'user', content: '다'.repeat(12_000), createdAt: 3 },
      { id: 'second', role: 'assistant', content: '라'.repeat(12_000), createdAt: 4 },
      { id: 'latest', role: 'user', content: '마'.repeat(12_000), createdAt: 5 },
    ];

    const totalChars = getRecentChatContents(session).reduce((total, content) => (
      total + (content.parts[0]?.text.length || 0)
    ), 0);

    expect(totalChars).toBeLessThanOrEqual(48_000);
  });

  it('긴 페르소나와 고정 기억도 시스템 지침 예산 안에서 자른다', () => {
    const oversizedPersona: CharacterChatPersona = {
      ...persona,
      background: field('배경'.repeat(8_000)),
      storyContext: field('이야기'.repeat(8_000)),
      worldContext: field('세계'.repeat(8_000)),
    };
    const oversizedSession = makeSession();
    oversizedSession.messages[0] = {
      ...oversizedSession.messages[0],
      content: '고정 기억'.repeat(4_000),
    };
    oversizedSession.memorySummary = '장기 기억'.repeat(4_000);

    const prompt = buildCharacterChatSystemInstruction(oversizedPersona, source, oversizedSession);

    expect(prompt.length).toBeLessThanOrEqual(28_000);
    expect(prompt).toContain('자 생략');
  });

  it('장기 기억용 원문도 최신 대화를 포함한 채 예산 안으로 줄인다', () => {
    const session = makeSession();
    session.messages = Array.from({ length: 14 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `${index}:` + '나'.repeat(8_000),
      createdAt: index,
    }));
    session.summarizedMessageCount = 0;

    const transcript = buildCharacterChatSummaryTranscript(session, persona.name);

    expect(transcript.length).toBeLessThanOrEqual(36_000);
    expect(transcript).toContain('13:');
  });

  it('오래 끝난 기억 요약이 더 최신 요약을 덮어쓰지 못하게 한다', () => {
    const target = makeSession();
    target.messages = Array.from({ length: 12 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `${index}`,
      createdAt: index,
    }));
    const current = {
      ...target,
      messages: [
        ...target.messages,
        { id: 'message-12', role: 'user' as const, content: '새 메시지', createdAt: 12 },
        { id: 'message-13', role: 'assistant' as const, content: '새 응답', createdAt: 13 },
      ],
      summarizedMessageCount: 14,
    };

    expect(canApplyCharacterChatSummary(current, target)).toBe(false);
    expect(canApplyCharacterChatSummary({ ...current, summarizedMessageCount: 0 }, target)).toBe(true);
    expect(canApplyCharacterChatSummary({
      ...current,
      summarizedMessageCount: 0,
      messages: current.messages.map((message, index) => index === 2
        ? { ...message, content: '수정됨' }
        : message),
    }, target)).toBe(false);
  });

  it('마지막 요약 이후 12개 메시지가 쌓였을 때만 새 요약을 요청한다', () => {
    const session = makeSession();
    session.messages = Array.from({ length: 15 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `${index}`,
      createdAt: index,
    }));
    session.summarizedMessageCount = 3;

    expect(shouldSummarizeSession(session)).toBe(true);
    session.summarizedMessageCount = 4;
    expect(shouldSummarizeSession(session)).toBe(false);
  });
});
