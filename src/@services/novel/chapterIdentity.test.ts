import { describe, expect, it } from 'vitest';
import type { Chapter } from '@core/types';
import {
  createChapterTrace,
  getChapterDisplayId,
  reviseChapter,
} from './chapterIdentity';

describe('chapter identity', () => {
  it('keeps the stable chapter id while increasing the content revision', () => {
    const chapter: Chapter = {
      id: 'ch_100_abcde',
      title: '1화',
      content: '초고',
      trace: createChapterTrace('ai', { generationBatchId: 'batch-1', batchPosition: 1, batchSize: 2 }, 100),
    };

    const revised = reviseChapter(chapter, { content: '수정고' }, undefined, 200);

    expect(revised.id).toBe(chapter.id);
    expect(revised.trace).toMatchObject({
      revision: 2,
      createdAt: 100,
      updatedAt: 200,
      source: 'ai',
      generationBatchId: 'batch-1',
    });
  });

  it('does not create a new content revision for title-only changes', () => {
    const chapter: Chapter = {
      id: 'chapter-123456',
      title: '임시 제목',
      content: '본문',
      trace: createChapterTrace('manual', {}, 100),
    };

    const revised = reviseChapter(chapter, { title: '확정 제목' }, undefined, 200);

    expect(revised.trace?.revision).toBe(1);
    expect(revised.trace?.updatedAt).toBe(100);
    expect(getChapterDisplayId(revised)).toBe('CH-123456');
  });

  it('keeps the first saved text of an empty manual chapter at revision one', () => {
    const chapter: Chapter = {
      id: 'chapter-manual',
      title: '1화',
      content: '',
      trace: createChapterTrace('manual', {}, 100),
    };

    const saved = reviseChapter(chapter, { content: '첫 원고' }, undefined, 200);

    expect(saved.trace?.revision).toBe(1);
    expect(saved.trace?.updatedAt).toBe(200);
  });
});
