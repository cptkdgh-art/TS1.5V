import { describe, expect, it } from 'vitest';
import { buildStoryClassificationText, combineMood, parseMood } from './story-guides';

describe('story guides', () => {
  it('기존 자유입력 분위기와 새 프리셋 조합을 모두 보존한다', () => {
    expect(parseMood('서늘하고 건조한')).toEqual({ tags: [], freeText: '서늘하고 건조한' });
    expect(combineMood(['긴장감', '따뜻한'], '사건 장면은 서늘하게'))
      .toBe('긴장감, 따뜻한 | 사건 장면은 서늘하게');
  });

  it('비어 있는 분류는 생략하고 사용자가 고른 정보만 만든다', () => {
    expect(buildStoryClassificationText({
      primaryGenre: '현대판타지',
      subgenres: ['헌터'],
      themes: ['성장'],
      subject: '',
    })).toBe('주 장르: 현대판타지\n부 장르: 헌터\n주제: 성장');
  });
});
