/**
 * ============================================================
 * @module stores/authorStore
 * @file authorStore.ts
 * ============================================================
 * @description AI 작가 상태 관리 (Zustand)
 * ============================================================
 */

import { create } from 'zustand';
import type { AiAuthor } from '@core/types';
import { DEFAULT_AUTHORS } from '@core/constants';
import { getActiveWorkspaceId, getRaw, getWorkspaceStorageKey, setRaw, migrateFromLocalStorage } from '@services/storage';
import { subscribeWorkspaceChanges, withWorkspaceWrite } from '@services/storage/workspaceCoordination';
import { STORAGE_KEYS } from '@services/storage';
import { logger } from '@shared/utils/logger';
import { updateAuthorWithProfileHistory } from '@services/ai/authorProfile';
import { migrateAuthorIdentities } from '@services/ai/authorIdentity';

function mutateAuthors(mutation: (latest: AiAuthor[]) => AiAuthor[], expectedGeneration?: string): Promise<AiAuthor[]> {
  const workspaceId = getActiveWorkspaceId();
  return withWorkspaceWrite(workspaceId, async () => {
    const key = getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.AUTHORS);
    const latest = await getRaw<AiAuthor[]>(key) ?? [];
    const next = mutation(latest);
    if (next !== latest) await setRaw(key, next);
    return next;
  }, { expectedGeneration });
}

interface AuthorState {
  authors: AiAuthor[];
  selectedAuthorId: string | null;
  isLoading: boolean;

  // Actions
  loadAuthors: () => Promise<void>;
  addAuthor: (author: AiAuthor) => Promise<void>;
  updateAuthor: (id: string, updates: Partial<AiAuthor>) => Promise<void>;
  mutateAuthor: (id: string, updater: (latest: AiAuthor) => AiAuthor | undefined, expectedGeneration?: string) => Promise<AiAuthor | undefined>;
  deleteAuthor: (id: string) => Promise<void>;
  setAuthors: (authors: AiAuthor[]) => Promise<void>; // 전체 교체
  selectAuthor: (id: string | null) => void;
  getAuthorById: (id: string) => AiAuthor | undefined;
}

export const useAuthorStore = create<AuthorState>((setState, getState) => ({
  authors: [],
  selectedAuthorId: null,
  isLoading: true,

  loadAuthors: async () => {
    try {
      // localStorage 마이그레이션 체크
      await migrateFromLocalStorage(STORAGE_KEYS.AUTHORS);
      const workspaceId = getActiveWorkspaceId();
      await withWorkspaceWrite(workspaceId, async () => {
      const key = getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.AUTHORS);
      let authors = await getRaw<AiAuthor[]>(key);

      // 기본 작가가 없으면 추가
      if (!authors || authors.length === 0) {
        authors = [...DEFAULT_AUTHORS];
        await setRaw(key, authors);
      } else {
        let updated = false;

        // [마이그레이션] 삭제된 기본 프리셋만 제거한다. 사용자 작가는 이름이 같아도 보존한다.
        const removedAuthorNames = new Set(['만능 작가', '볼트', 'versatile', 'volt']);
        const beforeCount = authors.length;
        authors = authors.filter((a) => {
          const isRemoved = a.isDefault === true && removedAuthorNames.has(a.name.trim().toLowerCase());
          return !isRemoved;
        });
        if (authors.length !== beforeCount) {
          updated = true;
          logger.log('[AuthorStore] 삭제된 기본 작가 제거:', beforeCount - authors.length, '명');
        }

        // 기존 사용자 프로필은 그대로 보존하고, 빠진 정체성 코어만 안전하게 심는다.
        const migratedAuthors = migrateAuthorIdentities(authors, DEFAULT_AUTHORS);
        if (migratedAuthors !== authors) {
          authors = migratedAuthors;
          updated = true;
        }

        // 기존 작가 목록에 기본 작가가 빠진 게 있으면 추가
        const existingIds = new Set(authors.map((a) => a.id));
        for (const defaultAuthor of DEFAULT_AUTHORS) {
          if (!existingIds.has(defaultAuthor.id)) {
            authors.push(defaultAuthor);
            updated = true;
          }
        }

        if (updated) {
          await setRaw(key, authors);
        }
      }

      setState({ authors, isLoading: false });
      }, { refresh: true });
    } catch (error) {
      console.error('[AuthorStore] 로드 실패:', error);
      setState({ isLoading: false });
    }
  },

  addAuthor: async (author) => {
    const normalizedAuthor = migrateAuthorIdentities([author], DEFAULT_AUTHORS)[0];
    const newAuthors = await mutateAuthors((latest) => {
      if (latest.some((item) => item.id === normalizedAuthor.id)) throw new Error('이미 존재하는 작가 ID예요.');
      return [...latest, normalizedAuthor];
    });
    setState({ authors: newAuthors });
  },

  updateAuthor: async (id, updates) => {
    const newAuthors = await mutateAuthors((latest) => latest.map((a) =>
      a.id === id ? updateAuthorWithProfileHistory(a, { ...updates, id }) : a
    ));
    setState({ authors: newAuthors });
  },

  mutateAuthor: async (id, updater, expectedGeneration) => {
    let updated: AiAuthor | undefined;
    const authors = await mutateAuthors((latest) => {
      const index = latest.findIndex((item) => item.id === id);
      if (index < 0) return latest;
      const candidate = updater(latest[index]);
      if (!candidate) return latest;
      updated = { ...candidate, id };
      return latest.map((item, position) => position === index ? updated! : item);
    }, expectedGeneration);
    setState({ authors });
    return updated;
  },

  deleteAuthor: async (id) => {
    const { selectedAuthorId } = getState();
    const newAuthors = await mutateAuthors((latest) => latest.filter((a) => a.id !== id));
    setState({
      authors: newAuthors,
      selectedAuthorId: selectedAuthorId === id ? null : selectedAuthorId,
    });
  },

  setAuthors: async (newAuthors) => {
    const normalizedAuthors = migrateAuthorIdentities(newAuthors, DEFAULT_AUTHORS);
    await mutateAuthors(() => normalizedAuthors);
    setState({ authors: normalizedAuthors });
  },

  selectAuthor: (id) => {
    setState({ selectedAuthorId: id });
  },

  getAuthorById: (id) => {
    return getState().authors.find((a) => a.id === id);
  },
}));

subscribeWorkspaceChanges(({ workspaceId, kind }) => {
  if (workspaceId !== getActiveWorkspaceId() || kind !== 'updated') return;
  void withWorkspaceWrite(workspaceId, async () => {
    const authors = await getRaw<AiAuthor[]>(getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.AUTHORS)) ?? [];
    useAuthorStore.setState({ authors });
  }).catch(() => undefined);
});
