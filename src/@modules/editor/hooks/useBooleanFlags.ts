import { useCallback, useState } from 'react';

/**
 * boolean 플래그를 단일 객체 상태로 관리.
 * 관련 도메인(예: busy 상태, 모달 open/close)의 수많은 개별 useState를
 * 하나의 타입 안전 객체로 묶는다.
 */
export function useBooleanFlags<T extends object>(initial: T) {
  const [flags, setFlags] = useState<T>(initial);

  const setFlag = useCallback(<K extends keyof T>(key: K, value: boolean) => {
    setFlags((prev) => ({ ...prev, [key]: value as T[K] }));
  }, []);

  return [flags, setFlag] as const;
}
