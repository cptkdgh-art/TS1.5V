import { logger } from '@shared/utils/logger';
import { DEFAULT_WORKSPACE_ID, getActiveWorkspaceId, isWorkspaceStorageKey, resolveStorageKey } from './storageNamespace';

/** IndexedDB low-level wrapper. */
const DB_NAME = 'JinpokStidoDB';
const DB_VERSION = 1;
const STORE_NAME = 'KeyValueStore';

let dbPromise: Promise<IDBDatabase> | null = null;

export const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      console.error('[IndexedDB] connection error:', request.error);
      reject(request.error);
    };
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
  });

  return dbPromise;
};

export const getRaw = async <T>(key: string): Promise<T | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T);
  });
};

export const get = async <T>(key: string): Promise<T | undefined> =>
  getRaw<T>(resolveStorageKey(key));

export const setRaw = async <T>(key: string, value: T): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(
      tx.error ?? new DOMException('IndexedDB save was aborted.', 'AbortError'),
    );
    tx.objectStore(STORE_NAME).put(value, key);
  });
};

export const setManyRaw = async (entries: ReadonlyArray<readonly [string, unknown]>): Promise<void> => {
  if (entries.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(
      tx.error ?? new DOMException('IndexedDB batch save was aborted.', 'AbortError'),
    );
    for (const [key, value] of entries) {
      store.put(value, key);
    }
  });
};

export const setManyAndRemoveRaw = async (
  entries: ReadonlyArray<readonly [string, unknown]>,
  keys: ReadonlyArray<IDBValidKey>,
): Promise<void> => {
  if (entries.length === 0 && keys.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(
      tx.error ?? new DOMException('IndexedDB batch update was aborted.', 'AbortError'),
    );
    for (const [key, value] of entries) {
      store.put(value, key);
    }
    for (const key of keys) {
      store.delete(key);
    }
  });
};

export const set = async <T>(key: string, value: T): Promise<void> => {
  const workspaceId = getActiveWorkspaceId();
  const resolvedKey = resolveStorageKey(key);
  if (!isWorkspaceStorageKey(key)) return setRaw(resolvedKey, value);
  const { withWorkspaceWrite } = await import('./workspaceCoordination');
  return withWorkspaceWrite(workspaceId, () => setRaw(resolvedKey, value));
};

export const removeRaw = async (key: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(
      tx.error ?? new DOMException('IndexedDB delete was aborted.', 'AbortError'),
    );
    tx.objectStore(STORE_NAME).delete(key);
  });
};

export const remove = async (key: string): Promise<void> => {
  const workspaceId = getActiveWorkspaceId();
  const resolvedKey = resolveStorageKey(key);
  if (!isWorkspaceStorageKey(key)) return removeRaw(resolvedKey);
  const { withWorkspaceWrite } = await import('./workspaceCoordination');
  return withWorkspaceWrite(workspaceId, () => removeRaw(resolvedKey));
};

export const getAllKeys = async (): Promise<IDBValidKey[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAllKeys();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const migrateFromLocalStorage = async (key: string): Promise<boolean> => {
  // 구버전 데이터는 오직 기본 작업실의 빈 저장소로만 이관한다.
  if (getActiveWorkspaceId() !== DEFAULT_WORKSPACE_ID) {
    return false;
  }

  const oldDataRaw = window.localStorage.getItem(key);
  if (!oldDataRaw) {
    return false;
  }
  const workspaceId = getActiveWorkspaceId();
  const resolvedKey = resolveStorageKey(key);
  const { withWorkspaceWrite } = await import('./workspaceCoordination');
  return withWorkspaceWrite(workspaceId, async () => {
  if (await getRaw<unknown>(resolvedKey) !== undefined) {
    logger.log(`[IndexedDB] ${key} migration skipped: destination already has data.`);
    return false;
  }

  logger.log(`[IndexedDB] ${key} localStorage -> IndexedDB migration...`);
  await setRaw(resolvedKey, JSON.parse(oldDataRaw));
  window.localStorage.removeItem(key);
  return true;
  });
};
