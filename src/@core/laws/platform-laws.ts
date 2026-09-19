/**
 * ============================================================
 * @module core/laws
 * @file platform-laws.ts
 * ============================================================
 * @description 플랫폼별 웹소설 규칙 정의
 *
 * 각 플랫폼은 고유한 독자층, 수익 구조, 선호 장르가 있음.
 * 이 규칙들은 작가가 특정 플랫폼을 타겟으로 할 때 자연스럽게 적용됨.
 * ============================================================
 */

import type { PlatformLaw, WebNovelPlatform, WebNovelGenre } from '@core/types/webnovel.types';

// ============================================================
// 문피아
// ============================================================
const MUNPIA: PlatformLaw = {
  platform: 'munpia',
  name: '문피아',
  recommendedLength: {
    min: 4000,
    max: 7000,
    optimal: 5500,
  },
  monetizationPoint: 50, // 50화부터 유료화 일반적
  primaryAudience: 'male',
  strongGenres: ['hunter', 'martial-arts', 'game-fantasy', 'regression', 'fusion', 'alt-history'],
  tips: [
    '남성 독자 비율 90% 이상',
    '먼치킨/성장물이 강세',
    '50화 이후 유료 전환이 일반적',
    '정산율 50-63% (등급별)',
    '베스트 작품은 100만 조회 이상',
    '댓글 문화가 활발 - 독자 반응에 민감',
  ],
  prompt: `당신은 문피아 독자들을 위해 글을 씁니다.
남성 독자들은 주인공의 압도적인 성장과 통쾌한 활약을 원합니다.
빠른 전개와 시원한 사이다가 핵심입니다.
회차당 5,000-6,000자가 적당하고, 50화까지는 독자를 확실히 사로잡아야 합니다.`,
};

// ============================================================
// 카카오페이지
// ============================================================
const KAKAO_PAGE: PlatformLaw = {
  platform: 'kakao-page',
  name: '카카오페이지',
  recommendedLength: {
    min: 3500,
    max: 5500,
    optimal: 4500,
  },
  monetizationPoint: 20, // 기다무 시스템
  primaryAudience: 'female',
  strongGenres: ['romance-fantasy', 'modern-fantasy-f', 'romance', 'possession'],
  tips: [
    '기다리면 무료(기다무) 시스템',
    '로맨스 판타지/현대 판타지 강세',
    '웹툰 연계 가능성',
    '짧은 회차, 빠른 전개 선호',
    '모바일 최적화 필수',
    '20화 이내 핵심 전개 시작',
  ],
  prompt: `당신은 카카오페이지 독자들을 위해 글을 씁니다.
여성 독자들은 로맨스와 감정선, 그리고 시원한 사이다를 원합니다.
모바일에서 읽기 좋은 짧은 문장과 빠른 전개가 중요합니다.
기다무 시스템이므로 매 회차 끝이 다음 회차로 이어지는 흡입력이 필수입니다.`,
};

// ============================================================
// 리디북스
// ============================================================
const RIDI: PlatformLaw = {
  platform: 'ridi',
  name: '리디북스',
  recommendedLength: {
    min: 5000,
    max: 8000,
    optimal: 6500,
  },
  primaryAudience: 'female',
  strongGenres: ['romance-fantasy', 'romance', 'bl', 'modern-fantasy-f'],
  tips: [
    '여성향/BL 강세',
    '단행본 형식 선호 (권 단위 판매)',
    '성인물 시장 활발',
    '상대적으로 긴 호흡의 글 수용',
    '완결작 선호도 높음',
    '정가제 도서 판매 구조',
  ],
  prompt: `당신은 리디북스 독자들을 위해 글을 씁니다.
단행본으로 묶일 것을 고려해 권 단위로 완결성 있는 구조가 좋습니다.
여성 독자들의 로맨스, BL에 대한 기대가 높습니다.
다른 플랫폼보다 조금 더 긴 호흡의 서사도 수용됩니다.`,
};

// ============================================================
// 노벨피아
// ============================================================
const NOVELPIA: PlatformLaw = {
  platform: 'novelpia',
  name: '노벨피아',
  recommendedLength: {
    min: 4000,
    max: 7000,
    optimal: 5000,
  },
  primaryAudience: 'male',
  strongGenres: ['academy', 'game-fantasy', 'hunter', 'possession', 'regression'],
  tips: [
    '정액제 구독 모델',
    'TS물, 아카데미물 특화',
    '남성 독자 90% 이상',
    '2차 창작/팬픽 활발',
    '자유로운 소재 허용',
    '신인 작가 진입 용이',
  ],
  prompt: `당신은 노벨피아 독자들을 위해 글을 씁니다.
정액제이므로 독자들은 더 많은 회차를 빠르게 소비합니다.
TS, 아카데미, 게임 판타지 등 다양한 소재가 환영받습니다.
자유로운 상상력이 허용되는 플랫폼입니다.`,
};

// ============================================================
// 네이버 시리즈
// ============================================================
const NAVER_SERIES: PlatformLaw = {
  platform: 'series',
  name: '네이버 시리즈',
  recommendedLength: {
    min: 3500,
    max: 5500,
    optimal: 4500,
  },
  monetizationPoint: 30,
  primaryAudience: 'all',
  strongGenres: ['romance-fantasy', 'hunter', 'fusion', 'romance'],
  tips: [
    '네이버 플랫폼 연계 (검색 노출)',
    '웹툰 원작 가능성',
    '쿠키 시스템 (유료 화폐)',
    '대중적인 장르 선호',
    '폭넓은 연령대',
    '마케팅 파워 강함',
  ],
  prompt: `당신은 네이버 시리즈 독자들을 위해 글을 씁니다.
대중적이고 접근성 있는 소재가 좋습니다.
웹툰 원작이 될 수 있다는 점을 고려하면 장면 연출이 선명하면 좋습니다.`,
};

// ============================================================
// 조아라
// ============================================================
const JOARA: PlatformLaw = {
  platform: 'joara',
  name: '조아라',
  recommendedLength: {
    min: 3000,
    max: 6000,
    optimal: 4500,
  },
  primaryAudience: 'all',
  strongGenres: ['romance', 'romance-fantasy', 'fusion', 'bl'],
  tips: [
    '한국 웹소설의 원조 플랫폼',
    '로맨스 강세',
    '노블레스 프리미엄 시스템',
    '신인 등용문 역할',
    '팬픽/2차 창작 활발',
    '자유로운 분위기',
  ],
  prompt: `당신은 조아라 독자들을 위해 글을 씁니다.
한국 웹소설의 원조 플랫폼으로, 다양한 장르가 공존합니다.
로맨스와 판타지가 강세이며, 자유로운 글쓰기가 가능합니다.`,
};

// ============================================================
// 자유 / 사용자 정의
// ============================================================
const CUSTOM: PlatformLaw = {
  platform: 'custom',
  name: '플랫폼 무관',
  recommendedLength: {
    min: 3000,
    max: 8000,
    optimal: 5000,
  },
  primaryAudience: 'all',
  strongGenres: [],
  tips: [
    '특정 플랫폼에 맞추지 않음',
    '작가의 자유로운 선택',
    '나중에 플랫폼 결정 가능',
  ],
  prompt: `특정 플랫폼을 타겟으로 하지 않습니다.
작가의 스타일과 이야기에 집중하세요.`,
};

// ============================================================
// 플랫폼 규칙 레지스트리
// ============================================================

/** 모든 플랫폼 규칙 */
export const PLATFORM_LAWS: Record<WebNovelPlatform, PlatformLaw> = {
  'munpia': MUNPIA,
  'kakao-page': KAKAO_PAGE,
  'ridi': RIDI,
  'novelpia': NOVELPIA,
  'series': NAVER_SERIES,
  'joara': JOARA,
  'custom': CUSTOM,
};

/**
 * 플랫폼 규칙 가져오기
 */
export function getPlatformLaw(platform: WebNovelPlatform): PlatformLaw {
  return PLATFORM_LAWS[platform] || PLATFORM_LAWS['custom'];
}

/**
 * 플랫폼 목록 (UI용)
 */
export function getPlatformList(): Array<{ value: WebNovelPlatform; label: string; audience: string }> {
  return [
    { value: 'munpia', label: '문피아', audience: '남성향' },
    { value: 'kakao-page', label: '카카오페이지', audience: '여성향' },
    { value: 'ridi', label: '리디북스', audience: '여성향' },
    { value: 'novelpia', label: '노벨피아', audience: '남성향' },
    { value: 'series', label: '네이버 시리즈', audience: '전체' },
    { value: 'joara', label: '조아라', audience: '전체' },
    { value: 'custom', label: '플랫폼 무관', audience: '전체' },
  ];
}

/**
 * 장르에 맞는 추천 플랫폼 가져오기
 */
export function getRecommendedPlatforms(genre: WebNovelGenre): WebNovelPlatform[] {
  const recommendations: WebNovelPlatform[] = [];

  for (const [platform, law] of Object.entries(PLATFORM_LAWS)) {
    if (law.strongGenres.includes(genre)) {
      recommendations.push(platform as WebNovelPlatform);
    }
  }

  return recommendations.length > 0 ? recommendations : ['custom'];
}
