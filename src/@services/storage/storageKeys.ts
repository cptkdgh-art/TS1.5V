/**
 * ============================================================
 * @module services/storage/storageKeys
 * @file storageKeys.ts
 * ============================================================
 * @description 스토리지 키 상수 정의
 * ============================================================
 */

export const STORAGE_KEYS = {
  /** 작업실 명부 (앱 전체 공용) */
  WORKSPACES: 'studioWorkspaces',
  /** AI 작가 목록 */
  AUTHORS: 'aiAuthors',
  /** 소설 목록 */
  NOVELS: 'novels',
  /** 시리즈 목록 */
  SERIES: 'series',
  /** 앱 설정 */
  SETTINGS: 'appSettings',
  /** 기본작가 클리오와 분리된 총괄감독 클리오 작업공간 */
  DIRECTOR_CLIO: 'directorClio',
  /** 캐릭터챗 원문 스냅샷 */
  CHARACTER_CHAT_SOURCES: 'characterChatSources',
  /** 캐릭터챗 페르소나 */
  CHARACTER_CHAT_PERSONAS: 'characterChatPersonas',
  /** 캐릭터챗에서 재사용하는 사용자 역할 */
  CHARACTER_CHAT_USER_PERSONAS: 'characterChatUserPersonas',
  /** 캐릭터챗 대화 세션 */
  CHARACTER_CHAT_SESSIONS: 'characterChatSessions',
  /** 외부 제작 패키지와 로컬 항목의 ID 대응 이력 */
  PRODUCTION_PACKAGE_RECEIPTS: 'productionPackageReceipts',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export const WORKSPACE_STORAGE_KEYS = [
  STORAGE_KEYS.AUTHORS,
  STORAGE_KEYS.NOVELS,
  STORAGE_KEYS.SERIES,
  STORAGE_KEYS.DIRECTOR_CLIO,
  STORAGE_KEYS.CHARACTER_CHAT_SOURCES,
  STORAGE_KEYS.CHARACTER_CHAT_PERSONAS,
  STORAGE_KEYS.CHARACTER_CHAT_USER_PERSONAS,
  STORAGE_KEYS.CHARACTER_CHAT_SESSIONS,
  STORAGE_KEYS.PRODUCTION_PACKAGE_RECEIPTS,
] as const;

export type WorkspaceStorageKey = (typeof WORKSPACE_STORAGE_KEYS)[number];
