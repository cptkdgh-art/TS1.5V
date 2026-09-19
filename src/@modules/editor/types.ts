/**
 * ============================================================
 * @module modules/editor
 * @file types.ts
 * ============================================================
 * @description 에디터 관련 타입 정의
 * ============================================================
 */

/** 에디터 탭 유형 */
export type EditorTab = 'content' | 'characters' | 'worldview' | 'foreshadowing' | 'settings' | 'analysis' | 'cache';

/** 편집 중인 챕터 정보 */
export interface EditingChapter {
  index: number;
  content: string;
}

/** 에디터 상태 */
export interface EditorState {
  activeTab: EditorTab;
  editingChapter: EditingChapter | null;
  isAutoLoading: boolean;
  isCommittingChapter: boolean;
  streamingContent: string;
  generationError: string | null;
}

/** 텍스트 선택 정보 */
export interface TextSelection {
  text: string;
  chapterIndex: number;
  start: number;
  end: number;
}

/** 생성 설정 */
export interface GenerationSettings {
  /** 원문 전송 개수 */
  contextChapterCount: number;
  /** 자동 요약 트리거 (챕터 수) */
  summaryTrigger: number;
  /** 반복 회피 활성화 */
  avoidRepetition: boolean;
  /** 에피소드 모드 */
  episodeMode: boolean;
  /** 에피소드 목표 */
  episodeGoal: string;
  /** 에피소드 속도 */
  episodePacing: 'slow' | 'normal' | 'fast';
}

/** 기본 생성 설정 */
export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  contextChapterCount: 3,
  summaryTrigger: 10,
  avoidRepetition: true,
  episodeMode: false,
  episodeGoal: '',
  episodePacing: 'normal',
};
