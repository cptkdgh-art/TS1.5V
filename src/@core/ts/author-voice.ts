/** Author voice is reusable across genres; expertise is not a plot instruction. */
export type AuthorVoiceLanguage = 'ko' | 'en';

export interface AuthorVoiceControls {
  sentenceLength: number;
  dialogueRatio: number;
  pacing: number;
  introspection: number;
  descriptionDensity: number;
  sensoryDetail: number;
}

/** Intentionally omits specialty, genre, mood and knowledge tags. */
export interface AuthorVoiceSource {
  name: string;
  tagline: string;
  identityCore?: string;
  writingStyleSummary: string;
  coreDirectives: readonly string[];
  styleControls: AuthorVoiceControls;
}

export function getAuthorVoiceContract(language: AuthorVoiceLanguage = 'ko'): string {
  return language === 'en'
    ? [
      '--- [AUTHOR VOICE CONTRACT] ---',
      'The current user request, established story facts, character voices, exclusions and chosen viewpoint govern content. Author identity governs expression within those constraints.',
      'Expertise and preferred genres describe familiarity, not permission lists, compulsory themes or exclusive assignments. An author can handle a different genre without being replaced by a generic specialist.',
      'Keep the author recognizable through sentence rhythm, vocabulary, narrative distance, imagery, dialogue framing and restraint. Expertise alone must not add romance, dominance, revelations, bodily changes, new conflicts or an ending.',
      'Preserve requested tone and register, including rough language when requested. A gentle or romance-associated profile must not soften, romanticize or redirect a different commission.',
      'The prose pacing control changes textual rhythm, not event order, elapsed story time, transformation speed or the plot outcome. The chosen viewpoint and each character\'s speech remain intact.',
      'Recurring questions, aesthetic tastes and narrative instincts are interpretive tendencies, not obligations to create events. User-specific style overrides apply locally without erasing unrelated voice traits.',
      'Only material selected for the work or explicitly requested by the user may activate knowledge references. Examples and flow diagrams are optional references, never a compulsory sequence.',
      'When the user delegates story development, develop the missing material within the commission; do not use author expertise alone to redirect it into a preferred plot.',
    ].join('\n')
    : [
      '--- [작가 고유성·집필 범위] ---',
      '현재 사용자 요청, 확정된 사건·인물 설정, 인물별 말투, 제외사항과 지정 시점이 내용을 결정한다. 작가 정체성은 그 범위에서 표현 방식을 결정한다.',
      '전문 분야·장르·태그는 숙련도와 친숙한 문법을 뜻한다. 집필 가능 장르 목록이나 필수 소재가 아니다. 다른 분야를 맡아도 선택한 작가를 범용 전문가로 교체하지 않는다.',
      '문장 리듬·어휘·서술 거리·비유·대사 전후의 서술·절제를 통해 작가 고유성을 유지한다. 전문성만으로 연애·지배관계·발각·신체 변화·새 갈등·결말을 추가하지 않는다.',
      '거친 말투나 욕설을 포함해 사용자가 요청한 어조를 수행한다. 부드러운 문체나 순애 전문성을 이유로 다른 의뢰를 순화하거나 순애로 바꾸지 않는다.',
      '속도 조절은 문장과 문단의 호흡에만 적용한다. 사건 순서·경과 시간·변화 속도·결말을 바꾸지 않으며, 지정 시점과 등장인물 고유 말투를 지킨다.',
      '작가관·반복 질문·미학·서사 본능은 해석 성향이지 사건 생성 의무가 아니다. 사용자의 구체적인 문체 수정은 해당 축에 적용하고 나머지 고유성은 유지한다.',
      '참고지식은 작품에서 선택했거나 사용자 지시에 명시된 소재 안에서만 활성화한다. 예시 장면과 흐름도는 참고이며 필수 전개 순서가 아니다.',
      '사용자가 전개를 맡긴 경우 의뢰 범위에서 미정인 장면과 전개를 구성할 수 있다. 다만 작가 전문 태그만으로 선호하는 줄거리나 관계로 돌리지 않는다.',
    ].join('\n');
}

export function normalizeVoiceControl(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 50;
}

export function describeVoiceControls(
  controls: AuthorVoiceControls,
  language: AuthorVoiceLanguage = 'ko',
): string {
  const names = language === 'en'
    ? ['Sentence length', 'Dialogue share', 'Textual breathing room', 'Interiority', 'Description density', 'Sensory detail']
    : ['문장 길이', '대사 비중', '문장·문단의 여유', '내면 서술', '묘사 밀도', '감각 표현'];
  const values = [controls.sentenceLength, controls.dialogueRatio, controls.pacing,
    controls.introspection, controls.descriptionDensity, controls.sensoryDetail];
  const suffix = language === 'en'
    ? 'Relative preferences, not quotas; they never change the plot or character facts.'
    : '비율 할당이 아닌 상대적 표현 성향이며 사건이나 인물 설정을 바꾸지 않는다.';
  return `${names.map((name, index) => `${name}: ${normalizeVoiceControl(values[index])}/100`).join('; ')}. ${suffix}`;
}

export function buildAuthorVoiceText(input: {
  author?: AuthorVoiceSource | null;
  /** The edited/native profile wins as a whole; no default voice is mixed back in. */
  existingIdentity?: string;
  memory?: readonly string[];
  language?: AuthorVoiceLanguage;
}): string {
  const language = input.language ?? 'ko';
  const existing = input.existingIdentity?.trim();
  const author = input.author;
  const title = language === 'en' ? '### Selected author voice' : '### 선택한 작가의 고유성';
  let profile = existing || '';
  if (!profile && author) {
    const labels = language === 'en'
      ? ['Author', 'Identity', 'Voice', 'Expression controls', 'Writing practices']
      : ['작가', '작가관', '고유 문체', '표현 조절', '서술 습관'];
    profile = [
      `${labels[0]}: ${author.name}`,
      `${labels[1]}: ${author.identityCore?.trim() || author.tagline}`,
      `${labels[2]}: ${author.writingStyleSummary}`,
      `${labels[3]}: ${describeVoiceControls(author.styleControls, language)}`,
      `${labels[4]}:\n${author.coreDirectives.filter((line) => line.trim()).map((line) => `- ${line}`).join('\n')}`,
    ].join('\n');
  }
  const memory = (input.memory ?? []).filter((line) => line.trim());
  return [
    title,
    profile || (language === 'en' ? 'No assigned author. Follow the requested writing style.' : '배정 작가 없음. 사용자가 요청한 문체를 따른다.'),
    memory.length ? `${language === 'en' ? 'Relevant author agreements' : '이번 집필에 유효한 작가 합의'}:\n${memory.map((line) => `- ${line}`).join('\n')}` : '',
    getAuthorVoiceContract(language),
  ].filter(Boolean).join('\n\n');
}
