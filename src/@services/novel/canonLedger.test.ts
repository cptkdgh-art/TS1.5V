import { describe, expect, it } from 'vitest';
import type { CanonFact, Novel } from '@core/types';
import { buildCanonBriefing, inspectCanonFacts, reconcileCanonAfterChapterRemoval } from './canonLedger';

const makeNovel = (): Novel => ({
  id: 'novel-1',
  title: '테스트',
  subject: '',
  mood: '',
  plotSummary: '',
  history: [],
  createdAt: 1,
  aiAuthorId: null,
  characters: [],
  chapters: [
    { id: 'ch-1', title: '1화', content: '초고', trace: { revision: 2, createdAt: 1, updatedAt: 2, source: 'manual' } },
    { id: 'ch-2', title: '2화', content: '본문', trace: { revision: 1, createdAt: 2, updatedAt: 2, source: 'ai' } },
  ],
});

const fact = (overrides: Partial<CanonFact> = {}): CanonFact => ({
  id: 'fact-1',
  kind: 'relationship',
  subject: '두 사람',
  value: '동맹이다.',
  sourceChapterId: 'ch-1',
  sourceRevision: 2,
  validFromChapterId: 'ch-1',
  status: 'confirmed',
  locked: false,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe('canon ledger', () => {
  it('injects only confirmed facts active at the next chapter', () => {
    const novel = makeNovel();
    novel.canonFacts = [
      fact(),
      fact({ id: 'draft', subject: '초안', status: 'draft' }),
      fact({ id: 'ended', subject: '종료', validUntilChapterId: 'ch-2' }),
    ];

    expect(inspectCanonFacts(novel).filter((item) => item.active).map((item) => item.fact.id)).toEqual(['fact-1']);
    expect(buildCanonBriefing(novel)).toContain('두 사람: 동맹이다.');
    expect(buildCanonBriefing(novel)).not.toContain('초안');
  });

  it('stops injecting a fact after its source revision changes unless the user locked it', () => {
    const novel = makeNovel();
    novel.canonFacts = [fact({ sourceRevision: 1 }), fact({ id: 'locked', sourceRevision: 1, locked: true })];

    const states = inspectCanonFacts(novel);
    expect(states[0]).toMatchObject({ active: false, sourceChanged: true });
    expect(states[1]).toMatchObject({ active: true, sourceChanged: true });
  });

  it('moves facts tied to removed chapters back to review state', () => {
    const reconciled = reconcileCanonAfterChapterRemoval([fact()], new Set(['ch-2']), 10);
    expect(reconciled?.[0]).toMatchObject({ status: 'draft', sourceChapterId: undefined, updatedAt: 10 });
  });
});
