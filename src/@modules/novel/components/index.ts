/**
 * ============================================================
 * @module modules/novel/components
 * @file index.ts
 * ============================================================
 * @description 소설 컴포넌트 통합 export
 * ============================================================
 */

export { NovelCard } from './NovelCard';
export { SeriesCard } from './SeriesCard';
export {
  CreateWorkModal,
  type WorkType,
  type CreateNovelData,
  type CreateSeriesData,
} from './CreateWorkModal';
export { DeleteNovelModal } from './DeleteNovelModal';
export { SeriesMemoryModal } from './SeriesMemoryModal';
export {
  IncorporateToSeriesModal,
  type IncorporateTarget,
} from './IncorporateToSeriesModal';
export { TranslateNovelModal } from './TranslateNovelModal';
export { SeriesWorkflowGuideModal } from './SeriesWorkflowGuideModal';
export { SeriesArchitectModal } from './SeriesArchitectModal';
export { StoryGuideFields } from './StoryGuideFields';
