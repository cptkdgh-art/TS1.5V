import { describe, expect, it } from 'vitest';
import type { Novel } from '@core/types';
import { computeChapterSignature } from '@services/ai';
import { prepareChapterRemoval } from './chapterRecovery';

const createNovel = (): Novel => {
  const chapters = Array.from({ length: 4 }, (_, index) => ({
    id: `chapter-${index + 1}`,
    title: `${index + 1}화 제목`,
    content: `${index + 1}화 본문`,
  }));
  const covered = chapters.slice(0, 3);

  return {
    id: 'novel-1',
    title: '회차 복구 테스트',
    subject: '',
    mood: '',
    plotSummary: '',
    chapters,
    history: [{ role: 'user', parts: [{ text: '삭제 전 대화' }] }],
    createdAt: 1,
    aiAuthorId: null,
    characters: [],
    contextSummary: {
      content: covered.map((_, index) => `[${index + 1}화] 요약 ${index + 1}`).join('\n\n'),
      summarizedChapters: 3,
      createdAt: 1,
      coveredChapterIds: covered.map((chapter) => chapter.id!),
      contentSignature: computeChapterSignature(covered),
      entries: covered.map((chapter, index) => ({
        chapterId: chapter.id!,
        chapterNumber: index + 1,
        chapterTitle: chapter.title,
        summary: `요약 ${index + 1}`,
        timestamp: 1,
      })),
    },
    contextCaching: {
      isEnabled: true,
      activeBufferWindow: 2,
      caches: {
        model: {
          cacheName: 'cache-1',
          createTime: '2026-08-21T00:00:00.000Z',
          expireTime: '2026-08-22T00:00:00.000Z',
          cachedChapterCount: 2,
          cachedTokenCount: 100,
          contentSignature: 'old',
        },
      },
    },
    foreshadowingSystem: {
      items: [
        {
          id: 'kept-clue',
          name: '남는 복선',
          description: '',
          type: 'mystery',
          urgency: 'short',
          status: 'hinted',
          causality: { premise: '', implication: '', consequence: '' },
          plantedAt: { chapterIndex: 0, briefContext: '' },
          hints: [{ chapterIndex: 3, hint: '삭제될 힌트' }],
          linkedCharacterIds: [],
          linkedForeshadowingIds: ['removed-clue'],
          aiGuidance: { doHint: [], dontReveal: [], payoffTiming: '' },
          createdAt: 1,
          updatedAt: 1,
          importance: 3,
        },
        {
          id: 'removed-clue',
          name: '삭제될 복선',
          description: '',
          type: 'mystery',
          urgency: 'short',
          status: 'planted',
          causality: { premise: '', implication: '', consequence: '' },
          plantedAt: { chapterIndex: 2, briefContext: '' },
          hints: [],
          linkedCharacterIds: [],
          linkedForeshadowingIds: [],
          aiGuidance: { doHint: [], dontReveal: [], payoffTiming: '' },
          createdAt: 1,
          updatedAt: 1,
          importance: 3,
        },
      ],
      pacingGuide: {
        currentTension: 30,
        plantedCount: 1,
        awaitingPayoffCount: 2,
        recommendation: 'balanced',
        urgentPayoffs: [],
      },
    },
  };
};

describe('prepareChapterRemoval', () => {
  it('rolls back from the selected chapter and creates a restorable full snapshot', () => {
    const original = createNovel();
    const result = prepareChapterRemoval(original, 'chapter-3', 2, 'rollback', 100);

    expect(result.chapters.map((chapter) => chapter.id)).toEqual(['chapter-1', 'chapter-2']);
    expect(result.contextSummary?.coveredChapterIds).toEqual(['chapter-1', 'chapter-2']);
    expect(result.contextSummary?.content).toContain('[2화] 요약 2');
    expect(result.contextSummary?.content).not.toContain('[3화]');
    expect(result.contextCaching?.caches).toEqual({});
    expect(result.history).toEqual([]);
    expect(result.foreshadowingSystem?.items).toHaveLength(1);
    expect(result.foreshadowingSystem?.items[0].hints).toEqual([]);
    expect(result.foreshadowingSystem?.items[0].linkedForeshadowingIds).toEqual([]);
    const recovery = result.snapshots?.[result.snapshots.length - 1];
    expect(recovery?.kind).toBe('auto-recovery');
    expect(recovery?.novelData.chapters).toHaveLength(4);
    expect(recovery?.recoveryMeta).toMatchObject({
      operation: 'rollback',
      targetChapterId: 'chapter-3',
      targetChapterNumber: 3,
      chapterCountBefore: 4,
    });
  });

  it('deletes only one chapter and keeps only the uncontaminated summary prefix', () => {
    const original = createNovel();
    const result = prepareChapterRemoval(original, 'chapter-2', 1, 'delete', 200);

    expect(result.chapters.map((chapter) => chapter.id)).toEqual([
      'chapter-1',
      'chapter-3',
      'chapter-4',
    ]);
    expect(result.contextSummary?.coveredChapterIds).toEqual(['chapter-1']);
    expect(result.contextSummary?.entries?.map((entry) => ({
      id: entry.chapterId,
      number: entry.chapterNumber,
      title: entry.chapterTitle,
    }))).toEqual([
      { id: 'chapter-1', number: 1, title: '1화 제목' },
    ]);
    expect(result.contextSummary?.content).toBe('[1화] 요약 1');
    expect(result.contextSummary?.needsRecheck).toBe(true);
    expect(result.snapshots?.[result.snapshots.length - 1]?.recoveryMeta?.operation).toBe('delete');
  });

  it('keeps manual snapshots and only the five newest automatic recovery snapshots', () => {
    const initial = createNovel();
    const { snapshots: _snapshots, ...manualNovelData } = initial;
    let resultSnapshots: Novel['snapshots'] = [{
      id: 'manual-1',
      createdAt: 1,
      description: '직접 저장',
      novelData: manualNovelData,
      kind: 'manual',
    }];

    for (let index = 0; index < 6; index += 1) {
      const novel = createNovel();
      novel.snapshots = resultSnapshots;
      const result = prepareChapterRemoval(novel, 'chapter-4', 3, 'delete', 300 + index);
      resultSnapshots = result.snapshots;
    }

    expect(resultSnapshots?.filter((snapshot) => snapshot.kind === 'auto-recovery')).toHaveLength(5);
    expect(resultSnapshots?.some((snapshot) => snapshot.id === 'manual-1')).toBe(true);
  });
});
