/**
 * ============================================================
 * @module core/laws
 * @file genre-laws.ts
 * ============================================================
 * @description 장르별 웹소설 규칙 정의
 *
 * 이 규칙들은 AI 작가에게 직접 "이렇게 해라"라고 명령하지 않음.
 * 대신 자연스러운 맥락으로 녹여서 작가가 "원래 그런 거"처럼 쓰게 함.
 * ============================================================
 */

import type { GenreLaw, WebNovelGenre } from '@core/types/webnovel.types';

// ============================================================
// 로맨스 판타지 (로판)
// ============================================================
const ROMANCE_FANTASY: GenreLaw = {
  genre: 'romance-fantasy',
  name: '로맨스 판타지',
  description: '판타지 세계관 + 로맨스. 여성향의 대표 장르.',
  requirements: {
    mustHave: [
      '신분 상승 또는 계급 역전',
      '절대적 남주의 여주 독점욕',
      '빌런/악역에 대한 통쾌한 응징',
      '여주의 능력 각성 또는 인정받는 순간',
    ],
    recommended: [
      '회귀/빙의/환생 설정',
      '전생 기억을 활용한 미래 예지',
      '계약 결혼 → 진심으로 발전',
      '오해 → 해소 → 달달 전개',
    ],
    avoid: [
      '남주의 바람기 암시',
      '여주가 일방적으로 당하기만 하는 전개',
      '해소 없는 고구마 연속',
      '여주 수동성 과다',
    ],
    cliches: [
      '회빙환 (회귀/빙의/환생)',
      '"이 몸이 악녀라니"',
      '차가운 공작님이 녹는 과정',
      '무능력했던 여주가 먼치킨으로',
    ],
  },
  styleOverrides: {
    minDialogueRatio: 55,
    maxConsecutiveNarration: 4,
  },
  prompt: `당신은 로맨스 판타지 세계에서 이야기를 풀어가고 있습니다.
독자들은 여주인공의 성장과 남주와의 로맨스를 기대합니다.
답답한 전개가 있다면 반드시 시원한 해소가 따라와야 합니다.
남주는 여주에게만 특별해야 하고, 여주는 수동적이지 않아야 합니다.`,
};

// ============================================================
// 헌터물 / 회귀물
// ============================================================
const HUNTER: GenreLaw = {
  genre: 'hunter',
  name: '헌터물',
  description: '던전/게이트/각성자 세계관. 성장과 전투의 쾌감.',
  requirements: {
    mustHave: [
      '각성/등급 시스템 (E~S, SSS 등)',
      '던전/게이트/탑 등 성장의 장',
      '주인공만의 특별한 능력 또는 시스템',
      '압도적 실력 과시 장면 (먼치킨)',
    ],
    recommended: [
      '상태창/스킬창 시스템',
      '길드/클랜 소속 또는 솔로 플레이',
      '숨겨진 직업/유니크 스킬',
      '각성 전 무시당하다 → 각성 후 인정',
    ],
    avoid: [
      '주인공이 너무 오래 약한 상태',
      '복잡한 정치극 과다 (액션 부족)',
      '성장 없는 반복 패턴',
      '너무 쉬운 적만 등장',
    ],
    cliches: [
      '회귀해서 모든 정보 앎',
      '"겨우 E급이라고? 껄껄"',
      '숨긴 실력 들킬 뻔한 아슬아슬',
      '최강이 되어 복수/보호',
    ],
  },
  styleOverrides: {
    maxLinesPerParagraph: 4,
    minDialogueRatio: 45,
  },
  prompt: `당신은 각성자와 던전이 존재하는 세계에서 이야기를 씁니다.
독자들은 주인공의 압도적인 성장과 통쾌한 활약을 원합니다.
전투 장면은 역동적으로, 성장의 쾌감은 확실하게 전달하세요.
"이 정도면 되겠지"가 아니라 "역시 먼치킨"이라는 감탄이 나와야 합니다.`,
};

// ============================================================
// 무협
// ============================================================
const MARTIAL_ARTS: GenreLaw = {
  genre: 'martial-arts',
  name: '무협',
  description: '강호와 무림의 세계. 무공과 의리, 협객의 이야기.',
  requirements: {
    mustHave: [
      '무공/경지 체계 (후천-선천-화경-현경 등)',
      '정파/사파/중립 세력 구도',
      '사제 또는 문파 관계',
      '비급/신공/절학 획득',
    ],
    recommended: [
      '강호 은어와 무림 용어 활용',
      '의형제/맹약 등 의리 서사',
      '복수 또는 대의를 위한 여정',
      '무림맹/마교 등 거대 세력',
    ],
    avoid: [
      '현대어 과다 사용',
      '한자어 설명 없는 남발',
      '무공 수련 없는 급성장',
      '강호의 규율 무시',
    ],
    cliches: [
      '절벽 추락 → 동굴 → 비급 발견',
      '독으로 죽을 뻔 → 기연으로 내공 급상승',
      '폐관수련 후 경지 돌파',
      '"협의가 아니면 죽음을"',
    ],
  },
  styleOverrides: {
    rhythmPattern: 'varied',
    maxLinesPerParagraph: 4,
  },
  prompt: `당신은 강호와 무림이 펼쳐지는 세계에서 이야기를 씁니다.
강호의 분위기와 무협 특유의 문체가 자연스럽게 녹아들어야 합니다.
무공 대결은 긴장감 있게, 협객의 의리는 묵직하게 그려주세요.
현대적 표현보다는 강호의 정취가 느껴지는 문장을 사용합니다.`,
};

// ============================================================
// 아카데미물
// ============================================================
const ACADEMY: GenreLaw = {
  genre: 'academy',
  name: '아카데미물',
  description: '학원/아카데미 배경. 성장과 경쟁, 로맨스의 조화.',
  requirements: {
    mustHave: [
      '학년/반/기숙사 등 학교 시스템',
      '시험/대회/토너먼트 이벤트',
      '교수/교관 등 멘토 캐릭터',
      '라이벌 또는 동기 관계',
    ],
    recommended: [
      '숨겨진 실력자 주인공',
      '명문가 vs 평민 구도',
      '낙제 위기 → 반전 성적',
      '동아리/파티 결성',
    ],
    avoid: [
      '학원물 특성 무시한 전개',
      '학교 밖 이야기만 진행',
      '나이에 맞지 않는 어른스러움 과다',
    ],
    cliches: [
      '입학 첫날 사고',
      '모의전 에이스 등극',
      '"저 녀석 뭐야" (숨긴 실력)',
      '실기 시험에서 압도',
    ],
  },
  prompt: `당신은 특별한 아카데미가 있는 세계에서 이야기를 씁니다.
학원물 특유의 청춘, 경쟁, 성장의 서사가 중심입니다.
시험과 대회는 긴장감 있게, 동기들과의 관계는 입체적으로 그려주세요.`,
};

// ============================================================
// 현대 판타지 (여성향)
// ============================================================
const MODERN_FANTASY_F: GenreLaw = {
  genre: 'modern-fantasy-f',
  name: '현대 판타지 (여성향)',
  description: '현대 배경 + 판타지 요소. 재벌/연예계/직장 로맨스.',
  requirements: {
    mustHave: [
      '현대적 배경 (도시, 회사, 연예계 등)',
      '판타지 요소 (능력, 회귀, 초자연)',
      '남주의 압도적 스펙',
      '여주의 성장 또는 복수',
    ],
    recommended: [
      '재벌 2세/CEO 남주',
      '비서/계약 관계에서 시작',
      '숨겨진 정체 공개 장면',
      '사이다 복수 (회사/가족)',
    ],
    avoid: [
      '현실과 동떨어진 판타지 과다',
      '여주 캐릭터 일관성 부족',
    ],
    cliches: [
      '회귀해서 주식/로또',
      '"전 남편(약혼자)에게 복수"',
      '버려진 딸이 진짜 상속녀',
    ],
  },
  prompt: `당신은 현대 사회에 판타지 요소가 섞인 세계에서 이야기를 씁니다.
세련된 현대적 감각과 판타지의 쾌감을 모두 담아주세요.
독자들은 현실에서 불가능한 통쾌함과 로맨스를 원합니다.`,
};

// ============================================================
// 게임 판타지
// ============================================================
const GAME_FANTASY: GenreLaw = {
  genre: 'game-fantasy',
  name: '게임 판타지',
  description: '게임 속 세계 또는 게임 시스템이 현실화된 세계.',
  requirements: {
    mustHave: [
      '레벨/스탯/스킬 시스템',
      '퀘스트 또는 미션 구조',
      '아이템/장비 획득의 쾌감',
      '성장의 수치적 체감',
    ],
    recommended: [
      '상태창 UI 묘사',
      '히든 퀘스트/히든 직업',
      '버그/글리치 활용',
      'NPC와의 상호작용',
    ],
    avoid: [
      '게임 시스템 일관성 부족',
      '레벨업만 반복되는 단조로움',
    ],
    cliches: [
      '최초 발견 보너스',
      '유일무이 히든 클래스',
      '"이 스킬 개사기네"',
    ],
  },
  prompt: `당신은 게임 시스템이 작동하는 세계에서 이야기를 씁니다.
레벨업, 스킬 획득, 아이템 드랍의 쾌감을 생생하게 전달하세요.
상태창은 명확하게, 성장은 체감되게 묘사합니다.`,
};

// ============================================================
// 퓨전
// ============================================================
const FUSION: GenreLaw = {
  genre: 'fusion',
  name: '퓨전',
  description: '장르 경계를 넘나드는 자유로운 조합.',
  requirements: {
    mustHave: [
      '두 가지 이상 장르 요소의 자연스러운 결합',
      '일관된 세계관 규칙',
    ],
    recommended: [
      '독창적인 설정',
      '익숙함 속 신선함',
    ],
    avoid: [
      '장르 요소의 어색한 결합',
      '세계관 규칙 혼란',
    ],
    cliches: [],
  },
  prompt: `당신은 여러 장르가 융합된 세계에서 이야기를 씁니다.
각 장르의 매력을 살리면서도 하나의 세계관으로 자연스럽게 녹여내세요.`,
};

// ============================================================
// 대체역사
// ============================================================
const ALT_HISTORY: GenreLaw = {
  genre: 'alt-history',
  name: '대체역사',
  description: '역사의 분기점을 바꾸어 펼쳐지는 이야기.',
  requirements: {
    mustHave: [
      '실제 역사적 사건/인물의 변용',
      '분기점(Point of Divergence) 설정',
      '역사 지식을 활용한 서사',
    ],
    recommended: [
      '현대인 회귀/빙의',
      '미래 지식으로 역사 개입',
      '가상 국가/세력 등장',
    ],
    avoid: [
      '역사 고증 무시',
      '현대 감각 과다 이식',
    ],
    cliches: [
      '조선 시대 회귀',
      '삼국지 빙의',
      '일제강점기 독립운동',
    ],
  },
  prompt: `당신은 역사가 다르게 흘러간 세계에서 이야기를 씁니다.
역사적 배경의 디테일과 분위기를 살리되, 픽션의 자유도 함께 누리세요.`,
};

// ============================================================
// 장르 규칙 레지스트리
// ============================================================

/** 모든 장르 규칙 */
export const GENRE_LAWS: Record<WebNovelGenre, GenreLaw> = {
  'romance-fantasy': ROMANCE_FANTASY,
  'modern-fantasy-f': MODERN_FANTASY_F,
  'romance': {
    ...ROMANCE_FANTASY,
    genre: 'romance',
    name: '순정 로맨스',
    description: '판타지 요소 없는 순수 로맨스.',
    prompt: `당신은 현실적인 로맨스를 그립니다. 감정의 섬세한 묘사가 핵심입니다.`,
  },
  'bl': {
    ...ROMANCE_FANTASY,
    genre: 'bl',
    name: 'BL',
    description: '남성 간의 로맨스.',
    requirements: {
      ...ROMANCE_FANTASY.requirements,
      mustHave: [
        '두 남성 캐릭터 간의 로맨스',
        '감정선의 섬세한 발전',
        '관계 역학의 명확성 (공수 등)',
      ],
    },
    prompt: `당신은 BL 로맨스를 그립니다. 두 캐릭터 간의 감정 발전을 섬세하게 묘사하세요.`,
  },
  'hunter': HUNTER,
  'martial-arts': MARTIAL_ARTS,
  'game-fantasy': GAME_FANTASY,
  'academy': ACADEMY,
  'regression': {
    ...HUNTER,
    genre: 'regression',
    name: '회귀물',
    description: '과거로 돌아가 다시 시작하는 이야기.',
    requirements: {
      ...HUNTER.requirements,
      mustHave: [
        '회귀 트리거 (죽음, 각성 등)',
        '전생 기억/경험 활용',
        '운명 변경 시도',
        '주요 사건 선점',
      ],
    },
    prompt: `당신은 회귀자의 이야기를 씁니다. 미래 지식을 활용한 통쾌한 전개가 핵심입니다.`,
  },
  'possession': {
    ...ROMANCE_FANTASY,
    genre: 'possession',
    name: '빙의물',
    description: '다른 존재의 몸에 들어가 살아가는 이야기.',
    requirements: {
      ...ROMANCE_FANTASY.requirements,
      mustHave: [
        '빙의 트리거',
        '원래 인물의 기억/관계 처리',
        '정체 숨김과 발각 위기',
        '새로운 삶에서의 변화',
      ],
    },
    prompt: `당신은 빙의자의 이야기를 씁니다. 다른 존재로 살아가는 아슬아슬함을 그려주세요.`,
  },
  'fusion': FUSION,
  'alt-history': ALT_HISTORY,
  'mystery': {
    genre: 'mystery',
    name: '미스터리/스릴러',
    description: '수수께끼와 긴장감의 이야기.',
    requirements: {
      mustHave: ['중심 미스터리', '단서와 복선', '반전 또는 해결'],
      recommended: ['레드헤링', '신뢰할 수 없는 화자'],
      avoid: ['해결 없는 미스터리', '뜬금없는 범인'],
      cliches: [],
    },
    prompt: `당신은 미스터리를 풀어갑니다. 독자에게 단서를 주되 결말은 숨기세요.`,
  },
  'horror': {
    genre: 'horror',
    name: '호러',
    description: '공포와 불안의 이야기.',
    requirements: {
      mustHave: ['공포 요소', '긴장감 조성', '위기와 생존'],
      recommended: ['심리적 공포', '반전'],
      avoid: ['공포 없는 그로테스크', '무의미한 잔인함'],
      cliches: [],
    },
    prompt: `당신은 공포를 조성합니다. 보이지 않는 것의 두려움을 활용하세요.`,
  },
  'slice-of-life': {
    genre: 'slice-of-life',
    name: '일상물',
    description: '특별하지 않은 일상의 특별함.',
    requirements: {
      mustHave: ['일상적 배경', '캐릭터 간 상호작용', '잔잔한 감동'],
      recommended: ['소소한 에피소드', '성장'],
      avoid: ['갑작스러운 장르 변경', '과도한 드라마'],
      cliches: [],
    },
    prompt: `당신은 일상의 소소한 이야기를 그립니다. 작은 것에서 감동을 찾아주세요.`,
  },
  'custom': {
    genre: 'custom',
    name: '사용자 정의',
    description: '사용자가 직접 정의한 장르.',
    requirements: {
      mustHave: [],
      recommended: [],
      avoid: [],
      cliches: [],
    },
    prompt: ``,
  },
};

/**
 * 장르 규칙 가져오기
 */
export function getGenreLaw(genre: WebNovelGenre): GenreLaw {
  return GENRE_LAWS[genre] || GENRE_LAWS['custom'];
}

/**
 * 장르 목록 (UI용)
 */
export function getGenreList(): Array<{ value: WebNovelGenre; label: string; category: string }> {
  return [
    // 여성향
    { value: 'romance-fantasy', label: '로맨스 판타지', category: '여성향' },
    { value: 'modern-fantasy-f', label: '현대 판타지', category: '여성향' },
    { value: 'romance', label: '순정 로맨스', category: '여성향' },
    { value: 'bl', label: 'BL', category: '여성향' },
    { value: 'possession', label: '빙의물', category: '여성향' },
    // 남성향
    { value: 'hunter', label: '헌터물', category: '남성향' },
    { value: 'martial-arts', label: '무협', category: '남성향' },
    { value: 'game-fantasy', label: '게임 판타지', category: '남성향' },
    { value: 'academy', label: '아카데미물', category: '남성향' },
    { value: 'regression', label: '회귀물', category: '남성향' },
    // 공용
    { value: 'fusion', label: '퓨전', category: '공용' },
    { value: 'alt-history', label: '대체역사', category: '공용' },
    { value: 'mystery', label: '미스터리', category: '공용' },
    { value: 'horror', label: '호러', category: '공용' },
    { value: 'slice-of-life', label: '일상물', category: '공용' },
    { value: 'custom', label: '직접 설정', category: '기타' },
  ];
}
