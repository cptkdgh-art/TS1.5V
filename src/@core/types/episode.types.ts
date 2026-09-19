/**
 * ============================================================
 * @module core/types/episode
 * @file episode.types.ts
 * ============================================================
 * @description 에피소드 호흡 및 아크 관련 타입 정의
 * ============================================================
 */

/** 페이싱 속도 */
export type PacingSpeed = 'fast' | 'normal' | 'slow';

/** 집필 집중 목표의 적용 범위 */
export type WritingFocusScope = 'next-chapter' | 'until-complete';

/** 에피소드 호흡 조절 */
export interface EpisodePacing {
  isEnabled: boolean;
  goal: string;
  speed: PacingSpeed;
  /** 기존 데이터는 목표 달성까지로 해석해 사용자가 유지하던 목표를 보존한다. */
  scope?: WritingFocusScope;
  /** 여러 회차 집중에서 도달하고 싶은 상태. */
  destination?: string;
}

/** 에피소드 아크 챕터 */
export interface EpisodeArcChapter {
  goal: string;
  keyEvents: string;
  pacing: PacingSpeed;
  cliffhanger: string;
  directorsNote?: string;
}

/** 에피소드 아크 */
export interface EpisodeArc {
  goal: string;
  chapters: EpisodeArcChapter[];
  startChapterIndex: number;
}
