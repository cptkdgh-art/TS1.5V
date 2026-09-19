import type {
  CharacterChatEmotion,
  CharacterChatMessage,
  CharacterChatMessageBlock,
} from '@core/types';

const EMOTION_LABELS: Record<CharacterChatEmotion, string> = {
  neutral: '중립',
  warm: '다정',
  happy: '기쁨',
  shy: '당황',
  sad: '슬픔',
  angry: '분노',
  surprised: '놀람',
  tense: '긴장',
};

const EMOTION_ALIASES: Record<string, CharacterChatEmotion> = {
  neutral: 'neutral',
  중립: 'neutral',
  무표정: 'neutral',
  calm: 'neutral',
  warm: 'warm',
  다정: 'warm',
  부드러움: 'warm',
  happy: 'happy',
  기쁨: 'happy',
  미소: 'happy',
  웃음: 'happy',
  shy: 'shy',
  당황: 'shy',
  수줍음: 'shy',
  부끄러움: 'shy',
  sad: 'sad',
  슬픔: 'sad',
  우울: 'sad',
  angry: 'angry',
  분노: 'angry',
  화남: 'angry',
  surprised: 'surprised',
  놀람: 'surprised',
  경악: 'surprised',
  tense: 'tense',
  긴장: 'tense',
  경계: 'tense',
};

export interface ParsedRoleplayResponse {
  content: string;
  emotion: CharacterChatEmotion;
  blocks: CharacterChatMessageBlock[];
}

const MAX_TURN_CHARS = 420;
const MAX_NARRATION_BLOCKS = 2;
const MAX_DIALOGUE_BLOCKS = 1;

function trimAtSentence(value: string, maxChars: number): string {
  const text = value.trim();
  if (text.length <= maxChars) return text;
  const candidate = text.slice(0, maxChars);
  const boundary = Math.max(
    candidate.lastIndexOf('.'),
    candidate.lastIndexOf('!'),
    candidate.lastIndexOf('?'),
    candidate.lastIndexOf('。'),
    candidate.lastIndexOf('！'),
    candidate.lastIndexOf('？')
  );
  if (boundary >= Math.floor(maxChars * 0.55)) return candidate.slice(0, boundary + 1).trim();
  return `${candidate.trimEnd()}…`;
}

export function getEmotionLabel(emotion: CharacterChatEmotion): string {
  return EMOTION_LABELS[emotion];
}

function normalizeEmotion(value: string | undefined): CharacterChatEmotion {
  const normalized = (value || '').trim().toLowerCase().replace(/\s+/g, '');
  return EMOTION_ALIASES[normalized] || 'neutral';
}

function appendUnmarked(blocks: CharacterChatMessageBlock[], value: string) {
  const text = value.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();
  if (!text) return;
  blocks.push({ type: 'dialogue', text });
}

export function parseRoleplayResponse(raw: string): ParsedRoleplayResponse {
  const emotionMatch = raw.match(/\[(?:표정|emotion)\s*:\s*([^\]]+)\]/i);
  const emotion = normalizeEmotion(emotionMatch?.[1]);
  const body = raw
    .replace(/\[(?:표정|emotion)\s*:\s*[^\]]+\]/i, '')
    .replace(/^\[(?:표정|emotion)\s*:[^\]\n]*(?:\]\s*|\s*$)/i, '')
    .replace(/^```(?:markdown|text)?\s*|\s*```$/gi, '')
    .trim();

  const blocks: CharacterChatMessageBlock[] = [];
  const tokenPattern = /\*([^*]+)\*|[“"]([^”"]+)[”"]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(body)) !== null) {
    appendUnmarked(blocks, body.slice(cursor, match.index));
    const narration = match[1]?.trim();
    const dialogue = match[2]?.trim();
    if (narration) blocks.push({ type: 'narration', text: narration });
    if (dialogue) blocks.push({ type: 'dialogue', text: dialogue });
    cursor = tokenPattern.lastIndex;
  }
  appendUnmarked(blocks, body.slice(cursor));

  if (blocks.length === 0 && body) blocks.push({ type: 'dialogue', text: body });
  const content = blocks.map((block) => block.text).join('\n\n').trim();
  return { content, emotion, blocks };
}

export function constrainRoleplayTurn(parsed: ParsedRoleplayResponse): ParsedRoleplayResponse {
  const blocks: CharacterChatMessageBlock[] = [];
  let narrationCount = 0;
  let dialogueCount = 0;
  let remainingChars = MAX_TURN_CHARS;

  for (const block of parsed.blocks) {
    if (remainingChars <= 0) break;
    if (block.type === 'narration') {
      if (narrationCount >= MAX_NARRATION_BLOCKS) continue;
      narrationCount += 1;
    } else {
      if (dialogueCount >= MAX_DIALOGUE_BLOCKS) continue;
      dialogueCount += 1;
    }
    const text = trimAtSentence(block.text, remainingChars);
    if (!text) continue;
    blocks.push({ ...block, text });
    remainingChars -= text.length;
  }

  const content = blocks.map((block) => block.text).join('\n\n').trim();
  return { ...parsed, content, blocks };
}

export function formatRoleplayMessage(message: CharacterChatMessage): string {
  if (message.role !== 'assistant' || !message.blocks?.length) return message.content;
  const emotion = getEmotionLabel(message.emotion || 'neutral');
  const body = message.blocks.map((block) => (
    block.type === 'narration' ? `*${block.text}*` : `“${block.text}”`
  )).join('\n');
  return `[표정:${emotion}]\n${body}`;
}
