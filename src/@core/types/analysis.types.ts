/**
 * ============================================================
 * @module core/types/analysis
 * @file analysis.types.ts
 * ============================================================
 * @description 시각적 분석 관련 타입 정의
 * ============================================================
 */

/** 시각적 분석 데이터 */
export interface VisualAnalysisData {
  relationshipGraph: {
    nodes: { id: string; name: string }[];
    links: { source: string; target: string; label: string }[];
  };
  eventTimeline: { title: string; description: string }[];
}

/** 소설 분석 결과 */
export interface NovelAnalysis {
  relationships: string;
  timeline: string;
  visualAnalysis?: VisualAnalysisData;
}
