/**
 * ============================================================
 * @module services/tts/modelStore
 * @file modelStore.ts
 * ============================================================
 * @description ONNX 모델 저장소 (IndexedDB)
 * - 사용자가 업로드한 음성 모델 저장
 * - 모델 메타데이터 관리
 * - 브라우저 로컬 스토리지 활용
 * ============================================================
 */

const DB_NAME = 'jinpok-tts-models';
const DB_VERSION = 1;
const STORE_NAME = 'models';
const META_STORE_NAME = 'metadata';

export interface ModelMetadata {
  id: string;
  name: string;
  language: string;
  description?: string;
  size: number;
  createdAt: number;
  type: 'piper' | 'custom';
}

/**
 * IndexedDB 초기화
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 모델 바이너리 저장소
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }

      // 메타데이터 저장소
      if (!db.objectStoreNames.contains(META_STORE_NAME)) {
        const metaStore = db.createObjectStore(META_STORE_NAME, { keyPath: 'id' });
        metaStore.createIndex('language', 'language', { unique: false });
        metaStore.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

/**
 * 모델 저장
 */
export async function saveModel(
  id: string,
  modelData: ArrayBuffer,
  metadata: Omit<ModelMetadata, 'id' | 'size' | 'createdAt'>
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, META_STORE_NAME], 'readwrite');

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();

    // 모델 데이터 저장
    const modelStore = transaction.objectStore(STORE_NAME);
    modelStore.put({ id, data: modelData });

    // 메타데이터 저장
    const metaStore = transaction.objectStore(META_STORE_NAME);
    const fullMetadata: ModelMetadata = {
      ...metadata,
      id,
      size: modelData.byteLength,
      createdAt: Date.now(),
    };
    metaStore.put(fullMetadata);
  });
}

/**
 * 모델 로드
 */
export async function loadModel(id: string): Promise<ArrayBuffer | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result?.data || null);
    };
  });
}

/**
 * 모델 메타데이터 조회
 */
export async function getModelMetadata(id: string): Promise<ModelMetadata | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(META_STORE_NAME, 'readonly');
    const store = transaction.objectStore(META_STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * 모든 모델 메타데이터 조회
 */
export async function getAllModelMetadata(): Promise<ModelMetadata[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(META_STORE_NAME, 'readonly');
    const store = transaction.objectStore(META_STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * 언어별 모델 조회
 */
export async function getModelsByLanguage(language: string): Promise<ModelMetadata[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(META_STORE_NAME, 'readonly');
    const store = transaction.objectStore(META_STORE_NAME);
    const index = store.index('language');
    const request = index.getAll(language);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * 모델 삭제
 */
export async function deleteModel(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, META_STORE_NAME], 'readwrite');

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();

    transaction.objectStore(STORE_NAME).delete(id);
    transaction.objectStore(META_STORE_NAME).delete(id);
  });
}

/**
 * 전체 저장 용량 계산
 */
export async function getTotalStorageSize(): Promise<number> {
  const metadata = await getAllModelMetadata();
  return metadata.reduce((total, model) => total + model.size, 0);
}

/**
 * 모델 존재 여부 확인
 */
export async function hasModel(id: string): Promise<boolean> {
  const metadata = await getModelMetadata(id);
  return metadata !== null;
}
