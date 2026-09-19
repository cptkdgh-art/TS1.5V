/**
 * ============================================================
 * @module services/ai
 * @file index.ts
 * ============================================================
 * @description AI 서비스 통합 export
 * ============================================================
 */

// Config & Utils
export { ai, MODELS, CHUNK_SIZE, CACHE_TOKEN_THRESHOLD, DEFAULT_ACTIVE_BUFFER_WINDOW, isApiKeyConfigured, streamGeminiContent } from './config';
export { processGeminiError, formatAiErrorForUser, extractTextFromContent, estimateTokens, withRetry, stripMarkdown, diversifyExpressions, generateChapterId, ensureChapterIds, validateSummaryCheckpoint, computeChapterSignature, computeStableSignature, matchesChapterSignature, getSummaryCoveredCount } from './utils';
export type { CheckpointValidation } from './utils';

// Prompts
export * from './prompts';

// Generation
export { continueNovelStream, rewriteText, reconstructChapter } from './generation';

// Chat
export {
  chatWithAuthor,
  haveStrategicChat,
  getLiveFeedback,
  haveGeneralChatWithAuthor,
  haveAfterwordChat,
  interviewCharacter,
  chatWithDirectorClio,
  summarizeBriefingChat,
  summarizeClioChatHistory,
  summarizeMemoryFromChat,
} from './chat';

// Analysis
export {
  summarizeNovelHistory,
  createAuthorProfileFromNovel,
  analyzeNovel,
  analyzeCharactersFromText,
  analyzeAndCharacterizeNovel,
  analyzeWorldviewFromNovel,
  enhancePlotSummary,
  // Character conversion utilities
  scannedToCharacter,
  convertScannedCharacters,
} from './analysis';

// Author
export {
  generateAuthorRecommendations,
  generateRandomAuthorProfile,
  fuseAuthorProfiles,
  generateAuthorInterlude,
} from './author';
export type { AuthorRecommendation, AuthorRecommendationRequest } from './author';
export {
  hasAuthorProfileChanged,
  createAuthorProfileVersion,
  restoreAuthorProfileVersion,
  updateAuthorWithProfileHistory,
} from './authorProfile';
export {
  cloneAuthorIdentityCore,
  createAuthorIdentityCore,
  createLegacyAuthorIdentityCore,
  ensureAuthorIdentity,
  forkAuthorIdentityCore,
  isAuthorIdentityCore,
  migrateAuthorIdentities,
  normalizeAuthorIdentityDraft,
  resolveAuthorIdentityCore,
} from './authorIdentity';
export type { AuthorIdentityDraft } from './authorIdentity';

// Worldview
export {
  generateInitialWorldviewDraft,
  generateWorldviewAspect,
  generateGeneralWorldviewFromContext,
} from './worldview';

// Episode
export {
  generateEpisodeArc,
  suggestIntermediateChapter,
  suggestEpisodeGoals,
  generateNextChapterPreview,
} from './episode';

// Treatment (트리트먼트 - 총괄설계도 v2)
export { generateTreatment } from './treatment';

// Character
export { generateCharacterProfile } from './character';
export {
  extractCharacterChatCandidates,
  generatePersonaFieldPatch,
  streamCharacterChatReply,
  summarizeCharacterChatMemory,
} from './characterChat';

// Image
export {
  generateCoverImage,
  generateCharacterChatImage,
  generatePromptsFromTitle,
  generateSymbolicPrompt,
  extractKeyScene,
} from './image';

// Series
export {
  summarizeSeriesHistory,
  generateSeriesBlueprint,
  regenerateSingleVolume,
  rebalanceSeriesStructure,
} from './series';
export type { SeriesHistoryResult } from './series';
export {
  composeSeriesMemory,
  computeSeriesVolumeMemorySignature,
  createSeriesMemoryState,
  inspectSeriesMemoryState,
  resolveSeriesMemoryForNovel,
} from './seriesMemory';
export type { SeriesMemoryInspection } from './seriesMemory';

// Foreshadowing (개연성 중심 복선 관리)
export {
  buildForeshadowingContext,
  formatForeshadowingForPrompt,
  analyzeForeshadowingFromText,
  updatePacingGuide,
  injectForeshadowingContext,
  createForeshadowingFromAnalysis,
  // 자동 복선 추출
  extractForeshadowingMemo,
  convertMemoToForeshadowings,
  // 로컬 복선 체크
  checkForeshadowingExistence,
  checkAllForeshadowings,
  extractTrackingKeywords,
} from './foreshadowing';
export type { AutoForeshadowingMemo } from './foreshadowing';

// Lorekeeper (기록보관자 - 세계관 사전 브리핑)
export {
  buildLorekeeperBriefing,
  formatLorekeeperBriefing,
  injectLorekeeperBriefing,
} from './lorekeeper';
export type { LorekeeperBriefing } from './lorekeeper';

// Briefing (통합 집필 브리핑 - 기록보관자 + 복선 + 에피소드 아크)
export {
  buildUnifiedBriefing,
  injectUnifiedBriefing,
  getBriefingMeta,
  shouldRunForeshadowingAnalysis,
  analyzeAfterChapterSave,
  applyForeshadowingAnalysis,
} from './briefing';
export type { UnifiedBriefing, PostChapterAnalysis } from './briefing';

// Summary (자동 요약 갱신 - 체크포인트 기반)
export {
  shouldAutoSummarize,
  getAutoSummarySchedule,
  computeSummarySourceSignature,
  autoUpdateSummary,
  refreshSummaryRange,
  editSummaryEntry,
  deleteSummaryEntry,
  mergeEntriesToText,
  computeSingleChapterSignature,
  matchesSingleChapterSignature,
  buildSummaryChunks,
  isLegacySummary,
  parseLegacyText,
} from './summary';
export type { AutoSummaryResult, AutoSummarySchedule, LegacyMigrationResult, ManualSummaryResult, SummaryChunk } from './summary';
export { inspectNovelMemory } from './memoryHealth';
export type { MemoryHealthReport, MemoryHealthStatus } from './memoryHealth';
export { buildWritingContext, resolveStoryMemory } from './writingContext';
export type { StoryMemoryResolution, WritingContextMode, WritingContextPackage } from './writingContext';
export {
  attachSummaryRollups,
  buildSummaryRollups,
  resolveHierarchicalSummary,
  SUMMARY_HIERARCHY_THRESHOLD,
} from './summaryHierarchy';

// Caching
export { manageContextCache, deleteContextCache, getCacheStatus } from './caching';
export type { CacheResult } from './caching';

// Config (전역 API 설정 관련)
export {
  getCurrentProvider,
  getCurrentApiInfo,
  generateContent,
  getAiTaskModel,
  getAiTaskPolicySummary,
  getRecommendedFullTextChapters,
  getSummaryTriggerChapters,
  XAI_MODELS,
  GLM_MODELS,
  // AbortController 관련
  createAbortSignal,
  cancelCurrentGeneration,
  isGenerating,
  clearAbortController,
} from './config';

// Review (원고 검토 & 웹소설 편집자 피드백)
export {
  reviewText,
  autoCorrect,
  getHighlightedSegments,
  getIssueClassName,
  getWebNovelEditorFeedback,
  chatWithWebNovelEditor,
} from './review';
export type {
  IssueType,
  TextIssue,
  ReviewResult,
  HighlightSegment,
  WebNovelEditorFeedback,
} from './review';
