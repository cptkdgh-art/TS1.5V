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
  author?: TsAuthorProfile | null;
  /** 이번 회차에서 사용자가 직접 내린 지시. 정적 프리셋보다 우선한다. */
  chapterInstruction?: string;
  /** 이미 확정된 설정/상태. 작품 취향이나 작가 문체보다 우선한다. */
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

function buildAuthorBlock(author: TsAuthorProfile, language: ManuscriptLanguage): string {
  const directives = author.coreDirectives.map((item) => `- ${item}`).join('\n');
  const controlText = styleControlText(author.styleControls, language);

  if (language === 'en') {
    return [
      `### Selected AI Author: ${author.name}`,
      `Identity: ${author.tagline}`,
      `Style summary: ${author.writingStyleSummary}`,
      `Writing controls: ${controlText}`,
      'Author principles:',
      directives,
    ].join('\n');
  }

  return [
    `### 선택 AI 작가: ${author.name}`,
    `작가 정체성: ${author.tagline}`,
    `문체 요약: ${author.writingStyleSummary}`,
    `문체 조절값: ${controlText}`,
    '작가 핵심 원칙:',
    directives,
  ].join('\n');
}

/**
 * 작품 생성 화면에서 고른 값과 AI 작가의 개성을 실제 집필 프롬프트로 컴파일한다.
 * 이 문자열은 표시용 메타데이터가 아니라 매 회차 생성 컨텍스트에 넣는 ACTIVE 지시문이다.
 */
export function buildTsWritingDirective(input: TsWritingDirectiveInput): string {
  const { design, author } = input;
  const language = design.manuscriptLanguage;
  const workBrief = buildTsWorkDesignBrief(design);
  const tradition = getTsNarrativeTradition(design.narrativeTradition ?? 'hybrid');
  const preferences = getTsPreferenceTags(design.preferenceTagIds || []);
  const expression = TS_EXPRESSION_BALANCE.find((item) => item.id === (design.expressionBalance ?? 'balanced'));

  const continuityFacts = (input.continuityFacts || []).filter(Boolean);
  const exclusions = (input.exclusions || []).filter(Boolean);
  const additional = (input.additionalInstructions || []).filter(Boolean);
  const chapterInstruction = input.chapterInstruction?.trim();

  if (language === 'en') {
    const sections = [
      '--- [JINPOK TS ACTIVE WRITING DIRECTIVE] ---',
      'The following values are active production constraints, not decorative metadata. Reflect them in scene choice, prose, pacing, character reactions, and continuity.',
      '',
      '### Priority',
      '1. Explicit instruction for the current chapter.',
      '2. Already-established canon and continuity facts.',
      '3. Work-level TS design, selected preferences, exclusions, and story core.',
      '4. Selected AI author voice and craft preferences.',
      '5. General TS genre guidance.',
      chapterInstruction ? `\n### Current chapter instruction\n${chapterInstruction}` : '',
      continuityFacts.length ? `\n### Canon / continuity facts\n${continuityFacts.map((item) => `- ${item}`).join('\n')}` : '',
      `\n### Work design\n${workBrief}`,
      tradition ? `Narrative tradition blend: KR ${Math.round(tradition.blend.kr * 100)} / JP ${Math.round(tradition.blend.jp * 100)} / Western ${Math.round(tradition.blend.western * 100)}. Treat this as genre convention and pacing guidance, never as a nationality stereotype.` : '',
      expression ? `Expression balance: ${expression.en}. ${expressionRule(design.expressionBalance ?? 'balanced', language)}` : '',
      preferences.length ? `Selected preferences are recurring story interests: ${preferences.map((item) => item.en).join(', ')}.` : '',
      exclusions.length ? `\n### Exclusions\n${exclusions.map((item) => `- ${item}`).join('\n')}` : '',
      additional.length ? `\n### Additional work instructions\n${additional.map((item) => `- ${item}`).join('\n')}` : '',
      author ? `\n${buildAuthorBlock(author, language)}` : '',
      `\n### TS continuity core\n${TS_GENRE_CORE_GUIDE}`,
      '',
      '### Enforcement rules',
      '- Primary TS type, primary subgenre, and primary mood are dominant. Secondary selections recur without being forced into every scene.',
      '- Selected preference tags must affect concrete scene focus across the work; do not merely repeat the tag names in narration.',
      '- Do not mechanically include every preference in every chapter. Use the ones relevant to the current beat and rotate them across chapters.',
      '- The chosen narrative tradition changes scene rhythm, dialogue density, payoff placement, and transformation emphasis; it does not change character nationality or setting unless the user says so.',
      '- Author style changes how the story is told, but cannot overwrite canon, transformation rules, or explicit user instructions.',
      '- Keep previously established body state, identity, relationships, knowledge gaps, transformation conditions, and reversibility consistent.',
      '- Never expose these internal tags, numeric controls, or instruction hierarchy in the novel text unless the user explicitly asks for meta commentary.',
      '--- [END JINPOK TS ACTIVE WRITING DIRECTIVE] ---',
    ];
    return sections.filter(Boolean).join('\n');
  }

  const sections = [
    '--- [진폭 TS 활성 집필 지시문] ---',
    '아래 값은 표시용 메타데이터가 아니라 실제 집필 제약이다. 장면 선택, 문체, 호흡, 인물 반응, 변화 묘사와 연속성에 반드시 반영한다.',
    '',
    '### 우선순위',
    '1. 이번 회차에서 사용자가 직접 내린 명시적 지시',
    '2. 이미 확정된 설정·상태·연속성 사실',
    '3. 작품의 TS 설계·취향·제외사항·작품 핵심',
    '4. 선택 AI 작가의 문체와 집필 성향',
    '5. 공통 TS 장르 문법',
    chapterInstruction ? `\n### 이번 회차 지시\n${chapterInstruction}` : '',
    continuityFacts.length ? `\n### 확정 설정·연속성\n${continuityFacts.map((item) => `- ${item}`).join('\n')}` : '',
    `\n### 작품 설계\n${workBrief}`,
    tradition ? `서사 관습 혼합: 한국 ${Math.round(tradition.blend.kr * 100)} / 일본 ${Math.round(tradition.blend.jp * 100)} / 서양 ${Math.round(tradition.blend.western * 100)}. 국적 묘사가 아니라 장르적 호흡·장면 구성·보상 구조에만 사용한다.` : '',
    expression ? `표현 비중: ${expression.ko}. ${expressionRule(design.expressionBalance ?? 'balanced', language)}` : '',
    preferences.length ? `선택 취향·소재는 작품 전체에서 반복적으로 체감되어야 한다: ${preferences.map((item) => item.ko).join(', ')}.` : '',
    exclusions.length ? `\n### 제외사항\n${exclusions.map((item) => `- ${item}`).join('\n')}` : '',
    additional.length ? `\n### 작품 추가 지침\n${additional.map((item) => `- ${item}`).join('\n')}` : '',
    author ? `\n${buildAuthorBlock(author, language)}` : '',
    `\n### TS 공통 연속성 원칙\n${TS_GENRE_CORE_GUIDE}`,
    '',
    '### 적용 규칙',
    '- 대표 TS 타입·대표 부장르·대표 분위기를 중심으로 쓰고, 추가 선택은 작품 전반에 반복적으로 스며들게 한다.',
    '- 선택한 취향·소재는 실제 장면 초점과 묘사 배분에 영향을 줘야 하며 태그 이름만 대사나 서술로 반복하지 않는다.',
    '- 한 회차에 모든 취향을 억지로 넣지 않는다. 현재 회차에 맞는 요소를 쓰고 장편에서는 여러 회차에 걸쳐 순환한다.',
    '- 한국/일본/서양/혼합형 프리셋은 장면 호흡·대사 밀도·보상 위치·변화 묘사 방식에 영향을 주며 캐릭터 국적이나 배경을 자동으로 바꾸지 않는다.',
    '- AI 작가의 개성은 표현 방식을 바꾸지만 확정 설정, 변신 규칙, 사용자 명시 지시를 덮어쓸 수 없다.',
    '- 현재 신체 상태, 자아·기억, 관계, 누가 무엇을 아는지, 변신 조건·가역성을 이전 회차와 일관되게 유지한다.',
    '- 내부 태그명, 수치형 문체 조절값, 지시 우선순위를 작품 본문에 노출하지 않는다.',
    '--- [진폭 TS 활성 집필 지시문 끝] ---',
  ];

  return sections.filter(Boolean).join('\n');
}
