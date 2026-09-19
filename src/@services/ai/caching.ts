/**
 * ============================================================
 * @module services/ai/caching
 * @file caching.ts
 * ============================================================
 * @description 컨텍스트 캐싱 서비스 (Gemini Explicit Caching)
 *
 * [2계층 캐싱 전략]
 * - Summary 캐싱 (1순위): 요약본 + 시스템 프롬프트를 캐싱 → 최저 비용
 *   → 요약이 유효할 때 사용. 변경 주기 = 5화마다 (요약 갱신 시)
 *   → 캐시 히트율 ~80% (5번 요청 중 4번 재사용)
 *
 * - Raw 캐싱 (2순위): 과거 챕터 원문을 캐싱 → 정보 손실 없음
 *   → 요약이 없을 때 폴백. 변경 주기 = 매 챕터 추가 시
 *
 * 비용 비교 (10만자 / 50화 기준):
 *   전체 원문: ~33K 토큰 = 100%
 *   Raw 캐싱:  ~33K 토큰 × 25% = 25%
 *   Summary 캐싱: ~4K 토큰(요약+시스템) × 25% + ~6K 토큰(최신N화) = ~8%
 * ============================================================
 */

import type { Content } from '@google/genai';
import type { Novel, Chapter, CachedModelInfo } from '@core/types';
import { ai, CACHE_TOKEN_THRESHOLD, DEFAULT_ACTIVE_BUFFER_WINDOW } from './config';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import { computeStableSignature, estimateTokens, getSummaryCoveredCount } from './utils';
import { logger } from '@shared/utils/logger';

/** 캐시 결과 인터페이스 */
export interface CacheResult {
  cachedContentName?: string;
  newCacheInfo?: CachedModelInfo;
  /** 검증 실패로 서버에서 제거한 이전 캐시. 로컬 메타데이터도 같은 이름일 때 제거한다. */
  invalidatedCacheName?: string;
  activeBufferStartIndex: number;
  /** 캐시 모드 ('summary' = 요약 캐싱, 'raw' = 원문 캐싱, 'none' = 캐시 없음) */
  cacheMode: 'summary' | 'raw' | 'none';
}

const CONTEXT_CACHE_TTL_SECONDS = 3600;

/**
 * 챕터 내용 서명 계산 (변경 감지용)
 */
export const computeContextCacheSignature = (
  mode: 'summary' | 'raw',
  content: string,
  systemInstruction: string
): string => computeStableSignature(JSON.stringify({ mode, content, systemInstruction }));

const computeContentSignature = (
  chapters: Chapter[],
  rangeEnd: number,
  systemInstruction: string,
  staticContext: string
): string => {
  const targetChapters = chapters.slice(0, rangeEnd);
  const content = JSON.stringify({
    staticContext,
    chapters: targetChapters.map((chapter) => [chapter.id || '?', chapter.title, chapter.content]),
  });
  return computeContextCacheSignature('raw', content, systemInstruction);
};

/**
 * 요약 내용 서명 계산 (요약 변경 감지용)
 */
const computeSummarySignature = (summaryContent: string, systemInstruction: string): string =>
  computeContextCacheSignature('summary', summaryContent, systemInstruction);

/**
 * 기존 캐시 검증 및 삭제 (공통 로직)
 */
function validateAndCleanCache(
  existingCache: CachedModelInfo | undefined,
  currentSignature: string,
  expectedCount: number
): { isValid: boolean; invalidatedCacheName?: string } {
  if (!existingCache) return { isValid: false };

  const now = new Date();
  const expireTime = new Date(existingCache.expireTime);
  const isExpired = now >= expireTime;
  const isContentChanged = existingCache.contentSignature !== currentSignature;
  const isRangeChanged = existingCache.cachedChapterCount !== expectedCount;

  if (!isExpired && !isContentChanged && !isRangeChanged) {
    return { isValid: true };
  }

  // 이전 캐시 정리는 새 본문 요청의 선행 조건이 아니다. 서버 왕복을 기다리지 않는다.
  void ai.caches.delete({ name: existingCache.cacheName })
    .then(() => logger.log(`[Cache Clean] Deleted invalid cache: ${existingCache.cacheName}`))
    .catch((error) => console.warn('Failed to delete old cache:', error));

  return { isValid: false, invalidatedCacheName: existingCache.cacheName };
}

/**
 * 컨텍스트 캐시 관리자 (모드 자동 선택)
 *
 * @param summaryContent - 유효한 요약 텍스트가 있으면 전달 → Summary 캐싱 모드
 *                          없으면 → Raw 챕터 캐싱 모드
 */
export async function manageContextCache(
  novel: Novel,
  modelName: string,
  systemInstruction: string,
  staticContext: string,
  summaryContent?: string,
  abortSignal?: AbortSignal
): Promise<CacheResult> {
  abortSignal?.throwIfAborted();
  const totalChapters = novel.chapters.length;

  // ═══════════════════════════════════════════════════
  // [1순위] Summary 캐싱 모드
  // 요약본 + 시스템 프롬프트를 캐싱 → 최저 비용
  // 변경 주기 = 5화마다 (요약 갱신 시만 캐시 재생성)
  // ═══════════════════════════════════════════════════
  if (summaryContent) {
    const fullTextChapters = FIXED_RECENT_RAW_CHAPTERS;
    const summarizedCount = getSummaryCoveredCount(
      novel.contextSummary,
      totalChapters,
      fullTextChapters
    );

    if (summarizedCount < 3) {
      return { activeBufferStartIndex: 0, cacheMode: 'none' };
    }

    const currentSignature = computeSummarySignature(summaryContent, systemInstruction);
    const existingCache = novel.contextCaching?.caches?.[modelName];

    // 기존 캐시 검증
    const { isValid, invalidatedCacheName } = validateAndCleanCache(existingCache, currentSignature, summarizedCount);
    if (isValid && existingCache) {
      logger.log(`[Summary Cache Hit] ${existingCache.cacheName} (${modelName})`);
      return {
        cachedContentName: existingCache.cacheName,
        activeBufferStartIndex: summarizedCount,
        cacheMode: 'summary',
      };
    }

    // 토큰 수 체크 (요약 + 시스템 프롬프트)
    const estimatedTokenCount = estimateTokens(summaryContent) + estimateTokens(systemInstruction);
    if (estimatedTokenCount < CACHE_TOKEN_THRESHOLD) {
      logger.log(`[Summary Cache Skip] Not enough tokens (${Math.round(estimatedTokenCount)} < ${CACHE_TOKEN_THRESHOLD})`);
      return { activeBufferStartIndex: 0, cacheMode: 'none', invalidatedCacheName };
    }

    // 새 Summary 캐시 생성
    logger.log(`[Summary Cache Create] 요약 ${summarizedCount}화분 + 시스템프롬프트 캐싱...`);

    const cacheContents: Content[] = [{
      role: 'user',
      parts: [{
        text: `[STORY CONTEXT SUMMARY]
이것은 1~${summarizedCount}화까지의 요약입니다. 이 정보를 과거 사건의 절대적 사실로 취급하세요.

${summaryContent}

[END SUMMARY - 이후 최신 챕터 원문이 별도 전송됩니다]`
      }]
    }];

    try {
      const cacheResponse = await ai.caches.create({
        model: modelName,
        config: {
          abortSignal,
          systemInstruction: systemInstruction,
          contents: cacheContents,
          ttl: `${CONTEXT_CACHE_TTL_SECONDS}s`,
        },
      });

      const newCacheInfo: CachedModelInfo = {
        cacheName: cacheResponse.name || '',
        createTime: cacheResponse.createTime || new Date().toISOString(),
        expireTime: cacheResponse.expireTime || new Date(Date.now() + CONTEXT_CACHE_TTL_SECONDS * 1000).toISOString(),
        cachedChapterCount: summarizedCount,
        cachedTokenCount: cacheResponse.usageMetadata?.totalTokenCount || estimatedTokenCount,
        contentSignature: currentSignature,
      };

      logger.log(`[Summary Cache Created] ${newCacheInfo.cacheName} (~${Math.round(estimatedTokenCount)} tokens)`);
      return {
        cachedContentName: newCacheInfo.cacheName,
        newCacheInfo,
        invalidatedCacheName,
        activeBufferStartIndex: summarizedCount,
        cacheMode: 'summary',
      };
    } catch (e) {
      abortSignal?.throwIfAborted();
      console.error('Summary Cache Creation Failed:', e);
      return { activeBufferStartIndex: 0, cacheMode: 'none', invalidatedCacheName };
    }
  }

  // ═══════════════════════════════════════════════════
  // [2순위] Raw 챕터 캐싱 모드
  // 과거 챕터 원문을 캐싱 → 요약이 없을 때 폴백
  // ═══════════════════════════════════════════════════
  const activeWindow = DEFAULT_ACTIVE_BUFFER_WINDOW;
  const cachedChapterCount = Math.max(0, totalChapters - activeWindow);

  if (cachedChapterCount === 0) {
    return { activeBufferStartIndex: 0, cacheMode: 'none' };
  }

  const existingCache = novel.contextCaching?.caches?.[modelName];
  const currentSignature = computeContentSignature(
    novel.chapters,
    cachedChapterCount,
    systemInstruction,
    staticContext
  );

  const { isValid, invalidatedCacheName } = validateAndCleanCache(existingCache, currentSignature, cachedChapterCount);
  if (isValid && existingCache) {
    logger.log(`[Raw Cache Hit] ${existingCache.cacheName} (${modelName})`);
    return {
      cachedContentName: existingCache.cacheName,
      activeBufferStartIndex: cachedChapterCount,
      cacheMode: 'raw',
    };
  }

  // 토큰 수 체크
  const estimatedTokenCount =
    estimateTokens(systemInstruction) +
    estimateTokens(staticContext) +
    novel.chapters.slice(0, cachedChapterCount).reduce((sum, ch) => sum + estimateTokens(ch.content), 0);

  if (estimatedTokenCount < CACHE_TOKEN_THRESHOLD) {
    logger.log(`[Raw Cache Skip] Not enough tokens (${Math.round(estimatedTokenCount)} < ${CACHE_TOKEN_THRESHOLD})`);
    return { activeBufferStartIndex: 0, cacheMode: 'none', invalidatedCacheName };
  }

  // 새 Raw 캐시 생성
  logger.log(`[Raw Cache Create] ${cachedChapterCount}화 원문 캐싱...`);

  const cacheContents: Content[] = [
    {
      role: 'user',
      parts: [
        {
          text: `
[SYSTEM: EXPLICIT CONTEXT CACHE START]
[TYPE: STATIC HISTORY ARCHIVE]
[RANGE: CHAPTER 1 - CHAPTER ${cachedChapterCount}]
[INSTRUCTION: This is a frozen memory block. Use this as the absolute truth of past events.]

${staticContext}

--- [ARCHIVED CHAPTERS START] ---
`,
        },
      ],
    },
  ];

  for (let i = 0; i < cachedChapterCount; i++) {
    const chapter = novel.chapters[i];
    cacheContents.push({
      role: 'user',
      parts: [{ text: `[CHAPTER_ID: ${i + 1}] [TITLE: ${chapter.title}]\n${chapter.content}` }],
    });
  }

  cacheContents.push({
    role: 'user',
    parts: [{ text: `[ARCHIVED CHAPTERS END]\n[SYSTEM: CONTEXT CACHE END] Waiting for active buffer input...` }],
  });

  try {
    const cacheResponse = await ai.caches.create({
      model: modelName,
      config: {
        abortSignal,
        systemInstruction: systemInstruction,
        contents: cacheContents,
        ttl: `${CONTEXT_CACHE_TTL_SECONDS}s`,
      },
    });

    const newCacheInfo: CachedModelInfo = {
      cacheName: cacheResponse.name || '',
      createTime: cacheResponse.createTime || new Date().toISOString(),
      expireTime: cacheResponse.expireTime || new Date(Date.now() + CONTEXT_CACHE_TTL_SECONDS * 1000).toISOString(),
      cachedChapterCount: cachedChapterCount,
      cachedTokenCount: cacheResponse.usageMetadata?.totalTokenCount || estimatedTokenCount,
      contentSignature: currentSignature,
    };

    logger.log(`[Raw Cache Created] ${newCacheInfo.cacheName}`);
    return {
      cachedContentName: newCacheInfo.cacheName,
      newCacheInfo,
      invalidatedCacheName,
      activeBufferStartIndex: cachedChapterCount,
      cacheMode: 'raw',
    };
  } catch (e) {
    abortSignal?.throwIfAborted();
    console.error('Raw Cache Creation Failed:', e);
    return { activeBufferStartIndex: 0, cacheMode: 'none', invalidatedCacheName };
  }
}

/**
 * 캐시 삭제
 */
export async function deleteContextCache(cacheName: string): Promise<void> {
  try {
    await ai.caches.delete({ name: cacheName });
    logger.log(`Cache deleted: ${cacheName}`);
  } catch (e) {
    console.error(`Failed to delete cache ${cacheName}:`, e);
    throw e;
  }
}

/**
 * 캐시 상태 조회
 */
export async function getCacheStatus(cacheName: string): Promise<{
  exists: boolean;
  expireTime?: string;
  tokenCount?: number;
}> {
  try {
    const cache = await ai.caches.get({ name: cacheName });
    return {
      exists: true,
      expireTime: cache.expireTime,
      tokenCount: cache.usageMetadata?.totalTokenCount,
    };
  } catch {
    return { exists: false };
  }
}
