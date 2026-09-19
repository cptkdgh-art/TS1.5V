/**
 * ============================================================
 * @module modules/author
 * @file index.ts
 * ============================================================
 * @description AI 작가 모듈 통합 export
 * ============================================================
 */

export { AuthorManager, type AuthorManagerProps } from './AuthorManager';
export { AuthorCard, TagFilter, EditAuthorModal, DeleteAuthorModal } from './components';
export { useTagClassification, useAuthorFilter } from './hooks';
export { CATEGORY_DEFINITIONS, TAG_DICT, KEYWORD_RULES, type CategoryId } from './constants';
