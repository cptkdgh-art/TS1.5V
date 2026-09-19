/**
 * ============================================================
 * @module core/types/series
 * @file series.types.ts
 * ============================================================
 * @description 시리즈(권 묶음) 관련 타입 정의
 * ============================================================
 */

import type { Character } from './character.types';
import type { WorldviewFile } from './worldview.types';

/** 권별 청사진 - 각 권의 목표와 구조 */
export interface VolumeBlueprint {
  id?: string; // 권 번호가 바뀌어도 유지되는 내부 매핑 ID (기존 데이터는 자동 생성)
  volumeNumber: number;
  displayLabel?: string; // 사용자 표시용 헤더 (예: 2권, 외전 A)
  title: string;
  localSetting?: string; // 이 권에서만 적용되는 지역·조직·분위기·규칙의 변주
  goal: string; // 이 권의 목표
  mainConflict: string; // 주요 갈등
  keyEvents: string; // 핵심 사건
  status: 'planned' | 'drafting' | 'completed';
  linkedNovelId?: string; // 연결된 소설 ID (이미 집필된 권)
  isLocked?: boolean; // Canon 잠금 - true면 AI가 수정 불가
}

/** 시리즈에서 분리되거나 권 계획이 삭제되어도 작품에 남는 마지막 적용 계획 */
export interface SeriesVolumePlanSnapshot {
  sourceSeriesId: string;
  sourceVolumeId: string;
  volumeNumber: number;
  displayLabel: string;
  title: string;
  localSetting?: string;
  goal: string;
  mainConflict: string;
  keyEvents: string;
  capturedAt: number;
}

/** 시리즈 청사진 - 전체 시리즈의 구조 설계 */
export interface SeriesBlueprint {
  worldview: string; // 시리즈 세계관 핵심
  mainConflict: string; // 시리즈 메인 갈등
  characterArcs: string; // 인물 성장 아크
  volumes: VolumeBlueprint[];
  lastUpdated: number;
}

/** 권별 시리즈 연대기 블록. 위치가 아니라 작품/권 내부 ID로 추적한다. */
export interface SeriesMemoryBlock {
  novelId: string;
  volumeId?: string;
  volumeLabel: string;
  novelTitle: string;
  sourceSignature: string;
  content: string;
  generatedAt: number;
}

/** 단일 문자열 연대기의 원본 추적 정보. 문자열은 호환용으로 함께 유지한다. */
export interface SeriesMemoryState {
  blocks: SeriesMemoryBlock[];
  combinedSignature: string;
  generatedAt: number;
}

/** 소설 시리즈 */
export interface Series {
  id: string;
  title: string;
  seriesPlotSummary: string; // 시리즈 전체를 관통하는 거시적 줄거리
  blueprint?: SeriesBlueprint; // AI 아키텍트가 설계한 구조화된 계획
  characters: Character[]; // 시리즈 전체에서 공유되는 등장인물
  worldviewFiles?: WorldviewFile[]; // 시리즈 전체에서 공유되는 세계관
  novelIds: string[]; // 이 시리즈에 속한 소설(권)들의 ID 배열
  createdAt: number;
  seriesMemoryCompendium?: string; // 시리즈 전체 권들의 사건 요약본 (연대기)
  seriesMemoryState?: SeriesMemoryState; // 권별 출처/서명 기반 증분 연대기
}
