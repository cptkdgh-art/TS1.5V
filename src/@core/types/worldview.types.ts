/**
 * ============================================================
 * @module core/types/worldview
 * @file worldview.types.ts
 * ============================================================
 * @description 세계관 관련 타입 정의
 * ============================================================
 */

/** 세계관 파일 */
export interface WorldviewFile {
  filename: string;
  content: string;
}

/** 세계관 분석에서 추출된 인물 */
export interface ExtractedWorldviewCharacter {
  name: string;
  role: string;        // 세계관 내 역할/소속 (예: "왕국 기사단장", "마탑 수석")
  personality: string; // 성격 특성
  appearance: string;  // 외모 (언급된 경우)
  background: string;  // 배경/설명
}

/** 세계관 분석 결과 */
export interface WorldviewAnalysisResult {
  worldLaws: string;
  geography: string;
  history: string;
  factions: string;
  magicAndTechnology: string;
  uniqueConcepts: string;
  coreTheme: string;
  extractedCharacters?: ExtractedWorldviewCharacter[];
}

/** 세계관 전문가 캐시 값 */
export interface LorekeeperCacheValue {
  answer: string;
  cachedAt: number;
}
