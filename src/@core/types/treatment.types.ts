/**
 * ============================================================
 * @module core/types/treatment
 * @file treatment.types.ts
 * ============================================================
 * @description 트리트먼트 (총괄설계도 v2) 타입 정의
 * ============================================================
 */

/** 트리트먼트 에피소드 (챕터 단위 설계) */
export interface TreatmentEpisode {
  episodeNumber: number;
  title: string;
  goal: string;            // 이 화의 핵심 목표
  scenes: string;          // 주요 장면/전개 상세
  characters: string[];    // 등장 인물
  emotion: string;         // 감정선/분위기
  hook: string;            // 엔딩 훅 (절단마공)
}

/** 트리트먼트 (총괄설계도) */
export interface Treatment {
  premise: string;                  // 한줄 로그라인
  synopsis: string;                 // 전체 시놉시스
  tone: string;                     // 톤/무드 방향
  genreStrategy: string;            // 장르 전략
  episodes: TreatmentEpisode[];     // 에피소드별 설계
  createdAt: number;
}
