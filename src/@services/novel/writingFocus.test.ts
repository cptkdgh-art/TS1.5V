import { describe, expect, it } from 'vitest';
import type { Novel } from '@core/types';
import { applyWritingFocusAfterChapterCommit } from './writingFocus';

const novel: Novel = {
  id: 'novel-focus',
  title: '집중 테스트',
  subject: '',
  mood: '',
  plotSummary: '',
  chapters: [],
  history: [],
  createdAt: 1,
  aiAuthorId: null,
  characters: [],
};

describe('applyWritingFocusAfterChapterCommit', () => {
  it('다음 1화만 집중은 완성 화가 저장된 뒤 자동으로 종료한다', () => {
    const result = applyWritingFocusAfterChapterCommit({
      ...novel,
      episodePacing: {
        isEnabled: true,
        goal: '다음 화 목표',
        destination: '',
        scope: 'next-chapter',
        speed: 'normal',
      },
    }, true);

    expect(result.episodePacing?.isEnabled).toBe(false);
    expect(result.episodePacing?.goal).toBe('다음 화 목표');
  });

  it('미완성 저장에서는 다음 1화만 집중을 유지한다', () => {
    const result = applyWritingFocusAfterChapterCommit({
      ...novel,
      episodePacing: {
        isEnabled: true,
        goal: '이어 쓸 목표',
        destination: '',
        scope: 'next-chapter',
        speed: 'slow',
      },
    }, false);

    expect(result.episodePacing?.isEnabled).toBe(true);
  });

  it('목표 달성까지 집중은 완성 화가 저장되어도 유지한다', () => {
    const result = applyWritingFocusAfterChapterCommit({
      ...novel,
      episodePacing: {
        isEnabled: true,
        goal: '장기 방향',
        destination: '도달점',
        scope: 'until-complete',
        speed: 'fast',
      },
    }, true);

    expect(result.episodePacing?.isEnabled).toBe(true);
    expect(result.episodePacing?.destination).toBe('도달점');
  });

  it('범위가 없는 기존 집중 데이터는 목표 달성까지로 보존한다', () => {
    const result = applyWritingFocusAfterChapterCommit({
      ...novel,
      episodePacing: {
        isEnabled: true,
        goal: '기존 장기 목표',
        speed: 'normal',
      },
    }, true);

    expect(result.episodePacing?.isEnabled).toBe(true);
  });
});
