export interface ChapterAgentChoice {
  id: 'a' | 'b';
  label: string;
  direction: string;
  expectedEffect: string;
}

/** The author's two-way proposal shown after consultation. */
export interface ChapterAgentProposal {
  id: string;
  createdAt: number;
  reason: string;
  preserve: readonly string[];
  expectedEffect: string;
  choices: readonly [ChapterAgentChoice, ChapterAgentChoice];
}

/** Manuscript state and author identity that make a saved proposal selectable. */
export interface ChapterAgentPendingProposal extends ChapterAgentProposal {
  source: {
    chapterId: string;
    revision: number;
    signature: string;
  };
  authorId: string | null;
  authorName: string;
  model: string;
}

export interface ChapterAgentRevisionGrounding {
  proposalId: string;
  reason: string;
  preserve: readonly string[];
  expectedEffect: string;
  selectedChoice: ChapterAgentChoice;
}

/** A saved manuscript version, separate from the currently published chapter text. */
export interface ChapterAgentRevision {
  id: string;
  createdAt: number;
  kind: 'edit' | 'restore';
  authorId: string | null;
  authorName: string;
  model: string;
  instruction: string;
  summary: string;
  before: { title: string; content: string };
  after: { title: string; content: string };
  grounding?: ChapterAgentRevisionGrounding;
  restoredFromId?: string;
}
