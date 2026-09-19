import { WORKSPACE_STORAGE_KEYS } from './storageKeys';

export const DEFAULT_WORKSPACE_ID = 'workspace-default';
export const WORKSPACE_QUERY_PARAM = 'workspace';

const workspaceStorageKeys = new Set<string>(WORKSPACE_STORAGE_KEYS);

let activeWorkspaceId = DEFAULT_WORKSPACE_ID;

export const setActiveWorkspaceId = (workspaceId: string): void => {
  activeWorkspaceId = workspaceId || DEFAULT_WORKSPACE_ID;
};

export const getActiveWorkspaceId = (): string => activeWorkspaceId;

export const isWorkspaceStorageKey = (key: string): boolean => workspaceStorageKeys.has(key);

export const getWorkspaceStorageKey = (workspaceId: string, key: string): string =>
  `workspace:${workspaceId}:${key}`;

export const resolveStorageKey = (key: string): string =>
  isWorkspaceStorageKey(key) ? getWorkspaceStorageKey(activeWorkspaceId, key) : key;
