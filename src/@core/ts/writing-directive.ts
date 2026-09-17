import type { TsAuthorProfile, TsAuthorStyleControls } from './authors';
import { TS_GENRE_CORE_GUIDE } from './genre';
import {
  TS_EXPRESSION_BALANCE,
  buildTsWorkDesignBrief,
  getTsNarrativeTradition,
  getTsPreferenceTags,
  type ManuscriptLanguage,
  type TsExpressionBalanceId,
  type TsWorkDesign,
} from './work-design';

export interface TsWritingDirectiveInput {
  design: TsWorkDesign;
  /** TS판 기본 작가 프리셋. 기존 진폭 작가를 쓸 때는 authorIdentityContext를 함께 넘긴다. */
  author?: TsAuthorProfile | null;
  /**
   * 기존 진폭 AiAuthor의 identityCore / writingStyle / coreDirectives / 성장 결과 등을
   * 집필용 텍스트로 직렬화한 컨텍스트. 존재하면 TS 기본 프리셋보다 우선하는 작가 정체성이다.
   */
  authorIdentityContext?: string;
  /** 작가 기억·회고·장기 성장에서 이번 작품에 실제로 유효한 항목. */
  authorMemory?: string[];
  /** 이번 회차에서 사용자가 직접 내린 지시. 작가도 반드시 존중해야 하는 회차 제약이다. */
  chapterInstruction?: string;
  /** 이미 확정된 설정/상태. 작가 개성과 무관하게 깨뜨리면 안 되는 사실 제약이다. */
  continuityFacts?: string[];
  /** 작품에서 하지 않기로 한 요소. */
  exclusions?: string[];
  /** 작품별 추가 제작 지침. */
  additionalInstructions?: string[];
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function styleControlText(controls: TsAuthorStyleControls, language: ManuscriptLanguage): string {
  const values = {
    sentenceLength: clamp(controls.sentenceLength),
    dialogueRatio: clamp(controls.dialogueRatio),
    pacing: clamp(controls.pacing),
    introspection: clamp(controls.introspection),
    descriptionDensity: clamp(controls.descriptionDensity),
    sensoryDetail: clamp(controls.sensoryDetail),
  };

  if (language === 'en') {
    return [
      `sentence length ${values.sentenceLength}/100 (higher = longer/more complex)`,
      `dialogue share ${values.dialogueRatio}/100`,
      `slow-build pacing ${values.pacing}/100`,
      `interiority ${values.introspection}/100`,
      `description density ${values.descriptionDensity}/100`,
      `sensory detail ${values.sensoryDetail}/100`,
    ].join('; ');
  }

  return [
    `문장 길이 ${values.sentenceLength}/100(높을수록 장문·복문)`,
    `대사 비중 ${values.dialogueRatio}/100`,
    `느린 축적 ${values.pacing}/100`,
    `내면 비중 ${values.introspection}/100`,
    `묘사 밀도 ${values.descriptionDensity}/100`,
    `감각 묘사 ${values.sensoryDetail}/100`,
  ].join('; ');
}

function expressionRule(id: TsExpressionBalanceId | null | undefined, language: ManuscriptLanguage): string {
  if (language === 'en') {
    if (id === 'story_first') return 'Story-first: character goals, causality, and plot progression come before transformation/fetish detail.';
    if (id === 'fetish_forward') return 'Fetish-forward: give the selected transformation, appearance, sensory, and role-change interests noticeably more scene time, while preserving continuity and plot causality.';
    return 'Balanced: keep story progression and the selected transformation interests visibly present in comparable proportion.';
  }

  if (id === 'story_first') return '서사 중심: 인물 목표·인과·전개를 우선하고 변환/취향 묘사는 장면 목적이 있을 때 사용한다.';
  if (id === 'fetish_forward') return '페티시 강조: 선택된 변화·외형·감각·역할 취향에 장면과 묘사 비중을 더 주되, 설정 연속성과 사건 인과를 희생하지 않는다.';
  return '균형: 서사 진행과 선택된 TS 취향·변화 묘사가 모두 체감되도록 비중을 배분한다.';
}

function buildPresetAuthorBlock(author: TsAuthorProfile, language: ManuscriptLanguage): string {
  const directives = author.coreDirectives.map((item) => `- ${item}`).join('\n');
  const controlText = styleControlText(author.styleControls, language);

  if (language === 'en') {
    return [
      `Preset author: ${author.name}`,
      `Identity: ${author.tagline}`,
      `Style summary: ${author.writingStyleSummary}`,
      `Writing controls: ${controlText}`,
      'Author principles:',
      directives,
    ].join('\n');
  }

  return [
    `프리셋 작가: ${author.name}`,
    `작가 정체성: ${author.tagline}`,
    `문체 요약: ${author.writingStyleSummary}`,
    `문체 조절값: ${controlText}`,
    '작가 핵심 원칙:',
    directives,
  ].join('\n');
}

function buildAuthorAuthorityBlock(input: TsWritingDirectiveInput, language: ManuscriptLanguage): string {
  const existingIdentity = input.authorIdentityContext?.trim();
  const memory = (input.authorMemory || []).filter(Boolean);
  const preset = input.author ? buildPresetAuthorBlock(input.author, language) : '';

  if (language === 'en') {
    return [
      '### AUTHOR IDENTITY — PRIMARY CREATIVE AUTHORITY',
      'Within the hard constraints of canon and explicit user instructions, the selected author is the primary creative authority. The work brief tells this author what kind of work to write; it must not flatten or replace the author voice.',
      existingIdentity ? `\n#### Existing Jinpok author identity\n${existingIdentity}` : '',
      preset ? `\n#### TS specialization layer\n${preset}` : '',
      memory.length ? `\n#### Relevant author memory / growth\n${memory.map((item) => `- ${item}`).join('\n')}` : '',
      '',
      'Author-identity rules:',
      '- Let the author identity affect sentence rhythm, scene selection, emotional interpretation, dialogue, emphasis, restraint, and payoff design.',
      '- When a genre convention has several valid implementations, choose the implementation this author would naturally prefer.',
      '- Do not neutralize distinct authors into the same generic TS voice just because the work uses the same tags.',
      '- Work presets are material and commission constraints, not a replacement personality for the author.',
    ].filter(Boolean).join('\n');
  }

  return [
    '### 작가 정체성 — 최상위 창작 주체',
    '확정 설정과 사용자의 명시 지시를 지키는 범위 안에서는 선택한 작가의 정체성이 최상위 창작 기준이다. 작품 설계는 이 작가에게 주어진 의뢰서이며, 작가의 문체·판단·미학을 평준화하거나 덮어쓰면 안 된다.',
    existingIdentity ? `\n#### 기존 진폭 작가 정체성\n${existingIdentity}` : '',
    preset ? `\n#### TS 전문성 레이어\n${preset}` : '',
    memory.length ? `\n#### 이번 집필에 유효한 작가 기억·성장\n${memory.map((item) => `- ${item}`).join('\n')}` : '',
    '',
    '작가 정체성 적용 규칙:',
    '- 문장 호흡, 장면 선택, 감정 해석, 대사, 강조와 생략, 보상 장면 설계에 작가의 고유 성향이 묻어나야 한다.',
    '- 같은 장르 규칙도 구현 방식이 여러 개라면 이 작가가 자연스럽게 선택할 방식을 우선한다.',
    '- 같은 TS 태그를 썼다는 이유로 서로 다른 작가가 비슷한 범용 TS 문체로 수렴하면 안 된다.',
    '- 작품 프리셋은 소재와 의뢰 조건이지 작가를 대체하는 새 페르소나가 아니다.',
  ].filter(Boolean).join('\n');
}

/**
 * 작품 생성 화면에서 고른 값과 기존/기본 AI 작가의 개성을 실제 집필 프롬프트로 컴파일한다.
 * 핵심 철학은 "무슨 장르의 무슨 작품을 이 작가가 쓴다"이다.
 * 작품 설정이 작가를 덮는 것이 아니라, 작가가 작품 설정을 자기 방식으로 해석해 집필한다.
 */
export function buildTsWritingDirective(input: TsWritingDirectiveInput): string {
  const { design } = input;
  const language = design.manuscriptLanguage;
  const workBrief = buildTsWorkDesignBrief(design);
  const tradition = getTsNarrativeTradition(design.narrativeTradition ?? 'hybrid');
  const preferences = getTsPreferenceTags(design.preferenceTagIds || []);
  const expression = TS_EXPRESSION_BALANCE.find((item) => item.id === (design.expressionBalance ?? 'balanced'));

  const continuityFacts = (input.continuityFacts || []).filter(Boolean);
  const exclusions = (input.exclusions || []).filter(Boolean);
  const additional = (input.additionalInstructions || []).filter(Boolean);
  const chapterInstruction = input.chapterInstruction?.trim();
  const authorAuthority = buildAuthorAuthorityBlock(input, language);

  if (language === 'en') {
    const sections = [
      '--- [JINPOK TS ACTIVE WRITING DIRECTIVE] ---',
      'These are active production instructions, not decorative metadata.',
      '',
      '### HARD CONSTRAINTS',
      'The author has creative authority, but must not violate the following hard constraints.',
      chapterInstruction ? `\n#### Current chapter instruction\n${chapterInstruction}` : '',
      continuityFacts.length ? `\n#### Canon / continuity facts\n${continuityFacts.map((item) => `- ${item}`).join('\n')}` : '',
      exclusions.length ? `\n#### Exclusions\n${exclusions.map((item) => `- ${item}`).join('\n')}` : '',
      additional.length ? `\n#### Additional work instructions\n${additional.map((item) => `- ${item}`).join('\n')}` : '',
      `\n${authorAuthority}`,
      `\n### WORK COMMISSION — WHAT THIS AUTHOR IS WRITING\n${workBrief}`,
      tradition ? `Narrative convention blend: KR ${Math.round(tradition.blend.kr * 100)} / JP ${Math.round(tradition.blend.jp * 100)} / Western ${Math.round(tradition.blend.western * 100)}. This is a genre-convention reference only. The selected author decides how to embody it.` : '',
      expression ? `Expression balance: ${expression.en}. ${expressionRule(design.expressionBalance ?? 'balanced', language)}` : '',
      preferences.length ? `Recurring story interests: ${preferences.map((item) => item.en).join(', ')}.` : '',
      `\n### TS CONTINUITY FLOOR — GUARDRAILS, NOT A VOICE\n${TS_GENRE_CORE_GUIDE}`,
      '',
      '### Final enforcement',
      '- Think: "This author is writing this particular TS work." Never think: "apply a generic TS preset to this author."',
      '- Primary type/subgenre/mood define the commission, while author identity defines how scenes are written and interpreted.',
      '- Narrative-tradition presets may influence rhythm, scene structure, and payoff, but they must pass through the author voice rather than overwrite it.',
      '- Selected preferences must become concrete scene focus across the work, but the author decides their phrasing, timing, intensity, and dramatic function.',
      '- Preserve body state, identity, relationships, knowledge gaps, transformation conditions, and reversibility.',
      '- Never expose internal tags, numeric controls, or instruction hierarchy in the novel text unless explicitly requested.',
      '--- [END JINPOK TS ACTIVE WRITING DIRECTIVE] ---',
    ];
    return sections.filter(Boolean).join('\n');
  }

  const sections = [
    '--- [진폭 TS 활성 집필 지시문] ---',
    '아래 값은 표시용 메타데이터가 아니라 실제 집필 지시다.',
    '',
    '### 절대 제약',
    '작가는 창작 주도권을 가지지만 아래 제약은 깨뜨리지 않는다.',
    chapterInstruction ? `\n#### 이번 회차 사용자 지시\n${chapterInstruction}` : '',
    continuityFacts.length ? `\n#### 확정 설정·연속성\n${continuityFacts.map((item) => `- ${item}`).join('\n')}` : '',
    exclusions.length ? `\n#### 제외사항\n${exclusions.map((item) => `- ${item}`).join('\n')}` : '',
    additional.length ? `\n#### 작품 추가 지침\n${additional.map((item) => `- ${item}`).join('\n')}` : '',
    `\n${authorAuthority}`,
    `\n### 작품 의뢰서 — 이 작가가 무엇을 쓰는가\n${workBrief}`,
    tradition ? `서사 관습 참고 비율: 한국 ${Math.round(tradition.blend.kr * 100)} / 일본 ${Math.round(tradition.blend.jp * 100)} / 서양 ${Math.round(tradition.blend.western * 100)}. 이것은 장르 관습 참고값일 뿐이며 실제 구현 방식은 선택한 작가의 정체성을 따른다.` : '',
    expression ? `표현 비중: ${expression.ko}. ${expressionRule(design.expressionBalance ?? 'balanced', language)}` : '',
    preferences.length ? `작품 전체에서 반복적으로 체감될 취향·소재: ${preferences.map((item) => item.ko).join(', ')}.` : '',
    `\n### TS 공통 연속성 바닥 규칙 — 문체가 아닌 안전망\n${TS_GENRE_CORE_GUIDE}`,
    '',
    '### 최종 적용 원칙',
    '- 항상 "이 작가가 이 TS 작품을 쓴다"고 해석한다. "TS 프리셋을 작가에게 덮어씌운다"고 해석하지 않는다.',
    '- 대표 TS 타입·부장르·분위기는 작품 의뢰의 방향을 정하고, 작가 정체성은 그 장면을 어떤 방식으로 쓰고 해석할지를 결정한다.',
    '- 일본/서양/한국/혼합형 서사 프리셋은 호흡·장면 구성·보상 위치에 참고하되 작가의 고유 문체를 덮지 않는다.',
    '- 취향·소재는 작품 전체에서 실제 장면으로 체감되어야 하지만, 표현 방식·배치·강약·의미는 작가가 자기 방식으로 결정한다.',
    '- 현재 신체 상태, 자아·기억, 관계, 정보 격차, 변신 조건·가역성은 이전 회차와 일관되게 유지한다.',
    '- 내부 태그명, 수치형 문체값, 지시 구조를 작품 본문에 노출하지 않는다.',
    '--- [진폭 TS 활성 집필 지시문 끝] ---',
  ];

  return sections.filter(Boolean).join('\n');
}
