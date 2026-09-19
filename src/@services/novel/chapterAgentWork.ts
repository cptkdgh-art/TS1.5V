import type {
  AiAuthor,
  Chapter,
  ChapterAgentChoice,
  ChapterAgentPendingProposal,
  ChapterAgentProposal,
  ChapterAgentRevision,
  Content,
  Novel,
} from '@core/types';
import { computeStableSignature } from '@services/ai/utils';
import { reviseChapter } from './chapterIdentity';

export interface ChapterAgentProposalTurnResult {
  message: string;
  proposal?: ChapterAgentProposal | Omit<ChapterAgentProposal, 'id' | 'createdAt'>;
  readChapterIds: string[];
  model: string;
}

export interface ChapterAgentEditTurnResult {
  message: string;
  summary: string;
  title: string;
  content: string;
  changed: boolean;
  readChapterIds: string[];
  model: string;
}

export function requireWorkChapter(novel: Novel, chapterId: string): Chapter {
  const chapter = novel.chapters.find((item) => item.id === chapterId);
  if (!chapter) throw new Error('작업할 회차가 삭제되었거나 다른 작품으로 옮겨졌어요.');
  return chapter;
}

function sameManuscript(a: Chapter, b: Chapter): boolean {
  return a.content === b.content && a.title === b.title
    && a.trace?.revision === b.trace?.revision;
}

function workContext(novel: Novel): string {
  return JSON.stringify([
    novel.title, novel.subject, novel.mood, novel.plotSummary, novel.aiAuthorId,
    novel.generationEngine, novel.characters, novel.worldviewFiles, novel.writingDirectives,
    novel.treatment, novel.episodeArc, novel.seriesId,
  ]);
}

export function chapterAgentSourceSignature(chapter: Pick<Chapter, 'title' | 'content'>): string {
  return computeStableSignature(JSON.stringify([chapter.title, chapter.content]));
}

function sameWorkRecords(a: Chapter, b: Chapter): boolean {
  return JSON.stringify(a.feedbackChat ?? []) === JSON.stringify(b.feedbackChat ?? [])
    && JSON.stringify(a.agentPendingProposal ?? null) === JSON.stringify(b.agentPendingProposal ?? null)
    && JSON.stringify(a.agentRevisions ?? []) === JSON.stringify(b.agentRevisions ?? []);
}

function assertStableContext(current: Novel, base: Novel, chapterId: string, readChapterIds: string[]): void {
  if (current.id !== base.id || workContext(current) !== workContext(base)) {
    throw new Error('작품 설정이나 담당 작가가 바뀌었어요. 최신 상태에서 다시 대화해 주세요.');
  }
  for (const id of new Set([chapterId, ...readChapterIds])) {
    if (!sameManuscript(requireWorkChapter(base, id), requireWorkChapter(current, id))) {
      throw new Error('작가가 읽은 원고가 작업 중 변경되었어요. 현재 원고를 보존했으니 다시 대화해 주세요.');
    }
  }
  if (!sameWorkRecords(requireWorkChapter(base, chapterId), requireWorkChapter(current, chapterId))) {
    throw new Error('다른 대화나 제안, 수정이 먼저 저장되었어요. 최신 작업 기록을 확인해 주세요.');
  }
}

function isValidProposal(proposal: ChapterAgentProposal): boolean {
  return !!proposal.id.trim()
    && Number.isFinite(proposal.createdAt)
    && proposal.createdAt >= 0
    && !!proposal.reason.trim()
    && Array.isArray(proposal.preserve)
    && proposal.preserve.every((item) => typeof item === 'string')
    && !!proposal.expectedEffect.trim()
    && Array.isArray(proposal.choices)
    && proposal.choices.length === 2
    && proposal.choices[0]?.id === 'a'
    && proposal.choices[1]?.id === 'b'
    && proposal.choices.every((choice) => !!choice.label.trim()
      && !!choice.direction.trim() && !!choice.expectedEffect.trim());
}

function appendConversation(chapter: Chapter, message: string, reply: string): Content[] {
  return [
    ...(chapter.feedbackChat ?? []),
    { role: 'user', parts: [{ text: message }] },
    { role: 'model', parts: [{ text: reply }] },
  ];
}

/** Saves a consultation and replaces any older, unselected proposal without changing the manuscript. */
export function commitChapterAgentProposalTurn(current: Novel, options: {
  base: Novel;
  chapterId: string;
  message: string;
  author: AiAuthor | null;
  result: ChapterAgentProposalTurnResult;
}): Novel {
  const { base, chapterId, message, author, result } = options;
  assertStableContext(current, base, chapterId, result.readChapterIds);
  if (!result.proposal) {
    const chapter = requireWorkChapter(current, chapterId);
    return replaceWorkChapter(current, {
      ...chapter,
      feedbackChat: appendConversation(chapter, message, result.message),
      agentPendingProposal: undefined,
    }, false);
  }
  const proposalWithIdentity: ChapterAgentProposal = {
    ...result.proposal,
    id: 'id' in result.proposal ? result.proposal.id : crypto.randomUUID(),
    createdAt: 'createdAt' in result.proposal ? result.proposal.createdAt : Date.now(),
  };
  if (!isValidProposal(proposalWithIdentity)) {
    throw new Error('작가의 두 방향 제안이 완전하지 않아 저장하지 않았어요.');
  }
  const chapter = requireWorkChapter(current, chapterId);
  const proposal: ChapterAgentPendingProposal = {
    ...structuredClone(proposalWithIdentity),
    source: {
      chapterId,
      revision: chapter.trace?.revision ?? 1,
      signature: chapterAgentSourceSignature(chapter),
    },
    authorId: author?.id ?? null,
    authorName: author?.name ?? 'AI 작가',
    model: result.model,
  };
  return replaceWorkChapter(current, {
    ...chapter,
    feedbackChat: appendConversation(chapter, message, result.message),
    agentPendingProposal: proposal,
  }, false);
}

function selectedChoice(proposal: ChapterAgentPendingProposal, choiceId: ChapterAgentChoice['id']): ChapterAgentChoice {
  const choice = proposal.choices.find((item) => item.id === choiceId);
  if (!choice) throw new Error('선택한 수정 방향을 찾지 못했어요. 최신 제안을 다시 확인해 주세요.');
  return choice;
}

/** Applies only the currently saved proposal choice and clears it after a successful atomic edit. */
export function commitChapterAgentSelectionTurn(current: Novel, options: {
  base: Novel;
  chapterId: string;
  message: string;
  proposalId: string;
  choiceId: ChapterAgentChoice['id'];
  author: AiAuthor | null;
  result: ChapterAgentEditTurnResult;
}): Novel {
  const { base, chapterId, message, proposalId, choiceId, author, result } = options;
  assertStableContext(current, base, chapterId, result.readChapterIds);
  const chapter = requireWorkChapter(current, chapterId);
  const proposal = chapter.agentPendingProposal;
  if (!proposal || proposal.id !== proposalId) {
    throw new Error('이미 새 대화로 제안이 바뀌었어요. 최신 두 방향 중에서 다시 선택해 주세요.');
  }
  if (proposal.source.chapterId !== chapterId
    || proposal.source.revision !== (chapter.trace?.revision ?? 1)
    || proposal.source.signature !== chapterAgentSourceSignature(chapter)) {
    throw new Error('제안 뒤 원고가 바뀌었어요. 현재 원고를 보존했으니 새 방향을 받아 주세요.');
  }
  if (proposal.authorId !== (author?.id ?? null) || proposal.authorId !== current.aiAuthorId) {
    throw new Error('담당 작가가 바뀌었어요. 현재 작가와 다시 방향을 정해 주세요.');
  }
  const choice = selectedChoice(proposal, choiceId);
  const changed = result.content !== chapter.content || result.title !== chapter.title;
  if (!changed || !result.changed || !result.content.trim()) {
    throw new Error('선택한 방향의 수정 결과가 완전하지 않아 원고를 보존했어요.');
  }
  const revision: ChapterAgentRevision = {
    id: crypto.randomUUID(), createdAt: Date.now(), kind: 'edit',
    authorId: author?.id ?? null, authorName: author?.name ?? 'AI 작가', model: result.model,
    instruction: message, summary: result.summary,
    before: { title: chapter.title, content: chapter.content },
    after: { title: result.title, content: result.content },
    grounding: {
      proposalId: proposal.id,
      reason: proposal.reason,
      preserve: [...proposal.preserve],
      expectedEffect: proposal.expectedEffect,
      selectedChoice: structuredClone(choice),
    },
  };
  return replaceWorkChapter(current, {
    ...reviseChapter(chapter, revision.after),
    feedbackChat: appendConversation(chapter, message, result.message),
    agentPendingProposal: undefined,
    agentRevisions: [...(chapter.agentRevisions ?? []), revision],
    authorInterlude: undefined,
  }, true);
}

function replaceWorkChapter(novel: Novel, chapter: Chapter, changed: boolean): Novel {
  return {
    ...novel,
    chapters: novel.chapters.map((item) => item.id === chapter.id ? chapter : item),
    ...(changed ? {
      history: [], analysis: undefined, lorekeeperCache: undefined,
      contextCaching: novel.contextCaching ? { ...novel.contextCaching, caches: {} } : undefined,
      contextSummary: novel.contextSummary ? { ...novel.contextSummary, needsRecheck: true } : undefined,
    } : {}),
  };
}

/** Restoration also saves the current text, so undo never erases an intervening version. */
export function restoreChapterAgentRevision(current: Novel, options: {
  chapterId: string;
  expected: Chapter;
  revisionId: string;
}): Novel {
  const chapter = requireWorkChapter(current, options.chapterId);
  if (!sameManuscript(chapter, options.expected) || !sameWorkRecords(chapter, options.expected)) {
    throw new Error('복원 확인 중 원고나 작업 기록이 바뀌었어요. 최신 상태를 확인해 주세요.');
  }
  const source = chapter.agentRevisions?.find((item) => item.id === options.revisionId);
  if (!source) throw new Error('복원할 작업 기록을 찾지 못했어요.');
  const revision: ChapterAgentRevision = {
    id: crypto.randomUUID(), createdAt: Date.now(), kind: 'restore',
    authorId: source.authorId, authorName: source.authorName, model: source.model,
    instruction: '사용자가 작업 기록에서 수정 전 원고를 복원함',
    summary: `「${source.before.title}」의 수정 전 원고로 복원`,
    before: { title: chapter.title, content: chapter.content },
    after: { ...source.before }, restoredFromId: source.id,
  };
  return replaceWorkChapter(current, {
    ...reviseChapter(chapter, revision.after),
    authorInterlude: undefined,
    agentPendingProposal: undefined,
    agentRevisions: [...(chapter.agentRevisions ?? []), revision],
    feedbackChat: [
      ...(chapter.feedbackChat ?? []),
      { role: 'user', parts: [{ text: `[원고 복원] ${revision.summary}. 다음 작업은 현재 원고를 다시 읽고 진행해.` }] },
    ],
  }, true);
}
