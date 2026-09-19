import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Novel } from '@core/types';

const database = vi.hoisted(() => new Map<string, unknown>());
vi.mock('@services/storage', () => ({
  get: async (key: string) => database.get(key),
  getRaw: async (key: string) => database.get(key),
  getWorkspaceStorageKey: (workspaceId: string, key: string) => `${workspaceId}:${key}`,
  set: async (key: string, value: unknown) => { database.set(key, structuredClone(value)); },
  setRaw: async (key: string, value: unknown) => { database.set(key, structuredClone(value)); },
  getActiveWorkspaceId: () => 'audit',
  migrateFromLocalStorage: vi.fn(),
  STORAGE_KEYS: { NOVELS: 'novels', AI_AUTHORS: 'authors', SERIES: 'series' },
}));

import { useNovelStore } from '@stores/novelStore';
import { handleBridgeCommand } from '@services/bridge';
import { inspectCanonFacts } from '@services/novel/canonLedger';

beforeEach(() => {
  database.clear();
  const novel = {
    id: 'audit', title: 'Audit', subject: '', mood: '', plotSummary: '',
    history: [], characters: [], aiAuthorId: null, createdAt: 1,
    chapters: [{
      id: 'chapter-1', title: 'First', content: 'The key belongs to A.',
      trace: { revision: 1, source: 'ai', createdAt: 1, updatedAt: 1 },
    }],
    canonFacts: [{
      id: 'fact-1', subject: 'Key', value: 'Owned by A', category: 'possession',
      status: 'confirmed', sourceChapterId: 'chapter-1', sourceRevision: 1,
      createdAt: 1, updatedAt: 1,
    }],
  } as Novel;
  useNovelStore.setState({ novels: [novel] });
});

describe('Review regressions: bridge chapter invariants', () => {
  it('rejects malformed chapter content without changing manuscript', async () => {
    await expect(handleBridgeCommand('addChapter', {
      novelId: 'audit', chapter: { title: 'Bad', content: { html: 'invalid' } },
    })).rejects.toThrow();
    expect(useNovelStore.getState().novels[0].chapters).toHaveLength(1);
  });

  it('uses stable chapter IDs and rejects stale revisions', async () => {
    await handleBridgeCommand('updateChapter', {
      novelId: 'audit', chapterId: 'chapter-1', expectedRevision: 1, updates: { content: 'Changed.' },
    });
    await expect(handleBridgeCommand('updateChapter', {
      novelId: 'audit', chapterId: 'chapter-1', expectedRevision: 1, updates: { content: 'Stale.' },
    })).rejects.toThrow();
    expect(useNovelStore.getState().novels[0].chapters[0].content).toBe('Changed.');
  });

  it('assigns stable identity when a bridge chapter is saved', async () => {
    await handleBridgeCommand('addChapter', {
      novelId: 'audit', chapter: { title: 'Second', content: 'New chapter.' },
    });
    const chapter = useNovelStore.getState().novels[0].chapters[1];
    expect(chapter.content).toBe('New chapter.');
    expect(chapter.id).toEqual(expect.any(String));
    expect(chapter.trace?.revision).toBe(1);
  });

  it('marks prior Canon for review when the bridge changes its source chapter', async () => {
    await handleBridgeCommand('updateChapter', {
      novelId: 'audit', chapterIndex: 0, updates: { content: 'The key was destroyed.' },
    });
    const novel = useNovelStore.getState().novels[0];
    expect(novel.chapters[0].content).toBe('The key was destroyed.');
    expect(inspectCanonFacts(novel)[0].sourceChanged).toBe(true);
    expect(inspectCanonFacts(novel)[0].active).toBe(false);
  });
});
