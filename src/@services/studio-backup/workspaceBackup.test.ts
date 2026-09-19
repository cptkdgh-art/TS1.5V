import { describe, expect, it } from 'vitest';
import {
  ALL_WORKSPACES_BACKUP_KIND,
  parseAllWorkspacesBackup,
  parseWorkspaceBackupContent,
} from './workspaceBackup';

describe('workspace backup compatibility', () => {
  const novel = { id: 'n', title: 'Novel', subject: '', mood: '', plotSummary: '', chapters: [{ title: 'One', content: 'Text' }], history: [], characters: [], aiAuthorId: null, createdAt: 1 };
  const revision = {
    id: 'revision-1', createdAt: 1, kind: 'edit', authorId: 'former-author', authorName: '당시 작가',
    model: 'model', instruction: '감정선을 고쳐.', summary: '수정 설명',
    before: { title: '이전 제목', content: '기존 원고\n두 번째 문단' },
    after: { title: '새 제목', content: '수정 원고' },
    grounding: {
      proposalId: 'proposal-1', reason: '감정의 원인이 부족하다.', preserve: ['사건 순서'],
      expectedEffect: '선택이 자연스럽게 읽힌다.',
      selectedChoice: { id: 'a', label: '행동 보강', direction: '망설임을 행동으로 보인다.', expectedEffect: '원인이 보인다.' },
    },
  };
  const pendingProposal = {
    id: 'proposal-2', createdAt: 2, reason: '반응이 빠르다.', preserve: ['마지막 대사'],
    expectedEffect: '여운이 생긴다.', choices: [
      { id: 'a', label: '침묵', direction: '침묵을 둔다.', expectedEffect: '오래 머문다.' },
      { id: 'b', label: '행동', direction: '손을 거둔다.', expectedEffect: '주저함이 보인다.' },
    ],
    source: { chapterId: 'chapter-1', revision: 1, signature: 'v2:source' },
    authorId: 'former-author', authorName: '당시 작가', model: 'model',
  };

  it('round-trips full workspace JSON with chapter originals, restored versions and dialogue, including snapshots', () => {
    const chapter = { ...novel.chapters[0], id: 'chapter-1', agentPendingProposal: pendingProposal, agentRevisions: [revision, {
      ...revision, id: 'revision-2', kind: 'restore', createdAt: 2,
      before: revision.after, after: revision.before, restoredFromId: revision.id,
    }], feedbackChat: [{ role: 'user', parts: [{ text: '이 부분만 수정해.' }] }] };
    const data = { novels: [{ ...novel, chapters: [chapter], snapshots: [{
      id: 'snapshot-1', createdAt: 3, description: '기록 포함 스냅샷', novelData: { ...novel, chapters: [chapter] },
    }] }], series: [], authors: [] };
    const bundle = {
      kind: ALL_WORKSPACES_BACKUP_KIND, version: '2.0', exportedAt: '2026-09-12T00:00:00Z',
      workspaces: [{ workspace: { id: 'workspace-history', slot: 1, name: '기록 작업실' }, data }],
    };
    const parsed = parseAllWorkspacesBackup(JSON.parse(JSON.stringify(bundle)));
    expect(parsed?.workspaces[0].data.novels[0].chapters[0]).toEqual(chapter);
    expect(parsed?.workspaces[0].data.novels[0].snapshots?.[0].novelData.chapters[0]).toEqual(chapter);
  });

  it.each([
    null, {}, [null], [{ id: 'incomplete' }],
    [{ ...revision, before: null }], [{ ...revision, after: { title: '', content: 7 } }],
    [{ ...revision, kind: 'delete' }], [{ ...revision, createdAt: 'yesterday' }],
    [{ ...revision, createdAt: 1e20 }], [{ ...revision, authorId: 4 }],
    [{ ...revision, restoredFromId: 0 }], [revision, revision],
  ])('rejects malformed agent work history: %j', (agentRevisions) => {
    expect(parseWorkspaceBackupContent({
      novels: [{ ...novel, chapters: [{ ...novel.chapters[0], agentRevisions }] }], series: [], authors: [],
    })).toBeNull();
  });

  it.each([
    null, {}, { ...pendingProposal, reason: '' },
    { ...pendingProposal, choices: [{ id: 'a', label: 'A', direction: 'A' }, pendingProposal.choices[1]] },
    { ...pendingProposal, choices: [pendingProposal.choices[1], pendingProposal.choices[1]] },
    { ...pendingProposal, source: { ...pendingProposal.source, revision: 0 } },
    { ...pendingProposal, authorId: 4 },
  ])('rejects malformed pending proposals: %j', (agentPendingProposal) => {
    expect(parseWorkspaceBackupContent({
      novels: [{ ...novel, chapters: [{ ...novel.chapters[0], agentPendingProposal }] }], series: [], authors: [],
    })).toBeNull();
  });

  it('preserves legacy chapters without identity and deprecated author engine', () => {
    const parsed = parseWorkspaceBackupContent({ novels: [novel], series: [], authors: [{ id: 'a', name: 'Author', specialty: '', writingStyle: '', coreDirectives: '', createdAt: 1, engine: 'old' }] });
    expect(parsed?.novels[0].chapters).toEqual(novel.chapters);
    expect(parsed?.authors[0]).not.toHaveProperty('engine');
  });

  it('accepts many novels and nullable legacy settings after migration', () => {
    const novels = Array.from({ length: 15 }, (_, index) => ({ ...novel, id: `novel-${index}`, primaryGenre: null, subgenres: null, themes: null, foreshadowingSystem: null }));
    expect(parseWorkspaceBackupContent({ novels, series: [], authors: [] })?.novels).toHaveLength(15);
  });

  it.each([
    { chapters: [null] }, { chapters: [{ title: 'One', content: 1 }] },
    { chapters: [{ id: 'c', title: '', content: '' }, { id: 'c', title: '', content: '' }] },
    { chapters: [{ title: '', content: '', trace: { revision: 0 } }] },
    { history: {} }, { characters: [null] }, { contextSummary: { entries: 'broken' } },
    { snapshots: [{ id: 's', novelData: { chapters: null } }] },
    { seriesId: 'missing' },
  ])('rejects malformed nested novel data: %j', (updates) => {
    expect(parseWorkspaceBackupContent({ novels: [{ ...novel, ...updates }], series: [], authors: [] })).toBeNull();
  });

  it('rejects duplicate root IDs and broken series references', () => {
    expect(parseWorkspaceBackupContent({ novels: [novel, novel], series: [], authors: [] })).toBeNull();
    expect(parseWorkspaceBackupContent({ novels: [], series: [{ id: 's', title: '', seriesPlotSummary: '', characters: [], novelIds: ['missing'], createdAt: 1 }], authors: [] })).toBeNull();
  });

  it('rejects malformed author memory and package receipts', () => {
    const author = { id: 'a', name: '', specialty: '', writingStyle: '', coreDirectives: '', createdAt: 1, memoryCache: [null] };
    expect(parseWorkspaceBackupContent({ novels: [], series: [], authors: [author] })).toBeNull();
    expect(parseWorkspaceBackupContent({ novels: [], series: [], authors: [], productionPackageReceipts: [null] })).toBeNull();
  });

  it('preserves a valid author identity core and rejects a malformed one', () => {
    const identityCore = {
      schemaVersion: 1, coreId: 'core-a', versionId: 'core-a-v1',
      selfDefinition: '선택을 쓰는 작가', reasonToWrite: '사람의 변화를 보기 위해',
      worldview: '', viewOfHumanity: '', literaryValues: [],
      aestheticTaste: { drawnTo: [], avoids: [], emotionalTexture: '' },
      innerContradictions: [], recurringQuestions: [], readerRelationship: '', creativeEthics: '',
      narrativeInstincts: [], voiceOrigins: '', readabilityPractice: '술술 읽히게 쓴다.',
      plausibilityPractice: '원인에서 결과를 잇는다.', createdAt: 1, updatedAt: 1,
    };
    const author = { id: 'a', name: 'Author', specialty: '', writingStyle: '', coreDirectives: '', createdAt: 1, identityCore };

    expect(parseWorkspaceBackupContent({ novels: [], series: [], authors: [author] })?.authors[0].identityCore)
      .toEqual(identityCore);
    expect(parseWorkspaceBackupContent({ novels: [], series: [], authors: [{ ...author, identityCore: { ...identityCore, recurringQuestions: [null] } }] }))
      .toBeNull();
  });
  it('accepts the legacy studio backup data shape', () => {
    const parsed = parseWorkspaceBackupContent({
      version: '1.2',
      novels: [],
      series: [],
      authors: [],
    });

    expect(parsed).toEqual({
      novels: [],
      series: [],
      authors: [],
      characterChat: undefined,
      directorClio: undefined,
    });
  });

  it('parses every workspace in a full backup bundle', () => {
    const parsed = parseAllWorkspacesBackup({
      kind: ALL_WORKSPACES_BACKUP_KIND,
      version: '2.0',
      exportedAt: '2026-08-21T00:00:00.000Z',
      workspaces: [
        {
          workspace: { id: 'workspace-a', slot: 1, name: '판타지' },
          data: { novels: [], series: [], authors: [] },
        },
        {
          workspace: { id: 'workspace-b', slot: 2, name: '스포츠' },
          data: { novels: [], series: [], authors: [] },
        },
      ],
    });

    expect(parsed?.workspaces.map((item) => item.workspace.name)).toEqual(['판타지', '스포츠']);
  });

  it('rejects a full backup when even one workspace payload is damaged', () => {
    const parsed = parseAllWorkspacesBackup({
      kind: ALL_WORKSPACES_BACKUP_KIND,
      version: '2.0',
      workspaces: [
        {
          workspace: { id: 'workspace-a', slot: 1, name: '정상' },
          data: { novels: [], series: [], authors: [] },
        },
        {
          workspace: { id: 'workspace-b', slot: 2, name: '손상' },
          data: { novels: 'not-an-array', series: [], authors: [] },
        },
      ],
    });

    expect(parsed).toBeNull();
  });

  it('keeps production package receipts when present', () => {
    const parsed = parseWorkspaceBackupContent({
      novels: [],
      series: [],
      authors: [],
      productionPackageReceipts: [{
        lineageId: 'lineage-1',
        packageId: 'package-1',
        revision: 1,
        importedAt: 1,
        targetWorkspaceId: 'workspace-1',
        mode: 'copy',
        idMap: {
          authors: {}, series: {}, volumes: {}, novels: {}, chapters: {}, characters: {}, foreshadowings: {}, snapshots: {},
        },
      }],
    });

    expect(parsed?.productionPackageReceipts?.[0].lineageId).toBe('lineage-1');
  });
});
