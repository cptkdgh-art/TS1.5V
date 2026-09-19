import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceRegistry } from '@core/types';

const rawStorage = vi.hoisted(() => new Map<string, unknown>());

vi.mock('@services/storage', () => ({
  DEFAULT_WORKSPACE_ID: 'workspace-default',
  WORKSPACE_QUERY_PARAM: 'workspace',
  WORKSPACE_STORAGE_KEYS: ['aiAuthors', 'novels', 'series'],
  STORAGE_KEYS: {
    WORKSPACES: 'studioWorkspaces',
  },
  getRaw: async <T,>(key: string) => rawStorage.get(key) as T | undefined,
  setRaw: async (key: string, value: unknown) => {
    rawStorage.set(key, value);
  },
  getAllKeys: async () => [...rawStorage.keys()],
  setManyAndRemoveRaw: async (
    entries: ReadonlyArray<readonly [string, unknown]>,
    keys: ReadonlyArray<string>,
  ) => {
    for (const [key, value] of entries) rawStorage.set(key, value);
    for (const key of keys) rawStorage.delete(key);
  },
  getWorkspaceStorageKey: (workspaceId: string, key: string) => `workspace:${workspaceId}:${key}`,
  setActiveWorkspaceId: vi.fn(),
}));

import { deleteWorkspace } from './workspaceService';
import { withWorkspaceWrite, workspaceLifecycleKey } from '@services/storage/workspaceCoordination';

const now = 1_700_000_000_000;
const registry: WorkspaceRegistry = {
  schemaVersion: 1,
  legacyDataMigrated: true,
  workspaces: [
    { id: 'workspace-default', slot: 1, name: '기본 작업실', createdAt: now, updatedAt: now },
    { id: 'workspace-two', slot: 2, name: '삭제할 작업실', createdAt: now, updatedAt: now },
  ],
};

describe('workspace deletion', () => {
  beforeEach(() => {
    rawStorage.clear();
    rawStorage.set('studioWorkspaces', registry);
    rawStorage.set('workspace:workspace-default:novels', [{ id: 'keep' }]);
    rawStorage.set('workspace:workspace-two:novels', [{ id: 'delete' }]);
    rawStorage.set('workspace:workspace-two:futureCache', { cached: true });
    rawStorage.set('appSettings', { apiKey: 'keep-global' });
  });

  it('removes the complete workspace namespace and preserves other data', async () => {
    const result = await deleteWorkspace('workspace-two');

    expect(result.registry.workspaces.map((workspace) => workspace.id)).toEqual(['workspace-default']);
    expect(result.nextWorkspace.id).toBe('workspace-default');
    expect(rawStorage.has('workspace:workspace-two:novels')).toBe(false);
    expect(rawStorage.has('workspace:workspace-two:futureCache')).toBe(false);
    expect(rawStorage.get('workspace:workspace-default:novels')).toEqual([{ id: 'keep' }]);
    expect(rawStorage.get('appSettings')).toEqual({ apiKey: 'keep-global' });
    expect([...rawStorage.keys()].some(key => key.startsWith('workspace:workspace-two:'))).toBe(false);
    expect(rawStorage.get(workspaceLifecycleKey('workspace-two'))).toMatchObject({ deleted: true });
    await expect(withWorkspaceWrite('workspace-two', async () => { throw new Error('must not run'); })).rejects.toThrow('작업실');
  });

  it('protects the default workspace', async () => {
    await expect(deleteWorkspace('workspace-default')).rejects.toThrow('기본 작업실은 삭제할 수 없어요.');
    expect((rawStorage.get('studioWorkspaces') as WorkspaceRegistry).workspaces).toHaveLength(2);
  });

  it('protects the final remaining workspace', async () => {
    rawStorage.set('studioWorkspaces', {
      ...registry,
      workspaces: [registry.workspaces[1]],
    });

    await expect(deleteWorkspace('workspace-two')).rejects.toThrow('마지막 작업실은 삭제할 수 없어요.');
  });
});
