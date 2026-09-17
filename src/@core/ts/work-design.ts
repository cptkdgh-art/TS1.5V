export type UiLanguage = 'ko' | 'en';
export type ManuscriptLanguage = 'ko' | 'en';
export type WorkKind = 'novel' | 'series';

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

export interface TsWorkDesign {
  workKind: WorkKind;
  uiLanguage: UiLanguage;
  manuscriptLanguage: ManuscriptLanguage;
  direction: string | null;
  tsType: PrimaryMultiSelection;
  subgenre: PrimaryMultiSelection;
  mood: PrimaryMultiSelection;
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
  { id: 'futanari', ko: '후타나리', en: 'Futanari', aliases: ['후타'] },
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

  const label = (item?: LocalizedOption) => item ? getLocalizedLabel(item, design.manuscriptLanguage) : '';

  return [
    direction ? `TS 방향: ${label(direction)}` : '',
    primaryType ? `대표 TS 타입: ${label(primaryType)}` : '',
    secondaryTypes.length ? `추가 TS 타입: ${secondaryTypes.map(label).join(', ')}` : '',
    primarySubgenre ? `대표 부장르: ${label(primarySubgenre)}` : '',
    secondarySubgenres.length ? `추가 부장르: ${secondarySubgenres.map(label).join(', ')}` : '',
    primaryMood ? `대표 분위기: ${label(primaryMood)}` : '',
    secondaryMoods.length ? `추가 분위기: ${secondaryMoods.map(label).join(', ')}` : '',
    design.storyCore.trim() ? `작품 핵심: ${design.storyCore.trim()}` : '',
    design.workKind === 'series' && 'seriesCore' in design && design.seriesCore.trim()
      ? `시리즈 전체 핵심: ${design.seriesCore.trim()}`
      : '',
    design.workKind === 'series' && 'volume1Core' in design && design.volume1Core.trim()
      ? `1권 핵심 전개: ${design.volume1Core.trim()}`
      : '',
  ].filter(Boolean).join('\n');
}
