import type { Content } from '@core/types';

function getContentText(content: Content): string {
  return (content.parts || [])
    .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

/** 최신 사용자 브리핑을 우선 보존하면서 중복과 전체 글자 수를 제한한다. */
export function buildPreviousBriefing(
  history: Content[] | undefined,
  maxMessages: number,
  maxChars: number
): string {
  if (!history?.length || maxMessages <= 0 || maxChars <= 0) return '';

  const seen = new Set<string>();
  const newestFirst: string[] = [];

  for (let index = history.length - 1; index >= 0 && newestFirst.length < maxMessages; index -= 1) {
    const item = history[index];
    if (item.role !== 'user') continue;
    const text = getContentText(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    newestFirst.push(text);
  }

  const selected: string[] = [];
  let remaining = maxChars;
  for (const text of newestFirst) {
    const separatorCost = selected.length > 0 ? 5 : 0;
    if (remaining <= separatorCost) break;
    remaining -= separatorCost;

    if (text.length <= remaining) {
      selected.push(text);
      remaining -= text.length;
      continue;
    }

    const clipped = remaining > 1 ? `${text.slice(0, remaining - 1)}…` : text.slice(0, remaining);
    if (clipped) selected.push(clipped);
    break;
  }

  return selected.reverse().join('\n---\n');
}
