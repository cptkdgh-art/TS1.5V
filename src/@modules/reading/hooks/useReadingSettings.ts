/**
 * ============================================================
 * @module modules/reading/hooks
 * @file useReadingSettings.ts
 * ============================================================
 * @description 읽기 설정 관리 훅
 * ============================================================
 */

import { useLocalStorage } from '@shared/hooks';

export type ReadingTheme = 'dark' | 'light' | 'sepia';
export type FontFamily = 'serif' | 'sans-serif';

export interface ReadingSettings {
  theme: ReadingTheme;
  fontSize: number;
  lineHeight: number;
  fontFamily: FontFamily;
}

const defaultSettings: ReadingSettings = {
  theme: 'dark',
  fontSize: 16,
  lineHeight: 1.8,
  fontFamily: 'serif',
};

export const useReadingSettings = () => {
  return useLocalStorage<ReadingSettings>('reading-settings', defaultSettings);
};
