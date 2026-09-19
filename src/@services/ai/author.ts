/**
 * ============================================================
 * @module services/ai/author
 * @file author.ts
 * ============================================================
 * @description 작가 관련 AI 함수
 * ============================================================
 */

import type { AiAuthor, AuthorIdentityCore, Chapter } from '@core/types';
import { generateContent, MODELS, normalizeGeminiHelperModel, type GeminiHelperModel } from './config';
import { AUTHOR_CONCEPT_ARTIST_INSTRUCTION, AUTHOR_FUSION_INSTRUCTION, AUTHOR_INTERLUDE_INSTRUCTION } from './prompts';
import { extractAndParseJson } from './utils';
import { createAuthorIdentityCore, resolveAuthorIdentityCore, type AuthorIdentityDraft } from './authorIdentity';

const IDENTITY_CORE_JSON_EXAMPLE = `
  "identityCore": {
    "selfDefinition": "나는 어떤 작가인가",
    "reasonToWrite": "왜 이야기를 쓰는가",
    "worldview": "세계와 삶을 바라보는 관점",
    "viewOfHumanity": "인간의 욕망과 선택을 바라보는 관점",
    "literaryValues": [{ "belief": "문학적 믿음", "creativeEffect": "장면 선택에 미치는 영향", "doubt": "스스로 품는 의심이나 반례" }],
    "aestheticTaste": { "drawnTo": ["끌리는 정서와 이미지"], "avoids": ["피하는 미감"], "emotionalTexture": "선호하는 감정의 질감" },
    "innerContradictions": [{ "valueA": "충돌하는 가치 A", "valueB": "충돌하는 가치 B", "unresolvedReason": "쉽게 결론 내리지 못하는 이유" }],
    "recurringQuestions": ["작품을 통해 반복해서 묻는 질문"],
    "readerRelationship": "독자를 어떤 존재로 대하는가",
    "creativeEthics": "서사를 만들 때 지키는 윤리",
    "narrativeInstincts": ["본능적으로 택하는 서사적 선택"],
    "voiceOrigins": "그 문체가 생겨나는 내적 이유",
    "readabilityPractice": "술술 읽히게 만드는 자기만의 방식",
    "plausibilityPractice": "인과와 감정의 개연성을 지키는 자기만의 방식"
  }`;

/** 단일 작가 생성용 JSON 스키마 프롬프트 */
const ENHANCED_JSON_SCHEMA = `
[중요: JSON 응답 규칙]
반드시 아래 형식의 JSON만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "name": "작가 필명 (창의적이고 기억에 남는 이름)",
  "specialty": "전문 장르와 강점에 대한 상세 설명 (최소 50자 이상, 구체적으로)",
  "writingStyle": "문체, 톤, 서술 방식, 문장 리듬에 대한 상세 설명 (최소 100자 이상)",
  "coreDirectives": "핵심 글쓰기 철학과 원칙 3가지 이상 (최소 100자 이상)",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],${IDENTITY_CORE_JSON_EXAMPLE}
}

[개성 기준]
- 모든 필드를 풍부하고 구체적으로 작성하되 상투적인 성공 공식으로 채우지 마세요.
- writingStyle에는 실제 문장에서 드러날 어휘, 시점, 문장 리듬, 묘사와 대화의 성향을 적으세요.
- coreDirectives에는 이 작가만의 선택 기준과 쓰지 않을 방식을 함께 담으세요.
- identityCore는 작품이나 캐릭터 설정이 아니라 작품이 바뀌어도 지속되는 작가 자신의 내면과 작품관이어야 합니다.`;

const AUTHOR_RECOMMENDATION_SCHEMA = `
[중요: JSON 응답 규칙]
반드시 아래 형식의 JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.

{
  "authors": [
    {
      "name": "작가 필명",
      "specialty": "전문 장르와 강점에 대한 구체적인 설명",
      "writingStyle": "실제 문장에 반영할 어휘, 시점, 호흡, 묘사와 대화 성향",
      "coreDirectives": "집필 판단 원칙과 피해야 할 방식",
      "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],${IDENTITY_CORE_JSON_EXAMPLE}
    }
  ]
}

[후보 구성]
- authors 배열에는 정확히 3명을 넣으세요.
- 세 후보 모두 사용자의 요구에 맞아야 하지만, 이름이나 태그만 바꾼 변형이어서는 안 됩니다.
- 각 후보는 문장 리듬, 장면 전개, 감정 처리, 대사와 묘사 중 최소 두 축에서 분명히 달라야 합니다.
- 상투적인 웹소설 성공 공식이나 동일한 만능형 작가를 반복하지 마세요.
- specialty, writingStyle, coreDirectives는 추상적인 칭찬이 아니라 실제 집필 때 적용 가능한 내용으로 작성하세요.`;

export interface AuthorRecommendationRequest {
  keywords: string;
  mood?: string;
  strengths?: string;
  avoid?: string;
  model?: GeminiHelperModel;
}

export type AuthorRecommendation = Pick<
  AiAuthor,
  'name' | 'specialty' | 'writingStyle' | 'coreDirectives' | 'tags' | 'identityCore'
>;

/** 융합용 강화된 JSON 스키마 프롬프트 */
const ENHANCED_FUSION_SCHEMA = `
[중요: JSON 응답 규칙]
반드시 아래 형식의 JSON만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "name": "융합된 새 작가의 필명",
  "specialty": "융합을 통해 탄생한 새로운 전문 영역 (최소 50자 이상)",
  "writingStyle": "원본 작가들의 문체가 어떻게 결합되었는지 상세 설명 (최소 100자 이상)",
  "coreDirectives": "융합된 핵심 철학과 원칙 (최소 100자 이상)",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],${IDENTITY_CORE_JSON_EXAMPLE}
}

[주의]
- 단순히 원본 내용을 복사하지 마세요.
- 원본 작가들의 특성이 화학적으로 결합되어 새로운 것이 탄생해야 합니다.
- identityCore도 평균내지 말고 새로운 작가가 실제로 믿고 의심하는 하나의 내면으로 통합하세요.
- 모든 필드를 풍부하고 상세하게 작성하세요.`;

/** 융합 모드 타입 */
export type FusionMode = 'creative' | 'goal' | 'weighted' | 'complement' | 'filter';

/** 융합 옵션 */
export interface FusionOptions {
  mode: FusionMode;
  goal?: string;              // 목적기반 융합 시 목표
  weights?: number[];         // 가중치기반 융합 시 각 작가별 가중치 (0-100)
  filterTags?: string[];      // 필터링 융합 시 보존할 태그
  customPrompt?: string;      // 추가 지시사항
}

/** AI 응답 필드명 정규화 (한국어/스네이크케이스/변형 대응) */
function normalizeAuthorFields(raw: Record<string, unknown>): Record<string, unknown> {
  const fieldMap: Record<string, string> = {
    // name 변형
    '이름': 'name', '필명': 'name', '작가명': 'name', '작가_이름': 'name',
    'author_name': 'name', 'pen_name': 'name', 'nome': 'name',
    // specialty 변형
    '전문분야': 'specialty', '전문_분야': 'specialty', '장르': 'specialty',
    '전문영역': 'specialty', '분야': 'specialty', 'speciality': 'specialty',
    'genre': 'specialty', 'expertise': 'specialty',
    // writingStyle 변형
    '문체': 'writingStyle', '문체스타일': 'writingStyle', '문체_스타일': 'writingStyle',
    'writing_style': 'writingStyle', '서술방식': 'writingStyle', '스타일': 'writingStyle',
    'style': 'writingStyle', 'tone': 'writingStyle',
    // coreDirectives 변형
    '핵심지침': 'coreDirectives', '핵심_지침': 'coreDirectives', '철학': 'coreDirectives',
    'core_directives': 'coreDirectives', '지침': 'coreDirectives', '원칙': 'coreDirectives',
    'directives': 'coreDirectives', 'philosophy': 'coreDirectives',
    // tags 변형
    '태그': 'tags', '키워드': 'tags', 'keywords': 'tags', '태그들': 'tags',
    // identityCore 변형
    '작가코어': 'identityCore', '정체성코어': 'identityCore', 'identity_core': 'identityCore',
  };

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const mappedKey = fieldMap[key] || key;
    // 이미 정규화된 키가 없을 때만 설정 (원본 키 우선)
    if (!normalized[mappedKey]) {
      normalized[mappedKey] = value;
    }
  }
  return normalized;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 12)
    : [];
}

function normalizeIdentityCore(raw: unknown): AuthorIdentityCore | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  const taste = value.aestheticTaste && typeof value.aestheticTaste === 'object' && !Array.isArray(value.aestheticTaste)
    ? value.aestheticTaste as Record<string, unknown>
    : {};
  const literaryValues = Array.isArray(value.literaryValues)
    ? value.literaryValues.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const entry = item as Record<string, unknown>;
        const belief = stringValue(entry.belief);
        if (!belief) return [];
        return [{ belief, creativeEffect: stringValue(entry.creativeEffect), doubt: stringValue(entry.doubt) }];
      }).slice(0, 8)
    : [];
  const innerContradictions = Array.isArray(value.innerContradictions)
    ? value.innerContradictions.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const entry = item as Record<string, unknown>;
        const valueA = stringValue(entry.valueA);
        const valueB = stringValue(entry.valueB);
        if (!valueA || !valueB) return [];
        return [{ valueA, valueB, unresolvedReason: stringValue(entry.unresolvedReason) }];
      }).slice(0, 6)
    : [];

  const draft: AuthorIdentityDraft = {
    selfDefinition: stringValue(value.selfDefinition),
    reasonToWrite: stringValue(value.reasonToWrite),
    worldview: stringValue(value.worldview),
    viewOfHumanity: stringValue(value.viewOfHumanity),
    literaryValues,
    aestheticTaste: {
      drawnTo: stringList(taste.drawnTo),
      avoids: stringList(taste.avoids),
      emotionalTexture: stringValue(taste.emotionalTexture),
    },
    innerContradictions,
    recurringQuestions: stringList(value.recurringQuestions),
    readerRelationship: stringValue(value.readerRelationship),
    creativeEthics: stringValue(value.creativeEthics),
    narrativeInstincts: stringList(value.narrativeInstincts),
    voiceOrigins: stringValue(value.voiceOrigins),
    readabilityPractice: stringValue(value.readabilityPractice),
    plausibilityPractice: stringValue(value.plausibilityPractice),
  };

  if (!draft.selfDefinition || !draft.reasonToWrite || !draft.voiceOrigins
    || !draft.readabilityPractice || !draft.plausibilityPractice) return undefined;
  return createAuthorIdentityCore(draft);
}

function normalizeRecommendation(raw: unknown): AuthorRecommendation | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const normalized = normalizeAuthorFields(raw as Record<string, unknown>);
  const name = typeof normalized.name === 'string' ? normalized.name.trim() : '';
  const specialty = typeof normalized.specialty === 'string' ? normalized.specialty.trim() : '';
  const writingStyle = typeof normalized.writingStyle === 'string' ? normalized.writingStyle.trim() : '';
  const coreDirectives = typeof normalized.coreDirectives === 'string'
    ? normalized.coreDirectives.trim()
    : '';
  const tags = Array.isArray(normalized.tags)
    ? normalized.tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())).map((tag) => tag.trim()).slice(0, 8)
    : typeof normalized.tags === 'string'
      ? normalized.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8)
      : [];
  const identityCore = normalizeIdentityCore(normalized.identityCore);

  if (!name || !specialty || !writingStyle || !coreDirectives) return null;
  return { name, specialty, writingStyle, coreDirectives, tags, identityCore };
}

/** 텍스트 분석 등 다른 작가 생성 경로도 같은 안전한 스키마를 사용한다. */
export function normalizeGeneratedAuthorProfile(raw: unknown): AuthorRecommendation | null {
  return normalizeRecommendation(raw);
}

/** 같은 요청을 서로 다른 방식으로 해석한 추천 작가 3명을 생성한다. */
export async function generateAuthorRecommendations(
  request: AuthorRecommendationRequest
): Promise<AuthorRecommendation[]> {
  const lines = [
    `[핵심 키워드와 방향]\n${request.keywords.trim()}`,
    request.mood?.trim() ? `[원하는 분위기]\n${request.mood.trim()}` : '',
    request.strengths?.trim() ? `[특히 잘해야 할 것]\n${request.strengths.trim()}` : '',
    request.avoid?.trim() ? `[피해야 할 것]\n${request.avoid.trim()}` : '',
  ].filter(Boolean);

  const recommendations: AuthorRecommendation[] = [];

  for (let responseAttempt = 0; responseAttempt < 2; responseAttempt++) {
    const retryNote = responseAttempt > 0
      ? `\n\n[재요청]\n이전 응답에는 비교 가능한 후보가 부족했습니다. 기존 후보(${recommendations.map((author) => author.name).join(', ') || '없음'})와 겹치지 않는 후보를 포함해 형식을 다시 완성하세요.`
      : '';
    const responseText = await generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: `아래 의뢰를 바탕으로 비교 가능한 AI 작가 후보를 설계하십시오.\n\n${lines.join('\n\n')}\n\n${AUTHOR_RECOMMENDATION_SCHEMA}${retryNote}`,
        }],
      }],
      systemInstruction: AUTHOR_CONCEPT_ARTIST_INSTRUCTION,
      model: normalizeGeminiHelperModel(request.model || MODELS.TEXT),
      maxTokens: 4096,
      jsonMode: true,
      timeoutMs: 30000,
      retryAttempts: 2,
    });

    const parsed = extractAndParseJson<unknown>(responseText, null);
    const rawAuthors = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { authors?: unknown }).authors)
        ? (parsed as { authors: unknown[] }).authors
        : [];

    rawAuthors
      .map(normalizeRecommendation)
      .filter((author): author is AuthorRecommendation => author !== null)
      .forEach((author) => {
        const isDuplicate = recommendations.some((existing) => (
          existing.name.toLocaleLowerCase() === author.name.toLocaleLowerCase()
          || existing.writingStyle === author.writingStyle
        ));
        if (!isDuplicate && recommendations.length < 3) recommendations.push(author);
      });

    if (recommendations.length >= 2) return recommendations;
  }

  throw new Error('작가 추천 실패: 비교 가능한 후보를 충분히 만들지 못했습니다.');
}

/**
 * 랜덤 작가 프로필 생성
 * @param keywords 키워드
 * @param options 생성 옵션 (API 제공자 선택 등)
 */
export async function generateRandomAuthorProfile(
  keywords: string
): Promise<Partial<AiAuthor>> {
  let prompt = '새로운 AI 작가의 고유한 정체성과 창작관을 설계하십시오.';

  if (keywords.trim()) {
    prompt += `\n- 키워드/스타일: ${keywords}`;
    prompt += '\n- 조건: 위 힌트를 바탕으로 구체적인 인물을 만드십시오.';
  } else {
    prompt += '\n- 조건: 완전히 무작위로 독창적인 작가를 생성하십시오.';
  }

  const enhancedPrompt = `${prompt}\n\n${ENHANCED_JSON_SCHEMA}`;
  const responseText = await generateContent({
    contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
    systemInstruction: AUTHOR_CONCEPT_ARTIST_INSTRUCTION,
    model: MODELS.FLASH_LITE,
    maxTokens: 1536,
    jsonMode: true,
    timeoutMs: 12000,
    retryAttempts: 1,
  });
  const raw = extractAndParseJson<Record<string, unknown>>(responseText, {});

  // 필드명 정규화 (모델이 한국어/스네이크케이스/다른 키로 반환할 수 있음)
  const output = normalizeAuthorFields(raw);
  const normalizedProfile = normalizeRecommendation(output);

  if (!normalizedProfile) {
    const preview = responseText.substring(0, 300);
    const keys = Object.keys(raw);
    throw new Error(
      `작가 생성 실패: 필수 필드 누락 (받은 키: ${keys.length ? keys.join(', ') : '없음'}) | 응답: ${preview}`
    );
  }

  return { ...normalizedProfile, engine: 'gemini' } as Partial<AiAuthor>;
}

/**
 * 융합 모드별 프롬프트 생성
 */
function buildFusionPrompt(authors: AiAuthor[], options: FusionOptions): string {
  // 기본 작가 정보
  let prompt = `다음 작가들의 프로필을 융합하십시오:\n`;

  authors.forEach((a, idx) => {
    const identity = resolveAuthorIdentityCore(a);
    const weight = options.weights?.[idx];
    const weightLabel = weight !== undefined ? ` (가중치: ${weight}%)` : '';
    prompt += `\n[작가 ${idx + 1}: ${a.name}]${weightLabel}`;
    prompt += `\n전문분야: ${a.specialty}`;
    prompt += `\n문체: ${a.writingStyle}`;
    prompt += `\n지시사항: ${a.coreDirectives}`;
    prompt += `\n자기 정의: ${identity.selfDefinition}`;
    prompt += `\n쓰는 이유: ${identity.reasonToWrite}`;
    prompt += `\n세계관·인간관: ${identity.worldview} / ${identity.viewOfHumanity}`;
    prompt += `\n문체의 기원: ${identity.voiceOrigins}`;
    prompt += `\n반복 질문: ${identity.recurringQuestions.join(' / ')}`;
    if (a.tags?.length) {
      prompt += `\n태그: ${a.tags.join(', ')}`;
    }
    prompt += '\n';
  });

  prompt += '\n\n[융합 모드 및 옵션]';

  switch (options.mode) {
    case 'goal':
      prompt += '\n🎯 목적기반 융합';
      prompt += `\n- 목표: "${options.goal || '새로운 장르에 적합한 작가'}"`;
      prompt += '\n- 각 작가의 요소 중 목표 달성에 필요한 것만 선별하여 융합하세요.';
      prompt += '\n- 목표에 맞지 않는 특성은 과감히 배제하세요.';
      break;

    case 'weighted':
      prompt += '\n⚖️ 가중치기반 융합';
      prompt += '\n- 각 작가의 가중치에 비례하여 특성을 반영하세요.';
      prompt += '\n- 가중치가 높은 작가의 문체, 전문분야, 철학을 더 강하게 반영하세요.';
      prompt += '\n- 가중치가 0%인 작가는 미세한 뉘앙스만 차용하세요.';
      break;

    case 'complement':
      prompt += '\n🔄 상보적 융합';
      prompt += '\n- 각 작가의 부족한 점을 다른 작가가 보완하도록 융합하세요.';
      prompt += '\n- 충돌하는 특성이 있다면 시너지를 내도록 조화시키세요.';
      prompt += '\n- 최종 결과물이 어느 한 작가보다 더 균형 잡히도록 하세요.';
      break;

    case 'filter':
      prompt += '\n🏷️ 필터링 융합';
      if (options.filterTags?.length) {
        prompt += `\n- 보존할 태그: ${options.filterTags.join(', ')}`;
        prompt += '\n- 위 태그와 관련된 특성만 융합에 반영하세요.';
        prompt += '\n- 관련 없는 특성은 새 작가에서 제외하세요.';
      }
      break;

    case 'creative':
    default:
      prompt += '\n✨ 창의적 융합';
      prompt += '\n- 작가들의 강점을 자유롭게 결합하세요.';
      prompt += '\n- 예상치 못한 시너지를 만들어내세요.';
      prompt += '\n- 단순한 평균이 아닌, 새로운 가치를 창출하세요.';
      break;
  }

  if (options.customPrompt?.trim()) {
    prompt += `\n\n[추가 지시사항]\n${options.customPrompt}`;
  }

  return prompt;
}

/**
 * 작가 프로필 융합 (확장 버전)
 * @param authors 융합할 작가들
 * @param options 융합 옵션 (모드, 가중치, 목표 등)
 */
export async function fuseAuthorProfiles(
  authors: AiAuthor[],
  options: FusionOptions | string = { mode: 'creative' }
): Promise<Partial<AiAuthor>> {
  // 이전 버전 호환성: 문자열로 전달되면 customPrompt로 처리
  const fusionOptions: FusionOptions = typeof options === 'string'
    ? { mode: 'creative', customPrompt: options }
    : options;

  const prompt = buildFusionPrompt(authors, fusionOptions);

  // 작가 융합
  const enhancedPrompt = `${prompt}\n\n${ENHANCED_FUSION_SCHEMA}`;
  const responseText = await generateContent({
    contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
    systemInstruction: AUTHOR_FUSION_INSTRUCTION,
    model: MODELS.FLASH_LITE,
    maxTokens: 2048,
    jsonMode: true,
    timeoutMs: 16000,
    retryAttempts: 1,
  });
  const output = extractAndParseJson<Record<string, unknown>>(responseText, {});
  const normalizedProfile = normalizeRecommendation(output);
  if (!normalizedProfile) {
    throw new Error('작가 융합 실패: 완전한 작가 프로필을 만들지 못했습니다.');
  }

  return { ...normalizedProfile, engine: 'gemini' } as Partial<AiAuthor>;
}

/**
 * 작가의 막간 (작품 해설) 생성
 */
export async function generateAuthorInterlude(
  author: AiAuthor,
  title: string,
  chapters: Chapter[]
): Promise<string> {
  const systemInstruction = AUTHOR_INTERLUDE_INSTRUCTION(author, title);
  const context = chapters
    .map((c) => c.content)
    .join('\n\n')
    .substring(0, 20000);
  const prompt = `--- 소설 내용 ---\n${context}\n\n지금까지의 내용에 대한 작가의 코멘터리를 작성하세요.`;

  try {
    const result = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
    });
    return result || '';
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    throw new Error(`작가 막간 생성 실패: ${message}`);
  }
}
