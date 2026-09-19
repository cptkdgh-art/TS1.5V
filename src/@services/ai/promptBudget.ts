import type { Content } from '@google/genai';
import type { Character, WorldviewFile } from '@core/types';
import { isLargeWorldview } from './worldviewPolicy';

export const PROMPT_BUDGETS = {
  maxCharacters: 12,
  characterPersonalityChars: 260,
  characterAppearanceChars: 180,
  characterBackgroundChars: 320,
  characterLogChars: 260,
  maxWorldviewFiles: 12,
  worldviewFileChars: 1600,
  worldviewTotalChars: 10000,
  largeWorldviewMaxFiles: 8,
  largeWorldviewFileChars: 1200,
  largeWorldviewCoreChars: 5000,
  maxDirectives: 12,
  directiveChars: 500,
} as const;

export function truncateForPrompt(text: string | undefined, maxChars: number): string {
  const value = (text || '').trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).trim()}… (${value.length - maxChars}자 생략)`;
}

export function extractContentText(content: Content): string {
  return content.parts?.map((part) => ('text' in part ? part.text || '' : '')).join('\n').trim() || '';
}

export function buildCharacterContext(characters: Character[]): string {
  if (characters.length === 0) return '';

  const lines = characters.slice(0, PROMPT_BUDGETS.maxCharacters).map((character) => {
    const chunks = [
      `[${character.name}] ${truncateForPrompt(character.personality, PROMPT_BUDGETS.characterPersonalityChars)}`,
      character.appearance ? `외모: ${truncateForPrompt(character.appearance, PROMPT_BUDGETS.characterAppearanceChars)}` : '',
      character.background ? `배경: ${truncateForPrompt(character.background, PROMPT_BUDGETS.characterBackgroundChars)}` : '',
      character.log ? `변화: ${truncateForPrompt(character.log, PROMPT_BUDGETS.characterLogChars)}` : '',
    ].filter(Boolean);
    return chunks.join(' | ');
  });

  if (characters.length > PROMPT_BUDGETS.maxCharacters) {
    lines.push(`(외 ${characters.length - PROMPT_BUDGETS.maxCharacters}명은 이름/역할만 필요 시 보조 맥락에서 확인)`);
  }

  return `--- 주요 등장인물 ---\n${lines.join('\n')}\n\n`;
}

export function buildWorldviewContext(
  files: WorldviewFile[] | undefined,
  useLorekeeper = true,
): string {
  if (!files || files.length === 0) return '';

  const large = useLorekeeper && isLargeWorldview(files);
  const maxFiles = large ? PROMPT_BUDGETS.largeWorldviewMaxFiles : PROMPT_BUDGETS.maxWorldviewFiles;
  const perFileChars = large ? PROMPT_BUDGETS.largeWorldviewFileChars : PROMPT_BUDGETS.worldviewFileChars;
  const totalChars = large ? PROMPT_BUDGETS.largeWorldviewCoreChars : PROMPT_BUDGETS.worldviewTotalChars;
  const selected = files.slice(0, maxFiles);
  let remainingTotal = totalChars;
  const blocks: string[] = [];

  for (const file of selected) {
    if (remainingTotal <= 0) break;
    const maxForFile = Math.min(perFileChars, remainingTotal);
    const content = truncateForPrompt(file.content, maxForFile);
    remainingTotal -= content.length;
    blocks.push(`[File: ${file.filename}]\n${content}`);
  }

  if (files.length > blocks.length) {
    blocks.push(`(세계관 파일 ${files.length - blocks.length}개는 기록보관자가 현재 회차에 맞춰 로컬 원문에서 선별)`);
  }

  return blocks.length > 0
    ? `--- 세계관 설정 (${large ? '대형 세계관 핵심본' : '압축'}) ---\n파일 순서는 기본 우선순위이며 위쪽 파일일수록 먼저 참고하세요.\n${blocks.join('\n\n')}\n\n`
    : '';
}

export function buildWritingDirectivesContext(directives: Content[] | undefined): string {
  if (!directives || directives.length === 0) return '';

  const selected = directives.slice(-PROMPT_BUDGETS.maxDirectives);
  const lines = selected
    .map(extractContentText)
    .filter(Boolean)
    .map((text) => `- ${truncateForPrompt(text, PROMPT_BUDGETS.directiveChars)}`);

  if (directives.length > selected.length) {
    lines.unshift(`- (이전 지시 ${directives.length - selected.length}개는 장기 기억에 보존. 현재 호출에는 최신 핵심만 주입)`);
  }

  return lines.length > 0 ? `--- 핵심 연출 지침 (AI 기억, 압축) ---\n${lines.join('\n')}\n\n` : '';
}
