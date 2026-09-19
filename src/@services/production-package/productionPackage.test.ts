import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AiAuthor, Novel, Series, StudioWorkspace } from '@core/types';
import { createProductionPackage } from './exporter';
import { parseProductionPackage } from './schema';
import { importProductionPackage } from './importer';
import { recordProductionPackageExport } from './receipts';
import { DELIVERY_PACKAGE_SECTIONS, PLANNING_PACKAGE_SECTIONS } from './constants';

const rawStorage = vi.hoisted(() => new Map<string, unknown>());

vi.mock('@services/storage', () => ({
  STORAGE_KEYS: {
    AUTHORS: 'aiAuthors',
    SERIES: 'series',
    NOVELS: 'novels',
    PRODUCTION_PACKAGE_RECEIPTS: 'productionPackageReceipts',
  },
  getWorkspaceStorageKey: (workspaceId: string, key: string) => `workspace:${workspaceId}:${key}`,
  getRaw: async <T,>(key: string) => rawStorage.get(key) as T | undefined,
  setManyRaw: async (entries: Array<readonly [string, unknown]>) => {
    entries.forEach(([key, value]) => rawStorage.set(key, value));
  },
  setRaw: async (key: string, value: unknown) => { rawStorage.set(key, value); },
}));

const workspace: StudioWorkspace = {
  id: 'workspace-source',
  slot: 1,
  name: '원본 작업실',
  createdAt: 1,
  updatedAt: 1,
};

const author: AiAuthor = {
  id: 'author-source',
  name: '테스트 작가',
  specialty: '판타지',
  writingStyle: '간결함',
  coreDirectives: '빠른 전개',
  createdAt: 1,
  memoryCache: ['작가 기억'],
  generalChatHistory: [{ role: 'user', parts: [{ text: '개인 대화' }] }],
  identityCore: {
    schemaVersion: 1, coreId: 'core-source', versionId: 'core-source-v1',
    selfDefinition: '기억과 선택을 쓰는 작가', reasonToWrite: '잊힌 선택을 복원하기 위해',
    worldview: '기억은 정체성을 만든다.', viewOfHumanity: '인간은 기억을 편집하며 살아간다.',
    literaryValues: [], aestheticTaste: { drawnTo: ['절제'], avoids: ['설명 과다'], emotionalTexture: '서늘함' },
    innerContradictions: [], recurringQuestions: ['잊으면 같은 사람인가?'],
    readerRelationship: '독자를 기억의 증인으로 본다.', creativeEthics: '', narrativeInstincts: ['선택을 장면으로 보인다.'],
    voiceOrigins: '기억의 빈칸에서 문장이 나온다.', readabilityPractice: '장면의 목적을 분명히 한다.',
    plausibilityPractice: '결과 앞에 선택의 원인을 둔다.', createdAt: 1, updatedAt: 1,
  },
};

const novel: Novel = {
  id: 'novel-source',
  title: '기억 도시',
  subject: '기억 거래',
  mood: '긴장감',
  plotSummary: '기억을 되찾는 이야기',
  chapters: [{ id: 'chapter-source', title: '1화', content: '본문' }],
  history: [],
  createdAt: 1,
  aiAuthorId: author.id,
  authorMemoryByAuthor: { [author.id]: ['작품 전용 기억'] },
  characters: [{
    id: 'character-source',
    name: '윤',
    personality: '냉정',
    appearance: '검은 머리',
    background: '기억상',
    log: '',
  }],
  worldviewFiles: [{ filename: '도시.txt', content: '기억이 화폐다.' }],
  lorekeeperCache: { 질문: { answer: '서버성 캐시', cachedAt: 1 } },
  contextCaching: {
    isEnabled: true,
    activeBufferWindow: 5,
    caches: {
      model: {
        cacheName: 'remote-cache-name',
        createTime: 'now',
        expireTime: 'later',
        cachedChapterCount: 1,
        cachedTokenCount: 100,
        contentSignature: 'sig',
      },
    },
  },
  episodePacing: {
    isEnabled: true,
    goal: '재단의 비밀을 의심하게 한다.',
    destination: '주인공이 제한 구역을 확인하기로 한다.',
    scope: 'until-complete',
    speed: 'normal',
  },
};

describe('production package', () => {
  beforeEach(() => rawStorage.clear());

  it('carries chapter work history with the manuscript through package copy import', async () => {
    const historyNovel = structuredClone(novel);
    historyNovel.chapters[0].feedbackChat = [{ role: 'user', parts: [{ text: '부분만 수정해.' }] }];
    historyNovel.chapters[0].agentRevisions = [{
      id: 'saved-edit', createdAt: 1, kind: 'edit', authorId: author.id, authorName: author.name,
      model: 'model-test', instruction: '부분만 수정해.', summary: '감정선 보강',
      before: { title: '원제', content: '원래 원고' }, after: { title: '수정제', content: '바꾼 원고' },
      grounding: {
        proposalId: 'proposal-applied', reason: '감정의 원인이 약하다.', preserve: ['사건 순서'],
        expectedEffect: '선택이 자연스럽다.',
        selectedChoice: { id: 'a', label: '행동', direction: '망설임을 넣는다.', expectedEffect: '원인이 보인다.' },
      },
    }];
    historyNovel.chapters[0].agentPendingProposal = {
      id: 'proposal-pending', createdAt: 2, reason: '반응이 빠르다.', preserve: ['마지막 대사'],
      expectedEffect: '여운이 생긴다.', choices: [
        { id: 'a', label: '침묵', direction: '침묵을 둔다.', expectedEffect: '주저함이 보인다.' },
        { id: 'b', label: '행동', direction: '손을 거둔다.', expectedEffect: '거절이 선명하다.' },
      ],
      source: { chapterId: 'chapter-source', revision: 1, signature: 'v2:source' },
      authorId: author.id, authorName: author.name, model: 'model-test',
    };
    const value = createProductionPackage({
      workspace, authors: [author], novels: [historyNovel], series: [],
      selectedAuthorIds: [author.id], selectedNovelIds: [novel.id],
      sections: { ...DELIVERY_PACKAGE_SECTIONS, collaboration: false, memory: false },
      purpose: 'delivery', title: '기록 포함 원고',
    });
    const parsed = parseProductionPackage(JSON.parse(JSON.stringify(value)));
    expect(parsed?.payload.novels[0].chapters[0].agentRevisions).toEqual(historyNovel.chapters[0].agentRevisions);
    expect(parsed?.payload.novels[0].chapters[0].agentPendingProposal).toEqual(historyNovel.chapters[0].agentPendingProposal);
    await importProductionPackage(parsed!, {
      targetWorkspaceId: 'history-target', mode: 'copy', sections: value.manifest.sections,
      selectedAuthorIds: [author.id], selectedNovelIds: [novel.id],
    });
    const imported = rawStorage.get('workspace:history-target:novels') as Novel[];
    expect(imported[0].chapters[0].id).not.toBe(historyNovel.chapters[0].id);
    expect(imported[0].chapters[0].agentRevisions).toEqual(historyNovel.chapters[0].agentRevisions);
    expect(imported[0].chapters[0].feedbackChat).toEqual(historyNovel.chapters[0].feedbackChat);
    expect(imported[0].chapters[0].agentPendingProposal).toMatchObject({
      id: 'proposal-pending', authorId: imported[0].aiAuthorId,
      source: { chapterId: imported[0].chapters[0].id, revision: 1, signature: 'v2:source' },
    });
    const damaged = structuredClone(value);
    damaged.payload.novels[0].chapters[0].agentRevisions![0].after.content = null as unknown as string;
    expect(parseProductionPackage(damaged)).toBeNull();
    const damagedProposal = structuredClone(value);
    damagedProposal.payload.novels[0].chapters[0].agentPendingProposal!.choices[1].id = 'a';
    expect(parseProductionPackage(damagedProposal)).toBeNull();
  });

  it('exports only the selected planning layers and strips remote caches', () => {
    const value = createProductionPackage({
      workspace,
      authors: [author],
      novels: [novel],
      series: [],
      selectedAuthorIds: [author.id],
      selectedNovelIds: [novel.id],
      sections: PLANNING_PACKAGE_SECTIONS,
      purpose: 'planning',
      title: '기획 패키지',
    });

    expect(value.payload.novels[0].chapters).toEqual([]);
    expect(value.payload.novels[0].characters[0].name).toBe('윤');
    expect(value.payload.novels[0].lorekeeperCache).toBeUndefined();
    expect(value.payload.novels[0].contextCaching?.caches).toEqual({});
    expect(value.payload.novels[0].chapterTargetCharacters).toBe(6000);
    expect(value.payload.novels[0].targetedGenerationEnabled).toBe(true);
    expect(value.payload.novels[0].chapterGenerationMode).toBe('single');
    expect(value.payload.novels[0].maxTokens).toBe(16384);
    expect(value.payload.novels[0].episodePacing?.scope).toBe('until-complete');
    expect(value.payload.novels[0].episodePacing?.destination).toContain('제한 구역');
    expect(value.payload.authors[0].generalChatHistory).toBeUndefined();
    expect(value.payload.authors[0].identityCore).toEqual(author.identityCore);
    expect(parseProductionPackage(value)?.package.title).toBe('기획 패키지');
  });

  it('rejects a workspace backup as a production package', () => {
    expect(parseProductionPackage({ kind: 'jinpok-workspace', novels: [], series: [], authors: [] })).toBeNull();
  });

  it('accepts the published AI production package example', () => {
    const examplePath = resolve(
      process.cwd(),
      'docs/production-package-kit/jinpok-production-package-v1.example.jinpok.json',
    );
    const example = JSON.parse(readFileSync(examplePath, 'utf8')) as unknown;

    expect(parseProductionPackage(example)?.package.title).toBe('기억 도시 기획 패키지');
  });

  it('records the original local ids for a later returned package', async () => {
    const value = createProductionPackage({
      workspace,
      authors: [author],
      novels: [novel],
      series: [],
      selectedAuthorIds: [author.id],
      selectedNovelIds: [novel.id],
      sections: PLANNING_PACKAGE_SECTIONS,
      purpose: 'planning',
      title: '왕복 패키지',
    });
    const receipt = await recordProductionPackageExport(workspace.id, value);

    expect(receipt.mode).toBe('export');
    expect(receipt.idMap.novels[novel.id]).toBe(novel.id);
    expect(rawStorage.get(`workspace:${workspace.id}:productionPackageReceipts`)).toHaveLength(1);
  });

  it('copies selected data with new ids while preserving relationships', async () => {
    const value = createProductionPackage({
      workspace,
      authors: [author],
      novels: [novel],
      series: [],
      selectedAuthorIds: [author.id],
      selectedNovelIds: [novel.id],
      sections: DELIVERY_PACKAGE_SECTIONS,
      purpose: 'delivery',
      title: '납품 패키지',
    });

    const result = await importProductionPackage(value, {
      targetWorkspaceId: 'workspace-target',
      mode: 'copy',
      sections: value.manifest.sections,
      selectedAuthorIds: [author.id],
      selectedNovelIds: [novel.id],
    });
    const importedAuthors = rawStorage.get('workspace:workspace-target:aiAuthors') as AiAuthor[];
    const importedNovels = rawStorage.get('workspace:workspace-target:novels') as Novel[];

    expect(result.importedAuthors).toBe(1);
    expect(result.importedNovels).toBe(1);
    expect(importedAuthors[0].id).not.toBe(author.id);
    expect(importedAuthors[0].identityCore).toEqual(author.identityCore);
    expect(importedNovels[0].id).not.toBe(novel.id);
    expect(importedNovels[0].aiAuthorId).toBe(importedAuthors[0].id);
    expect(importedNovels[0].chapters[0].id).not.toBe('chapter-source');
    expect(importedNovels[0].authorMemoryByAuthor?.[importedAuthors[0].id]).toEqual(['작품 전용 기억']);
    expect(importedNovels[0].contextCaching?.caches).toEqual({});
    expect(importedNovels[0].episodePacing?.scope).toBe('until-complete');
    expect(importedNovels[0].episodePacing?.destination).toContain('제한 구역');
  });

  it('remaps signed series-memory novel and volume IDs during copy import', async () => {
    const seriesNovel: Novel = { ...novel, seriesId: 'series-source', seriesVolumeId: 'volume-source', volumeNumber: 1 };
    const sourceSeries: Series = {
      id: 'series-source',
      title: '기억 도시 시리즈',
      seriesPlotSummary: '',
      characters: [],
      novelIds: [seriesNovel.id],
      createdAt: 1,
      blueprint: {
        worldview: '',
        mainConflict: '',
        characterArcs: '',
        lastUpdated: 1,
        volumes: [{
          id: 'volume-source',
          volumeNumber: 1,
          title: '1권',
          goal: '',
          mainConflict: '',
          keyEvents: '',
          status: 'drafting',
          linkedNovelId: seriesNovel.id,
        }],
      },
      seriesMemoryCompendium: '1권 기억',
      seriesMemoryState: {
        blocks: [{
          novelId: seriesNovel.id,
          volumeId: 'volume-source',
          volumeLabel: '1권',
          novelTitle: seriesNovel.title,
          sourceSignature: 'source-signature',
          content: '1권 기억',
          generatedAt: 1,
        }],
        combinedSignature: 'combined-signature',
        generatedAt: 1,
      },
    };
    const value = createProductionPackage({
      workspace,
      authors: [author],
      novels: [seriesNovel],
      series: [sourceSeries],
      selectedAuthorIds: [author.id],
      selectedNovelIds: [seriesNovel.id],
      sections: DELIVERY_PACKAGE_SECTIONS,
      purpose: 'delivery',
      title: '시리즈 기억 납품',
    });

    await importProductionPackage(value, {
      targetWorkspaceId: 'workspace-target',
      mode: 'copy',
      sections: value.manifest.sections,
      selectedAuthorIds: [author.id],
      selectedNovelIds: [seriesNovel.id],
    });
    const importedSeries = rawStorage.get('workspace:workspace-target:series') as Series[];
    const block = importedSeries[0].seriesMemoryState?.blocks[0];

    expect(block?.novelId).toBe(importedSeries[0].novelIds[0]);
    expect(block?.novelId).not.toBe(seriesNovel.id);
    expect(block?.volumeId).toBe(importedSeries[0].blueprint?.volumes[0].id);
    expect(block?.volumeId).not.toBe('volume-source');
  });

  it('merges only the selected worldbuilding layer and keeps the existing manuscript', async () => {
    const value = createProductionPackage({
      workspace,
      authors: [author],
      novels: [novel],
      series: [],
      selectedAuthorIds: [author.id],
      selectedNovelIds: [novel.id],
      sections: DELIVERY_PACKAGE_SECTIONS,
      purpose: 'delivery',
      title: '설정 납품',
    });
    const target: Novel = {
      ...novel,
      id: 'target-novel',
      title: '기존 작품',
      aiAuthorId: null,
      chapters: [{ id: 'target-chapter', title: '기존 1화', content: '절대 바뀌면 안 되는 본문' }],
      characters: [],
      worldviewFiles: [],
    };
    rawStorage.set('workspace:workspace-target:novels', [target]);
    rawStorage.set('workspace:workspace-target:aiAuthors', []);
    rawStorage.set('workspace:workspace-target:series', []);

    await importProductionPackage(value, {
      targetWorkspaceId: 'workspace-target',
      mode: 'merge',
      sections: {
        authors: false,
        workCore: false,
        planning: false,
        worldbuilding: true,
        manuscript: false,
        memory: false,
        collaboration: false,
        assets: false,
      },
      selectedAuthorIds: [],
      selectedNovelIds: [novel.id],
      targetNovelId: target.id,
    });
    const saved = rawStorage.get('workspace:workspace-target:novels') as Novel[];

    expect(saved[0].title).toBe('기존 작품');
    expect(saved[0].chapters).toEqual(target.chapters);
    expect(saved[0].characters[0].name).toBe('윤');
    expect(saved[0].worldviewFiles?.[0].filename).toBe('도시.txt');
  });
});
