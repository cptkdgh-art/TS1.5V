/**
 * ============================================================
 * @module modules/author/hooks
 * @file useTagClassification.ts
 * ============================================================
 * @description 태그 분류 로직 훅
 * ============================================================
 */

import { useMemo, useCallback } from 'react';
import { useLocalStorage } from '@shared/hooks';
import type { AiAuthor } from '@core/types';
import {
  CATEGORY_DEFINITIONS,
  TAG_DICT,
  KEYWORD_RULES,
  type CategoryId,
} from '../constants';

export interface CategorizedTag {
  id: CategoryId;
  name: string;
  tags: string[];
}

/**
 * 태그 분류 훅
 */
export function useTagClassification(authors: AiAuthor[]) {
  const [customClassifications, setCustomClassifications] = useLocalStorage<
    Record<string, CategoryId>
  >('custom-tag-classifications', {});

  /** 태그를 카테고리로 분류 */
  const classifyTag = useCallback(
    (tag: string): CategoryId => {
      // 사용자 정의 분류 우선
      if (customClassifications[tag]) {
        return customClassifications[tag];
      }
      // 미리 정의된 태그 사전
      if (TAG_DICT[tag]) {
        return TAG_DICT[tag];
      }
      // 키워드 규칙 기반 분류
      for (const rule of KEYWORD_RULES) {
        if (rule.keywords.some((k) => tag.includes(k))) {
          return rule.category;
        }
      }
      return 'other';
    },
    [customClassifications]
  );

  /** 카테고리별로 태그 그룹화 */
  const categorizedTags = useMemo(() => {
    const allTags = new Set<string>();
    authors.forEach((author) => {
      author.tags?.forEach((tag) => allTags.add(tag.replace('#', '')));
    });

    const categories: Record<CategoryId, { name: string; tags: string[] }> = {
      vibe: { name: CATEGORY_DEFINITIONS.vibe.name, tags: [] },
      relationship: { name: CATEGORY_DEFINITIONS.relationship.name, tags: [] },
      style: { name: CATEGORY_DEFINITIONS.style.name, tags: [] },
      genre: { name: CATEGORY_DEFINITIONS.genre.name, tags: [] },
      erotic: { name: CATEGORY_DEFINITIONS.erotic.name, tags: [] },
      other: { name: CATEGORY_DEFINITIONS.other.name, tags: [] },
    };

    allTags.forEach((tag) => {
      const categoryId = classifyTag(tag);
      if (categories[categoryId]) {
        categories[categoryId].tags.push(tag);
      }
    });

    Object.values(categories).forEach((cat) => cat.tags.sort());

    return (Object.keys(CATEGORY_DEFINITIONS) as CategoryId[]).map((id) => ({
      id,
      ...categories[id],
    }));
  }, [authors, classifyTag]);

  /** 태그의 카테고리 변경 */
  const reclassifyTag = useCallback(
    (tag: string, newCategory: CategoryId) => {
      setCustomClassifications((prev) => ({
        ...prev,
        [tag]: newCategory,
      }));
    },
    [setCustomClassifications]
  );

  return {
    categorizedTags,
    classifyTag,
    reclassifyTag,
  };
}
