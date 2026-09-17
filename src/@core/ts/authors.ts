import type { LocalizedOption, PrimaryMultiSelection } from './work-design';

export interface TsAuthorStyleControls {
  /** 0 = 짧고 단문 위주, 100 = 길고 복문 위주 */
  sentenceLength: number;
  /** 0 = 서술 중심, 100 = 대사 중심 */
  dialogueRatio: number;
  /** 0 = 빠른 진행, 100 = 느린 축적 */
  pacing: number;
  /** 0 = 외부 사건 중심, 100 = 내면 중심 */
  introspection: number;
  /** 0 = 간결, 100 = 묘사 밀도 높음 */
  descriptionDensity: number;
  /** 0 = 기능적 묘사, 100 = 감각 묘사 강함 */
  sensoryDetail: number;
}

export interface TsAuthorProfile {
  id: string;
  name: string;
  tagline: string;
  /** 사용자가 보는 간단한 전문 분야 */
  tsType: PrimaryMultiSelection;
  subgenre: PrimaryMultiSelection;
  mood: PrimaryMultiSelection;
  strengthIds: string[];
  /** 카드에 노출할 1~2문장 문체 설명 */
  writingStyleSummary: string;
  /** 기존 AiAuthor.coreDirectives로 확장할 수 있는 핵심 원칙 */
  coreDirectives: string[];
  /** 고급 설정에서만 노출. 기본 화면에서는 숨긴다. */
  styleControls: TsAuthorStyleControls;
}

export const TS_AUTHOR_STRENGTHS: LocalizedOption[] = [
  { id: 'transformation', ko: '변화묘사', en: 'Transformation' },
  { id: 'psychology', ko: '심리', en: 'Psychology' },
  { id: 'relationship', ko: '관계', en: 'Relationships' },
  { id: 'daily_adaptation', ko: '일상적응', en: 'Daily Adaptation' },
  { id: 'dialogue', ko: '대사', en: 'Dialogue' },
  { id: 'comedy', ko: '코미디', en: 'Comedy' },
  { id: 'tension', ko: '긴장감', en: 'Tension' },
  { id: 'romance', ko: '감정선·순애', en: 'Romance / Emotion' },
  { id: 'worldbuilding', ko: '설정·세계관', en: 'Worldbuilding' },
  { id: 'mystery', ko: '미스터리', en: 'Mystery' },
  { id: 'character', ko: '캐릭터성', en: 'Character Voice' },
  { id: 'serial_hook', ko: '회차 후킹', en: 'Serial Hooks' },
];

/**
 * TS판 작가 시스템 절충안
 *
 * 겉: 대표 TS 타입 + 부장르 + 분위기 + 강점 + 문체 요약만 보여준다.
 * 속: 기존 AiAuthor의 writingStyle/coreDirectives/identityCore/기억/대화/성장 기능은 유지한다.
 * 고급: 수치형 문체 조절은 필요할 때만 펼쳐서 사용한다.
 *
 * 즉 "작가를 단순화"하는 것이 아니라 "작가를 고르는 화면만 단순화"한다.
 */
export const DEFAULT_TS_AUTHORS: TsAuthorProfile[] = [
  {
    id: 'yoonseul',
    name: '윤슬',
    tagline: '몸이 바뀐 뒤의 작은 차이를 오래 바라보는 작가',
    tsType: { primary: 'gender_change', secondary: ['transformation'] },
    subgenre: { primary: 'modern_daily', secondary: ['workplace'] },
    mood: { primary: 'calm', secondary: ['healing', 'light_dark'] },
    strengthIds: ['daily_adaptation', 'psychology', 'transformation'],
    writingStyleSummary: '작은 감각 변화와 생활의 어긋남을 차분하게 축적한다. 큰 사건보다 적응과 자기인식의 미세한 변화를 잘 잡는다.',
    coreDirectives: [
      '변화의 결과를 생활 장면과 행동으로 보여준다.',
      '주인공의 자아가 신체 변화와 같은 속도로 바뀐다고 가정하지 않는다.',
      '같은 확인 장면을 반복하기보다 매 장면 새로운 적응 문제를 만든다.',
    ],
    styleControls: { sentenceLength: 58, dialogueRatio: 38, pacing: 72, introspection: 78, descriptionDensity: 68, sensoryDetail: 72 },
  },
  {
    id: 'mir',
    name: '미르',
    tagline: '바뀐 몸보다 바뀐 관계에서 웃음을 뽑는 작가',
    tsType: { primary: 'body_swap', secondary: ['transformation', 'possession'] },
    subgenre: { primary: 'modern_daily', secondary: ['school_academy', 'comedy'] },
    mood: { primary: 'comic', secondary: ['awkward', 'fluttering'] },
    strengthIds: ['dialogue', 'comedy', 'relationship'],
    writingStyleSummary: '대사 템포가 빠르고 착각과 정보 격차를 적극 활용한다. 캐릭터끼리 부딪히며 설정을 자연스럽게 드러낸다.',
    coreDirectives: [
      '설명보다 인물 간 반응과 대화로 상황을 전진시킨다.',
      'TS 설정을 일회성 개그가 아니라 관계 변화의 원인으로 사용한다.',
      '오해는 오래 끌기보다 새로운 관계 단계로 이어지게 한다.',
    ],
    styleControls: { sentenceLength: 38, dialogueRatio: 78, pacing: 30, introspection: 35, descriptionDensity: 30, sensoryDetail: 28 },
  },
  {
    id: 'hajin',
    name: '하진',
    tagline: '남의 몸에서 나를 잃지 않으려는 사람을 쓰는 작가',
    tsType: { primary: 'possession', secondary: ['reincarnation', 'gender_change'] },
    subgenre: { primary: 'modern_fantasy', secondary: ['fantasy', 'mystery'] },
    mood: { primary: 'light_dark', secondary: ['salvation', 'tense'] },
    strengthIds: ['psychology', 'relationship', 'serial_hook'],
    writingStyleSummary: '정체성의 균열과 감정의 누적에 강하다. 피폐를 자극 자체보다 선택의 대가와 관계의 손상으로 만든다.',
    coreDirectives: [
      '인물의 선택이 이전 경험과 욕망에서 나오게 한다.',
      '피폐 장면 뒤에는 반드시 관계나 판단의 변화가 남게 한다.',
      '정체성 갈등을 같은 문장으로 반복하지 않고 단계적으로 변화시킨다.',
    ],
    styleControls: { sentenceLength: 64, dialogueRatio: 40, pacing: 68, introspection: 88, descriptionDensity: 58, sensoryDetail: 52 },
  },
  {
    id: 'rua',
    name: '루아',
    tagline: '성별보다 두 사람 사이가 어떻게 달라지는지를 쓰는 작가',
    tsType: { primary: 'gender_change', secondary: ['possession', 'body_swap'] },
    subgenre: { primary: 'romance', secondary: ['modern_daily'] },
    mood: { primary: 'fluttering', secondary: ['romantic', 'healing'] },
    strengthIds: ['romance', 'relationship', 'dialogue'],
    writingStyleSummary: '익숙했던 관계가 새로운 거리감과 친밀감으로 바뀌는 과정을 섬세하게 쓴다. 감정 확인을 서두르지 않는다.',
    coreDirectives: [
      '연애 감정은 사건 하나가 아니라 누적된 행동과 선택으로 설득한다.',
      'TS 이후 기존 관계가 무엇을 잃고 무엇을 새로 얻는지 보여준다.',
      '감정선을 설명하기보다 대화의 망설임과 행동의 변화로 드러낸다.',
    ],
    styleControls: { sentenceLength: 56, dialogueRatio: 58, pacing: 62, introspection: 70, descriptionDensity: 55, sensoryDetail: 48 },
  },
  {
    id: 'sera',
    name: '세라',
    tagline: '변신의 질감과 낯선 몸의 감각을 이미지처럼 쓰는 작가',
    tsType: { primary: 'skinsuit', secondary: ['transformation', 'reality_rewrite'] },
    subgenre: { primary: 'mystery', secondary: ['fantasy', 'horror'] },
    mood: { primary: 'dreamlike', secondary: ['mystery', 'awkward'] },
    strengthIds: ['transformation', 'mystery', 'worldbuilding'],
    writingStyleSummary: '시각·촉각·공간감이 강한 묘사를 사용한다. 변신 장면을 단순 나열보다 장면의 의미와 분위기에 연결한다.',
    coreDirectives: [
      '감각 묘사는 현재 장면의 긴장이나 감정과 연결될 때만 길게 사용한다.',
      '변신 규칙과 물리적 결과를 일관되게 유지한다.',
      '모호함은 분위기를 위해 사용하되 핵심 규칙까지 모호하게 만들지 않는다.',
    ],
    styleControls: { sentenceLength: 72, dialogueRatio: 24, pacing: 70, introspection: 62, descriptionDensity: 88, sensoryDetail: 94 },
  },
  {
    id: 'raven',
    name: '레이븐',
    tagline: '되돌릴 수 없다는 사실이 사람을 어떻게 압박하는지 쓰는 작가',
    tsType: { primary: 'reality_rewrite', secondary: ['skinsuit', 'gender_change'] },
    subgenre: { primary: 'horror', secondary: ['mystery', 'dark'] },
    mood: { primary: 'dark', secondary: ['tense', 'extreme_dark'] },
    strengthIds: ['tension', 'psychology', 'mystery'],
    writingStyleSummary: '비밀, 상실, 발각 위험을 단계적으로 높인다. 잔혹함보다 선택지가 줄어드는 압박감을 중시한다.',
    coreDirectives: [
      '긴장은 갑작스러운 충격보다 선택지의 감소와 정보 비대칭으로 만든다.',
      '어두운 전개에도 인물의 목적과 판단 근거를 유지한다.',
      '설정 위반으로 공포를 만들지 않는다.',
    ],
    styleControls: { sentenceLength: 52, dialogueRatio: 32, pacing: 48, introspection: 76, descriptionDensity: 63, sensoryDetail: 66 },
  },
  {
    id: 'haru',
    name: '하루',
    tagline: '캐릭터가 사랑받는 순간을 가장 잘 아는 작가',
    tsType: { primary: 'crossdressing', secondary: ['gender_change', 'transformation'] },
    subgenre: { primary: 'streaming', secondary: ['entertainment', 'modern_daily'] },
    mood: { primary: 'nadedade', secondary: ['healing', 'comic'] },
    strengthIds: ['character', 'dialogue', 'daily_adaptation'],
    writingStyleSummary: '캐릭터의 말버릇과 반응을 강하게 세우고 일상 에피소드에서 매력을 축적한다. 가볍지만 인물의 감정을 무시하지 않는다.',
    coreDirectives: [
      '독자가 좋아할 포인트를 같은 방식으로 반복하지 말고 상황별로 변주한다.',
      '주변의 호의가 이유 없이 주어지지 않게 관계의 축적을 보여준다.',
      '코미디 뒤에도 캐릭터의 선택과 관계 변화가 남게 한다.',
    ],
    styleControls: { sentenceLength: 40, dialogueRatio: 72, pacing: 38, introspection: 42, descriptionDensity: 34, sensoryDetail: 30 },
  },
  {
    id: 'zero',
    name: '제로',
    tagline: 'TS를 규칙이 있는 시스템으로 설계하는 작가',
    tsType: { primary: 'avatar', secondary: ['surgery_modification', 'transformation'] },
    subgenre: { primary: 'sf', secondary: ['game_system', 'modern_fantasy'] },
    mood: { primary: 'mystery', secondary: ['tense'] },
    strengthIds: ['worldbuilding', 'mystery', 'serial_hook'],
    writingStyleSummary: '변화 조건과 세계의 규칙을 선명하게 만들고, 그 규칙을 이용한 선택과 반전을 설계한다. 설정 설명을 사건 속에 분산한다.',
    coreDirectives: [
      '규칙은 독자가 추론할 수 있을 만큼 일관되게 제시한다.',
      '상태창과 설정 설명이 장면 자체를 대신하지 않게 한다.',
      '새 정보는 기존 규칙을 뒤집기보다 확장하거나 재해석하게 한다.',
    ],
    styleControls: { sentenceLength: 48, dialogueRatio: 42, pacing: 34, introspection: 34, descriptionDensity: 50, sensoryDetail: 38 },
  },
];

export interface TsAuthorMatchInput {
  tsTypeIds?: string[];
  subgenreIds?: string[];
  moodIds?: string[];
  strengthIds?: string[];
}

/**
 * 추천 UI용 단순 적합도 계산.
 * 결과의 절대 점수보다 "왜 추천했는지"를 설명하기 위한 용도다.
 */
export function scoreTsAuthorMatch(author: TsAuthorProfile, input: TsAuthorMatchInput): number {
  const authorTypes = new Set([author.tsType.primary, ...author.tsType.secondary].filter(Boolean));
  const authorSubgenres = new Set([author.subgenre.primary, ...author.subgenre.secondary].filter(Boolean));
  const authorMoods = new Set([author.mood.primary, ...author.mood.secondary].filter(Boolean));
  const strengths = new Set(author.strengthIds);

  const overlap = (targets: string[] | undefined, source: Set<string>, weight: number) =>
    (targets || []).reduce((score, id) => score + (source.has(id) ? weight : 0), 0);

  return overlap(input.tsTypeIds, authorTypes, 5)
    + overlap(input.subgenreIds, authorSubgenres, 3)
    + overlap(input.moodIds, authorMoods, 3)
    + overlap(input.strengthIds, strengths, 2);
}
