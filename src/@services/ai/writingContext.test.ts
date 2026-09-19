import { describe, expect, it } from 'vitest';
import type { AiAuthor, Novel } from '@core/types';
import { COMMON_PROSE_GUARDRAILS } from '@core/laws';
import { computeChapterSignature, computeStableSignature } from './utils';
import { buildWritingContext } from './writingContext';

const author: AiAuthor = {
  id: 'author-1', name: '서늘', specialty: '심리극', writingStyle: '건조한 관찰',
  coreDirectives: '감정을 단정하지 않는다.', memoryCache: ['침묵을 존중한다.'], createdAt: 1,
  identityCore: {
    schemaVersion: 1, coreId: 'core-1', versionId: 'version-1',
    selfDefinition: '침묵 속 선택을 기록하는 작가', reasonToWrite: '말하지 못한 마음을 드러내기 위해',
    worldview: '사람은 선택으로 자신을 증명한다.', viewOfHumanity: '인간은 모순 속에서도 변한다.',
    literaryValues: [{ belief: '행동이 설명보다 진실하다.', creativeEffect: '행동으로 감정을 보인다.', doubt: '침묵만으로 충분한가.' }],
    aestheticTaste: { drawnTo: ['절제'], avoids: ['감정 설명'], emotionalTexture: '서늘한 여운' },
    innerContradictions: [{ valueA: '절제', valueB: '고백', unresolvedReason: '둘 다 진실에 필요하다.' }],
    recurringQuestions: ['사람은 언제 진실해지는가?'], readerRelationship: '독자를 해석의 동료로 본다.',
    creativeEthics: '인물을 결론으로 소비하지 않는다.', narrativeInstincts: ['행동을 먼저 둔다.'],
    voiceOrigins: '설명보다 흔적을 믿는다.', readabilityPractice: '짧은 장면 목표를 잇는다.',
    plausibilityPractice: '선택 전 감정의 원인을 심는다.', createdAt: 1, updatedAt: 1,
  },
};

function makeNovel(): Novel {
  const chapters = Array.from({ length: 6 }, (_, index) => ({
    id: `ch-${index + 1}`,
    title: `${index + 1}화`,
    content: `본문-${index + 1}`,
  }));
  return {
    id: 'novel-1', title: '작품', subject: '재회', mood: '서늘함', plotSummary: '다시 만난다.',
    chapters, history: [], createdAt: 1, aiAuthorId: author.id, characters: [],
    contextManagement: { isEnabled: true, fullTextChapters: 2, summaryTriggerChapters: 3 },
    authorMemoryByAuthor: { [author.id]: ['이 작품은 3인칭으로 쓴다.'] },
  };
}

describe('buildWritingContext', () => {
  it('작가의 고유 정체성과 공통 기억을 최우선 계약으로 묶고 작품별 적응은 제외한다', () => {
    const context = buildWritingContext(makeNovel(), author, null);

    expect(context.priorityPolicy[0]).toContain('AI 작가');
    expect(context.author.writingStyle).toBe(author.writingStyle);
    expect(context.author.identityCore).toEqual(author.identityCore);
    expect(context.author.globalMemories).toEqual(author.memoryCache);
    expect(context.author).not.toHaveProperty('workMemories');
    expect(context.diagnostics).not.toHaveProperty('authorWorkMemoryCount');
  });

  it('외부 집필자도 내부 생성기와 같은 공통 표현 규칙을 읽는다', () => {
    const context = buildWritingContext(makeNovel(), author, null);

    expect(context.commonWritingRules).toEqual(COMMON_PROSE_GUARDRAILS);
  });

  it('유효한 요약 뒤의 갱신 대기 화를 빠짐없이 원문으로 보낸다', () => {
    const novel = makeNovel();
    const covered = novel.chapters.slice(0, 2);
    novel.contextSummary = {
      content: '1~2화 요약', summarizedChapters: 2, createdAt: 1,
      coveredChapterIds: covered.map((chapter) => chapter.id!),
      contentSignature: computeChapterSignature(covered),
    };

    const context = buildWritingContext(novel, author, null);

    expect(context.storyMemory.coveredChapterCount).toBe(2);
    expect(context.chapters.filter((chapter) => chapter.content)).toHaveLength(4);
    expect(context.chapters[2].content).toBe('본문-3');
  });

  it('저장된 예전 설정과 무관하게 compact는 최근 3화, full은 전체 원문을 연다', () => {
    const novel = makeNovel();
    const compact = buildWritingContext(novel, author, null, 'compact');
    const full = buildWritingContext(novel, author, null, 'full');

    expect(compact.storyMemory.rawChapterCount).toBe(3);
    expect(compact.chapters.filter((chapter) => chapter.content)).toHaveLength(3);
    expect(full.chapters.filter((chapter) => chapter.content)).toHaveLength(6);
    expect(compact.warnings[0]).toContain('장기 요약');
  });

  it('수정된 과거 원문은 낡은 요약으로 덮지 않고 공통 상태를 stale로 표시한다', () => {
    const novel = makeNovel();
    const covered = novel.chapters.slice(0, 3);
    novel.contextSummary = {
      content: '1~3화의 예전 요약', summarizedChapters: 3, createdAt: 1,
      coveredChapterIds: covered.map((chapter) => chapter.id!),
      contentSignature: computeChapterSignature(covered),
    };
    novel.chapters[1] = { ...novel.chapters[1], content: '수정된 2화 본문' };

    const context = buildWritingContext(novel, author, null);

    expect(context.storyMemory.status).toBe('stale');
    expect(context.storyMemory.summary).toBe('');
    expect(context.storyMemory.rawChapterStart).toBe(1);
    expect(context.chapters.filter((chapter) => chapter.content)).toHaveLength(6);
    expect(context.warnings.join(' ')).toContain('재동기화');
  });

  it('구조화 요약이 낡으면 서명이 맞는 연속 앞 구간만 쓰고 이후는 원문으로 연다', () => {
    const novel = makeNovel();
    const covered = novel.chapters.slice(0, 4);
    novel.contextSummary = {
      content: '기존 전체 요약', summarizedChapters: 4, createdAt: 1,
      coveredChapterIds: covered.map((chapter) => chapter.id!),
      contentSignature: computeChapterSignature(covered),
      entries: covered.map((chapter, index) => ({
        chapterId: chapter.id!,
        chapterNumber: index + 1,
        chapterTitle: chapter.title,
        summary: `${index + 1}화의 안전한 요약`,
        timestamp: 1,
        chapterSignature: computeStableSignature(JSON.stringify([chapter.id, chapter.title, chapter.content])),
      })),
    };
    novel.chapters[1] = { ...novel.chapters[1], content: '수정된 2화 본문' };

    const context = buildWritingContext(novel, author, null);

    expect(context.storyMemory.status).toBe('stale');
    expect(context.storyMemory.summary).toContain('1화의 안전한 요약');
    expect(context.storyMemory.summary).not.toContain('2화의 안전한 요약');
    expect(context.storyMemory.coveredChapterCount).toBe(1);
    expect(context.storyMemory.rawChapterStart).toBe(2);
    expect(context.chapters.filter((chapter) => chapter.content)).toHaveLength(5);
  });
});
