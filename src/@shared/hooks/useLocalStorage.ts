/**
 * ============================================================
 * @module shared/hooks
 * @file useLocalStorage.ts
 * ============================================================
 * @description localStorage 동기화 훅
 * - 탭 간 동기화 지원 (storage 이벤트)
 * - 같은 페이지 내 동기화 (CustomEvent)
 * ============================================================
 */

import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';

const CUSTOM_EVENT_NAME = 'onLocalStorageChange';

/**
 * localStorage와 동기화되는 상태 훅
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`[useLocalStorage] Failed to read key "${key}":`, error);
      return initialValue;
    }
  });

  // 다른 탭/윈도우에서의 변경 감지
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.error(`[useLocalStorage] Failed to parse storage event for "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  // 같은 페이지 내 다른 훅 인스턴스에서의 변경 감지
  useEffect(() => {
    const handleCustomEvent = (event: CustomEvent<{ key: string; value: T }>) => {
      if (event.detail.key === key) {
        setStoredValue(event.detail.value);
      }
    };

    window.addEventListener(CUSTOM_EVENT_NAME, handleCustomEvent as EventListener);
    return () => window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomEvent as EventListener);
  }, [key]);

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (value) => {
      setStoredValue((currentValue) => {
        const valueToStore = value instanceof Function ? value(currentValue) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          // 같은 페이지 내 다른 훅 인스턴스에 알림
          window.dispatchEvent(
            new CustomEvent(CUSTOM_EVENT_NAME, {
              detail: { key, value: valueToStore },
            })
          );
        } catch (error) {
          console.error(`[useLocalStorage] Failed to set key "${key}":`, error);
        }
        return valueToStore;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
