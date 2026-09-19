import type { CharacterChatModel, CharacterChatPersonaField } from '@core/types';
import { normalizeGeminiTextModel } from '@services/ai/config';

export const DEFAULT_CHARACTER_CHAT_MODEL: CharacterChatModel = 'gemini-3.7-flash';

export const CHARACTER_CHAT_MODELS: Array<{ value: CharacterChatModel; label: string }> = [
  { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
];

const CHARACTER_CHAT_MODEL_SET = new Set<CharacterChatModel>(
  CHARACTER_CHAT_MODELS.map(({ value }) => value)
);

export function normalizeCharacterChatModel(model: unknown): CharacterChatModel {
  if (typeof model !== 'string') return DEFAULT_CHARACTER_CHAT_MODEL;
  if (
    model === 'gemini-3.8-flash' ||
    model === 'gemini-3-flash-preview' ||
    model === 'gemini-3.0-flash'
  ) {
    return DEFAULT_CHARACTER_CHAT_MODEL;
  }
  if (CHARACTER_CHAT_MODEL_SET.has(model as CharacterChatModel)) {
    return model as CharacterChatModel;
  }

  const normalized = normalizeGeminiTextModel(model);
  return CHARACTER_CHAT_MODEL_SET.has(normalized as CharacterChatModel)
    ? normalized as CharacterChatModel
    : DEFAULT_CHARACTER_CHAT_MODEL;
}

export const PERSONA_FIELD_LABELS: Record<CharacterChatPersonaField, string> = {
  role: '작품 속 역할',
  personality: '성격',
  speakingStyle: '말투',
  values: '가치관',
  behaviorRules: '행동 방식',
  appearance: '외모',
  background: '배경',
  forbiddenTopics: '금지 정보',
  storyContext: '현재 이야기 맥락',
  worldContext: '세계관',
  greeting: '첫 인사',
};

export const PERSONA_FIELDS = Object.keys(PERSONA_FIELD_LABELS) as CharacterChatPersonaField[];
