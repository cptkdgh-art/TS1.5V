import type { TsAuthorProfile } from './authors';
import { buildAuthorVoiceText } from './author-voice';
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
  /** The current native/edited profile wins; never mix an old default voice back into it. */
  authorIdentityContext?: string;
  authorMemory?: string[];
  chapterInstruction?: string;
  continuityFacts?: string[];
  exclusions?: string[];
  additionalInstructions?: string[];
}

function expressionRule(id: TsExpressionBalanceId, language: ManuscriptLanguage): string {
  if (language === 'en') {
    if (id === 'story_first') return 'Prioritize the commissioned scene and its purpose. Detail serves that scene.';
    if (id === 'fetish_forward') return 'Give explicitly selected interests more descriptive attention within the requested scene. This does not authorize new acts, relationships, transformations or a different plot.';
    return 'Balance the requested scene with relevant selected details. This is not a quota of scenes or a compulsory arc.';
  }
  if (id === 'story_first') return '의뢰한 장면과 목적을 우선하고 세부 묘사는 그 장면을 돕는다.';
  if (id === 'fetish_forward') return '사용자가 명시한 취향의 표현을 요청한 장면 안에서 세밀하게 다룬다. 새 행위·관계·변신·줄거리를 허용하는 지시가 아니다.';
  return '의뢰한 장면과 관련 세부 묘사를 균형 있게 표현한다. 장면 수나 전개 단계를 할당하는 규칙이 아니다.';
}

/**
 * One commission, one current author voice, then conditional reference knowledge.
 * Kept compatible with legacy callers. No new default narrative tradition is inferred.
 */
export function buildTsWritingDirective(input: TsWritingDirectiveInput): string {
  const { design } = input;
  const language = design.manuscriptLanguage;
  const en = language === 'en';
  const lines = (items: string[] | undefined) => (items ?? []).filter((item) => item.trim());
  const section = (heading: string, items: string[]) => items.length
    ? `${heading}\n${items.map((item) => `- ${item}`).join('\n')}` : '';
  const author = buildAuthorVoiceText({
    author: input.author,
    existingIdentity: input.authorIdentityContext,
    memory: input.authorMemory,
    language,
  });
  // Undefined means not requested, not "hybrid + balanced + compulsory changes".
  const tradition = getTsNarrativeTradition(design.narrativeTradition);
  const expression = TS_EXPRESSION_BALANCE.find((item) => item.id === design.expressionBalance);
  const preferences = getTsPreferenceTags(design.preferenceTagIds ?? []);
  const instruction = input.chapterInstruction?.trim();

  return [
    en ? '--- [JINPOK TS WRITING COMMISSION] ---' : '--- [진폭 TS 집필 의뢰] ---',
    en ? '### Content constraints' : '### 내용 제약',
    en
      ? 'The requested scene, established facts and exclusions govern content. Where they conflict, do not silently rewrite canon or use an author preference to decide the conflict.'
      : '요청한 장면·확정 사실·제외사항이 내용을 결정한다. 서로 충돌하면 작가 취향으로 선택하거나 기존 설정을 조용히 바꾸지 않는다.',
    instruction ? `${en ? 'Current chapter request' : '이번 회차 요청'}:\n${instruction}` : '',
    section(en ? 'Canon and continuity' : '확정 설정·연속성', lines(input.continuityFacts)),
    section(en ? 'Exclusions' : '제외사항', lines(input.exclusions)),
    section(en ? 'Additional instructions' : '추가 지침', lines(input.additionalInstructions)),
    `${en ? '### Work brief' : '### 작품 의뢰서'}\n${buildTsWorkDesignBrief(design)}`,
    author,
    tradition
      ? `${en ? 'Requested narrative convention reference' : '선택한 서사 관습 참고'}: ${en ? tradition.en : tradition.ko}. ${en ? 'Reference only: preserve the author voice and do not import a stock plot.' : '참고값이며 고유 문체를 보존하고 정형 플롯을 자동으로 가져오지 않는다.'}`
      : '',
    expression && design.expressionBalance
      ? `${en ? expression.en : expression.ko}: ${expressionRule(design.expressionBalance, language)}`
      : '',
    preferences.length
      ? `${en ? 'Selected material' : '선택한 소재'}: ${preferences.map((item) => en ? item.en : item.ko).join(', ')}. ${en ? 'Apply when relevant to this commission, not as a checklist of events.' : '이번 의뢰와 관련될 때 표현하되 사건 체크리스트로 사용하지 않는다.'}`
      : '',
    `${en ? '### Conditional continuity reference' : '### 조건부 연속성 참고'}\n${TS_GENRE_CORE_GUIDE}`,
    en
      ? 'Never print internal tags or control values in the manuscript. Preserve the chosen author across genres while obeying the commissioned content.'
      : '내부 태그·수치·지시 구조는 원고에 출력하지 않는다. 의뢰한 내용을 지키면서 장르가 달라도 선택한 작가의 글맛을 유지한다.',
    en ? '--- [END JINPOK TS WRITING COMMISSION] ---' : '--- [진폭 TS 집필 의뢰 끝] ---',
  ].filter(Boolean).join('\n\n');
}
