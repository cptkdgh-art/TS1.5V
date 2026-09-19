import type { StudioWorkspace, WorkspaceRegistry } from '@core/types';
import { REGISTRY_LOCK_NAME, withStorageLock, workspaceLockName } from '@services/storage/storageLocks';
import { notifyWorkspaceChanged, workspaceLifecycleKey } from '@services/storage/workspaceCoordination';
import {
  DEFAULT_WORKSPACE_ID,
  getAllKeys,
  getRaw,
  getWorkspaceStorageKey,
  setActiveWorkspaceId,
  setManyAndRemoveRaw,
  setRaw,
  STORAGE_KEYS,
  WORKSPACE_QUERY_PARAM,
  WORKSPACE_STORAGE_KEYS,
} from '@services/storage';

const REGISTRY_VERSION = 1 as const;
const DEFAULT_WORKSPACE_NAME = '기본 작업실';

let initializationPromise: Promise<WorkspaceInitialization> | null = null;

export interface WorkspaceInitialization {
  registry: WorkspaceRegistry;
  activeWorkspace: StudioWorkspace;
}

export interface WorkspaceDeletion {
  registry: WorkspaceRegistry;
  nextWorkspace: StudioWorkspace;
}

const createDefaultWorkspace = (): StudioWorkspace => {
  const now = Date.now();
  return {
    id: DEFAULT_WORKSPACE_ID,
    slot: 1,
    name: DEFAULT_WORKSPACE_NAME,
    createdAt: now,
    updatedAt: now,
  };
};

const createDefaultRegistry = (): WorkspaceRegistry => ({
  schemaVersion: REGISTRY_VERSION,
  workspaces: [createDefaultWorkspace()],
  legacyDataMigrated: false,
});

const normalizeRegistry = (value: WorkspaceRegistry | undefined): WorkspaceRegistry => {
  if (!value || !Array.isArray(value.workspaces) || value.workspaces.length === 0) {
    return createDefaultRegistry();
  }

  const workspaces = value.workspaces
    .filter((workspace) => workspace && typeof workspace.id === 'string')
    .map((workspace, index) => ({
      ...workspace,
      slot: Number.isInteger(workspace.slot) && workspace.slot > 0 ? workspace.slot : index + 1,
      name: workspace.name?.trim() || `작업실 ${index + 1}`,
    }))
    .sort((a, b) => a.slot - b.slot);

  return workspaces.length > 0
    ? { schemaVersion: REGISTRY_VERSION, workspaces, legacyDataMigrated: !!value.legacyDataMigrated }
    : createDefaultRegistry();
};

const saveRegistry = async (registry: WorkspaceRegistry): Promise<void> => {
  await setRaw(STORAGE_KEYS.WORKSPACES, registry);
};

const migrateLegacyWorkspaceData = async (registry: WorkspaceRegistry): Promise<WorkspaceRegistry> => {
  if (registry.legacyDataMigrated) {
    return registry;
  }

  for (const key of WORKSPACE_STORAGE_KEYS) {
    const legacyValue = await getRaw<unknown>(key);
    const defaultKey = getWorkspaceStorageKey(DEFAULT_WORKSPACE_ID, key);
    const migratedValue = await getRaw<unknown>(defaultKey);
    if (legacyValue !== undefined && migratedValue === undefined) {
      await setRaw(defaultKey, legacyValue);
    }
  }

  const migratedRegistry: WorkspaceRegistry = { ...registry, legacyDataMigrated: true };
  await saveRegistry(migratedRegistry);
  return migratedRegistry;
};

export const getWorkspaceUrl = (workspaceId: string): string => {
  const url = new URL(window.location.href);
  url.pathname = '/';
  url.searchParams.set(WORKSPACE_QUERY_PARAM, workspaceId);
  url.hash = '';
  return url.toString();
};

export const initializeWorkspace = (): Promise<WorkspaceInitialization> => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = withStorageLock(REGISTRY_LOCK_NAME, async () => {
    let registry = normalizeRegistry(await getRaw<WorkspaceRegistry>(STORAGE_KEYS.WORKSPACES));
    await saveRegistry(registry);
    registry = await withStorageLock(workspaceLockName(DEFAULT_WORKSPACE_ID), () => migrateLegacyWorkspaceData(registry));

    const requestedId = new URL(window.location.href).searchParams.get(WORKSPACE_QUERY_PARAM);
    const activeWorkspace = registry.workspaces.find((workspace) => workspace.id === requestedId)
      ?? registry.workspaces[0];

    setActiveWorkspaceId(activeWorkspace.id);

    if (requestedId !== activeWorkspace.id) {
      window.history.replaceState(null, '', getWorkspaceUrl(activeWorkspace.id));
    }

    return { registry, activeWorkspace };
  });

  return initializationPromise;
};

export const loadWorkspaceRegistry = async (): Promise<WorkspaceRegistry> =>
  normalizeRegistry(await getRaw<WorkspaceRegistry>(STORAGE_KEYS.WORKSPACES));

export const createWorkspace = async (name: string): Promise<StudioWorkspace> => withStorageLock(REGISTRY_LOCK_NAME, async () => {
  const registry = await loadWorkspaceRegistry();
  const now = Date.now();
  const slot = Math.max(0, ...registry.workspaces.map((workspace) => workspace.slot)) + 1;
  const workspace: StudioWorkspace = {
    id: crypto.randomUUID(),
    slot,
    name: name.trim() || `새 작업실 ${slot}`,
    createdAt: now,
    updatedAt: now,
  };

  await saveRegistry({ ...registry, workspaces: [...registry.workspaces, workspace] });
  return workspace;
});

export const renameWorkspace = async (workspaceId: string, name: string): Promise<WorkspaceRegistry> => withStorageLock(REGISTRY_LOCK_NAME, async () => {
  const registry = await loadWorkspaceRegistry();
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('작업실 이름을 입력해 주세요.');
  }

  const nextRegistry: WorkspaceRegistry = {
    ...registry,
    workspaces: registry.workspaces.map((workspace) => workspace.id === workspaceId
      ? { ...workspace, name: trimmedName, updatedAt: Date.now() }
      : workspace),
  };
  await saveRegistry(nextRegistry);
  return nextRegistry;
});

export const deleteWorkspace = async (workspaceId: string): Promise<WorkspaceDeletion> => withStorageLock(REGISTRY_LOCK_NAME, () => withStorageLock(workspaceLockName(workspaceId), async () => {
  const registry = await loadWorkspaceRegistry();
  const targetIndex = registry.workspaces.findIndex((workspace) => workspace.id === workspaceId);
  if (targetIndex < 0) {
    throw new Error('삭제할 작업실을 찾지 못했어요.');
  }
  if (workspaceId === DEFAULT_WORKSPACE_ID) {
    throw new Error('기본 작업실은 삭제할 수 없어요.');
  }
  if (registry.workspaces.length <= 1) {
    throw new Error('마지막 작업실은 삭제할 수 없어요.');
  }

  const remainingWorkspaces = registry.workspaces.filter((workspace) => workspace.id !== workspaceId);
  const nextWorkspace = remainingWorkspaces[Math.max(0, targetIndex - 1)] ?? remainingWorkspaces[0];
  const nextRegistry: WorkspaceRegistry = { ...registry, workspaces: remainingWorkspaces };
  const namespacePrefix = getWorkspaceStorageKey(workspaceId, '');
  const namespaceKeys = (await getAllKeys()).filter(
    (key) => typeof key === 'string' && key.startsWith(namespacePrefix) && key !== workspaceLifecycleKey(workspaceId),
  );

  await setManyAndRemoveRaw(
    [
      [STORAGE_KEYS.WORKSPACES, nextRegistry],
      [workspaceLifecycleKey(workspaceId), { generation: crypto.randomUUID(), deleted: true }],
    ],
    namespaceKeys,
  );
  notifyWorkspaceChanged({ workspaceId, kind: 'deleted' });
  return { registry: nextRegistry, nextWorkspace };
}));
