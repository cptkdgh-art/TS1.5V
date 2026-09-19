/**
 * ============================================================
 * @module core/types/generation
 * @file generation.types.ts
 * ============================================================
 * @description AI 생성 로그 관련 타입 정의
 * ============================================================
 */

/** 생성 로그 (블랙박스) */
export interface GenerationLog {
  id: string;
  sessionId: string; // To group attempts for a single "continue" click
  attemptNumber: number;
  maxAttempts: number;
  timestamp: number;
  status: 'success' | 'error';
  prompt: string;
  content: string;
  error?: string;
  authorName: string;
  model?: string;
  provider?: 'gemini' | 'xai' | 'glm';
  termination?: {
    finishReason?: string;
    finishMessage?: string;
    promptBlockReason?: string;
    safetyRatings: Array<{
      category?: string;
      probability?: string;
      blocked?: boolean;
    }>;
  };
  targetCharacters?: number;
  requestedMaxTokens?: number;
  outputCharacters?: number;
  batchId?: string;
  batchChapterIndex?: number;
  batchChapterCount?: number;
  continuationPass?: number;
  usage?: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
    measured: boolean;
  };
  timing?: {
    preparationMs: number;
    cachePreparationMs: number;
    firstTokenMs?: number;
    modelFirstTokenMs?: number;
    totalMs: number;
    cacheMode: 'summary' | 'raw' | 'none';
    cacheStatus: 'disabled' | 'hit' | 'created' | 'skipped';
  };
}

export type ChapterGenerationMode = 'single' | 'extended' | 'batch2' | 'batch3';

export interface PendingChapterGeneration {
  id: string;
  mode: ChapterGenerationMode;
  totalChapters: number;
  completedChapters: number;
  status: 'running' | 'paused';
  prompt: string;
  draftChapterId?: string;
  startedAt: number;
  updatedAt: number;
}
