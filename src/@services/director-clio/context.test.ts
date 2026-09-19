import { describe, expect, it } from 'vitest';
import type { AiAuthor, Novel, Series } from '@core/types';
import {
  buildDirectorNovelCatalog,
  buildDirectorNovelContext,
  resolveDirectorNovelReference,
} from './context';

const author: AiAuthor = {
  id: 'author-1',
  name: '기본작가 클리오',
  specialty: '메타픽션',
  writingStyle: '담백하게 쓴다.',
  coreDirectives: '작가 개성을 지킨다.',
  createdAt: 1,
  memoryCache: ['공통 작가 기억'],
  identityCore: {
    schemaVersion: 1, coreId: 'core-1', versionId: 'version-1',
    selfDefinition: '선택의 대가를 추적하는 작가', reasonToWrite: '사람의 변화를 보기 위해',
    worldview: '진실에는 대가가 따른다.', viewOfHumanity: '인간은 손해를 감수하며 변한다.',
    literaryValues: [], aestheticTaste: { drawnTo: [], avoids: [], emotionalTexture: '긴장 뒤의 여운' },
    innerContradictions: [], recurringQuestions: [], readerRelationship: '독자를 추리의 동료로 본다.',
    creativeEthics: '', narrativeInstincts: [], voiceOrigins: '선택의 결과에서 문장이 나온다.',
    readabilityPractice: '행동 목표를 선명하게 둔다.', plausibilityPractice: '선택의 원인을 먼저 심는다.',
    createdAt: 1, updatedAt: 1,
  },
};

function makeNovel(id: string, title: string, seriesId?: string): Novel {
  return {
    id,
    title,
    subject: '성장',
    mood: '긴장',
    plotSummary: '주인공이 진실을 추적한다.',
    chapters: Array.from({ length: 4 }, (_, index) => ({
      id: `chapter-${index + 1}`,
      title: `${index + 1}화`,
      content: `원문-${index + 1}`,
      chapterNumber: index + 1,
    })),
    history: [],
    createdAt: 1,
    aiAuthorId: author.id,
    authorMemoryByAuthor: { [author.id]: ['이 작품 전용 작가 기억'] },
    seriesId,
    volumeNumber: seriesId ? 1 : undefined,
    characters: [{
      id: 'character-1',
      name: '윤서',
      personality: '신중하다',
      appearance: '',
      background: '기록관',
      log: '',
    }],
    worldviewFiles: [{ filename: '세계관', content: '기억은 화폐다.' }],
    writingDirectives: [{ role: 'user', parts: [{ text: '주인공의 선택을 우선한다.' }] }],
    contextManagement: {
      isEnabled: true,
      fullTextChapters: 2,
      summaryTriggerChapters: 3,
    },
  };
}

const series: Series = {
  id: 'series-1',
  title: '기억 연대기',
  seriesPlotSummary: '잃어버린 역사를 복구한다.',
  characters: [],
  novelIds: ['novel-1'],
  createdAt: 1,
};

describe('director Clio novel context', () => {
  it('작품 제목이나 고유 ID로 한 작품을 찾는다', () => {
    const novels = [makeNovel('novel-1', '혈마전기', series.id)];
    const catalog = buildDirectorNovelCatalog(novels, [series], [author]);

    expect(resolveDirectorNovelReference('혈마전기 전략 봐줘', catalog)[0].id).toBe('novel-1');
    expect(resolveDirectorNovelReference('novel-1 읽어줘', catalog)[0].title).toBe('혈마전기');
  });

  it('동명 작품을 임의로 하나 선택하지 않는다', () => {
    const catalog = buildDirectorNovelCatalog([
      makeNovel('novel-1', '귀환'),
      makeNovel('novel-2', '귀환'),
    ], [], [author]);

    expect(resolveDirectorNovelReference('귀환 읽어줘', catalog).map((item) => item.id))
      .toEqual(['novel-1', 'novel-2']);
  });

  it('최근 원문 모드는 고정 3화만, 전권 모드는 모든 원문을 싣는다', () => {
    const novel = makeNovel('novel-1', '혈마전기');
    const recent = buildDirectorNovelContext(novel, author, null, 'recent');
    const full = buildDirectorNovelContext(novel, author, null, 'full');
    const overview = buildDirectorNovelContext(novel, author, null, 'overview');

    expect(recent.text).not.toContain('원문-1');
    expect(recent.text).toContain('원문-2');
    expect(recent.text).toContain('원문-3');
    expect(recent.text).toContain('원문-4');
    expect(recent.includedChapterCount).toBe(3);
    expect(full.text).toContain('원문-1');
    expect(full.includedChapterCount).toBe(4);
    expect(overview.includedChapterCount).toBe(0);
  });

  it('총괄감독 문맥에서 작가의 고유 정체성을 전달하고 작품별 적응은 제외한다', () => {
    const context = buildDirectorNovelContext(makeNovel('novel-1', '혈마전기'), author, null, 'overview');

    expect(context.text).toContain('기본작가 클리오');
    expect(context.text).toContain('선택의 대가를 추적하는 작가');
    expect(context.text).not.toContain('이 작품 전용 작가 기억');
    expect(context.text).toContain('주인공의 선택을 우선한다.');
  });
});
