import { describe, expect, it } from 'vitest';
import type { Character, Novel, Series } from '@core/types';
import {
  createNovelChatSource,
  getNovelSourceCharacters,
  registeredCharacterToCandidate,
} from './source';

const character: Character = {
  id: 'character-1',
  name: '윤서',
  personality: '신중하다',
  appearance: '검은 머리',
  background: '왕실의 숨겨진 후계자',
  log: '5화에서 정체가 드러난다',
};

const novel: Novel = {
  id: 'novel-1',
  title: '기억 도시',
  subject: '',
  mood: '',
  plotSummary: '',
  chapters: [1, 2, 3].map((number) => ({
    id: `chapter-${number}`,
    title: `${number}화`,
    content: `${number}화 본문`,
  })),
  history: [],
  createdAt: 1,
  aiAuthorId: null,
  characters: [character],
  worldviewFiles: [{ filename: '비밀 설정', content: '3화 이후 공개되는 세계의 진실' }],
};

describe('character chat source adapter', () => {
  it('선택한 진행도 뒤의 본문과 전체 세계관을 캐릭터챗 원천에서 제외한다', () => {
    const source = createNovelChatSource(novel, null, 2);

    expect(source.text).toContain('2화 본문');
    expect(source.text).not.toContain('3화 본문');
    expect(source.worldview).toBe('');
    expect(source.isFullCanon).toBe(false);
  });

  it('전체 원고를 선택하면 세계관 파일도 독립 원천에 복사한다', () => {
    const source = createNovelChatSource(novel, null, 3);

    expect(source.text).toContain('3화 본문');
    expect(source.worldview).toContain('세계의 진실');
    expect(source.isFullCanon).toBe(true);
  });

  it('부분 진행도에서는 등록 캐릭터의 미래 배경과 로그를 노출하지 않는다', () => {
    const limited = registeredCharacterToCandidate(character, false);
    const full = registeredCharacterToCandidate(character, true);

    expect(limited.background).toBe('');
    expect(limited.storyContext).toBe('');
    expect(full.background).toContain('후계자');
    expect(full.storyContext).toContain('5화');
  });

  it('시리즈와 권별 캐릭터를 합치되 같은 인물은 한 번만 노출한다', () => {
    const series: Series = {
      id: 'series-1', title: '기억 도시', seriesPlotSummary: '', novelIds: [novel.id], createdAt: 1,
      characters: [character, { ...character, id: 'character-2', name: '태오' }],
    };
    const localNovel = {
      ...novel,
      characters: [{ ...character, id: 'character-3' }],
    };

    expect(getNovelSourceCharacters(localNovel, series).map((item) => item.name)).toEqual(['윤서', '태오']);
  });
});
