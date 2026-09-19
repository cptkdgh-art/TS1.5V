import { beforeEach, expect, it, vi } from 'vitest';
import { parseWorkspaceBackupContent, writeWorkspaceBackupContent } from '@services/studio-backup/workspaceBackup';
import { importProductionPackage } from '@services/production-package/importer';
import { useAuthorStore } from '@stores/authorStore';
import { useNovelStore } from '@stores/novelStore';
import { createWorkspace } from '@services/workspace/workspaceService';
import { getWorkspaceGeneration, withWorkspaceWrite } from '@services/storage/workspaceCoordination';

const h = vi.hoisted(() => ({
  db: new Map<string, unknown>(),
  gate: undefined as Promise<void> | undefined,
  onWrite: undefined as (() => void) | undefined,
}));
vi.mock('@services/storage', () => {
  const keys = { AUTHORS: 'aiAuthors', NOVELS: 'novels', SERIES: 'series', WORKSPACES: 'studioWorkspaces', PRODUCTION_PACKAGE_RECEIPTS: 'productionPackageReceipts' };
  const put = async (k: string, v: unknown) => { h.db.set(k, structuredClone(v)); };
  return {
    STORAGE_KEYS: keys, DEFAULT_WORKSPACE_ID: 'workspace-default', WORKSPACE_QUERY_PARAM: 'workspace',
    WORKSPACE_STORAGE_KEYS: ['aiAuthors', 'novels', 'series', 'productionPackageReceipts'],
    getWorkspaceStorageKey: (w: string, k: string) => `workspace:${w}:${k}`,
    getActiveWorkspaceId: () => 'B', setActiveWorkspaceId: vi.fn(),
    getRaw: async (k: string) => structuredClone(h.db.get(k)),
    setRaw: async (k: string, v: unknown) => {
      if (k === 'workspace:B:novels' && h.gate) { h.onWrite?.(); await h.gate; }
      await put(k, v);
    },
    get: async (k: string) => structuredClone(h.db.get(`workspace:B:${k}`)),
    set: async (k: string, v: unknown) => {
      if (k === 'novels' && h.gate) { h.onWrite?.(); await h.gate; }
      await put(`workspace:B:${k}`, v);
    },
    setManyRaw: async (entries: ReadonlyArray<readonly [string, unknown]>) => {
      for (const [k, v] of entries) h.db.set(k, structuredClone(v));
    },
    migrateFromLocalStorage: async () => false,
  };
});
vi.mock('@core/constants', () => ({ DEFAULT_AUTHORS: [], FIXED_RECENT_RAW_CHAPTERS: 3 }));
vi.mock('@services/ai/authorProfile', () => ({ updateAuthorWithProfileHistory: (a: object, u: object) => ({ ...a, ...u }) }));
vi.mock('@services/character-chat', () => ({ parseCharacterChatBackup: (v: unknown) => v }));
vi.mock('@services/director-clio', () => ({ parseDirectorClioBackup: (v: unknown) => v }));

const author = (id: string) => ({ id, name: id, specialty: '', writingStyle: '', coreDirectives: '', createdAt: 1 });
const novel = (id: string) => ({ id, title: id, subject: '', mood: '', plotSummary: '', chapters: [], history: [], createdAt: 1, aiAuthorId: null, characters: [] });

beforeEach(async () => {
  h.db.clear();
  h.gate = undefined;
  h.onWrite = undefined;
  useAuthorStore.setState({ authors: [], isLoading: false });
  useNovelStore.setState({ novels: [], selectedNovelId: null, isLoading: false });
  await withWorkspaceWrite('B', async () => undefined, { refresh: true });
});

it('rejects damaged backup before replacing healthy manuscripts', async () => {
  const original = [novel('original')];
  h.db.set('workspace:B:novels', original);
  const parsed = parseWorkspaceBackupContent({ novels: [{ id: 'broken', title: 'Broken' }], series: [], authors: [] });
  if (parsed) await writeWorkspaceBackupContent('B', parsed);
  expect(parsed).toBeNull();
  expect(h.db.get('workspace:B:novels')).toEqual(original);
});

it('normalizes legacy recent-manuscript windows and schedules summary repair', async () => {
  const legacy = {
    ...novel('legacy-memory'),
    contextManagement: { isEnabled: true, fullTextChapters: 1, summaryTriggerChapters: 5 },
    contextCaching: { isEnabled: true, activeBufferWindow: 5, caches: {} },
    contextSummary: { content: 'legacy summary', summarizedChapters: 0, createdAt: 1 },
  };
  h.db.set('workspace:B:novels', [legacy]);

  await useNovelStore.getState().loadNovels();

  const saved = (h.db.get('workspace:B:novels') as Array<typeof legacy>)[0];
  expect(saved.contextManagement.fullTextChapters).toBe(3);
  expect(saved.contextCaching.activeBufferWindow).toBe(3);
  expect(saved.contextSummary.needsRecheck).toBe(true);
});

it('preserves imported authors when an already-open workspace adds an author', async () => {
  await useAuthorStore.getState().addAuthor(author('existing'));
  const pkg = { package: { lineageId: 'L', packageId: 'P', revision: 1 }, payload: { authors: [author('imported')], novels: [], series: [] } };
  await importProductionPackage(pkg as unknown as Parameters<typeof importProductionPackage>[0], {
    targetWorkspaceId: 'B', mode: 'copy', selectedAuthorIds: ['imported'], selectedNovelIds: [],
    sections: { authors: true, workCore: false, worldbuilding: false, planning: false, manuscript: false, memory: false, collaboration: false, assets: false },
  });
  expect((h.db.get('workspace:B:aiAuthors') as Array<{ name: string }>).map(a => a.name)).toContain('imported');
  await useAuthorStore.getState().addAuthor(author('local'));
  expect((h.db.get('workspace:B:aiAuthors') as Array<{ name: string }>).map(a => a.name)).toEqual(['existing', 'imported', 'local']);
});

it('preserves concurrent author additions and does not revive a deleted author', async () => {
  await Promise.all([useAuthorStore.getState().addAuthor(author('one')), useAuthorStore.getState().addAuthor(author('two'))]);
  expect((h.db.get('workspace:B:aiAuthors') as Array<{ id: string }>).map(a => a.id)).toEqual(['one', 'two']);
  h.db.set('workspace:B:aiAuthors', [author('two')]);
  await useAuthorStore.getState().updateAuthor('one', { name: 'Late response' });
  expect(h.db.get('workspace:B:aiAuthors')).toEqual([author('two')]);
});

it('prevents a pre-restore write from replacing the restored workspace', async () => {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>(r => { enter = r; });
  h.onWrite = enter;
  h.gate = new Promise<void>(r => { release = r; });
  h.db.set('workspace:B:novels', [novel('old')]);
  const pending = useNovelStore.getState().updateNovel('old', { title: 'Edited' });
  await entered;
  // Restore must wait for the writer holding the shared lock. Releasing only
  // after awaiting restore would deadlock a correctly serialized implementation.
  const restored = writeWorkspaceBackupContent('B', { novels: [novel('restored')], series: [], authors: [] });
  release();
  await Promise.all([pending, restored]);
  expect(h.db.get('workspace:B:novels')).toEqual(parseWorkspaceBackupContent({ novels: [novel('restored')], series: [], authors: [] })!.novels);
});

it('preserves both successful concurrent workspace creations', async () => {
  h.db.set('studioWorkspaces', {
    schemaVersion: 1, legacyDataMigrated: true,
    workspaces: [{ id: 'workspace-default', slot: 1, name: 'Base', createdAt: 1, updatedAt: 1 }],
  });
  const created = await Promise.all([createWorkspace('A'), createWorkspace('B')]);
  const saved = (h.db.get('studioWorkspaces') as { workspaces: Array<{ id: string }> }).workspaces;
  expect(saved.map(w => w.id)).toEqual(expect.arrayContaining(created.map(w => w.id)));
  expect(new Set(created.map(w => w.slot)).size).toBe(2);
});

it('validates direct restore callers before any transaction', async () => {
  h.db.set('workspace:B:novels', [novel('healthy')]);
  await expect(writeWorkspaceBackupContent('B', { novels: [null], series: [], authors: [] } as unknown as Parameters<typeof writeWorkspaceBackupContent>[1])).rejects.toThrow();
  expect(h.db.get('workspace:B:novels')).toEqual([novel('healthy')]);
});

it('rejects old-generation callbacks even when restored work retains the same ID', async () => {
  h.db.set('workspace:B:novels', [novel('same')]);
  const expectedGeneration = getWorkspaceGeneration('B');
  await writeWorkspaceBackupContent('B', { novels: [{ ...novel('same'), title: 'Restored' }], series: [], authors: [] });
  await expect(useNovelStore.getState().updateNovel('same', { title: 'Late' })).rejects.toThrow('작업실');
  await useNovelStore.getState().loadNovels();
  await expect(withWorkspaceWrite('B', async () => { throw new Error('must not run'); }, { expectedGeneration })).rejects.toThrow('작업실');
  expect((h.db.get('workspace:B:novels') as Array<{ title: string }>)[0].title).toBe('Restored');
  await useNovelStore.getState().updateNovel('same', { title: 'New edit' });
  expect((h.db.get('workspace:B:novels') as Array<{ title: string }>)[0].title).toBe('New edit');
});

it('rejects queued pre-restore writes after the replacement and recovers the queue', async () => {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  h.onWrite = enter;
  h.gate = new Promise<void>(resolve => { release = resolve; });
  h.db.set('workspace:B:novels', [novel('same')]);
  const first = useNovelStore.getState().updateNovel('same', { title: 'Before' });
  await entered;
  const restored = writeWorkspaceBackupContent('B', { novels: [{ ...novel('same'), title: 'Restored' }], series: [], authors: [] });
  const stale = useNovelStore.getState().updateNovel('same', { title: 'Stale queued write' });
  const rejected = expect(stale).rejects.toThrow('작업실');
  release();
  await Promise.all([first, restored, rejected]);
  expect((h.db.get('workspace:B:novels') as Array<{ title: string }>)[0].title).toBe('Restored');
});

it('applies author callbacks by ID and skips rejected or deleted targets without restoring old arrays', async () => {
  await useAuthorStore.getState().addAuthor(author('one'));
  h.db.set('workspace:B:aiAuthors', [author('one'), author('external')]);
  const updated = await useAuthorStore.getState().mutateAuthor('one', latest => ({ ...latest, name: 'Updated', id: 'wrong' }));
  expect(updated?.id).toBe('one');
  expect((h.db.get('workspace:B:aiAuthors') as Array<{ id: string }>).map(a => a.id)).toEqual(['one', 'external']);
  expect(await useAuthorStore.getState().mutateAuthor('one', () => undefined)).toBeUndefined();
  h.db.set('workspace:B:aiAuthors', [author('external')]);
  expect(await useAuthorStore.getState().mutateAuthor('one', () => author('one'))).toBeUndefined();
  expect(h.db.get('workspace:B:aiAuthors')).toEqual([author('external')]);
});
