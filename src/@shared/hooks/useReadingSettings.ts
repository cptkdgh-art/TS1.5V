/**
 * ============================================================
 * @module shared/hooks
 * @file useReadingSettings.ts
 * ============================================================
 * @description 독서 설정 훅
 * ============================================================
 */

import { useLocalStorage } from './useLocalStorage';

export type ReadingTheme = 'dark' | 'light' | 'sepia';
export type FontFamily = 'serif' | 'sans-serif';

export interface ReadingSettings {
  theme: ReadingTheme;
  fontSize: number;
  lineHeight: number;
  fontFamily: FontFamily;
}

const DEFAULT_SETTINGS: ReadingSettings = {
  theme: 'dark',
  fontSize: 16,
  lineHeight: 1.8,
  fontFamily: 'serif',
};

/**
 * 독서 설정 상태 훅
 */
export function useReadingSettings() {
  return useLocalStorage<ReadingSettings>('reading-settings', DEFAULT_SETTINGS);
}
