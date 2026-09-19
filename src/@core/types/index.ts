/**
 * ============================================================
 * @module core/types
 * @file index.ts
 * ============================================================
 * @description 타입 모듈 통합 export
 * ============================================================
 */

// Google Genai Content 타입 re-export
export type { Content } from '@google/genai';

// Author 타입
export type {
  AiAuthor,
  AuthorConviction,
  AuthorIdentityCore,
  AuthorProfileVersion,
  AuthorTaste,
  AuthorTension,
  ClonedAuthorDetails,
} from './author.types';

// Chapter 타입
export type { Chapter, ChapterSource, ChapterTrace } from './chapter.types';
export type {
  ChapterAgentChoice,
  ChapterAgentPendingProposal,
  ChapterAgentProposal,
  ChapterAgentRevision,
  ChapterAgentRevisionGrounding,
} from './chapterAgent.types';
export type { CanonFact, CanonFactKind, CanonFactStatus } from './canon.types';

// Character 타입
export type {
  Character,
  ScannedCharacter,
  CharacterUpdateLog,
  CharacterAnalysisResult,
} from './character.types';

export type {
  CharacterChatSourceType,
  CharacterChatModel,
  PersonaFieldOrigin,
  PersonaField,
  CharacterChatPersonaField,
  CharacterChatSource,
  CharacterChatPersona,
  CharacterChatCandidate,
  CharacterChatMessage,
  CharacterChatSession,
  CharacterChatBackupData,
  CharacterChatEmotion,
  CharacterChatMessageBlock,
  CharacterChatMessageBlockType,
  CharacterChatUserPersona,
} from './characterChat.types';

export type {
  DirectorAuthorProposal,
  DirectorAuthorProposalDraft,
  DirectorClioReadMode,
  DirectorClioSession,
  DirectorClioBackupData,
  DirectorNovelReference,
} from './directorClio.types';

// Series 타입
export type {
  Series,
  SeriesBlueprint,
  VolumeBlueprint,
  SeriesVolumePlanSnapshot,
  SeriesMemoryBlock,
  SeriesMemoryState,
} from './series.types';

// Worldview 타입
export type {
  WorldviewFile,
  WorldviewAnalysisResult,
  ExtractedWorldviewCharacter,
  LorekeeperCacheValue,
} from './worldview.types';

// Context 타입
export type {
  SummaryEntry,
  SummaryMilestone,
  SummaryRollup,
  SummaryRollupLevel,
  ContextSummary,
  ContextManagement,
  CachedModelInfo,
  ContextCachingConfig,
} from './context.types';

// Episode 타입
export type {
  PacingSpeed,
  EpisodePacing,
  WritingFocusScope,
  EpisodeArcChapter,
  EpisodeArc,
} from './episode.types';

// Generation 타입
export type {
  ChapterGenerationMode,
  GenerationLog,
  PendingChapterGeneration,
} from './generation.types';

// Analysis 타입
export type { VisualAnalysisData, NovelAnalysis } from './analysis.types';

// Snapshot 타입
export type { Snapshot } from './snapshot.types';

// Foreshadowing 타입 (개연성 중심 복선 관리)
export type {
  ForeshadowingUrgency,
  ForeshadowingType,
  ForeshadowingStatus,
  Foreshadowing,
  ForeshadowingSystem,
  ForeshadowingAnalysisResult,
  ForeshadowingContext,
} from './foreshadowing.types';

// Treatment 타입 (총괄설계도 v2)
export type { Treatment, TreatmentEpisode } from './treatment.types';

// Novel 타입 (메인)
export type { Novel, GenerationEngine, OpeningStyle, StartingPoint } from './novel.types';

// Workspace types
export type {
  StudioWorkspace,
  WorkspaceRegistry,
  WorkspaceBackupMetadata,
} from './workspace.types';

export {
  PRODUCTION_PACKAGE_KIND,
} from './productionPackage.types';
export type {
  ProductionPackage,
  ProductionPackagePurpose,
  ProductionPackageSection,
  ProductionPackageSectionSelection,
  ProductionPackageIdMap,
  ProductionPackageReceipt,
  ProductionPackageImportOptions,
  ProductionPackageImportResult,
} from './productionPackage.types';

// 웹소설 시스템 타입
export type {
  WebNovelGenre,
  WebNovelPlatform,
  SentenceBreathing,
  DialogueSettings,
  HookingSettings,
  GenreRequirements,
  GenreLaw,
  PlatformLaw,
  WebNovelSettings,
} from './webnovel.types';

export { DEFAULT_WEBNOVEL_STYLE, DEFAULT_WEBNOVEL_SETTINGS } from './webnovel.types';
