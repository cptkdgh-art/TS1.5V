import type { ContextSummary, SummaryEntry, SummaryRollup } from '@core/types';
import { computeStableSignature } from './utils';

const HIERARCHY_THRESHOLD = 30;
const EPISODE_SIZE = 10;
const VOLUME_SIZE = 50;
const DETAIL_TAIL = 10;

function entryGroupSignature(entries: SummaryEntry[]): string {
  return computeStableSignature(JSON.stringify(entries.map((entry) => [
    entry.chapterId,
    entry.chapterNumber,
    entry.chapterTitle,
    entry.chapterSignature || '',
    entry.summary,
  ])));
}

function reuseOrCreate(
  existing: SummaryRollup[],
  rollup: Omit<SummaryRollup, 'id' | 'createdAt'>,
): SummaryRollup {
  const reusable = existing.find((item) => item.level === rollup.level
    && item.sourceSignature === rollup.sourceSignature
    && item.content === rollup.content);
  return reusable ?? {
    ...rollup,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
}

function compactEntries(entries: SummaryEntry[], perEntryChars: number): string {
  return entries.map((entry) => {
    const text = compactEntryText(entry.summary, perEntryChars);
    return `${entry.chapterNumber}화 ${text}`;
  }).join('\n');
}

/** Local excerpts retain both setup and outcome; they do not claim lossless semantic coverage. */
function compactEntryText(summary: string, limit: number): string {
  if (summary.length <= limit) return summary;
  const sentences = [...new Set(summary.trim().split(/(?<=[.!?。])\s+|\n+/).map((text) => text.trim()).filter(Boolean))];
  const text = sentences.join(' ');
  if (text.length <= limit) return text;
  const headBudget = Math.ceil((limit - 5) * 0.65);
  const tailBudget = limit - 5 - headBudget;
  const head = sentences[0].slice(0, headBudget);
  const tail = sentences[sentences.length - 1].slice(-tailBudget);
  return `${head} ... ${tail}`;
}

export function buildSummaryRollups(
  entries: SummaryEntry[],
  existing: SummaryRollup[] = [],
): SummaryRollup[] {
  if (entries.length < HIERARCHY_THRESHOLD) return [];
  const ordered = [...entries].sort((a, b) => a.chapterNumber - b.chapterNumber);
  const episodeRollups: SummaryRollup[] = [];

  for (let index = 0; index < ordered.length; index += EPISODE_SIZE) {
    const group = ordered.slice(index, index + EPISODE_SIZE);
    if (group.length < EPISODE_SIZE) break;
    episodeRollups.push(reuseOrCreate(existing, {
      level: 'episode',
      startChapterNumber: group[0].chapterNumber,
      endChapterNumber: group[group.length - 1].chapterNumber,
      sourceChapterIds: group.map((entry) => entry.chapterId),
      sourceSignature: entryGroupSignature(group),
      content: compactEntries(group, 260),
    }));
  }

  const volumeRollups: SummaryRollup[] = [];
  for (let index = 0; index < episodeRollups.length; index += VOLUME_SIZE / EPISODE_SIZE) {
    const group = episodeRollups.slice(index, index + VOLUME_SIZE / EPISODE_SIZE);
    if (group.length < VOLUME_SIZE / EPISODE_SIZE) break;
    const signature = computeStableSignature(JSON.stringify(group.map((item) => [item.sourceSignature, item.content])));
    volumeRollups.push(reuseOrCreate(existing, {
      level: 'volume',
      startChapterNumber: group[0].startChapterNumber,
      endChapterNumber: group[group.length - 1].endChapterNumber,
      sourceChapterIds: group.flatMap((item) => item.sourceChapterIds),
      sourceSignature: signature,
      content: compactEntries(ordered.slice(index * EPISODE_SIZE, (index * EPISODE_SIZE) + VOLUME_SIZE), 120),
    }));
  }

  return [...volumeRollups, ...episodeRollups];
}

export function attachSummaryRollups(summary: ContextSummary): ContextSummary {
  return {
    ...summary,
    rollups: buildSummaryRollups(summary.entries ?? [], summary.rollups ?? []),
  };
}

/** 오래된 범위만 상위 파생 기억으로 접고, 최근 요약은 화별 원형을 유지한다. */
export function resolveHierarchicalSummary(summary: ContextSummary | undefined): string {
  const entries = summary?.entries ?? [];
  if (!summary?.content || entries.length < HIERARCHY_THRESHOLD || !summary.rollups?.length) {
    return summary?.content?.trim() || '';
  }

  const ordered = [...entries].sort((a, b) => a.chapterNumber - b.chapterNumber);
  // Persisted rollups may use an older compaction algorithm or predate a manual edit.
  const rollups = buildSummaryRollups(ordered, summary.rollups);
  const sections: string[] = [];
  const coveredIds = new Set<string>();
  const volumeTarget = Math.floor(Math.max(0, ordered.length - (DETAIL_TAIL * 2)) / VOLUME_SIZE) * VOLUME_SIZE;
  const volumeRollups = rollups
    .filter((item) => item.level === 'volume' && item.endChapterNumber <= volumeTarget)
    .sort((a, b) => a.startChapterNumber - b.startChapterNumber);
  for (const item of volumeRollups) {
    sections.push(`[권 기억 ${item.startChapterNumber}~${item.endChapterNumber}화]\n${item.content}`);
    item.sourceChapterIds.forEach((id) => coveredIds.add(id));
  }

  const episodeTarget = Math.floor(Math.max(0, ordered.length - DETAIL_TAIL) / EPISODE_SIZE) * EPISODE_SIZE;
  const episodeRollups = rollups
    .filter((item) => item.level === 'episode'
      && item.sourceChapterIds.every((id) => !coveredIds.has(id))
      && item.endChapterNumber <= episodeTarget)
    .sort((a, b) => a.startChapterNumber - b.startChapterNumber);
  for (const item of episodeRollups) {
    sections.push(`[에피소드 기억 ${item.startChapterNumber}~${item.endChapterNumber}화]\n${item.content}`);
    item.sourceChapterIds.forEach((id) => coveredIds.add(id));
  }

  const details = ordered.filter((entry) => !coveredIds.has(entry.chapterId));
  if (details.length > 0) sections.push(`[최근 화별 기억]\n${compactEntries(details, Number.MAX_SAFE_INTEGER)}`);
  return sections.join('\n\n');
}

export const SUMMARY_HIERARCHY_THRESHOLD = HIERARCHY_THRESHOLD;
