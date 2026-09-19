/**
 * ============================================================
 * @module core/types/webnovel
 * @file webnovel.types.ts
 * ============================================================
 * @description 웹소설 시스템 타입 정의
 *
 * 설계 철학:
 * - AI 작가의 프로필, 문체, 지시, 기억이 집필의 최우선 기준
 * - 장르와 플랫폼은 분류 및 UI 설정 데이터
 * - 자동 집필 보조는 작가의 개성을 바꾸지 않는 가독성, 속도, 호흡으로 제한
 * ============================================================
 */

// ============================================================
// 장르 (Genre)
// ============================================================

/** 웹소설 장르 */
export type WebNovelGenre =
  // 여성향
  | 'romance-fantasy'    // 로맨스 판타지 (로판)
  | 'modern-fantasy-f'   // 현대 판타지 여성향 (현판)
  | 'romance'            // 로맨스
  | 'bl'                 // BL
  // 남성향
  | 'hunter'             // 헌터물/회귀물
  | 'martial-arts'       // 무협
  | 'game-fantasy'       // 게임 판타지
  | 'academy'            // 아카데미물
  | 'regression'         // 회귀물
  | 'possession'         // 빙의물
  // 공용
  | 'fusion'             // 퓨전
  | 'alt-history'        // 대체역사
  | 'mystery'            // 미스터리/스릴러
  | 'horror'             // 호러
  | 'slice-of-life'      // 일상물
  | 'custom';            // 사용자 정의

// ============================================================
// 플랫폼 (Platform)
// ============================================================

/** 웹소설 플랫폼 */
export type WebNovelPlatform =
  | 'munpia'         // 문피아 (남성향 강세)
  | 'kakao-page'     // 카카오페이지 (로판/현판, 기다무)
  | 'ridi'           // 리디북스 (여성향/BL, 단행본)
  | 'novelpia'       // 노벨피아 (정액제, TS/아카데미)
  | 'series'         // 네이버 시리즈
  | 'joara'          // 조아라
  | 'custom';        // 사용자 정의 / 자유

// ============================================================
// 문체 설정 (Style Settings)
// ============================================================

/** 문장 호흡 설정 */
export interface SentenceBreathing {
  /** 목표 문장 길이 (자) */
  targetLength: {
    min: number;  // 기본 15
    max: number;  // 기본 40
  };
  /** 리듬 패턴: 긴-긴-짧, 짧-짧-긴 등 */
  rhythmPattern: 'long-long-short' | 'short-short-long' | 'varied' | 'consistent';
  /** 문단당 최대 줄 수 */
  maxLinesPerParagraph: number;  // 기본 3
}

/** 대화문 설정 */
export interface DialogueSettings {
  /** 최소 대화 비율 (%) */
  minDialogueRatio: number;  // 기본 50
  /** 지문 연속 최대 줄 수 (이 이상이면 대화 삽입 유도) */
  maxConsecutiveNarration: number;  // 기본 5
  /** 캐릭터별 말투 강제 여부 */
  enforceCharacterVoice: boolean;
}

/** 후킹 설정 */
export interface HookingSettings {
  /** 회차 끝 클리프행어 강도 */
  cliffhangerIntensity: 'mild' | 'moderate' | 'strong';
  /** 고구마-사이다 밸런스 (높을수록 사이다 많음) */
  catharsisBias: number;  // 0-100, 기본 50
  /** 회차당 최소 사이다 포인트 */
  minCatharsisPerEpisode: number;  // 기본 1
  /** 긴장 고조 시작 위치 (회차의 몇 %부터) */
  tensionBuildupStart: number;  // 기본 75 (4,500자/6,000자)
}

// ============================================================
// 장르별 규칙 (Genre Law)
// ============================================================

/** 장르별 필수 요소 */
export interface GenreRequirements {
  /** 필수 등장 요소 */
  mustHave: string[];
  /** 권장 요소 */
  recommended: string[];
  /** 금지/주의 요소 */
  avoid: string[];
  /** 클리셰/공식 */
  cliches: string[];
}

/** 장르 규칙 */
export interface GenreLaw {
  genre: WebNovelGenre;
  name: string;  // 표시명
  description: string;
  requirements: GenreRequirements;
  /** 기본 문체 설정 오버라이드 */
  styleOverrides?: Partial<SentenceBreathing & DialogueSettings>;
  /** 장르 특화 프롬프트 (AI에게 자연어로 전달) */
  prompt: string;
}

// ============================================================
// 플랫폼별 규칙 (Platform Law)
// ============================================================

/** 플랫폼 규칙 */
export interface PlatformLaw {
  platform: WebNovelPlatform;
  name: string;
  /** 회차당 권장 글자 수 */
  recommendedLength: {
    min: number;
    max: number;
    optimal: number;
  };
  /** 유료화 전환 시점 (화) */
  monetizationPoint?: number;
  /** 주요 독자층 */
  primaryAudience: 'male' | 'female' | 'all';
  /** 강세 장르 */
  strongGenres: WebNovelGenre[];
  /** 플랫폼 특화 팁 */
  tips: string[];
  /** 플랫폼 특화 프롬프트 */
  prompt: string;
}

// ============================================================
// 웹소설 시스템 설정 (Novel에 추가될 필드)
// ============================================================

/** 웹소설 시스템 설정 */
export interface WebNovelSettings {
  /** 활성화 여부 */
  isEnabled: boolean;

  /** 선택된 장르 */
  genre: WebNovelGenre;
  /** 커스텀 장르명 (genre가 'custom'일 때) */
  customGenreName?: string;

  /** 선택된 플랫폼 */
  platform: WebNovelPlatform;

  /** 문체 설정 */
  style: {
    breathing: SentenceBreathing;
    dialogue: DialogueSettings;
    hooking: HookingSettings;
  };

  /** 자동 규칙 적용 (false면 수동으로 조절) */
  autoApplyRules: boolean;
}

// ============================================================
// 기본값 (Defaults)
// ============================================================

/** 웹소설 기본 문체 설정 */
export const DEFAULT_WEBNOVEL_STYLE: WebNovelSettings['style'] = {
  breathing: {
    targetLength: { min: 15, max: 40 },
    rhythmPattern: 'long-long-short',
    maxLinesPerParagraph: 3,
  },
  dialogue: {
    minDialogueRatio: 50,
    maxConsecutiveNarration: 5,
    enforceCharacterVoice: true,
  },
  hooking: {
    cliffhangerIntensity: 'moderate',
    catharsisBias: 50,
    minCatharsisPerEpisode: 1,
    tensionBuildupStart: 75,
  },
};

/** 웹소설 설정 기본값 */
export const DEFAULT_WEBNOVEL_SETTINGS: WebNovelSettings = {
  isEnabled: true,
  genre: 'fusion',
  platform: 'custom',
  style: DEFAULT_WEBNOVEL_STYLE,
  autoApplyRules: true,
};
