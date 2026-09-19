import type { Chapter, ChapterSource, ChapterTrace } from '@core/types';

export function createChapterTrace(
  source: ChapterSource,
  options: Partial<Omit<ChapterTrace, 'revision' | 'createdAt' | 'updatedAt' | 'source'>> = {},
  now = Date.now(),
): ChapterTrace {
  return {
    revision: 1,
    createdAt: now,
    updatedAt: now,
    source,
    ...options,
  };
}

export function reviseChapter(
  chapter: Chapter,
  updates: Partial<Pick<Chapter, 'title' | 'content'>>,
  source: ChapterSource = chapter.trace?.source ?? 'legacy',
  now = Date.now(),
): Chapter {
  const contentChanged = updates.content !== undefined && updates.content !== chapter.content;
  const previous = chapter.trace ?? createChapterTrace(source, {}, now);
  const fillsInitialManualDraft = contentChanged
    && previous.source === 'manual'
    && previous.revision === 1
    && chapter.content.length === 0;
  return {
    ...chapter,
    ...updates,
    trace: {
      ...previous,
      revision: previous.revision + (contentChanged && !fillsInitialManualDraft ? 1 : 0),
      updatedAt: contentChanged ? now : previous.updatedAt,
    },
  };
}

export function getChapterDisplayId(chapter: Chapter): string {
  const raw = chapter.id || 'legacy';
  const compact = raw.replace(/^ch[_-]?/i, '').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
  return `CH-${compact || 'LEGACY'}`;
}

export function getChapterSourceLabel(source: ChapterSource | undefined): string {
  switch (source) {
    case 'ai': return 'AI 생성';
    case 'manual': return '직접 작성';
    case 'imported': return '외부 입고';
    case 'translated': return '번역본';
    default: return '기존 원고';
  }
}
