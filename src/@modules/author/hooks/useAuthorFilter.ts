/**
 * ============================================================
 * @module modules/author/hooks
 * @file useAuthorFilter.ts
 * ============================================================
 * @description 작가 필터링 로직 훅
 * ============================================================
 */

import { useMemo, useState, useCallback } from 'react';
import type { AiAuthor } from '@core/types';

/**
 * 작가 필터링 훅
 */
export function useAuthorFilter(authors: AiAuthor[]) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  /** 태그 기반 필터링된 작가 목록 */
  const filteredAuthors = useMemo(() => {
    if (selectedTags.length === 0) {
      return authors;
    }
    return authors.filter((author) =>
      selectedTags.every((tag) =>
        (author.tags || []).includes(`#${tag}`)
      )
    );
  }, [authors, selectedTags]);

  /** 태그 토글 */
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  /** 모든 필터 초기화 */
  const clearFilters = useCallback(() => {
    setSelectedTags([]);
  }, []);

  return {
    selectedTags,
    filteredAuthors,
    toggleTag,
    clearFilters,
  };
}
