/**
 * ============================================================
 * @module core/laws
 * @file index.ts
 * ============================================================
 * @description 웹소설 설정과 가독성 보조 시스템 통합 export
 *
 * 구조:
 * 장르와 플랫폼 규칙은 설정 UI의 참고 데이터다. 실제 집필에는
 * AI 작가의 프로필과 기억을 우선하고 가독성 보조만 자동 적용한다.
 * ============================================================
 */

// 장르 규칙
export {
  GENRE_LAWS,
  getGenreLaw,
  getGenreList,
} from './genre-laws';

// 플랫폼 규칙
export {
  PLATFORM_LAWS,
  getPlatformLaw,
  getPlatformList,
  getRecommendedPlatforms,
} from './platform-laws';

// 웹소설 프롬프트 빌더
export {
  buildWebNovelPrompt,
  extractForeshadowingContext,
} from './webnovel-prompt';

// 모든 집필 엔진이 공유하는 최소 표현 절제 규칙
export {
  COMMON_PROSE_GUARDRAIL_TITLE,
  COMMON_PROSE_GUARDRAILS,
  buildCommonProseGuardrailPrompt,
} from './prose-guardrails';
