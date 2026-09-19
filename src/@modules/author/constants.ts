/**
 * ============================================================
 * @module modules/author
 * @file constants.ts
 * ============================================================
 * @description AI 작가 관련 상수 정의
 * ============================================================
 */

/** 태그 카테고리 정의 */
export const CATEGORY_DEFINITIONS = {
  vibe: { name: '1. 분위기 / 톤' },
  relationship: { name: '2. 관계 역학' },
  style: { name: '3. 서사 방식 / 문체 스타일' },
  genre: { name: '4. 장르 / 세계관' },
  erotic: { name: '5. 성적 코드 / 감각도' },
  other: { name: '6. 기타' },
} as const;

export type CategoryId = keyof typeof CATEGORY_DEFINITIONS;

/** 태그-카테고리 매핑 */
export const TAG_DICT: Record<string, CategoryId> = {
  // 분위기/톤
  '달달': 'vibe',
  '서정': 'vibe',
  '관능': 'vibe',
  '감성': 'vibe',
  '어둡': 'vibe',
  '코믹': 'vibe',
  '잔잔': 'vibe',
  '빠른 전개': 'vibe',
  // 관계 역학
  '연인': 'relationship',
  '썸': 'relationship',
  '부부': 'relationship',
  '원나잇': 'relationship',
  '집착': 'relationship',
  '지배·복종': 'relationship',
  '역관계': 'relationship',
  // 서사 방식/문체
  '대사 중심': 'style',
  '묘사 중심': 'style',
  '내면 중심': 'style',
  '사건 중심': 'style',
  '1인칭': 'style',
  '3인칭': 'style',
  '회고': 'style',
  '현재형': 'style',
  '느린 호흡': 'style',
  '긴 호흡': 'style',
  // 장르/세계관
  '현대': 'genre',
  '판타지': 'genre',
  'SF': 'genre',
  'TS': 'genre',
  '변이': 'genre',
  '스릴러': 'genre',
  '일상': 'genre',
  // 성적 코드
  '은근한 에로스': 'erotic',
  '강한 텐션': 'erotic',
  '에로티카': 'erotic',
  '페티시': 'erotic',
  'SM': 'erotic',
  '감각적': 'erotic',
};

/** 키워드 기반 분류 규칙 */
export const KEYWORD_RULES: { keywords: string[]; category: CategoryId }[] = [
  {
    keywords: ['달달', '서정', '관능', '감성', '어둡', '코믹', '잔잔', '전개', '치유', '힐링'],
    category: 'vibe',
  },
  {
    keywords: ['연인', '썸', '부부', '원나잇', '집착', '지배', '복종', '역관계', '관계'],
    category: 'relationship',
  },
  {
    keywords: ['대사', '묘사', '내면', '사건', '1인칭', '3인칭', '회고', '현재형', '호흡', '시점', '서술'],
    category: 'style',
  },
  {
    keywords: ['현대', '판타지', 'SF', 'TS', '변이', '스릴러', '일상', '미래'],
    category: 'genre',
  },
  {
    keywords: ['에로스', '텐션', '에로티카', '페티시', 'SM', '관능', '감각적'],
    category: 'erotic',
  },
];

