import type { AiAuthor, AuthorIdentityCore } from '../types/author.types';
import type { VoiceFingerprint } from './voice-fingerprints';
import { describeVoiceControls, getAuthorVoiceContract, type AuthorVoiceSource } from './author-voice';

export interface RuntimeAuthorSeed extends AuthorVoiceSource {
  id: string;
  /** Display labels only, not a plot outline. */
  expertiseLabels: readonly string[];
  displayTags: readonly string[];
  voiceFingerprint?: VoiceFingerprint;
}

/** Converts a TS preset to the existing native editable/versionable author format. */
export function toRuntimeAuthor(seed: RuntimeAuthorSeed): AiAuthor {
  if (!seed.id.trim() || !seed.name.trim()) throw new Error('Author seed requires an ID and name.');
  const voice = seed.voiceFingerprint;
  const principles = [...(voice?.practices ?? seed.coreDirectives)];
  const identity: AuthorIdentityCore = {
    schemaVersion: 1,
    coreId: `ts-${seed.id}-identity`,
    versionId: `ts-${seed.id}-voice-v1`,
    selfDefinition: seed.identityCore?.trim() || seed.tagline,
    reasonToWrite: voice?.reasonToWrite ?? '맡은 이야기의 의도를 지키면서 나만의 언어로 읽히게 한다.',
    worldview: voice?.worldview ?? '작가의 관찰 관점은 작품 세계의 사실이나 필수 전개를 대신하지 않는다.',
    viewOfHumanity: voice?.viewOfHumanity ?? '등장인물의 선택과 감정은 확정된 인물 설정과 현재 장면을 따른다.',
    literaryValues: principles.map((belief) => ({
      belief,
      creativeEffect: '주어진 장면의 표현에 적용하며 새 사건이나 관계를 강제하지 않는다.',
      doubt: '현재 의뢰의 어조나 지정 시점과 충돌하지 않는지 확인한다.',
    })),
    aestheticTaste: {
      drawnTo: [seed.writingStyleSummary],
      avoids: voice ? [...voice.avoids] : ['장르 태그로 작품 내용을 제한하기', '고유 문체를 없애는 획일적 윤문'],
      emotionalTexture: '이번 작품의 정서 안에서 고유한 표현 습관을 유지한다.',
    },
    innerContradictions: [{
      valueA: '작가의 지속적인 고유성',
      valueB: '서로 다른 작품 의뢰의 어조',
      unresolvedReason: '표현의 중심은 유지하되 요청된 장르를 자신의 선호 장르로 바꾸지 않는다.',
    }],
    recurringQuestions: [],
    readerRelationship: voice?.readerRelationship ?? '요청된 이야기를 독자가 따라갈 수 있는 표현으로 전달한다.',
    creativeEthics: '전문성을 이유로 요청하지 않은 사건·관계·결말을 주입하지 않는다.',
    narrativeInstincts: principles,
    voiceOrigins: voice?.voiceOrigins ?? (seed.identityCore?.trim() || seed.tagline),
    readabilityPractice: seed.writingStyleSummary,
    plausibilityPractice: '확정된 사건, 시점, 인물별 말투와 지식 범위를 보존한다.',
    createdAt: 0,
    updatedAt: 0,
  };
  return {
    id: seed.id,
    name: seed.name,
    specialty: [...new Set(seed.expertiseLabels)].join(', '),
    writingStyle: `${seed.writingStyleSummary}\n${describeVoiceControls(seed.styleControls)}`,
    coreDirectives: `${principles.map((line, index) => `${index + 1}. ${line}`).join('\n')}\n\n${getAuthorVoiceContract()}`,
    createdAt: 0,
    isDefault: true,
    tags: [...new Set(seed.displayTags)],
    identityCore: identity,
  };
}

/** No saved records are supplied or overwritten here. Colliding IDs retain the legacy record. */
export function combineDefaultAuthorCatalogs(
  legacy: readonly AiAuthor[],
  tsAuthors: readonly AiAuthor[],
): AiAuthor[] {
  const legacyIds = new Set(legacy.map((author) => author.id));
  const seen = new Set(legacyIds);
  const additions: AiAuthor[] = [];
  for (const author of tsAuthors) {
    if (seen.has(author.id)) continue;
    seen.add(author.id);
    additions.push(author);
  }
  return [...additions, ...legacy];
}
