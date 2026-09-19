/**
 * ============================================================
 * @module modules/novel
 * @file index.ts
 * ============================================================
 * @description 소설 모듈 통합 export
 * ============================================================
 */

export { NovelList, type NovelListProps } from './NovelList';
export {
  NovelCard,
  SeriesCard,
  CreateWorkModal,
  DeleteNovelModal,
  type WorkType,
  type CreateNovelData,
  type CreateSeriesData,
} from './components';
