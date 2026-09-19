import { afterEach, describe, expect, it } from 'vitest';
import type { AiAuthor, Novel } from '@core/types';
import { useAuthorStore } from '@stores/authorStore';
import { useNovelStore } from '@stores/novelStore';
import { handleBridgeCommand } from './index';

const author: AiAuthor = {
  id: 'author-1', name: '브리지 작가', specialty: '심리극', writingStyle: '절제된 문장',
  coreDirectives: '감정을 설명하지 않는다.', memoryCache: ['침묵을 유지한다.'], createdAt: 1,
};
const novel: Novel = {
  id: 'novel-1', title: '브리지 작품', subject: '재회', mood: '서늘함', plotSummary: '다시 만난다.',
  chapters: [], history: [], createdAt: 1, aiAuthorId: author.id, characters: [],
};

afterEach(() => {
  useNovelStore.setState({ novels: [] });
  useAuthorStore.setState({ authors: [] });
});

describe('getWritingContext bridge command', () => {
  it('novelId 하나로 담당 작가와 집필 우선순위를 반환한다', async () => {
    useNovelStore.setState({ novels: [novel] });
    useAuthorStore.setState({ authors: [author] });

    const result = await handleBridgeCommand('getWritingContext', { novelId: novel.id });

    expect(result).toMatchObject({
      schemaVersion: 1,
      author: { id: author.id, name: author.name },
      work: { id: novel.id, title: novel.title },
      commonWritingRules: expect.arrayContaining([
        expect.stringContaining('불필요한 수식'),
      ]),
    });
  });
});
