/**
 * ============================================================
 * @module shared/hooks
 * @file useIndexedDB.ts
 * ============================================================
 * @description IndexedDB 동기화 훅
 * - localStorage → IndexedDB 자동 마이그레이션
 * - 대용량 데이터 저장에 최적화
 * ============================================================
 */

import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { get, set } from '@services/storage';
import { logger } from '@shared/utils/logger';

/**
 * IndexedDB와 동기화되는 상태 훅
 * @returns [storedValue, setValue, loading]
 */
export function useIndexedDB<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    const loadData = async () => {
      try {
        // localStorage에서 마이그레이션 확인
        const oldDataRaw = window.localStorage.getItem(key);
        let dataToSet: T = initialValue;
        let loaded = false;

        if (oldDataRaw) {
          logger.log(`[useIndexedDB] Migrating "${key}" from localStorage to IndexedDB...`);
          const oldData = JSON.parse(oldDataRaw) as T;
          await set(key, oldData);
          window.localStorage.removeItem(key);
          dataToSet = oldData;
          loaded = true;
        } else {
          // IndexedDB에서 로드
          const value = await get<T>(key);
          if (value !== undefined) {
            dataToSet = value;
            loaded = true;
          }
        }

        if (isMounted.current && loaded) {
          setStoredValue(dataToSet);
        }
      } catch (error) {
        console.error(`[useIndexedDB] Failed to load or migrate "${key}":`, error);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted.current = false;
    };
  }, [key, initialValue]);

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (value) => {
      setStoredValue((currentValue) => {
        const valueToStore = value instanceof Function ? value(currentValue) : value;
        set(key, valueToStore).catch((error) => {
          console.error(`[useIndexedDB] Failed to set "${key}":`, error);
        });
        return valueToStore;
      });
    },
    [key]
  );

  return [storedValue, setValue, loading];
}
