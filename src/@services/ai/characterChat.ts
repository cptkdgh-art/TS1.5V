import type {
  CharacterChatCandidate,
  CharacterChatModel,
  CharacterChatPersona,
  CharacterChatPersonaField,
  CharacterChatSession,
  CharacterChatSource,
} from '@core/types';
import { generateContent, streamGeminiContent } from './config';
import { extractAndParseJson } from './utils';
import {
  PERSONA_FIELD_LABELS,
  buildCharacterChatSummaryTranscript,
  buildCharacterChatSystemInstruction,
  getRecentChatContents,
} from '@services/character-chat';

const EXTRACTION_CHARS = 36000;
const MAX_EXTRACTION_CHUNKS = 24;
const EXTRACTION_CONCURRENCY = 2;

interface CandidateResponse {
  characters?: Array<Partial<Omit<CharacterChatCandidate, 'id' | 'confidence'>>>;
}

function splitSourceText(text: string): string[] {
  if (text.length <= EXTRACTION_CHARS) return [text];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const proposedEnd = Math.min(text.length, cursor + EXTRACTION_CHARS);
    const newline = text.lastIndexOf('\n', proposedEnd);
    const end = newline > cursor + EXTRACTION_CHARS * 0.6 ? newline : proposedEnd;
    chunks.push(text.slice(cursor, end));
    cursor = end;
  }
  if (chunks.length <= MAX_EXTRACTION_CHUNKS) return chunks;
  return Array.from({ length: MAX_EXTRACTION_CHUNKS }, (_, index) => {
    const sourceIndex = Math.round(index * (chunks.length - 1) / (MAX_EXTRACTION_CHUNKS - 1));
    return chunks[sourceIndex];
  });
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

function preferDetailed(current: string, candidate: string): string {
  return candidate.trim().length > current.trim().length ? candidate : current;
}

function mergeCandidates(candidates: CharacterChatCandidate[]): CharacterChatCandidate[] {
  const merged = new Map<string, CharacterChatCandidate>();
  for (const candidate of candidates) {
    const key = normalizeName(candidate.name);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, candidate);
      continue;
    }
    merged.set(key, {
      ...current,
      aliases: [...new Set([...current.aliases, ...candidate.aliases])],
      role: preferDetailed(current.role, candidate.role),
      personality: preferDetailed(current.personality, candidate.personality),
      speakingStyle: preferDetailed(current.speakingStyle, candidate.speakingStyle),
      values: preferDetailed(current.values, candidate.values),
      behaviorRules: preferDetailed(current.behaviorRules, candidate.behaviorRules),
      appearance: preferDetailed(current.appearance, candidate.appearance),
      background: preferDetailed(current.background, candidate.background),
      storyContext: [...new Set([current.storyContext, candidate.storyContext].filter(Boolean))].join('\n'),
    });
  }
  return [...merged.values()];
}

function parseCandidates(response: string): CharacterChatCandidate[] {
  const parsed = extractAndParseJson<CandidateResponse>(response, {});
  const characters = Array.isArray(parsed.characters) ? parsed.characters : [];
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  return characters
    .filter((character) => text(character.name))
    .map((character) => ({
      id: crypto.randomUUID(),
      name: text(character.name),
      aliases: Array.isArray(character.aliases)
        ? character.aliases.map(text).filter(Boolean)
        : [],
      role: text(character.role),
      personality: text(character.personality),
      speakingStyle: text(character.speakingStyle),
      values: text(character.values),
      behaviorRules: text(character.behaviorRules),
      appearance: text(character.appearance),
      background: text(character.background),
      storyContext: text(character.storyContext),
      confidence: 'high',
    }));
}

export async function extractCharacterChatCandidates(
  source: CharacterChatSource,
  model: CharacterChatModel,
  onProgress?: (completed: number, total: number) => void
): Promise<CharacterChatCandidate[]> {
  if (!source.text.trim()) throw new Error('분석할 원문이 없습니다.');
  const chunks = splitSourceText(source.text);
  const collected: CharacterChatCandidate[] = [];

  let completed = 0;
  for (let start = 0; start < chunks.length; start += EXTRACTION_CONCURRENCY) {
    const batch = chunks.slice(start, start + EXTRACTION_CONCURRENCY);
    const batchCandidates = await Promise.all(batch.map(async (chunk, batchIndex) => {
      const index = start + batchIndex;
      const response = await generateContent({
        model,
        maxTokens: 4096,
        timeoutMs: 35000,
        retryAttempts: 2,
        jsonMode: true,
        systemInstruction: `소설 원문에서 주요 등장인물을 찾는 분석가입니다.
단역과 이름만 언급된 인물은 제외하고, 실제 성격이나 행동이 드러난 인물을 추출하세요.
원문에 없는 설정을 창작하지 마세요.
반드시 JSON으로 응답하세요: {"characters":[{"name":"","aliases":[],"role":"","personality":"","speakingStyle":"","values":"","behaviorRules":"","appearance":"","background":"","storyContext":""}]}`,
        contents: [{
          role: 'user',
          parts: [{ text: `작품: ${source.title}\n분석 구간 ${index + 1}/${chunks.length}\n\n${chunk}` }],
        }],
      });
      completed += 1;
      onProgress?.(completed, chunks.length);
      return parseCandidates(response);
    }));
    collected.push(...batchCandidates.flat());
  }

  return mergeCandidates(collected);
}

function getRelevantSourceText(source: CharacterChatSource, persona: CharacterChatPersona): string {
  const names = [persona.name, ...persona.aliases].filter(Boolean);
  const paragraphs = source.text.split(/\n{2,}/);
  const relevant = paragraphs.filter((paragraph) => names.some((name) => paragraph.includes(name)));
  const selected = relevant.length > 0 ? relevant.join('\n\n') : source.text;
  return selected.slice(0, 28000);
}

export async function generatePersonaFieldPatch(options: {
  persona: CharacterChatPersona;
  source: CharacterChatSource;
  fields: CharacterChatPersonaField[];
  model: CharacterChatModel;
  request?: string;
}): Promise<Partial<Record<CharacterChatPersonaField, string>>> {
  const { persona, source, fields, model, request } = options;
  if (fields.length === 0) return {};
  const requestedSchema = fields.map((field) => `"${field}": "${PERSONA_FIELD_LABELS[field]} 내용"`).join(',');
  const currentValues = fields.map((field) => `${PERSONA_FIELD_LABELS[field]}: ${persona[field].value || '(비어 있음)'}`).join('\n');
  const response = await generateContent({
    model,
    maxTokens: 3072,
    timeoutMs: 35000,
    retryAttempts: 2,
    jsonMode: true,
    systemInstruction: `캐릭터 페르소나 편집자입니다.
사용자가 선택한 항목만 작성하고 선택하지 않은 항목은 절대 출력하지 마세요.
원문에서 확인되는 내용은 우선 보존하고, 근거가 부족한 부분만 자연스럽게 보완하세요.
기존 설정과 충돌하거나 캐릭터를 평범한 전형으로 바꾸지 마세요.
반드시 JSON 객체만 응답하세요: {${requestedSchema}}`,
    contents: [{
      role: 'user',
      parts: [{ text: `캐릭터: ${persona.name}\n추가 요청: ${request || '(없음)'}\n\n현재 값:\n${currentValues}\n\n관련 원문:\n${getRelevantSourceText(source, persona)}\n\n참고 세계관:\n${source.worldview.slice(0, 8000)}` }],
    }],
  });
  const parsed = extractAndParseJson<Record<string, unknown>>(response, {});
  return fields.reduce<Partial<Record<CharacterChatPersonaField, string>>>((patch, field) => {
    const value = parsed[field];
    if (typeof value === 'string' && value.trim()) patch[field] = value.trim();
    return patch;
  }, {});
}

export async function* streamCharacterChatReply(
  persona: CharacterChatPersona,
  source: CharacterChatSource,
  session: CharacterChatSession,
  signal?: AbortSignal
) {
  yield* streamGeminiContent({
    model: session.model,
    maxTokens: 1024,
    timeoutMs: 25000,
    retryAttempts: 2,
    signal,
    systemInstruction: buildCharacterChatSystemInstruction(persona, source, session),
    contents: getRecentChatContents(session),
  });
}

export async function summarizeCharacterChatMemory(
  session: CharacterChatSession,
  persona: CharacterChatPersona
): Promise<string> {
  const transcript = buildCharacterChatSummaryTranscript(session, persona.name);
  return generateContent({
    model: session.model,
    maxTokens: 1024,
    timeoutMs: 22000,
    retryAttempts: 2,
    systemInstruction: `캐릭터챗 장기 기억 정리자입니다.
기존 기억과 새 대화에서 관계 변화, 약속, 선호, 중요한 사건만 간결하게 통합하세요.
추측하거나 대화를 창작하지 말고 1200자 이내의 한국어 메모로 작성하세요.`,
    contents: [{
      role: 'user',
      parts: [{ text: `기존 기억:\n${session.memorySummary || '(없음)'}\n\n새 대화:\n${transcript}` }],
    }],
  });
}
