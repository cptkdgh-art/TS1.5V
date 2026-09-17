import type { ManuscriptLanguage, TsWorkDesign } from './work-design';

export type TsDictionaryRegion = 'kr' | 'jp' | 'en' | 'global';
export type TsDictionaryCategory =
  | 'umbrella'
  | 'direction'
  | 'mechanism'
  | 'regional_term'
  | 'character_expression'
  | 'transformation_focus'
  | 'relationship'
  | 'community_trope';
export type TsDictionaryConfidence = 'high' | 'medium' | 'community';
export type TsDictionaryMaturity = 'general' | 'adult-context';

export interface TsDictionarySource {
  id: string;
  title: string;
  url: string;
  region: TsDictionaryRegion;
  kind: 'dictionary' | 'platform' | 'community-reference' | 'archive' | 'article';
  note?: string;
}

export interface TsDictionaryEntry {
  id: string;
  category: TsDictionaryCategory;
  labels: {
    ko: string;
    en: string;
    ja?: string;
  };
  aliases: string[];
  regions: TsDictionaryRegion[];
  summary: {
    ko: string;
    en: string;
  };
  distinctions?: {
    ko: string[];
    en: string[];
  };
  promptHints?: {
    ko: string[];
    en: string[];
  };
  continuityRules?: {
    ko: string[];
    en: string[];
  };
  relatedIds?: string[];
  sourceIds: string[];
  confidence: TsDictionaryConfidence;
  maturity: TsDictionaryMaturity;
  selectableInCreateWork: boolean;
}

/**
 * 출처는 "정답 데이터"가 아니라 용례 검증 근거다.
 * 플랫폼·팬덤별 의미가 겹치거나 달라질 수 있으므로 사전 본문에서 차이를 함께 보존한다.
 */
export const TS_DICTIONARY_SOURCES: TsDictionarySource[] = [
  {
    id: 'wiktionary-tsf',
    title: 'Wiktionary — TSF',
    url: 'https://en.wiktionary.org/wiki/TSF',
    region: 'jp',
    kind: 'dictionary',
    note: 'TSF의 일본어 용례와 역사적 인용을 확인하는 기본 출처.',
  },
  {
    id: 'japandict-otokonoko',
    title: 'JapanDict — 男の娘',
    url: 'https://www.japandict.com/%E7%94%B7%E3%81%AE%E5%A8%98?lang=eng',
    region: 'jp',
    kind: 'dictionary',
    note: 'JMdict 기반 남の娘 기본 뜻 확인.',
  },
  {
    id: 'tsfes-about',
    title: 'TSFes — 사이트 설명',
    url: 'https://tsfes.com/about/',
    region: 'jp',
    kind: 'community-reference',
    note: '女体化·憑依·入れ替わり·皮モノ·他者変身 등 일본 TSF 실무 분류 확인.',
  },
  {
    id: 'narou-ts-glossary',
    title: '小説家になろう — TS用語集',
    url: 'https://ncode.syosetu.com/n6126gu/2/',
    region: 'jp',
    kind: 'community-reference',
    note: 'MtF/FtM, 男の娘, TS病, TS転生, TS百合 등 커뮤니티 용례 확인.',
  },
  {
    id: 'kaiyou-asaon',
    title: 'KAI-YOU — あさおんV',
    url: 'https://kai-you.net/article/80374',
    region: 'jp',
    kind: 'article',
    note: 'あさおん을 “朝起きたら女の子になっていた”의 약칭으로 설명.',
  },
  {
    id: 'fanlore-genderswap',
    title: 'Fanlore — Genderswap',
    url: 'https://fanlore.org/wiki/Genderswap',
    region: 'en',
    kind: 'community-reference',
    note: 'Rule 63, Always-a-girl, in-universe change 등 서로 다른 genderswap 용례를 구분하는 데 참고.',
  },
  {
    id: 'ao3-gender-tags',
    title: 'AO3 — Reorganization and Additions to Gender Transition Canonicals',
    url: 'https://secure.ao3.org/admin_posts/30937',
    region: 'en',
    kind: 'platform',
    note: 'Changes to Gender or Sex, Gender Transition, Medical/Forced Gender Transition 분리 원칙 확인.',
  },
  {
    id: 'fictionmania-fanlore',
    title: 'Fanlore — Fictionmania',
    url: 'https://fanlore.org/wiki/Fictionmania',
    region: 'en',
    kind: 'archive',
    note: 'Body Suit, Body Swap, Mind Transfer/Possession, Slow/Fast Transformation, Stuck 등 TG/TF 분류 체계 확인.',
  },
  {
    id: 'transformation-story-archive',
    title: 'Transformation Story Archive overview',
    url: 'https://en.wikipedia.org/wiki/Transformation_Story_Archive',
    region: 'en',
    kind: 'archive',
    note: '인터넷 TF 창작 아카이브의 역사적 맥락 참고.',
  },
  {
    id: 'rule63-wikipedia',
    title: 'Wikipedia — Rule 63',
    url: 'https://en.wikipedia.org/wiki/Rule_63',
    region: 'en',
    kind: 'dictionary',
    note: '작중 변신과 별개인 팬덤 성반전 버전 용어로 분리하기 위한 근거.',
  },
  {
    id: 'librewiki-ts',
    title: '리브레 위키 — TS물',
    url: 'https://librewiki.net/wiki/TS%EB%AC%BC',
    region: 'kr',
    kind: 'community-reference',
    note: '한국어권의 변신·교체·빙의·수술·환생·가죽 등 기본 분류 참고.',
  },
  {
    id: 'namu-ts',
    title: '나무위키 — TS물',
    url: 'https://namu.moe/w/TS%EB%AC%BC',
    region: 'kr',
    kind: 'community-reference',
    note: '한국 커뮤니티 용어·세부분류 확인용. 공식 표준으로 취급하지 않는다.',
  },
  {
    id: 'namu-body-swap',
    title: '나무위키 — 몸 바꾸기',
    url: 'https://namu.moe/w/%EB%AA%B8%20%EB%B0%94%EA%BE%B8%EA%B8%B0',
    region: 'kr',
    kind: 'community-reference',
  },
  {
    id: 'namu-mesuochi',
    title: '나무위키 — 암컷타락',
    url: 'https://namu.moe/w/%EC%95%94%EC%BB%B7%ED%83%80%EB%9D%BD',
    region: 'kr',
    kind: 'community-reference',
    note: '성인/페티시 문맥의 한국 커뮤니티 용례 확인용.',
  },
];

export const TS_DICTIONARY: TsDictionaryEntry[] = [
  {
    id: 'tsf', category: 'umbrella',
    labels: { ko: 'TSF', en: 'TSF', ja: 'TSF / 性転換もの' },
    aliases: ['TS', 'TSもの', 'Transsexual Fiction', 'Transsexual Fantasy'],
    regions: ['jp', 'kr'],
    summary: {
      ko: '성별·신체 성의 변화가 서사의 핵심 장치가 되는 픽션을 가리키는 일본계 장르 용어. 한국의 TS물과 크게 겹치지만 작품·커뮤니티마다 포함 범위가 다르다.',
      en: 'A Japan-origin genre label for fiction centered on changes of sex/gendered body. It overlaps strongly with Korean TS fiction, but community boundaries vary.',
    },
    distinctions: {
      ko: ['현실의 트랜스젠더 정체성·의료 전환과 동일한 개념으로 취급하지 않는다.', 'Rule 63처럼 처음부터 다른 성별 버전으로 설정된 2차창작과는 별도 분류할 수 있다.'],
      en: ['Do not equate the fiction label with real-world transgender identity or medical transition.', 'It can be separated from Rule-63/always-another-gender redesigns that contain no in-story change.'],
    },
    promptHints: {
      ko: ['변화 자체뿐 아니라 변화 전후의 자아·관계·사회적 인식 차이가 이야기의 기능을 갖게 한다.'],
      en: ['Give the change narrative consequences in identity, relationships, embodiment, or social role.'],
    },
    relatedIds: ['gender_change', 'tg_tf', 'rule63'], sourceIds: ['wiktionary-tsf', 'tsfes-about', 'librewiki-ts'], confidence: 'high', maturity: 'general', selectableInCreateWork: false,
  },
  {
    id: 'tg_tf', category: 'umbrella',
    labels: { ko: 'TG/TF', en: 'TG / TF', ja: 'TG / TF' },
    aliases: ['TG', 'TF', 'TFTG', 'Gender Transformation', 'Transformation Fiction'],
    regions: ['en', 'global'],
    summary: {
      ko: '영어권 변환 창작에서 TG는 성별·성적 신체 변화, TF는 더 넓은 변신을 가리키는 경우가 많다. 실제 플랫폼마다 의미 범위는 다르다.',
      en: 'In English-language transformation fandom, TG commonly marks gender/sex change while TF is the broader transformation umbrella; usage varies by community.',
    },
    distinctions: {
      ko: ['영어권의 TG는 실존 정체성 의미와 픽션 장르 약칭이 충돌할 수 있으므로 UI 설명에서 픽션 문맥을 명시한다.'],
      en: ['Because TG also has real-world identity meanings, UI copy should explicitly mark the fictional-transformation context.'],
    },
    relatedIds: ['tsf', 'transformation', 'gender_change'], sourceIds: ['fictionmania-fanlore', 'transformation-story-archive'], confidence: 'medium', maturity: 'general', selectableInCreateWork: false,
  },
  {
    id: 'mtf', category: 'direction',
    labels: { ko: '남→여', en: 'Male → Female', ja: 'MtF / 男→女' }, aliases: ['M2F', 'MtF', '♂→♀'], regions: ['global'],
    summary: { ko: '남성 신체·역할에서 여성 신체·역할 쪽으로 변화하는 방향 태그.', en: 'A direction tag for a male-to-female transformation.' },
    continuityRules: { ko: ['원래 상태와 현재 상태를 별도로 저장한다.', '신체 변화와 자아·기억 변화는 자동으로 동일시하지 않는다.'], en: ['Track original and current state separately.', 'Do not assume body change automatically changes memory or identity.'] },
    relatedIds: ['feminization', 'nyotaika'], sourceIds: ['narou-ts-glossary', 'fictionmania-fanlore'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'ftm', category: 'direction',
    labels: { ko: '여→남', en: 'Female → Male', ja: 'FtM / 女→男' }, aliases: ['F2M', 'FtM', '♀→♂'], regions: ['global'],
    summary: { ko: '여성 신체·역할에서 남성 신체·역할 쪽으로 변화하는 방향 태그.', en: 'A direction tag for a female-to-male transformation.' },
    continuityRules: { ko: ['원래 상태와 현재 상태를 별도로 저장한다.'], en: ['Track original and current state separately.'] },
    relatedIds: ['masculinization', 'nantaika'], sourceIds: ['narou-ts-glossary', 'fictionmania-fanlore'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'gender_change', category: 'mechanism',
    labels: { ko: '성전환·성별변화', en: 'Gender / Sex Change', ja: '性転換' }, aliases: ['gender change', 'sex change', 'gender transformation', 'TS'], regions: ['global'],
    summary: { ko: '변화의 구체적 원인보다 “성별·성적 신체가 달라졌다”는 결과를 중심에 두는 상위 분류.', en: 'An umbrella result category centered on a change of sex/gendered body regardless of the exact mechanism.' },
    relatedIds: ['transformation', 'body_swap', 'possession', 'reincarnation'], sourceIds: ['ao3-gender-tags', 'librewiki-ts'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'transformation', category: 'mechanism',
    labels: { ko: '변신·신체변화', en: 'Transformation', ja: '変身・変化 / 他者変身' }, aliases: ['TF', 'morph', 'shapeshifting'], regions: ['global'],
    summary: { ko: '같은 인물의 몸 자체가 다른 형태로 바뀌는 방식. TS에서는 성적 신체 변화가 포함되는 변신을 뜻한다.', en: 'The same character’s body changes form; in TS usage this includes transformation of sexed/gendered anatomy.' },
    continuityRules: { ko: ['변화 전·중·후 단계와 가역성을 기록한다.', '몸이 바뀌어도 기억·성격·법적 신분 변화 여부는 별도 설정으로 둔다.'], en: ['Track pre/change/post stages and reversibility.', 'Body change does not automatically rewrite memory, personality, or legal identity.'] },
    relatedIds: ['feminization', 'slow_transformation', 'fast_transformation'], sourceIds: ['tsfes-about', 'fictionmania-fanlore'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'feminization', category: 'transformation_focus',
    labels: { ko: '여성화', en: 'Feminization', ja: '女性化 / 女体化系' }, aliases: ['feminisation', 'feminizing', 'female transformation', 'gradual feminization'], regions: ['en', 'global'],
    summary: { ko: '외형·신체·행동·사회적 역할 등이 더 여성적으로 변하는 과정에 초점을 둔 넓은 표현. 완전한 성전환과 동의어일 필요는 없다.', en: 'A broad focus on becoming more feminine in body, appearance, behavior, or role; it does not necessarily imply a complete sex change.' },
    distinctions: { ko: ['sissification은 성인·복종·굴욕 문맥을 동반하는 경우가 많아 일반 여성화와 분리한다.'], en: ['Keep generic feminization separate from sissification, which often carries adult, submissive, or humiliation-specific context.'] },
    promptHints: { ko: ['어떤 축이 여성화되는지—신체, 외형, 목소리, 습관, 사회적 역할, 자아—를 구분한다.'], en: ['Specify which axes change: body, appearance, voice, habits, social role, or identity.'] },
    relatedIds: ['mtf', 'nyotaika', 'slow_transformation'], sourceIds: ['fictionmania-fanlore'], confidence: 'medium', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'masculinization', category: 'transformation_focus',
    labels: { ko: '남성화', en: 'Masculinization', ja: '男性化 / 男体化系' }, aliases: ['masculinisation', 'male transformation'], regions: ['en', 'global'],
    summary: { ko: '외형·신체·행동·사회적 역할 등이 더 남성적으로 변하는 과정에 초점을 둔 표현.', en: 'A focus on becoming more masculine in body, appearance, behavior, or social role.' },
    relatedIds: ['ftm', 'nantaika'], sourceIds: ['narou-ts-glossary'], confidence: 'medium', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'body_swap', category: 'mechanism',
    labels: { ko: '바디스왑·교체', en: 'Body Swap', ja: '入れ替わり' }, aliases: ['body switch', '교체', '몸 바꾸기', '入れ替わり'], regions: ['global'],
    summary: { ko: '두 인물의 정신·자아가 서로의 몸으로 이동하거나 교환되는 유형. 한쪽만 이동하는 mind transfer/possession과 구분할 수 있다.', en: 'Two characters exchange bodies/minds. It can be distinguished from one-way mind transfer or possession.' },
    continuityRules: { ko: ['정신 소유자와 신체 소유자를 각각 추적한다.', 'A가 B의 몸을 쓸 때 B의 사회적 신분·관계가 자동으로 A의 기억이 되는 것은 아니다.'], en: ['Track mind-owner and body-owner separately.', 'Using another person’s body does not automatically grant their memories or social knowledge.'] },
    relatedIds: ['possession'], sourceIds: ['fictionmania-fanlore', 'namu-body-swap', 'tsfes-about'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'possession', category: 'mechanism',
    labels: { ko: '빙의', en: 'Possession / Mind Possession', ja: '憑依' }, aliases: ['mind possession', 'mind transfer', '빙의', '憑依'], regions: ['global'],
    summary: { ko: '한 인물의 정신·영혼이 다른 몸에 들어가 그 몸을 사용하거나 공유하는 유형. 상호교환이 필수인 바디스왑과 다르다.', en: 'A mind or soul enters another body and controls or shares it; unlike body swap, a reciprocal exchange is not required.' },
    continuityRules: { ko: ['원래 몸의 상태, 원래 몸 주인의 존재 여부, 기억 공유 여부를 별도 필드로 둔다.'], en: ['Track the original body, the host’s continuing presence, and whether memories are shared.'] },
    relatedIds: ['body_swap'], sourceIds: ['tsfes-about', 'fictionmania-fanlore'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'reincarnation', category: 'mechanism',
    labels: { ko: '환생·전생', en: 'Reincarnation', ja: 'TS転生 / 転生' }, aliases: ['TS reincarnation', 'TS転生', '전생', '환생'], regions: ['jp', 'kr', 'global'],
    summary: { ko: '죽음·재탄생 또는 전생 설정을 통해 이전과 다른 성별의 몸으로 태어나는 유형.', en: 'A reincarnation setup in which a character is reborn in a body of another sex/gender.' },
    continuityRules: { ko: ['전생 기억의 보존 범위와 새 몸의 성장 이력을 분리한다.'], en: ['Separate retained past-life memory from the new body’s life history.'] },
    sourceIds: ['narou-ts-glossary', 'librewiki-ts'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'skinsuit', category: 'mechanism',
    labels: { ko: '가죽·스킨수트', en: 'Skinsuit / Bodysuit', ja: '皮モノ' }, aliases: ['skin suit', 'body suit', '가죽물', '皮モノ'], regions: ['jp', 'en', 'kr'],
    summary: { ko: '특정 피부·수트·몸 외피를 착용해 다른 신체를 얻는 변환 유형. 커뮤니티별로 TS에 포함하는 범위가 다르다.', en: 'A transformation mode in which wearing a skin/body suit grants another body; whether it counts as TS varies by community.' },
    continuityRules: { ko: ['착용·해제 가능 여부, 수트와 착용자의 감각 연결, 원래 몸의 보존 여부를 기록한다.'], en: ['Track removability, sensory linkage, and whether the original body remains.'] },
    sourceIds: ['tsfes-about', 'fictionmania-fanlore', 'narou-ts-glossary'], confidence: 'high', maturity: 'adult-context', selectableInCreateWork: true,
  },
  {
    id: 'reality_rewrite', category: 'mechanism',
    labels: { ko: '현실개변·기억개변', en: 'Reality Rewrite', ja: '現実改変' }, aliases: ['reality alteration', 'retcon gender', 'memory rewrite', '현실조작'], regions: ['jp', 'kr', 'en'],
    summary: { ko: '몸만 바뀌는 것이 아니라 세계의 기록·타인의 기억·사회적 사실까지 새 현실에 맞춰 바뀌는 유형.', en: 'A change that rewrites not only the body but records, others’ memories, or social facts to match a new reality.' },
    continuityRules: { ko: ['누가 이전 현실을 기억하는지, 문서·사진·가족관계·법적기록까지 무엇이 바뀌는지 범위를 명시한다.'], en: ['Specify who remembers the old reality and which records, photos, family ties, and legal facts are rewritten.'] },
    sourceIds: ['namu-ts', 'narou-ts-glossary'], confidence: 'medium', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'avatar_lock', category: 'mechanism',
    labels: { ko: 'VR·아바타 고착', en: 'Avatar / New-body Lock-in', ja: '女性アバター定着系' }, aliases: ['trapped in female avatar', 'avatar lock', '여캐정착'], regions: ['jp', 'kr', 'en'],
    summary: { ko: '게임·VR 아바타 또는 새 몸에 들어간 뒤 원래 상태로 쉽게 돌아갈 수 없게 되는 유형.', en: 'A game/VR/avatar or new-body scenario where the character becomes stuck or cannot easily return to the original form.' },
    continuityRules: { ko: ['현실 몸의 존재 여부와 로그아웃·복귀 조건을 분리한다.'], en: ['Track whether the real body still exists and the conditions for logout/reversion.'] },
    sourceIds: ['narou-ts-glossary', 'fictionmania-fanlore'], confidence: 'medium', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'surgery', category: 'mechanism',
    labels: { ko: '수술·신체개조', en: 'Surgery / Body Modification', ja: '手術' }, aliases: ['operation', 'body modification', '수술'], regions: ['global'],
    summary: { ko: '수술·의료·신체개조를 변화 장치로 사용하는 유형. 현실적 의료 전환과 완전히 같은 문법으로 취급하지 않도록 작품 맥락을 구분한다.', en: 'A fiction mechanism using surgery or body modification; distinguish speculative transformation from realistic medical-transition narratives when relevant.' },
    sourceIds: ['fictionmania-fanlore', 'ao3-gender-tags', 'librewiki-ts'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'asaon', category: 'regional_term',
    labels: { ko: '아사온·자고 일어나니 여자', en: 'Woke Up as a Girl', ja: 'あさおん / 朝おん' }, aliases: ['朝起きたら女の子になっていた', 'woke up as a girl', '아침에 일어나니 여자'], regions: ['jp'],
    summary: { ko: '“아침에 일어났더니 여자아이가 되어 있었다”는 일본 TSF의 정형 상황을 가리키는 약칭.', en: 'Japanese TSF shorthand for the stock setup “woke up in the morning and had become a girl.”' },
    distinctions: { ko: ['변화 과정 자체보다 변화가 이미 끝난 뒤의 당혹·적응·일상에 초점을 두기 쉽다.'], en: ['Often skips the transformation process itself and starts with the aftermath, adaptation, and social reaction.'] },
    sourceIds: ['kaiyou-asaon', 'narou-ts-glossary'], confidence: 'high', maturity: 'general', selectableInCreateWork: false,
  },
  {
    id: 'ts_disease', category: 'regional_term',
    labels: { ko: 'TS병·성전환병', en: 'Gender-change Disease', ja: 'TS病 / 性転換病' }, aliases: ['TS病', '性転換病', '성전환병', 'sudden sex change disease'], regions: ['jp', 'kr'],
    summary: { ko: '원인불명 질환·바이러스·체질 등으로 성별이 바뀌는 설정을 묶는 커뮤니티형 용어.', en: 'A community fiction label for sex/gender change caused by an unexplained disease, virus, syndrome, or constitution.' },
    continuityRules: { ko: ['감염·발현 조건, 변화 속도, 치료/복귀 가능성, 사회적 인지 여부를 정한다.'], en: ['Define transmission/onset, speed, reversibility/treatment, and public awareness.'] },
    sourceIds: ['narou-ts-glossary'], confidence: 'medium', maturity: 'general', selectableInCreateWork: false,
  },
  {
    id: 'nyotaika', category: 'regional_term',
    labels: { ko: '여체화', en: 'Nyotaika / Female-body Transformation', ja: '女体化 / にょた化' }, aliases: ['女体化', 'にょた', 'にょた化', 'nyota', 'nyotaika'], regions: ['jp'],
    summary: { ko: '남성 캐릭터가 여성 신체가 되는 것을 가리키는 일본어 표현. 작중 변화와 2차창작 성반전 양쪽에서 쓰일 수 있어 문맥 구분이 필요하다.', en: 'A Japanese term for a male character becoming/having a female body; it may be used for in-story transformation or gender-swapped fanwork depending on context.' },
    distinctions: { ko: ['작중 사건으로 변했는지, 처음부터 여성 버전으로 재설계된 것인지 별도 플래그로 구분한다.'], en: ['Distinguish in-story change from an always-female redesign/fanwork version.'] },
    relatedIds: ['mtf', 'feminization', 'rule63'], sourceIds: ['wiktionary-tsf', 'narou-ts-glossary'], confidence: 'medium', maturity: 'general', selectableInCreateWork: false,
  },
  {
    id: 'nantaika', category: 'regional_term',
    labels: { ko: '남체화', en: 'Nantaika / Male-body Transformation', ja: '男体化' }, aliases: ['男体化', 'nantaika'], regions: ['jp'],
    summary: { ko: '여성 캐릭터가 남성 신체가 되는 것을 가리키는 일본어 표현.', en: 'A Japanese term for a female character becoming/having a male body.' },
    relatedIds: ['ftm', 'masculinization'], sourceIds: ['narou-ts-glossary'], confidence: 'medium', maturity: 'general', selectableInCreateWork: false,
  },
  {
    id: 'otokonoko', category: 'character_expression',
    labels: { ko: '오토코노코·여성적인 남성 캐릭터', en: 'Otokonoko / Feminine Boy', ja: '男の娘' }, aliases: ['男の娘', 'otokonoko', 'feminine boy', 'femboy'], regions: ['jp', 'kr', 'en'],
    summary: { ko: '여성적으로 보이거나 여성적 표현을 하는 남성 캐릭터를 가리키는 일본 서브컬처 용어. 그 자체로 TS/성전환을 뜻하지 않는다.', en: 'A Japanese pop-culture term for a male character with strongly feminine appearance/expression; it is not inherently a transformation trope.' },
    distinctions: { ko: ['여장남자와 겹칠 수 있지만, 남の娘은 외형·캐릭터 속성까지 넓게 가리키는 경우가 있다.', 'TS 캐릭터가 되기 전·후의 캐릭터 표현 태그로 결합할 수 있다.'], en: ['It can overlap with crossdressing but often functions as a broader character-archetype label.', 'It can combine with TS as a pre/post transformation character-expression tag.'] },
    relatedIds: ['male_crossdressing'], sourceIds: ['japandict-otokonoko', 'narou-ts-glossary'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'male_crossdressing', category: 'character_expression',
    labels: { ko: '여장남자', en: 'Male Crossdressing', ja: '女装男子 / 女装' }, aliases: ['crossdresser', '女装', '女装男子', '여장'], regions: ['global'],
    summary: { ko: '남성 캐릭터가 여성 복장을 하는 설정. 외모·역할 표현일 뿐 신체 성별 변화가 필수는 아니다.', en: 'A male character wearing feminine clothing; it concerns presentation and does not require bodily sex change.' },
    distinctions: { ko: ['TS 타입이 아니라 캐릭터 표현 태그로 저장하는 편이 안정적이다.'], en: ['Prefer storing it as a character-expression tag rather than a transformation mechanism.'] },
    relatedIds: ['otokonoko'], sourceIds: ['japandict-otokonoko', 'fictionmania-fanlore'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'rule63', category: 'regional_term',
    labels: { ko: 'Rule 63·성반전 버전', en: 'Rule 63 / Gender-swapped Version', ja: '性別反転版' }, aliases: ['Rule 63', 'genderbend', 'genderswap redesign', 'Always a Girl', 'Always a Boy'], regions: ['en', 'global'],
    summary: { ko: '기존 캐릭터를 반대 성별 버전으로 재설계한 팬덤 용어. 작중에서 실제로 변신하는 서사와는 구분하는 것이 유용하다.', en: 'A fandom label for an alternate gender-swapped version of an existing character; useful to separate from in-story transformation.' },
    distinctions: { ko: ['작중 변화 없음(variant)과 작중 변화 있음(transformation)을 별도 상태로 둔다.'], en: ['Track “alternate version” separately from “in-story transformation.”'] },
    relatedIds: ['nyotaika', 'gender_change'], sourceIds: ['rule63-wikipedia', 'fanlore-genderswap'], confidence: 'high', maturity: 'general', selectableInCreateWork: false,
  },
  {
    id: 'slow_transformation', category: 'transformation_focus',
    labels: { ko: '점진적 변화', en: 'Slow / Gradual Transformation', ja: '徐々に変化' }, aliases: ['slow transformation', 'gradual transformation', '점진변화'], regions: ['en', 'global'],
    summary: { ko: '여러 장면·시간대에 걸쳐 변화가 단계적으로 진행되는 유형.', en: 'A transformation that unfolds progressively over multiple beats or a longer duration.' },
    continuityRules: { ko: ['변화 단계를 순서화하고 이전 단계로 되돌아가는지 여부를 기록한다.', '한 회차에서 이미 지나간 변화 단계를 무심코 초기화하지 않는다.'], en: ['Order the transformation stages and track any reversibility.', 'Do not accidentally reset already-completed stages in later chapters.'] },
    relatedIds: ['feminization', 'transformation'], sourceIds: ['fictionmania-fanlore'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'fast_transformation', category: 'transformation_focus',
    labels: { ko: '즉시·급속 변화', en: 'Fast / Sudden Transformation', ja: '急変・即時変化' }, aliases: ['fast transformation', 'sudden transformation', 'instant change'], regions: ['en', 'global'],
    summary: { ko: '짧은 시간에 변화가 완료되는 유형. 아사온처럼 변화 장면을 생략하고 사후상태부터 시작하는 경우와는 구분할 수 있다.', en: 'A transformation completed quickly; distinct from aftermath-first setups that skip the transformation scene entirely.' },
    relatedIds: ['asaon', 'transformation'], sourceIds: ['fictionmania-fanlore'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'mental_change', category: 'transformation_focus',
    labels: { ko: '정신·자아 변화', en: 'Mental / Identity Change', ja: '精神変化' }, aliases: ['mental change', 'identity change', 'mind alteration'], regions: ['en', 'global'],
    summary: { ko: '신체 변화와 별개로 기억, 성격, 자기인식, 욕망, 말투 등이 달라지는 축.', en: 'A separate axis where memory, personality, self-concept, desire, or speech patterns change alongside or after bodily transformation.' },
    continuityRules: { ko: ['신체변화와 정신변화를 별도 진행도로 관리한다.', '기억 삭제, 성격 변화, 자기인식 변화 중 무엇이 일어났는지 구체화한다.'], en: ['Track body change and mental change as separate progressions.', 'Specify whether memory, personality, or self-identification changes.'] },
    sourceIds: ['fictionmania-fanlore', 'ao3-gender-tags'], confidence: 'high', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'ts_yuri', category: 'relationship',
    labels: { ko: 'TS백합', en: 'TS Yuri / GL', ja: 'TS百合' }, aliases: ['TS百合', '육체적 GL', 'TS GL'], regions: ['jp', 'kr'],
    summary: { ko: 'TS된 여성 캐릭터와 여성 캐릭터 사이의 GL/백합 관계를 가리키는 팬덤 태그. 작품마다 자아·성별 인식의 해석은 다를 수 있다.', en: 'A fandom relationship tag for yuri/GL involving a gender-transformed female character and another female character.' },
    sourceIds: ['narou-ts-glossary'], confidence: 'medium', maturity: 'general', selectableInCreateWork: true,
  },
  {
    id: 'sissification', category: 'community_trope',
    labels: { ko: '시시피케이션·강한 여성화 역할극', en: 'Sissification', ja: 'シシフィケーション系' }, aliases: ['sissyfication', 'forced feminization roleplay'], regions: ['en'],
    summary: { ko: '영어권 성인/페티시 문맥에서 여성화, 복종, 굴욕 또는 역할 강제를 결합해 쓰이는 용어. 일반적인 feminization과 분리해 저장한다.', en: 'An adult/fetish-context term often combining feminization with submissive, humiliation, or enforced-role dynamics. Keep it separate from generic feminization.' },
    distinctions: { ko: ['일반 여성화의 동의어로 자동 치환하지 않는다.', '작품 선택 시 성인·민감 태그로 별도 노출한다.'], en: ['Do not automatically treat it as a synonym for generic feminization.', 'Expose it as an adult/sensitive opt-in tag.'] },
    relatedIds: ['feminization'], sourceIds: ['fictionmania-fanlore'], confidence: 'community', maturity: 'adult-context', selectableInCreateWork: false,
  },
  {
    id: 'mesuochi', category: 'community_trope',
    labels: { ko: '암컷타락·암타', en: 'Mesu-ochi / Erotic Feminization Fall', ja: 'メス堕ち' }, aliases: ['암타', '암타물', 'メス堕ち', 'mesu ochi'], regions: ['jp', 'kr'],
    summary: { ko: '성인 서브컬처에서 남성 캐릭터가 성적으로 여성화·복종화되는 전개를 가리키는 커뮤니티 용어. 일반 TS·여성화와 동일시하지 않는다.', en: 'An adult-subculture trope describing eroticized feminization/submission of a male character; do not conflate it with general TS or feminization.' },
    distinctions: { ko: ['커뮤니티별 의미 확장이 심해 canonical 메커니즘이 아니라 성인 취향 태그로만 둔다.'], en: ['Because usage varies heavily by community, treat it as an adult preference tag rather than a canonical mechanism.'] },
    relatedIds: ['feminization', 'sissification'], sourceIds: ['namu-mesuochi'], confidence: 'community', maturity: 'adult-context', selectableInCreateWork: false,
  },
];

const DICTIONARY_BY_ID = new Map(TS_DICTIONARY.map((entry) => [entry.id, entry] as const));

export function getTsDictionaryEntry(id: string): TsDictionaryEntry | undefined {
  return DICTIONARY_BY_ID.get(id);
}

export function searchTsDictionary(query: string): TsDictionaryEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return TS_DICTIONARY;
  return TS_DICTIONARY.filter((entry) => {
    const haystack = [
      entry.id,
      entry.labels.ko,
      entry.labels.en,
      entry.labels.ja || '',
      ...entry.aliases,
      entry.summary.ko,
      entry.summary.en,
    ].join(' ').toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

const WORK_DESIGN_DICTIONARY_MAP: Record<string, string[]> = {
  gender_change: ['gender_change'],
  feminization: ['feminization'],
  masculinization: ['masculinization'],
  transformation: ['transformation'],
  possession: ['possession'],
  body_swap: ['body_swap'],
  reincarnation: ['reincarnation'],
  crossdressing: ['male_crossdressing'],
  skinsuit: ['skinsuit'],
  reality_rewrite: ['reality_rewrite'],
  avatar: ['avatar_lock'],
  surgery_modification: ['surgery'],
  otokonoko: ['otokonoko'],
  crossdressing_male: ['male_crossdressing'],
  gradual_feminization: ['feminization', 'slow_transformation'],
  gradual_masculinization: ['masculinization', 'slow_transformation'],
  transformation_process: ['transformation'],
  body_swap_focus: ['body_swap'],
  reality_rewrite_focus: ['reality_rewrite'],
  skinsuit_focus: ['skinsuit'],
  avatar_lock: ['avatar_lock'],
  identity_shift: ['mental_change'],
};

export function resolveTsDictionaryIdsFromDesign(design: TsWorkDesign): string[] {
  const ids = new Set<string>();
  if (design.direction === 'mtf') ids.add('mtf');
  if (design.direction === 'ftm') ids.add('ftm');

  const addMapped = (key?: string | null) => {
    if (!key) return;
    for (const id of WORK_DESIGN_DICTIONARY_MAP[key] || []) ids.add(id);
  };

  addMapped(design.tsType.primary);
  design.tsType.secondary.forEach(addMapped);
  (design.preferenceTagIds || []).forEach(addMapped);
  return [...ids];
}

/**
 * 전체 사전을 프롬프트에 넣지 않고, 현재 작품과 관련된 항목의 핵심 규칙만 압축해 반환한다.
 */
export function buildTsDictionaryPromptContext(ids: string[], language: ManuscriptLanguage): string {
  const entries = [...new Set(ids)]
    .map((id) => DICTIONARY_BY_ID.get(id))
    .filter((entry): entry is TsDictionaryEntry => Boolean(entry));

  return entries.map((entry) => {
    const label = language === 'en' ? entry.labels.en : entry.labels.ko;
    const summary = language === 'en' ? entry.summary.en : entry.summary.ko;
    const hints = language === 'en' ? entry.promptHints?.en : entry.promptHints?.ko;
    const continuity = language === 'en' ? entry.continuityRules?.en : entry.continuityRules?.ko;
    return [
      `[${label}] ${summary}`,
      ...(hints || []).map((item) => `- writing: ${item}`),
      ...(continuity || []).map((item) => `- continuity: ${item}`),
    ].join('\n');
  }).join('\n\n');
}
