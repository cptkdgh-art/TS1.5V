import { describe, it, expect } from 'vitest';
import { GENRE_LAWS, getGenreLaw, getGenreList } from './genre-laws';
import type { WebNovelGenre } from '@core/types/webnovel.types';

describe('genre-laws', () => {
  describe('GENRE_LAWS 레지스트리', () => {
    it('필수 장르가 모두 등록되어 있다', () => {
      const required: WebNovelGenre[] = [
        'romance-fantasy',
        'modern-fantasy-f',
        'romance',
        'bl',
        'hunter',
        'martial-arts',
        'regression',
        'custom',
      ];
      for (const g of required) {
        expect(GENRE_LAWS[g]).toBeDefined();
        expect(GENRE_LAWS[g].genre).toBe(g);
      }
    });

    it('모든 장르에 name/description이 있다', () => {
      for (const [genre, law] of Object.entries(GENRE_LAWS)) {
        expect(law.name, `${genre} — name`).toBeTruthy();
        expect(law.description, `${genre} — description`).toBeTruthy();
      }
    });

    it('custom을 제외한 모든 장르에 prompt와 mustHave가 있다', () => {
      for (const [genre, law] of Object.entries(GENRE_LAWS)) {
        if (genre === 'custom') continue;
        expect(law.prompt, `${genre} — prompt`).toBeTruthy();
        expect(law.requirements.mustHave.length, `${genre} — mustHave`).toBeGreaterThan(0);
      }
    });

    it('custom 장르는 사용자 직접 설정용이라 prompt가 비어있다', () => {
      expect(GENRE_LAWS['custom'].prompt).toBe('');
    });
  });

  describe('getGenreLaw()', () => {
    it('유효한 장르는 정확히 매칭된다', () => {
      const law = getGenreLaw('hunter');
      expect(law.genre).toBe('hunter');
      expect(law.name).toContain('헌터');
    });

    it('알 수 없는 장르는 custom으로 폴백한다', () => {
      const law = getGenreLaw('unknown-genre' as WebNovelGenre);
      expect(law.genre).toBe('custom');
    });

    it('동일 장르 호출 시 같은 객체 참조를 반환한다', () => {
      expect(getGenreLaw('hunter')).toBe(getGenreLaw('hunter'));
    });
  });

  describe('getGenreList()', () => {
    it('UI용 리스트에 label/value/category가 있다', () => {
      const list = getGenreList();
      expect(list.length).toBeGreaterThan(0);
      for (const item of list) {
        expect(item.value).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.category).toBeTruthy();
      }
    });

    it('카테고리가 여성향/남성향/공용/기타 중 하나다', () => {
      const valid = new Set(['여성향', '남성향', '공용', '기타']);
      for (const item of getGenreList()) {
        expect(valid.has(item.category), `${item.value}: ${item.category}`).toBe(true);
      }
    });

    it('리스트의 모든 value가 GENRE_LAWS에 존재한다', () => {
      for (const item of getGenreList()) {
        expect(GENRE_LAWS[item.value], item.value).toBeDefined();
      }
    });
  });
});
