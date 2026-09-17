import {
  buildTsGenreBrief,
  buildTsWritingDirective,
  type TsAuthorProfile,
  type TsWorkDesign,
} from '@core/ts';

export interface StoryGenreGuide {
  id: string;
  label: string;
  guide: string;
  subgenres: string[];
}

export const STORY_GENRE_GUIDES: StoryGenreGuide[] = [
  { id: 'TS', label: 'TS', guide: '성별 변화가 자기인식, 신체감각, 관계, 사회적 위치와 선택을 어떻게 바꾸는지 중심축을 잡아보세요.', subgenres: ['성별전환', '변신', '빙의·전생', '바디스왑', '가역변신', '비가역변신', '점진변화', '즉시변화', '현대일상', '판타지', 'SF·실험', '순애', '심리', '코미디', '피폐', '미스터리'] },
  { id: '현대판타지', label: '현대판타지', guide: '현실적인 일상과 비현실적 능력·규칙의 대비를 선명하게 잡아보세요.', subgenres: ['헌터', '회귀', '빙의', '각성', '재벌·경영', '던전', '시스템'] },
  { id: '판타지', label: '판타지', guide: '세계의 규칙과 인물의 욕망이 서로 맞물리도록 중심축을 정해보세요.', subgenres: ['정통 판타지', '다크 판타지', '영지물', '모험', '성장', '전쟁', '환생'] },
  { id: '로맨스판타지', label: '로맨스판타지', guide: '관계의 변화와 판타지 세계의 갈등이 따로 놀지 않게 연결해보세요.', subgenres: ['회귀', '빙의', '계약결혼', '궁정물', '육아물', '복수', '구원'] },
  { id: '로맨스', label: '로맨스', guide: '두 사람의 감정 변화와 관계를 가로막는 구체적인 이유를 잡아보세요.', subgenres: ['현대로맨스', '사내연애', '재회', '계약연애', '청춘', '힐링', '로맨틱 코미디'] },
  { id: '무협', label: '무협', guide: '강호의 질서, 무공의 대가, 주인공이 걷는 길을 중심으로 잡아보세요.', subgenres: ['정통무협', '신무협', '회귀', '환생', '문파', '복수', '성장'] },
  { id: '아카데미', label: '아카데미', guide: '배움과 경쟁, 관계 형성, 학교 밖 큰 갈등 중 무엇이 중심인지 정해보세요.', subgenres: ['성장', '빙의', '교수', '생존', '라이벌', '마법학교', '헌터학교'] },
  { id: '게임·시스템', label: '게임·시스템', guide: '규칙과 보상이 독자에게 이해되도록 하되 숫자가 서사를 대신하지 않게 해보세요.', subgenres: ['게임빙의', '게임판타지', '탑등반', '성좌', '상태창', '생존', '경영'] },
  { id: 'SF', label: 'SF', guide: '기술이나 과학적 가정이 인물의 선택과 사회를 어떻게 바꾸는지 잡아보세요.', subgenres: ['스페이스 오페라', '사이버펑크', '디스토피아', '포스트 아포칼립스', '시간여행', 'AI', '밀리터리'] },
  { id: '미스터리·스릴러', label: '미스터리·스릴러', guide: '독자가 따라갈 질문, 단서, 위험의 상승 방향을 먼저 정해보세요.', subgenres: ['추리', '범죄', '심리', '법정', '의학', '첩보', '서스펜스'] },
  { id: '호러', label: '호러', guide: '무엇이 무서운지보다 인물이 왜 도망칠 수 없는지를 구체화해보세요.', subgenres: ['오컬트', '괴담', '크리처', '코즈믹 호러', '생존', '심리 공포', '도시괴담'] },
  { id: '대체역사', label: '대체역사', guide: '바뀐 역사적 조건과 그 변화가 인물의 삶에 미치는 결과를 연결해보세요.', subgenres: ['전쟁', '정치', '외교', '산업', '경영', '회귀', '군상극'] },
  { id: '일상·드라마', label: '일상·드라마', guide: '작은 사건 속에서 관계와 삶이 어떻게 달라지는지 중심 감정을 잡아보세요.', subgenres: ['힐링', '가족', '직업물', '음식', '연예계', '스포츠', '성장'] },
  { id: 'BL', label: 'BL', guide: '인물별 욕망과 관계의 변화가 장면마다 축적되도록 중심 갈등을 잡아보세요.', subgenres: ['현대물', '판타지', '오메가버스', '가이드버스', '회귀', '구원', '피폐'] },
];

export const STORY_THEME_PRESETS = [
  '성장', '복수', '구원', '생존', '가족', '우정', '사랑', '욕망',
  '권력', '정체성', '자유', '정의', '상실', '용서', '귀환', '선택과 대가',
] as const;

export const STORY_MOOD_PRESETS = [
  '긴장감', '어둡고 무거운', '희망적', '코믹', '잔잔한', '몽환적',
  '스릴러', '비장한', '로맨틱', '잔혹한', '서정적', '미스터리',
  '열혈', '우울한', '유쾌한', '공포', '서스펜스', '따뜻한',
] as const;

export function parseMood(mood: string): { tags: string[]; freeText: string } {
  const pipeIndex = mood.indexOf('|');
  if (pipeIndex === -1) {
    const parts = mood.split(',').map((part) => part.trim()).filter(Boolean);
    const tags = parts.filter((part) => STORY_MOOD_PRESETS.includes(part as typeof STORY_MOOD_PRESETS[number]));
    const freeText = parts.filter((part) => !tags.includes(part)).join(', ');
    return { tags, freeText };
  }

  return {
    tags: mood.slice(0, pipeIndex).split(',').map((part) => part.trim()).filter(Boolean),
    freeText: mood.slice(pipeIndex + 1).trim(),
  };
}

export function combineMood(tags: string[], freeText: string): string {
  const tagText = tags.join(', ');
  if (!tagText) return freeText.trim();
  if (!freeText.trim()) return tagText;
  return `${tagText} | ${freeText.trim()}`;
}

export interface StoryClassificationInput {
  primaryGenre?: string;
  subgenres?: string[];
  themes?: string[];
  subject?: string;
  /** TS 전용 작품 설계가 있으면 표시용 분류 대신 활성 집필 지시문까지 컴파일한다. */
  tsDesign?: TsWorkDesign;
  tsAuthor?: TsAuthorProfile | null;
  chapterInstruction?: string;
  continuityFacts?: string[];
  exclusions?: string[];
  additionalInstructions?: string[];
}

export function buildStoryClassificationText(input: StoryClassificationInput): string {
  const classification = [
    input.primaryGenre ? `주 장르: ${input.primaryGenre}` : '',
    input.subgenres?.length ? `부 장르: ${input.subgenres.join(', ')}` : '',
    input.themes?.length ? `주제: ${input.themes.join(', ')}` : '',
    input.subject?.trim() ? `주제·소재 추가 설명: ${input.subject.trim()}` : '',
  ].filter(Boolean).join('\n');

  if (input.tsDesign) {
    const activeDirective = buildTsWritingDirective({
      design: input.tsDesign,
      author: input.tsAuthor,
      chapterInstruction: input.chapterInstruction,
      continuityFacts: input.continuityFacts,
      exclusions: input.exclusions,
      additionalInstructions: input.additionalInstructions,
    });

    return [classification, activeDirective].filter(Boolean).join('\n\n');
  }

  const tsBrief = buildTsGenreBrief(input);
  return [classification, tsBrief].filter(Boolean).join('\n\n');
}
