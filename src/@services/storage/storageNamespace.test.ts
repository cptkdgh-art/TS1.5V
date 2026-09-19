import { afterEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from './storageKeys';
import {
  DEFAULT_WORKSPACE_ID,
  getWorkspaceStorageKey,
  resolveStorageKey,
  setActiveWorkspaceId,
} from './storageNamespace';

describe('workspace storage namespace', () => {
  afterEach(() => setActiveWorkspaceId(DEFAULT_WORKSPACE_ID));

  it('scopes creative data to the active workspace', () => {
    setActiveWorkspaceId('workspace-two');

    expect(resolveStorageKey(STORAGE_KEYS.NOVELS))
      .toBe('workspace:workspace-two:novels');
    expect(resolveStorageKey(STORAGE_KEYS.CHARACTER_CHAT_SESSIONS))
      .toBe('workspace:workspace-two:characterChatSessions');
  });

  it('keeps settings and the workspace registry global', () => {
    setActiveWorkspaceId('workspace-two');

    expect(resolveStorageKey(STORAGE_KEYS.SETTINGS)).toBe(STORAGE_KEYS.SETTINGS);
    expect(resolveStorageKey(STORAGE_KEYS.WORKSPACES)).toBe(STORAGE_KEYS.WORKSPACES);
  });

  it('builds stable keys from immutable workspace ids', () => {
    expect(getWorkspaceStorageKey('abc-123', STORAGE_KEYS.AUTHORS))
      .toBe('workspace:abc-123:aiAuthors');
  });
});
