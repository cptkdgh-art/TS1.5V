export type UiLanguage = 'ko' | 'en';
export type ManuscriptLanguage = 'ko' | 'en';
export type WorkKind = 'novel' | 'series';
export type TsNarrativeTraditionId = 'kr_webnovel' | 'jp_tsf' | 'western_tgtf' | 'hybrid';
export type TsExpressionBalanceId = 'story_first' | 'balanced' | 'fetish_forward';

export interface LocalizedOption {
  id: string;
  ko: string;
  en: string;
  aliases?: string[];
}

export interface PrimaryMultiSelection {
  primary: string | null;
  secondary: string[];
}

export interface TsNarrativeTraditionOption extends LocalizedOption {
  /** 내부 프롬프트에서 쓰는 서사 관습 혼합 비율. UI에서는 프리셋 이름만 보여준다. */
  blend: {
    kr: number;
    jp: number;
    western: number;
  };
  featuredPreferenceIds: string[];
}

export type TsPreferenceCategory =
  | 'theme'
  | 'character_expression'
  | 'transformation_focus'
  | 'community_fetish'
  | 'relationship';

export interface TsPreferenceOption extends LocalizedOption {
  category: TsPreferenceCategory;
}

export interface TsWorkDesign {
  workKind: WorkKind;
  uiLanguage: UiLanguage;
  manuscriptLanguage: ManuscriptLanguage;
  direction: string | null;
  tsType: PrimaryMultiSelection;
  subgenre: PrimaryMultiSelection;
  mood: PrimaryMultiSelection;
  /** 선택 사항. 기본값은 hybrid를 권장한다. */
  narrativeTradition?: TsNarrativeTraditionId | null;
  /** 선택 사항. '균형'을 기본값으로 쓰고 상세설정에서만 노출한다. */
  expressionBalance?: TsExpressionBalanceId | null;
  /** 취향·소재 태그. 기본 화면에서는 숨기고 필요할 때만 펼친다. */
  preferenceTagIds?: string[];
  storyCore: string;
}

export interface TsSeriesDesign extends TsWorkDesign {
  workKind: 'series';
  seriesCore: string;
  volume1Core: string;
}

/**
 * 새 작품 화면의 원칙
 * - 첫 화면은 TS 방향 / TS 타입 / 부장르 / 분위기 / 작품 핵심만 노출한다.
 * - TS 타입, 부장르, 분위기는 대표 1개 + 추가 다중선택을 지원한다.
 * - 취향·소재는 선택 피로를 줄이기 위해 접힌 고급 영역에서만 노출한다.
 * - 한국/일본/서양풍은 국적 모사가 아니라 장르적 서사 관습 프리셋이다.
 * - 세부적인 변화 속도·가역성·정신 변화 등은 작품 생성 뒤 TS 세부설정에서 다룬다.
 * - UI 언어와 원고 집필 언어는 서로 독립적으로 선택할 수 있다.
 */
export const TS_DIRECTIONS: LocalizedOption[] = [
  { id: 'mtf', ko: '남→여', en: 'Male → Female', aliases: ['M2F', 'MtF'] },
  { id: 'ftm', ko: '여→남', en: 'Female → Male', aliases: ['F2M', 'FtM'] },
  { id: 'variable', ko: '가변', en: 'Variable / Recurring', aliases: ['가변TS'] },
  { id: 'other', ko: '기타', en: 'Other' },
];

export const TS_TYPES: LocalizedOption[] = [
  {
    id: 'gender_change',
    ko: '성전환',
    en: 'Gender Transformation',
    aliases: ['TS', 'TS물', 'TSF', 'TG', 'gender bender', 'genderbend', 'gender swap', 'genderswap', '女体化', 'にょた', '男体化'],
  },
  {
    id: 'feminization',
    ko: '여성화',
    en: 'Feminization',
    aliases: ['Feminisation', 'feminization TF', 'gradual feminization', 'female transformation', '여성화 진행'],
  },
  {
    id: 'masculinization',
    ko: '남성화',
    en: 'Masculinization',
    aliases: ['Masculinisation', 'masculinization TF', 'gradual masculinization', 'male transformation', '남성화 진행'],
  },
  { id: 'transformation', ko: '변신', en: 'Transformation', aliases: ['변화', 'TF', 'TFTG'] },
  { id: 'possession', ko: '빙의', en: 'Possession', aliases: ['憑依'] },
  { id: 'body_swap', ko: '바디스왑', en: 'Body Swap', aliases: ['교체', '入れ替わり'] },
  { id: 'reincarnation', ko: '환생·전생', en: 'Reincarnation', aliases: ['환생', '전생', '転生'] },
  { id: 'crossdressing', ko: '여장·남장', en: 'Crossdressing', aliases: ['여장', '남장'] },
  { id: 'skinsuit', ko: '가죽·스킨', en: 'Skinsuit / Bodysuit', aliases: ['가죽물', '皮モノ'] },
  { id: 'futanari', ko: '후타나리', en: 'Futanari (Fantasy)', aliases: ['후타'] },
  { id: 'reality_rewrite', ko: '현실개변', en: 'Reality Rewrite', aliases: ['기억조작', 'retcon gender'] },
  { id: 'avatar', ko: 'VR·아바타', en: 'VR / Avatar', aliases: ['여캐정착', 'trapped in female avatar'] },
  { id: 'surgery_modification', ko: '수술·신체개조', en: 'Surgery / Body Modification', aliases: ['수술', '실험'] },
  { id: 'other', ko: '기타', en: 'Other' },
];

export const TS_SUBGENRES: LocalizedOption[] = [
  { id: 'modern_daily', ko: '현대일상', en: 'Modern Daily Life' },
  { id: 'modern_fantasy', ko: '현대판타지', en: 'Modern Fantasy', aliases: ['현판'] },
  { id: 'fantasy', ko: '판타지', en: 'Fantasy' },
  { id: 'school_academy', ko: '학원·아카데미', en: 'School / Academy', aliases: ['학원', '아카데미'] },
  { id: 'workplace', ko: '직장', en: 'Workplace' },
  { id: 'streaming', ko: '인방·방송', en: 'Streaming / Broadcasting', aliases: ['인방'] },
  { id: 'entertainment', ko: '연예계', en: 'Entertainment Industry' },
  { id: 'romance', ko: '로맨스', en: 'Romance' },
  { id: 'comedy', ko: '코미디', en: 'Comedy' },
  { id: 'dark', ko: '피폐', en: 'Dark / Psychological' },
  { id: 'isekai', ko: '이세계', en: 'Isekai' },
  { id: 'game_system', ko: '게임·시스템', en: 'Game / System' },
  { id: 'hunter', ko: '헌터', en: 'Hunter / Dungeon' },
  { id: 'sf', ko: 'SF', en: 'Science Fiction' },
  { id: 'horror', ko: '호러', en: 'Horror' },
  { id: 'mystery', ko: '미스터리', en: 'Mystery' },
];

export const TS_MOODS: LocalizedOption[] = [
  { id: 'healing', ko: '힐링', en: 'Healing / Comfort' },
  { id: 'nadedade', ko: '나데나데', en: 'Pampering / Comfort', aliases: ['나데나데물'] },
  { id: 'comic', ko: '코믹', en: 'Comedic' },
  { id: 'calm', ko: '잔잔', en: 'Calm' },
  { id: 'fluttering', ko: '설렘', en: 'Romantic Tension' },
  { id: 'romantic', ko: '로맨틱', en: 'Romantic' },
  { id: 'awkward', ko: '당혹·수치', en: 'Awkward / Embarrassing' },
  { id: 'tense', ko: '긴장', en: 'Tense' },
  { id: 'light_dark', ko: '약피폐', en: 'Light Dark / Mild Angst', aliases: ['약피폐물'] },
  { id: 'dark', ko: '피폐', en: 'Dark / Angst' },
  { id: 'extreme_dark', ko: '극피폐', en: 'Extreme Dark' },
  { id: 'salvation', ko: '구원', en: 'Salvation / Rescue' },
  { id: 'dreamlike', ko: '몽환', en: 'Dreamlike' },
  { id: 'horror', ko: '공포', en: 'Horror' },
  { id: 'mystery', ko: '미스터리', en: 'Mysterious' },
  { id: 'lyrical', ko: '서정적', en: 'Lyrical' },
];

/**
 * 장르적 글쓰기 관습 프리셋.
 * 특정 국가 사람의 문체를 흉내내는 기능이 아니라 해당 팬덤/시장에 익숙한 서사 관습을 조합한다.
 */
export const TS_NARRATIVE_TRADITIONS: TsNarrativeTraditionOption[] = [
  {
    id: 'kr_webnovel',
    ko: '한국 웹소설형',
    en: 'Korean Webnovel Style',
    aliases: ['한국형', '노벨피아풍'],
    blend: { kr: 0.72, jp: 0.18, western: 0.10 },
    featuredPreferenceIds: ['daily_adaptation', 'secret_exposure', 'relationship_change', 'character_charm'],
  },
  {
    id: 'jp_tsf',
    ko: '일본 TSF·오토코노코형',
    en: 'Japanese TSF / Otokonoko Style',
    aliases: ['TSF', '女体化', '男の娘', '오토코노코'],
    blend: { kr: 0.12, jp: 0.78, western: 0.10 },
    featuredPreferenceIds: ['otokonoko', 'crossdressing_male', 'gradual_feminization', 'body_swap_focus', 'reality_rewrite_focus'],
  },
  {
    id: 'western_tgtf',
    ko: '서양 TG·TF 변환물형',
    en: 'Western TG / TF Style',
    aliases: ['TG', 'TF', 'TFTG', 'Transformation Fiction'],
    blend: { kr: 0.08, jp: 0.12, western: 0.80 },
    featuredPreferenceIds: ['transformation_process', 'body_sensory', 'gradual_feminization', 'skinsuit_focus', 'identity_shift'],
  },
  {
    id: 'hybrid',
    ko: '혼합·균형형',
    en: 'Hybrid / Balanced',
    aliases: ['글로벌형', '중간형'],
    blend: { kr: 0.34, jp: 0.33, western: 0.33 },
    featuredPreferenceIds: ['transformation_process', 'daily_adaptation', 'relationship_change', 'identity_shift'],
  },
];

export const TS_EXPRESSION_BALANCE: LocalizedOption[] = [
  { id: 'story_first', ko: '서사 중심', en: 'Story-first' },
  { id: 'balanced', ko: '균형', en: 'Balanced' },
  { id: 'fetish_forward', ko: '페티시 강조', en: 'Fetish-forward' },
];

/**
 * 선택형 취향·소재 사전.
 * 기본 화면에서는 노출하지 않고, "취향·소재 더보기"에서 검색/다중선택한다.
 * 실존 성정체성의 분류가 아니라 픽션의 캐릭터 표현과 변환 소재를 위한 태그다.
 */
export const TS_PREFERENCE_TAGS: TsPreferenceOption[] = [
  // 작품 중심 테마
  { id: 'identity_shift', ko: '자아·정체성 변화', en: 'Identity Shift', category: 'theme' },
  { id: 'daily_adaptation', ko: '일상 적응', en: 'Daily Adaptation', category: 'theme' },
  { id: 'relationship_change', ko: '관계 변화', en: 'Relationship Change', category: 'theme' },
  { id: 'secret_exposure', ko: '비밀 유지·발각', en: 'Secrecy / Exposure', category: 'theme' },
  { id: 'acceptance', ko: '거부→수용', en: 'Resistance → Acceptance', category: 'theme' },
  { id: 'return_or_stay', ko: '돌아갈지 남을지', en: 'Return or Stay', category: 'theme' },
  { id: 'social_role_change', ko: '사회적 역할 변화', en: 'Social Role Change', category: 'theme' },
  { id: 'character_charm', ko: '캐릭터 매력 중심', en: 'Character Charm', category: 'theme' },

  // 캐릭터 표현
  { id: 'otokonoko', ko: '보추·오토코노코', en: 'Otokonoko / Feminine Boy', aliases: ['男の娘', '보추'], category: 'character_expression' },
  { id: 'crossdressing_male', ko: '여장남자', en: 'Male Crossdressing', aliases: ['여장', 'crossdresser'], category: 'character_expression' },
  { id: 'androgynous', ko: '중성미·안드로지너스', en: 'Androgynous', category: 'character_expression' },
  { id: 'feminine_male', ko: '여성적인 남성', en: 'Feminine Male', category: 'character_expression' },
  { id: 'masculine_female', ko: '남성적인 여성', en: 'Masculine Female', category: 'character_expression' },

  // 변화 과정/묘사 초점
  { id: 'gradual_feminization', ko: '점진적 여성화', en: 'Gradual Feminization', aliases: ['feminization', 'feminisation'], category: 'transformation_focus' },
  { id: 'gradual_masculinization', ko: '점진적 남성화', en: 'Gradual Masculinization', aliases: ['masculinization', 'masculinisation'], category: 'transformation_focus' },
  { id: 'transformation_process', ko: '변화 과정 중심', en: 'Transformation Process', category: 'transformation_focus' },
  { id: 'appearance_clothing', ko: '외형·의상 변화', en: 'Appearance / Clothing Change', category: 'transformation_focus' },
  { id: 'body_sensory', ko: '신체감각 변화', en: 'Body / Sensory Change', category: 'transformation_focus' },
  { id: 'voice_change', ko: '목소리 변화', en: 'Voice Change', category: 'transformation_focus' },
  { id: 'role_change', ko: '성역할·생활 역할 변화', en: 'Gender / Life Role Change', category: 'transformation_focus' },

  // 팬덤에서 자주 분리되는 변환 취향
  { id: 'skinsuit_focus', ko: '가죽·스킨수트 중심', en: 'Skinsuit Focus', aliases: ['皮モノ'], category: 'community_fetish' },
  { id: 'body_swap_focus', ko: '바디스왑 중심', en: 'Body Swap Focus', aliases: ['入れ替わり'], category: 'community_fetish' },
  { id: 'reality_rewrite_focus', ko: '현실개변·기억개변 중심', en: 'Reality Rewrite Focus', category: 'community_fetish' },
  { id: 'avatar_lock', ko: '아바타·새 몸 고착', en: 'Avatar / New-body Lock-in', category: 'community_fetish' },
  { id: 'futanari_fantasy', ko: '후타나리 판타지', en: 'Futanari Fantasy', category: 'community_fetish' },

  // 관계/연애
  { id: 'pure_romance', ko: '순애', en: 'Pure Romance', category: 'relationship' },
  { id: 'yuri_gl', ko: '백합·GL', en: 'Yuri / GL', category: 'relationship' },
  { id: 'no_romance', ko: '노맨스', en: 'No Romance', category: 'relationship' },
  { id: 'misunderstanding', ko: '착각·오해', en: 'Misunderstanding', category: 'relationship' },
  { id: 'role_reversal', ko: '관계·역할 역전', en: 'Relationship / Role Reversal', category: 'relationship' },
];

export function getLocalizedLabel(option: LocalizedOption, language: UiLanguage): string {
  return language === 'en' ? option.en : option.ko;
}

export function normalizePrimaryMultiSelection(selection: PrimaryMultiSelection): PrimaryMultiSelection {
  const secondary = [...new Set(selection.secondary.filter((id) => id && id !== selection.primary))];
  return {
    primary: selection.primary,
    secondary,
  };
}

export function getTsNarrativeTradition(id?: TsNarrativeTraditionId | null): TsNarrativeTraditionOption | undefined {
  return TS_NARRATIVE_TRADITIONS.find((item) => item.id === id);
}

export function getTsPreferenceTags(ids: string[] = []): TsPreferenceOption[] {
  const selected = new Set(ids);
  return TS_PREFERENCE_TAGS.filter((item) => selected.has(item.id));
}

export function buildTsWorkDesignBrief(design: TsWorkDesign): string {
  const direction = TS_DIRECTIONS.find((item) => item.id === design.direction);
  const primaryType = TS_TYPES.find((item) => item.id === design.tsType.primary);
  const secondaryTypes = design.tsType.secondary
    .map((id) => TS_TYPES.find((item) => item.id === id))
    .filter((item): item is LocalizedOption => Boolean(item));
  const primarySubgenre = TS_SUBGENRES.find((item) => item.id === design.subgenre.primary);
  const secondarySubgenres = design.subgenre.secondary
    .map((id) => TS_SUBGENRES.find((item) => item.id === id))
    .filter((item): item is LocalizedOption => Boolean(item));
  const primaryMood = TS_MOODS.find((item) => item.id === design.mood.primary);
  const secondaryMoods = design.mood.secondary
    .map((id) => TS_MOODS.find((item) => item.id === id))
    .filter((item): item is LocalizedOption => Boolean(item));
  const tradition = getTsNarrativeTradition(design.narrativeTradition);
  const expressionBalance = TS_EXPRESSION_BALANCE.find((item) => item.id === design.expressionBalance);
  const preferenceTags = getTsPreferenceTags(design.preferenceTagIds || []);
  const seriesDesign = design.workKind === 'series' ? design as TsSeriesDesign : null;

  const label = (item?: LocalizedOption) => item ? getLocalizedLabel(item, design.manuscriptLanguage) : '';

  return [
    direction ? `TS 방향: ${label(direction)}` : '',
    primaryType ? `대표 TS 타입: ${label(primaryType)}` : '',
    secondaryTypes.length ? `추가 TS 타입: ${secondaryTypes.map(label).join(', ')}` : '',
    primarySubgenre ? `대표 부장르: ${label(primarySubgenre)}` : '',
    secondarySubgenres.length ? `추가 부장르: ${secondarySubgenres.map(label).join(', ')}` : '',
    primaryMood ? `대표 분위기: ${label(primaryMood)}` : '',
    secondaryMoods.length ? `추가 분위기: ${secondaryMoods.map(label).join(', ')}` : '',
    tradition ? `서사 스타일: ${label(tradition)}` : '',
    expressionBalance ? `표현 비중: ${label(expressionBalance)}` : '',
    preferenceTags.length ? `취향·소재: ${preferenceTags.map(label).join(', ')}` : '',
    design.storyCore.trim() ? `작품 핵심: ${design.storyCore.trim()}` : '',
    seriesDesign?.seriesCore.trim()
      ? `시리즈 전체 핵심: ${seriesDesign.seriesCore.trim()}`
      : '',
    seriesDesign?.volume1Core.trim()
      ? `1권 핵심 전개: ${seriesDesign.volume1Core.trim()}`
      : '',
  ].filter(Boolean).join('\n');
}
