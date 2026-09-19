import { describe, expect, it, vi } from 'vitest';
import type { AiAuthor, ChapterAgentProposal, Novel } from '@core/types';
import {
  chapterAgentSourceSignature,
  commitChapterAgentProposalTurn,
  commitChapterAgentSelectionTurn,
  restoreChapterAgentRevision,
  type ChapterAgentEditTurnResult,
  type ChapterAgentProposalTurnResult,
} from './chapterAgentWork';

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => '00000000-0000-4000-8000-000000000001') });

const author = { id: 'a1', name: '윤슬' } as AiAuthor;
function novel(): Novel {
  return {
    id: 'n1', title: '작품', subject: '성장', mood: '담담', plotSummary: '약속을 지킨다.',
    chapters: [
      { id: 'c1', title: '1화', content: '수정 전 원고', trace: { revision: 1, createdAt: 1, updatedAt: 1, source: 'manual' } },
      { id: 'c2', title: '2화', content: '관련 회차', trace: { revision: 1, createdAt: 1, updatedAt: 1, source: 'manual' } },
    ],
    history: [{ role: 'user', parts: [{ text: '오래된 생성 문맥' }] }], createdAt: 1, aiAuthorId: 'a1', characters: [],
    contextSummary: { content: '요약', summarizedChapters: 2, createdAt: 1 },
  };
}

function proposal(overrides: Partial<ChapterAgentProposal> = {}): ChapterAgentProposal {
  return {
    id: 'proposal-1', createdAt: 10, reason: '감정의 원인이 보이지 않는다.',
    preserve: ['사건 순서', '마지막 대사'], expectedEffect: '주인공의 망설임이 자연스럽게 읽힌다.',
    choices: [
      { id: 'a', label: '행동 보강', direction: '대사 앞에 손의 망설임을 보인다.', expectedEffect: '감정을 빠르게 이해한다.' },
      { id: 'b', label: '침묵 확장', direction: '대화 사이 침묵을 늘린다.', expectedEffect: '여운이 깊어진다.' },
    ],
    ...overrides,
  };
}

function proposalResult(overrides: Partial<ChapterAgentProposalTurnResult> = {}): ChapterAgentProposalTurnResult {
  return {
    message: '왜 어색한지 읽어봤어. 두 방향이 있어.', proposal: proposal(),
    readChapterIds: ['c1', 'c2'], model: 'gemini-3.7-flash', ...overrides,
  };
}

function editResult(overrides: Partial<ChapterAgentEditTurnResult> = {}): ChapterAgentEditTurnResult {
  return {
    message: '선택한 방향으로 고치고 다시 읽어봤어.', summary: '행동으로 망설임을 보강',
    title: '1화', content: '수정 후 원고', changed: true,
    readChapterIds: ['c1', 'c2'], model: 'gemini-3.7-flash', ...overrides,
  };
}

function withProposal(base = novel(), value = proposal()): Novel {
  return commitChapterAgentProposalTurn(base, {
    base, chapterId: 'c1', message: '왜 어색하지?', author,
    result: proposalResult({ proposal: value }),
  });
}

describe('conversation-first chapter writer persistence', () => {
  it('stores consultation and a durable two-choice proposal without changing the manuscript', () => {
    const base = novel();
    const updated = withProposal(base);
    const chapter = updated.chapters[0];

    expect(chapter.content).toBe('수정 전 원고');
    expect(chapter.trace?.revision).toBe(1);
    expect(chapter.agentRevisions).toBeUndefined();
    expect(chapter.feedbackChat?.map((item) => item.role)).toEqual(['user', 'model']);
    expect(chapter.agentPendingProposal).toMatchObject({
      id: 'proposal-1', authorId: author.id, authorName: author.name, model: 'gemini-3.7-flash',
      source: { chapterId: 'c1', revision: 1, signature: chapterAgentSourceSignature(base.chapters[0]) },
      choices: [{ id: 'a' }, { id: 'b' }],
    });
    expect(updated.history).toHaveLength(1);
  });

  it('requires exactly ordered A/B choices and leaves the source untouched when malformed', () => {
    const base = novel();
    const malformed = proposal({ choices: [
      { id: 'b', label: 'B', direction: 'B', expectedEffect: 'B' },
      { id: 'a', label: 'A', direction: 'A', expectedEffect: 'A' },
    ] });
    expect(() => withProposal(base, malformed)).toThrow('두 방향 제안이 완전하지');
    expect(base.chapters[0].feedbackChat).toBeUndefined();
    expect(base.chapters[0].agentPendingProposal).toBeUndefined();
  });

  it('creates durable identity for an AI draft and clears an older proposal when the author asks one more question', () => {
    const base = novel();
    const draft = proposal();
    const { id: _id, createdAt: _createdAt, ...withoutIdentity } = draft;
    const first = commitChapterAgentProposalTurn(base, {
      base, chapterId: 'c1', message: '이유를 봐줘', author,
      result: proposalResult({ proposal: withoutIdentity }),
    });
    expect(first.chapters[0].agentPendingProposal).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001', createdAt: expect.any(Number),
    });

    const continued = commitChapterAgentProposalTurn(first, {
      base: first, chapterId: 'c1', message: 'A는 조금 더 절제할까?', author,
      result: proposalResult({ message: '어느 정도 절제할지 하나만 물을게.', proposal: undefined }),
    });
    expect(continued.chapters[0].content).toBe('수정 전 원고');
    expect(continued.chapters[0].feedbackChat).toHaveLength(4);
    expect(continued.chapters[0].agentPendingProposal).toBeUndefined();
  });

  it('applies only the latest saved proposal and records its reason, preservation and chosen direction', () => {
    const consulted = withProposal();
    const updated = commitChapterAgentSelectionTurn(consulted, {
      base: consulted, chapterId: 'c1', message: 'A 방향으로 수정',
      proposalId: 'proposal-1', choiceId: 'a', author, result: editResult(),
    });
    const chapter = updated.chapters[0];

    expect(chapter.content).toBe('수정 후 원고');
    expect(chapter.trace?.revision).toBe(2);
    expect(chapter.agentPendingProposal).toBeUndefined();
    expect(chapter.feedbackChat?.map((item) => item.role)).toEqual(['user', 'model', 'user', 'model']);
    expect(chapter.agentRevisions?.[0]).toMatchObject({
      kind: 'edit', instruction: 'A 방향으로 수정',
      before: { content: '수정 전 원고' }, after: { content: '수정 후 원고' },
      grounding: {
        proposalId: 'proposal-1', reason: proposal().reason,
        preserve: proposal().preserve, expectedEffect: proposal().expectedEffect,
        selectedChoice: proposal().choices[0],
      },
    });
    expect(updated.history).toEqual([]);
    expect(updated.contextSummary?.needsRecheck).toBe(true);
  });

  it('rejects old proposal ids, arbitrary choice ids and ordinary agreement text', () => {
    const consulted = withProposal();
    const apply = (proposalId: string, choiceId: 'a' | 'b') => commitChapterAgentSelectionTurn(consulted, {
      base: consulted, chapterId: 'c1', message: '응', proposalId, choiceId, author, result: editResult(),
    });

    expect(() => apply('older-proposal', 'a')).toThrow('최신 두 방향');
    expect(() => apply('proposal-1', 'c' as 'a')).toThrow('선택한 수정 방향');
    expect(consulted.chapters[0].content).toBe('수정 전 원고');
    expect(consulted.chapters[0].agentPendingProposal?.id).toBe('proposal-1');
  });

  it('rejects a stale manuscript fingerprint and changed author', () => {
    const stale = withProposal();
    stale.chapters[0].agentPendingProposal!.source.signature = 'stale-signature';
    expect(() => commitChapterAgentSelectionTurn(stale, {
      base: stale, chapterId: 'c1', message: 'A', proposalId: 'proposal-1', choiceId: 'a', author, result: editResult(),
    })).toThrow('제안 뒤 원고가 바뀌었');

    const changedAuthor = withProposal();
    changedAuthor.aiAuthorId = 'a2';
    expect(() => commitChapterAgentSelectionTurn(changedAuthor, {
      base: changedAuthor, chapterId: 'c1', message: 'A', proposalId: 'proposal-1', choiceId: 'a',
      author: { ...author, id: 'a2' }, result: editResult(),
    })).toThrow('담당 작가가 바뀌었');
  });

  it('rejects concurrent changes to any manuscript the author read', () => {
    const consulted = withProposal();
    const current = structuredClone(consulted);
    current.chapters[1].content = '다른 탭이 수정함';
    expect(() => commitChapterAgentSelectionTurn(current, {
      base: consulted, chapterId: 'c1', message: 'A', proposalId: 'proposal-1', choiceId: 'a', author, result: editResult(),
    })).toThrow('작가가 읽은 원고가 작업 중 변경');
    expect(current.chapters[0].content).toBe('수정 전 원고');
  });

  it('keeps the proposal when the selected edit is blank or unchanged', () => {
    const consulted = withProposal();
    expect(() => commitChapterAgentSelectionTurn(consulted, {
      base: consulted, chapterId: 'c1', message: 'A', proposalId: 'proposal-1', choiceId: 'a', author,
      result: editResult({ content: '수정 전 원고', changed: false }),
    })).toThrow('수정 결과가 완전하지');
    expect(consulted.chapters[0].agentPendingProposal?.id).toBe('proposal-1');
  });

  it('restores an earlier before-version, clears stale proposal and saves the displaced manuscript', () => {
    const consulted = withProposal();
    const edited = commitChapterAgentSelectionTurn(consulted, {
      base: consulted, chapterId: 'c1', message: 'A', proposalId: 'proposal-1', choiceId: 'a', author, result: editResult(),
    });
    const expected = edited.chapters[0];
    vi.mocked(crypto.randomUUID).mockReturnValueOnce('00000000-0000-4000-8000-000000000002');
    const restored = restoreChapterAgentRevision(edited, {
      chapterId: 'c1', expected, revisionId: '00000000-0000-4000-8000-000000000001',
    });

    expect(restored.chapters[0].content).toBe('수정 전 원고');
    expect(restored.chapters[0].agentPendingProposal).toBeUndefined();
    expect(restored.chapters[0].agentRevisions?.[restored.chapters[0].agentRevisions.length - 1]).toMatchObject({
      id: '00000000-0000-4000-8000-000000000002', kind: 'restore',
      restoredFromId: '00000000-0000-4000-8000-000000000001',
      before: { content: '수정 후 원고' }, after: { content: '수정 전 원고' },
    });
  });
});
