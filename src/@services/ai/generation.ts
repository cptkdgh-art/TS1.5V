/**
 * ============================================================
 * @module services/ai/generation
 * @file generation.ts
 * ============================================================
 * @description 소설 생성 관련 AI 함수 (전역 API 설정 기반)
 * ============================================================
 */

import type { Content, AiAuthor, Novel, Series, GenerationLog, CachedModelInfo } from '@core/types';
import { ai, MODELS, generateContent, getXaiApiKey, getGlmApiKey, getCurrentXaiModel, getCurrentGlmModel, createAbortSignal, clearAbortController, convertToOpenAIMessages, NOVEL_SAFETY_SETTINGS, normalizeGeminiTextModel, getGeminiWritingOverloadFallbackModel, getGeminiThinkingConfig } from './config';
import { processGeminiError } from './utils';
import { buildWriterDynamicInstruction, buildWriterStableInstruction } from './prompts';
import { resolveStoryMemory } from './writingContext';
import { manageContextCache } from './caching';
import { injectUnifiedBriefing } from './briefing';
import { isLorekeeperEnabled } from './lorekeeperPolicy';
import { buildPreviousBriefing } from './historyBudget';
import { extractForeshadowingMemo, type AutoForeshadowingMemo } from './foreshadowing';
import { logger } from '@shared/utils/logger';
import { getChapterOutputTokens } from './generationPolicy';
import { recordAiUsage, type AiUsageMetadata } from '@services/costEstimator';
import {
  GeminiTerminationError,
  getGeminiTerminationFromError,
  isGeminiBlocked,
  mergeGeminiTermination,
  readGeminiTermination,
  type GeminiTerminationDiagnostic,
} from './geminiTermination';

/** Pro 모델용 시스템 인스트럭션 예산 (글자 수) */
const PRO_INSTRUCTION_BUDGET = 8000; // ~2.7K 토큰 (12000→8000 축소, 출력에 토큰 집중)
const WORLDVIEW_TRUNCATE_PER_FILE = 400;
const PRO_WORLDVIEW_TOTAL_BUDGET = 3200;
const SERIES_MEMORY_TRUNCATE = 300; // 시리즈 메모리 최대 글자 수 (500→300)

/**
 * Pro 모델용 시스템 인스트럭션 압축
 * 세계관/시리즈 메모리 등 대용량 섹션을 요약 수준으로 축소
 * → Pro가 503 없이 글쓰기에 집중할 수 있도록
 */
export function compressInstructionForPro(instruction: string): string {
  let compressed = instruction;

  // 1. 세계관 설정 섹션 압축: 각 파일 내용을 앞부분만 유지
  const worldviewMatch = compressed.match(/--- 세계관 설정(?: \([^)]+\))? ---\n([\s\S]*?)(?=\n---|$)/);
  if (worldviewMatch) {
    const worldviewSection = worldviewMatch[1];
    const filePattern = /\[File: ([^\]]+)\]\n([\s\S]*?)(?=\[File:|$)/g;
    let compressedWorldview = '';
    let remainingWorldviewBudget = PRO_WORLDVIEW_TOTAL_BUDGET;
    let match;

    while ((match = filePattern.exec(worldviewSection)) !== null) {
      if (remainingWorldviewBudget <= 0) break;
      const fileName = match[1];
      const content = match[2].trim();
      const fileBudget = Math.min(WORLDVIEW_TRUNCATE_PER_FILE, remainingWorldviewBudget);
      if (content.length > fileBudget) {
        compressedWorldview += `[File: ${fileName}]\n${content.substring(0, fileBudget)}… (이하 생략)\n\n`;
        remainingWorldviewBudget -= fileBudget;
      } else {
        compressedWorldview += `[File: ${fileName}]\n${content}\n\n`;
        remainingWorldviewBudget -= content.length;
      }
    }

    if (compressedWorldview) {
      compressed = compressed.replace(
        worldviewMatch[0],
        `--- 세계관 설정 (요약) ---\n${compressedWorldview.trim()}`
      );
    }
  }

  // 2. 시리즈 연대기 압축
  const seriesMatch = compressed.match(/--- \[시리즈 연대기[^\]]*\] ---\n([\s\S]*?)(?=\n---|$)/);
  if (seriesMatch && seriesMatch[1].length > SERIES_MEMORY_TRUNCATE) {
    const truncated = seriesMatch[1].substring(0, SERIES_MEMORY_TRUNCATE) + '… (이하 생략)';
    compressed = compressed.replace(seriesMatch[0], `--- [시리즈 연대기 (요약)] ---\n${truncated}`);
  }

  // 3. 집필 기본 원칙 중 표현 다양화 예시 제거 (Pro는 기본적으로 잘함)
  compressed = compressed.replace(
    /   - "단순한"만 반복[\s\S]*?한 수식어가 2번 이상 연속으로 나오면 반드시 다른 표현으로 바꾸세요\./,
    '   한 수식어가 2번 이상 연속 사용 금지.'
  );

  // 4. 캐릭터 압축: 5명 초과 시 주요 캐릭터만 유지
  const charMatch = compressed.match(/--- (?:주요 )?등장인물(?: \([^\n]*\))? ---\n([\s\S]*?)(?=\n---|$)/);
  if (charMatch && charMatch[1].length > 1500) {
    const charLines = charMatch[1].trim().split('\n').filter(Boolean);
    const limitedChars = charLines.slice(0, 5).join('\n');
    const skipped = Math.max(0, charLines.length - 5);
    compressed = compressed.replace(
      charMatch[0],
      `--- 주요 등장인물 (요약 ${Math.min(5, charLines.length)}명) ---\n${limitedChars}${skipped > 0 ? `\n(외 ${skipped}명 생략)` : ''}`
    );
  }

  // 5. WRITER_SPARK(작가의 불꽃) 축약 — Pro는 기본 품질이 높아 상세 가이드 불필요
  compressed = compressed.replace(
    /너는 지금 이 캐릭터들의 곁에 있다\.[\s\S]*?캐릭터가 살아있으면, 재미는 따라온다\./,
    '캐릭터를 살아있는 존재로 느끼고, 독자가 다음 화를 궁금해하게 써라.'
  );

  // 6. 최종 안전장치: 예산 초과 시 뒤에서부터 자르기
  if (compressed.length > PRO_INSTRUCTION_BUDGET) {
    compressed = compressed.substring(0, PRO_INSTRUCTION_BUDGET) + '\n(이하 생략 — 출력에 집중하세요)';
  }

  return compressed;
}

interface StreamYieldType {
  streamingText?: string;
  log?: GenerationLog;
  newCacheInfo?: { model: string; info: CachedModelInfo };
  invalidatedCacheInfo?: { model: string; cacheName: string };
  cancelled?: boolean; // 취소됨 여부
  willRetry?: boolean; // 재시도 예정인 중간 오류 여부
  retryModel?: string; // 과부하 회피용 다음 시도 모델
  /** 자동 추출된 복선 메모 (성공 시에만) */
  foreshadowingMemo?: AutoForeshadowingMemo;
  /** 복선 메모가 제거된 정제된 콘텐츠 */
  cleanedContent?: string;
}

const monotonicNow = (): number => (
  typeof performance !== 'undefined' ? performance.now() : Date.now()
);

const roundDuration = (duration: number): number => Math.max(0, Math.round(duration));

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function countGenerationInputChars(contents: Content[], systemInstruction?: string): number {
  return contents.reduce(
    (total, content) => total + (content.parts || []).reduce(
      (sum, part) => sum + (part.text?.length || 0),
      0,
    ),
    systemInstruction?.length || 0,
  );
}

/** AI가 쓴 문장은 보존하고, 앱 전용 구조화 메모만 본문에서 분리한다. */
export function prepareGeneratedChapter(aiResponse: string): {
  content: string;
  memo: AutoForeshadowingMemo | null;
} {
  const { cleanedContent, memo } = extractForeshadowingMemo(aiResponse);
  return { content: cleanedContent.trim(), memo };
}

function isRetryableGenerationError(message: string): boolean {
  return message.includes('과부하') || message.includes('할당량') || message.includes('한도') || message.includes('503') || message.includes('429');
}

/**
 * OpenAI 호환 SSE 스트림 파서 (xAI, GLM 공통) - AsyncGenerator 버전
 * @param response fetch Response 객체
 * @yields 청크 텍스트
 */
async function* parseOpenAICompatibleStreamGenerator(
  response: Response
): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = ''; // 불완전한 라인을 위한 버퍼

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 버퍼에 새 데이터 추가
      buffer += decoder.decode(value, { stream: true });

      // 완전한 라인들 처리
      const lines = buffer.split('\n');
      // 마지막 라인은 불완전할 수 있으므로 버퍼에 유지
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content; // 즉시 yield하여 실시간 스트리밍
          }
        } catch {
          // JSON 파싱 에러 무시 (불완전한 JSON)
        }
      }
    }

    // 버퍼에 남은 데이터 처리
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6).trim();
      if (data && data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // 무시
        }
      }
    }
  }
}

/**
 * GLM/xAI 메시지 변환은 config.ts의 convertToOpenAIMessages를 사용
 * - GLM: Privacy Shield + 한국 웹소설 특화 프롬프트 자동 적용
 * - xAI: 직접 변환
 */

/**
 * 소설 이어쓰기 (스트리밍)
 * - 컨텍스트 캐싱 지원: 과거 챕터를 캐싱하여 비용 75% 절감
 * - AbortController를 통한 취소 지원
 */
export async function* continueNovelStream(
  sessionId: string,
  prompt: string,
  history: Content[],
  author: AiAuthor | null,
  novel: Novel,
  series: Series | null,
  currentLength: number
): AsyncGenerator<StreamYieldType> {
  let attempt = 0;
  const maxAttempts = 3;
  let delay = 1000; // 재시도 딜레이 단축 (2s→1s 시작)
  const authorName = author?.name || '기본 작가';
  const modelToUse = MODELS.TEXT;
  let skipCaching = false; // ★ 완충장치: 503 재시도 시 캐싱 스킵
  let retryGeminiModel: string | null = null;
  let requestedGeminiModel: string | null = null;
  let lastAttemptModel: string = modelToUse;

  // AbortController 생성 및 등록
  const abortSignal = createAbortSignal();

  try {
  while (attempt < maxAttempts) {
    let accumulatedText = '';
    const attemptStartedAt = monotonicNow();
    let cachePreparationMs = 0;
    let modelRequestStartedAt: number | undefined;
    let firstTokenAt: number | undefined;
    let attemptCacheMode: 'summary' | 'raw' | 'none' = 'none';
    let attemptCacheStatus: 'disabled' | 'hit' | 'created' | 'skipped' = 'disabled';

    const markModelRequestStarted = () => {
      if (modelRequestStartedAt === undefined) modelRequestStartedAt = monotonicNow();
    };
    const markFirstToken = () => {
      if (firstTokenAt === undefined) firstTokenAt = monotonicNow();
    };
    const getAttemptTiming = () => {
      const finishedAt = monotonicNow();
      const preparationFinishedAt = modelRequestStartedAt ?? finishedAt;
      return {
        preparationMs: roundDuration(preparationFinishedAt - attemptStartedAt - cachePreparationMs),
        cachePreparationMs: roundDuration(cachePreparationMs),
        ...(modelRequestStartedAt !== undefined && firstTokenAt !== undefined
          ? {
              firstTokenMs: roundDuration(firstTokenAt - attemptStartedAt),
              modelFirstTokenMs: roundDuration(firstTokenAt - modelRequestStartedAt),
            }
          : {}),
        totalMs: roundDuration(finishedAt - attemptStartedAt),
        cacheMode: attemptCacheMode,
        cacheStatus: attemptCacheStatus,
      };
    };

    try {
      abortSignal.throwIfAborted();
      const writerOptions = {
        useLorekeeper: isLorekeeperEnabled(novel.useLorekeeper),
        avoidRepetition: novel.avoidRepetition,
        episodePacing: novel.episodePacing,
        episodeArc: novel.episodeArc ? {
          episodeArc: novel.episodeArc,
          chaptersCount: novel.chapters.length,
        } : undefined,
        currentLength,
        chapterCount: novel.chapters.length,
        openingStyle: novel.openingStyle,
        startingPoint: novel.startingPoint,
      };
      const stableSystemInstruction = buildWriterStableInstruction(author, novel, series, writerOptions);
      const dynamicChapterInstruction = buildWriterDynamicInstruction(novel, writerOptions);
      let cachedContentName: string | undefined;
      let activeBufferStartIndex = 0;
      let finalSystemInstruction = stableSystemInstruction;

      // 소설별 generationEngine 결정 (마이그레이션: 구 모델명 호환)
      // (아래에서 isProModel 판단 후 Pro 컨텍스트 예산 적용)
      let engine: string | undefined = novel.generationEngine;
      if (engine === 'gemini-3.1-flash-lite-preview') {
        engine = MODELS.FLASH_LITE;
      } else if (engine?.startsWith('gemini-')) {
        engine = normalizeGeminiTextModel(engine);
      }
      if (retryGeminiModel) {
        engine = retryGeminiModel;
      }
      if ((engine as string) === 'glm-4.7') engine = 'glm-5';
      const effectiveProvider = engine?.startsWith('grok-') ? 'xai'
        : engine?.startsWith('glm-') ? 'glm'
        : engine?.startsWith('gemini-') ? 'gemini'
        : 'gemini';
      const isGlmEngine = effectiveProvider === 'glm';
      const isXaiEngine = effectiveProvider === 'xai';
      const isNonGeminiProvider = isGlmEngine || isXaiEngine;
      const effectiveModel: string = engine || (isXaiEngine ? getCurrentXaiModel() : isGlmEngine ? getCurrentGlmModel() : modelToUse);
      lastAttemptModel = effectiveModel;
      if (effectiveProvider === 'gemini' && !requestedGeminiModel) {
        requestedGeminiModel = effectiveModel;
      }

      // 기본 정보
      const totalChapterCount = novel.chapters.length;
      const lastChapterTitle = totalChapterCount > 0 ? novel.chapters[totalChapterCount - 1].title : '';
      const positionMarker = totalChapterCount > 0
        ? `\n[현재 위치] ${totalChapterCount}화 "${lastChapterTitle}" 이후 → ${totalChapterCount + 1}화를 이어서 작성`
        : '';
      const storyMemory = resolveStoryMemory(novel);

      // ── [STEP 1] 요약 체크포인트 검증 (캐시 결정 전에 먼저 확인) ──
      // 유효한 요약이 있으면 캐시 생성 자체를 스킵하여 비용 절감
      const contextSummary = storyMemory.summary || null;
      if (storyMemory.status === 'stale') {
        logger.log(`[Checkpoint] 요약 무효화(${storyMemory.reason}) → 검증된 ${storyMemory.coveredChapterCount}화까지만 사용`);
      }

      const hasSummary = !!(contextSummary && storyMemory.coveredChapterCount > 0);
      // 갱신 대기 중인 챕터도 원문으로 보내 문맥 공백을 만들지 않는다.
      // 체크포인트가 깨졌다면 안전을 위해 전체 원문을 폴백으로 사용한다.
      const summaryCoveredCount = storyMemory.coveredChapterCount;

      // ── [STEP 2] Gemini 캐싱 (모드 자동 선택) ──
      // 요약 있음 → Summary 캐싱 (요약+시스템프롬프트 캐싱, 최저 비용)
      // 요약 없음 → Raw 캐싱 (과거 원문 캐싱, 차선)
      // xAI/GLM → 캐싱 미지원, 스킵
      // ★ 완충장치:
      //   - 503 재시도 시 캐싱 스킵 (이중 503 방지)
      //   - Pro 모델은 캐싱 스킵 (Pro는 컴팩트 컨텍스트만 받아서 글쓰기에 집중)
      //   - 캐싱은 Flash만 사용 (Pro 캐시 생성 자체가 503 유발)
      let cacheMode: 'summary' | 'raw' | 'none' = 'none';
      const isProModel = effectiveModel.includes('-pro');

      // ★ Pro 컨텍스트 예산: 시스템 인스트럭션이 예산 초과 시 자동 압축
      // Pro는 Flash보다 컨텍스트 처리 용량이 작아 세계관/설계도가 많으면 503 발생
      // 핵심(작가 페르소나, 기본 정보)은 유지하고 부가 정보만 압축
      if (isProModel && finalSystemInstruction.length > PRO_INSTRUCTION_BUDGET) {
        const originalLength = finalSystemInstruction.length;
        finalSystemInstruction = compressInstructionForPro(finalSystemInstruction);
        logger.log(`[Pro Budget] 시스템 인스트럭션 압축: ${originalLength.toLocaleString()}자 → ${finalSystemInstruction.length.toLocaleString()}자`);
      }
      const uncachedSystemInstruction = finalSystemInstruction;

      const canUseContextCache = !contextSummary || storyMemory.status === 'valid';
      if (novel.contextCaching?.isEnabled !== false && !isNonGeminiProvider && !skipCaching && canUseContextCache) {
        const cacheModel = effectiveModel.startsWith('gemini-') ? effectiveModel : modelToUse;
        const cacheStartedAt = monotonicNow();
        const cacheResult = await manageContextCache(
          novel, cacheModel, uncachedSystemInstruction, '',
          hasSummary ? contextSummary! : undefined, abortSignal
        );
        cachePreparationMs = monotonicNow() - cacheStartedAt;

        cacheMode = cacheResult.cacheMode;
        attemptCacheMode = cacheResult.cacheMode;
        attemptCacheStatus = cacheResult.cachedContentName
          ? (cacheResult.newCacheInfo ? 'created' : 'hit')
          : 'skipped';

        if (cacheResult.invalidatedCacheName) {
          yield {
            invalidatedCacheInfo: {
              model: cacheModel,
              cacheName: cacheResult.invalidatedCacheName,
            },
          };
        }

        if (cacheResult.cachedContentName) {
          cachedContentName = cacheResult.cachedContentName;
          activeBufferStartIndex = cacheResult.activeBufferStartIndex;

          if (cacheResult.newCacheInfo) {
            yield { newCacheInfo: { model: cacheModel, info: cacheResult.newCacheInfo } };
          }

          finalSystemInstruction = '';
          if (isProModel) {
            logger.log(`[Pro Cache] Pro 모델 캐싱 성공 (압축 인스트럭션 기반)`);
          }
        }
      }

      // ── [STEP 3] 컨텍스트 주입 (우선순위 라우팅) ──
      // 최근 원문 범위는 resolveStoryMemory의 고정 기억 계약을 모든 모델에 동일하게 적용한다.
      // ★ 최선 (S등급): 요약 캐싱 + 최신 N화 원문 (~8% 비용)
      //   → 요약이 Gemini 서버에 캐싱됨 + 최신 N화만 원문 전송
      //
      // A등급: 요약 + 최신 N화 원문 (~11% 비용)
      //   → 요약 직접 전송 (xAI/GLM 또는 캐시 미생성 시)
      //
      // B등급: Raw 캐시 + 최신 activeWindow (~25% 비용)
      //   → 요약 없지만 원문 캐시 있음
      //
      // C등급: 전체 원문 / 최신 N화만 (~100% 비용)
      //   → 폴백 (첫 사용 등)
      //
      let contents: Content[] = [];
      if (dynamicChapterInstruction) {
        contents.push({
          role: 'user',
          parts: [{ text: `[CURRENT CHAPTER INSTRUCTION]\n${dynamicChapterInstruction}` }],
        });
      }

      const storyContextIndex = contents.length;
      if (hasSummary && cacheMode === 'summary' && cachedContentName) {
        // ★ S등급: 요약이 캐싱됨 → 최신 N화 원문만 전송
        const recentChaptersStart = activeBufferStartIndex;
        const recentChapters = novel.chapters.slice(recentChaptersStart);

        logger.log(`[Context] ★ S등급: 요약 캐싱 + 미요약/최신 ${recentChapters.length}화 원문`);

        contents.push({
          role: 'user',
          parts: [{
            text: `[RECENT CHAPTERS - 원문]
아래는 최근 ${recentChapters.length}개 챕터의 원문입니다. (과거 요약은 캐시에 포함됨)

${recentChapters.map((ch, idx) => `[CHAPTER_ID: ${recentChaptersStart + idx + 1}] [TITLE: ${ch.title}]\n${ch.content}`).join('\n\n')}
${positionMarker}`
          }]
        });

      } else if (hasSummary) {
        // A등급: 요약 직접 전송 + 최신 N화 (캐시 없거나 xAI/GLM)
        const recentChaptersStart = summaryCoveredCount;
        const recentChapters = novel.chapters.slice(recentChaptersStart);

        logger.log(`[Context] A등급: 요약 직접 전송 + 미요약/최신 ${recentChapters.length}화 원문`);

        contents.push({
          role: 'user',
          parts: [{
            text: `[STORY CONTEXT SUMMARY]
이것은 1~${recentChaptersStart}화까지의 요약입니다. 참고만 하세요.

${contextSummary}

[RECENT CHAPTERS - 원문]
아래는 최근 ${recentChapters.length}개 챕터의 원문입니다.

${recentChapters.map((ch, idx) => `[CHAPTER_ID: ${recentChaptersStart + idx + 1}] [TITLE: ${ch.title}]\n${ch.content}`).join('\n\n')}
${positionMarker}`
          }]
        });

      } else if (cachedContentName && activeBufferStartIndex < totalChapterCount) {
        // B등급: Raw 캐시 + 최신 activeWindow 원문
        const activeChapters = novel.chapters.slice(activeBufferStartIndex);

        logger.log(`[Context] B등급: Raw 캐시(1~${activeBufferStartIndex}화) + 최신 ${activeChapters.length}화 원문`);

        contents.push({
          role: 'user',
          parts: [{
            text: `[ACTIVE CHAPTERS] (${activeBufferStartIndex}화까지 캐시 → 이후 원문)

${activeChapters.map((ch, idx) => `[CHAPTER_ID: ${activeBufferStartIndex + idx + 1}] [TITLE: ${ch.title}]\n${ch.content}`).join('\n\n')}
${positionMarker}`,
          }],
        });

      } else if (cachedContentName) {
        // B등급 변형: 전체 캐시 완료
        logger.log(`[Context] B등급: 전체 캐시 완료`);
        contents.push({
          role: 'user',
          parts: [{ text: `[ACTIVE CHAPTERS] (전체 캐시 완료)${positionMarker}` }],
        });

      } else if (totalChapterCount > 0) {
        // C등급: 스마트 폴백 (요약도 캐시도 없음)
        // NovelAI/SillyTavern 방식 참고:
        //   1. 소설 핵심 설정(줄거리+캐릭터 이름)을 앵커로 주입
        //   2. 최신 N화 원문만 전송
        //   3. 나머지 화는 제목 목록으로 맥락 유지
        const totalCharCount = novel.chapters.reduce((sum, ch) => sum + ch.content.length, 0);
        const effectiveStart = storyMemory.rawChapterStartIndex;
        const activeChapters = novel.chapters.slice(effectiveStart);

        // 앵커: 줄거리 + 활성 캐릭터 이름 (요약 대용)
        const characters = (series?.characters ?? novel.characters ?? []);
        const charNames = characters.slice(0, 8).map(c => c.name).join(', ');
        let anchor = '';
        if (novel.plotSummary || charNames) {
          anchor = `[스토리 앵커]\n`;
          if (novel.plotSummary) anchor += `줄거리: ${novel.plotSummary.slice(0, 500)}\n`;
          if (charNames) anchor += `등장인물: ${charNames}\n`;
          // 과거 화 제목 목록 (흐름 파악용)
          if (effectiveStart > 0) {
            const pastTitles = novel.chapters.slice(0, effectiveStart)
              .map((ch, i) => `  ${i + 1}화: ${ch.title}`).join('\n');
            anchor += `\n[이전 화 목록]\n${pastTitles}\n`;
          }
          anchor += '\n';
        }

        logger.log(`[Context] C등급(스마트): 앵커(줄거리+캐릭터) + 최신 ${activeChapters.length}화 원문 (전체 ${totalCharCount.toLocaleString()}자)`);

        contents.push({
          role: 'user',
          parts: [{
            text: `${anchor}[최신 챕터 원문]
${activeChapters.map((ch, idx) => `[${effectiveStart + idx + 1}화 "${ch.title}"]\n${ch.content}`).join('\n\n')}
${positionMarker}`,
          }],
        });
      }

      // 기존 히스토리 필터링 - 브리핑 지시사항만 추출
      // Pro는 1개만, Flash는 3개 (Pro 컨텍스트 절약)
      if (history && history.length > 0) {
        const historyLimit = isProModel ? 1 : 3;
        const historyBudget = isProModel ? 1600 : 3600;
        const previousBriefing = buildPreviousBriefing(history, historyLimit, historyBudget);

        if (previousBriefing) {
          contents.push({
            role: 'user',
            parts: [{
              text: `[이전 브리핑 요약]\n${previousBriefing}`
            }]
          });
        }
      }

      // 통합 브리핑 주입 (기록보관자 + 복선 + 에피소드 아크)
      // 각 시스템은 독립적 - 설정된 것만 포함됨
      const unifiedBriefing = injectUnifiedBriefing(novel, series, prompt, novel.chapters.length);

      // GLM용 프롬프트 강화 - 마지막 위치 재확인
      let finalPrompt = prompt;
      if (isGlmEngine && novel.chapters.length > 0) {
        const lastChapterNum = novel.chapters.length;
        finalPrompt = `${prompt}

[중요] 현재 ${lastChapterNum}화까지 작성되었습니다. ${lastChapterNum + 1}화부터 새로운 내용을 이어서 작성하세요. 이전 내용을 반복하면 안 됩니다.`;
      }

      // 통합 브리핑이 있으면 프롬프트 앞에 추가 (AI 작가가 집필 전 참고)
      if (unifiedBriefing) {
        finalPrompt = `${unifiedBriefing}\n\n${finalPrompt}`;
      }

      // 현재 프롬프트 추가
      contents.push({ role: 'user', parts: [{ text: finalPrompt }] });

      // Cached history is absent from contents. Rebuild that slot before dropping the cache.
      const restoreUncachedRequest = () => {
        const rawStart = hasSummary ? summaryCoveredCount : 0;
        const historyText = [
          hasSummary ? `[STORY CONTEXT SUMMARY]\n${contextSummary}` : '',
          novel.chapters.slice(rawStart).map((chapter, index) => (
            `[${rawStart + index + 1}화 "${chapter.title}"]\n${chapter.content}`
          )).join('\n\n'),
          positionMarker,
        ].filter(Boolean).join('\n\n');
        if (totalChapterCount > 0) {
          contents = contents.map((item, index) => index === storyContextIndex
            ? { role: 'user', parts: [{ text: historyText }] }
            : item);
        }
        cachedContentName = undefined;
        finalSystemInstruction = uncachedSystemInstruction;
        cacheMode = 'none';
        attemptCacheMode = 'none';
        attemptCacheStatus = 'skipped';
      };

      // 저장값이 오래되었거나 외부 JSON에서 넘어와도 모델의 실제 허용 범위로 정규화한다.
      const targetedGenerationEnabled = novel.targetedGenerationEnabled !== false;
      const maxTokens = getChapterOutputTokens(
        targetedGenerationEnabled,
        novel.chapterTargetCharacters,
        effectiveModel,
      );
      let completedUsageMetadata: AiUsageMetadata | undefined;

      if (effectiveProvider === 'xai') {
        // xAI (Grok) 스트리밍
        const apiKey = getXaiApiKey();
        if (!apiKey) {
          throw new Error('xAI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
        }
        const modelName = effectiveModel;
        const messages = convertToOpenAIMessages(contents, finalSystemInstruction);

        markModelRequestStarted();
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: 0.7,
            max_tokens: maxTokens,
            stream: true,
          }),
          signal: abortSignal, // 취소 지원
        });

        if (!response.ok) {
          throw new Error(`xAI API 오류: ${response.status}`);
        }

        // AsyncGenerator로 실시간 스트리밍
        for await (const chunk of parseOpenAICompatibleStreamGenerator(response)) {
          // 취소 확인
          abortSignal.throwIfAborted();
          markFirstToken();
          accumulatedText += chunk;
          yield { streamingText: chunk };
        }
      } else if (effectiveProvider === 'glm') {
        // GLM (Z.AI) 스트리밍 - 한국어 품질 향상 지시 포함
        const apiKey = getGlmApiKey();
        if (!apiKey) {
          throw new Error('GLM API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
        }
        const modelName = effectiveModel;
        const messages = convertToOpenAIMessages(contents, finalSystemInstruction, true);

        markModelRequestStarted();
        const response = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: 0.85, // 반복 방지를 위해 약간 낮춤
            top_p: 0.9, // 반복 방지를 위해 약간 낮춤
            presence_penalty: 0.6, // 반복 방지 강화
            frequency_penalty: 0.4, // 동일 표현 반복 방지
            max_tokens: maxTokens,
            stream: true,
          }),
          signal: abortSignal, // 취소 지원
        });

        if (!response.ok) {
          throw new Error(`GLM API 오류: ${response.status}`);
        }

        // AsyncGenerator로 실시간 스트리밍
        for await (const chunk of parseOpenAICompatibleStreamGenerator(response)) {
          // 취소 확인
          abortSignal.throwIfAborted();
          markFirstToken();
          accumulatedText += chunk;
          yield { streamingText: chunk };
        }
      } else {
        // Gemini 스트리밍
        // 취소 확인
        abortSignal.throwIfAborted();

        const geminiModel = effectiveModel.startsWith('gemini-') ? effectiveModel : modelToUse;

        let streamSuccess = false;
        for (const streamModel of [geminiModel]) {
          try {
            logger.log(`[Gemini Stream] 정확한 선택 모델로 호출: ${streamModel}`);

            // ★ cachedContent와 systemInstruction은 동시 사용 불가 (Gemini API 제약)
            // 캐시에 이미 systemInstruction 포함됨 → 캐시 있으면 systemInstruction 제외
            const streamConfig: Record<string, unknown> = {
              abortSignal,
              maxOutputTokens: maxTokens,
              safetySettings: NOVEL_SAFETY_SETTINGS,
            };
            const thinkingConfig = getGeminiThinkingConfig(streamModel, 'low');
            if (thinkingConfig) streamConfig.thinkingConfig = thinkingConfig;
            if (cachedContentName) {
              streamConfig.cachedContent = cachedContentName;
            } else {
              streamConfig.systemInstruction = finalSystemInstruction || undefined;
            }

            markModelRequestStarted();
            const resultStream = await ai.models.generateContentStream({
              model: streamModel,
              contents,
              config: streamConfig,
            });

            let termination: GeminiTerminationDiagnostic | undefined;
            for await (const chunk of resultStream) {
              // 취소 확인
              abortSignal.throwIfAborted();
              if (chunk.usageMetadata) completedUsageMetadata = chunk.usageMetadata;
              if (chunk.text) {
                markFirstToken();
                accumulatedText += chunk.text;
                yield { streamingText: chunk.text };
              }
              // 마지막 청크의 finishReason 캡처 (안전 필터 차단 진단용)
              termination = mergeGeminiTermination(termination, readGeminiTermination(chunk));
            }

            // SAFETY 차단 감지 → 캐시 없이 즉시 재시도
            if (termination?.finishReason === 'SAFETY' && !accumulatedText.trim() && cachedContentName) {
              console.warn(`[Gemini Stream] SAFETY 차단 + 캐시 사용 중 → 캐시 없이 재시도`);
              const invalidCacheName = cachedContentName;
              restoreUncachedRequest();
              yield { invalidatedCacheInfo: { model: streamModel, cacheName: invalidCacheName } };
              accumulatedText = '';
              const retryStream2 = await ai.models.generateContentStream({
                model: streamModel,
                contents,
                config: {
                  abortSignal,
                  systemInstruction: uncachedSystemInstruction || undefined,
                  maxOutputTokens: maxTokens,
                  safetySettings: NOVEL_SAFETY_SETTINGS,
                  ...(thinkingConfig && { thinkingConfig }),
                },
              });
              let retryTermination: GeminiTerminationDiagnostic | undefined;
              for await (const chunk of retryStream2) {
                abortSignal.throwIfAborted();
                retryTermination = mergeGeminiTermination(retryTermination, readGeminiTermination(chunk));
                if (chunk.usageMetadata) completedUsageMetadata = chunk.usageMetadata;
                if (chunk.text) { markFirstToken(); accumulatedText += chunk.text; yield { streamingText: chunk.text }; }
              }
              termination = retryTermination;
            }

            // finishReason 로그
            if (termination?.finishReason && termination.finishReason !== 'STOP') {
              console.warn(`[Gemini Stream] finishReason: ${termination.finishReason}`);
            }
            if (termination && isGeminiBlocked(termination)) {
              throw new GeminiTerminationError(streamModel, termination);
            }

            streamSuccess = true;
            break; // 성공 시 루프 종료
          } catch (streamError) {
            const errMsg = streamError instanceof Error ? streamError.message : String(streamError);
            const errLower = errMsg.toLowerCase();
            const isCacheError = errLower.includes('cache') || errLower.includes('not found') || errLower.includes('404') || errLower.includes('invalid');

            // ★ 캐시 참조 실패 → 캐시 없이 즉시 재시도
            if (isCacheError && cachedContentName && !accumulatedText && !abortSignal.aborted) {
              console.warn(`[Gemini Stream] 캐시 참조 실패 (${errMsg}), 캐시 없이 재시도...`);
              const invalidCacheName = cachedContentName;
              restoreUncachedRequest();
              yield { invalidatedCacheInfo: { model: streamModel, cacheName: invalidCacheName } };
              accumulatedText = '';

              try {
                const retryStream = await ai.models.generateContentStream({
                  model: streamModel,
                  contents,
                  config: {
                    abortSignal,
                    systemInstruction: uncachedSystemInstruction || undefined,
                    maxOutputTokens: maxTokens,
                    safetySettings: NOVEL_SAFETY_SETTINGS,
                    ...(getGeminiThinkingConfig(streamModel, 'low') && {
                      thinkingConfig: getGeminiThinkingConfig(streamModel, 'low'),
                    }),
                  },
                });

                for await (const chunk of retryStream) {
                  abortSignal.throwIfAborted();
                  if (chunk.usageMetadata) completedUsageMetadata = chunk.usageMetadata;
                  if (chunk.text) {
                    markFirstToken();
                    accumulatedText += chunk.text;
                    yield { streamingText: chunk.text };
                  }
                }
                streamSuccess = true;
                break;
              } catch (retryError) {
                console.error(`[Gemini Stream] 캐시 없이 재시도도 실패:`, retryError);
                throw retryError;
              }
            }

            throw streamError; // 폴백 불가능하면 상위 catch로
          }
        }

        if (!streamSuccess) {
          throw new Error(`Gemini 스트리밍 실패: 선택 모델 호출 실패 (${geminiModel})`);
        }
      }

      const usageInputChars = countGenerationInputChars(contents, finalSystemInstruction);
      const generationUsage = {
        inputTokens: completedUsageMetadata?.promptTokenCount ?? Math.ceil(usageInputChars / 4),
        cachedInputTokens: completedUsageMetadata?.cachedContentTokenCount ?? 0,
        outputTokens: completedUsageMetadata?.candidatesTokenCount ?? Math.ceil(accumulatedText.length / 4),
        thinkingTokens: completedUsageMetadata?.thoughtsTokenCount ?? 0,
        measured: typeof completedUsageMetadata?.promptTokenCount === 'number',
      };
      recordAiUsage({
        model: effectiveModel,
        inputChars: usageInputChars,
        outputChars: accumulatedText.length,
        usageMetadata: completedUsageMetadata,
      });

      // 성공 후 AbortController 정리
      clearAbortController(abortSignal);

      // ★ 빈 응답 감지 — AI가 아무것도 안 쓴 경우 사유 전달
      if (!accumulatedText || accumulatedText.trim().length === 0) {
        // 캐시가 있었으면 캐시 문제 가능성 높음
        const hint = cacheMode !== 'none'
          ? '캐시 문제일 수 있습니다. 설정에서 캐시를 삭제하고 다시 시도해보세요.'
          : '소설 내용이 Google 서버 정책에 의해 차단되었을 수 있습니다. 프롬프트를 수정하거나 다시 시도해보세요.';
        throw new Error(`AI가 응답을 생성하지 못했습니다. ${hint}`);
      }

      // 복선 메모 자동 추출
      const { content: finalContent, memo } = prepareGeneratedChapter(accumulatedText);

      yield {
        log: {
          id: `${sessionId}-attempt-${attempt + 1}`,
          sessionId,
          attemptNumber: attempt + 1,
          maxAttempts,
          timestamp: Date.now(),
          status: 'success',
          prompt,
          content: finalContent, // 복선 메모 + 마크다운이 제거된 정제된 콘텐츠
          authorName,
          model: effectiveModel,
          provider: effectiveProvider,
          targetCharacters: targetedGenerationEnabled ? novel.chapterTargetCharacters ?? 6000 : undefined,
          requestedMaxTokens: maxTokens,
          outputCharacters: finalContent.length,
          usage: generationUsage,
          timing: getAttemptTiming(),
        },
        // 복선 메모가 있으면 함께 전달
        ...(memo && { foreshadowingMemo: memo, cleanedContent: finalContent }),
      };
      return;
    } catch (error) {
      // 취소된 경우 특별 처리
      if (abortSignal.aborted || (error instanceof Error && (error.name === 'AbortError' || error.message.includes('취소')))) {
        clearAbortController(abortSignal);
        yield {
          cancelled: true,
          log: {
            id: `${sessionId}-attempt-${attempt + 1}`,
            sessionId,
            attemptNumber: attempt + 1,
            maxAttempts,
            timestamp: Date.now(),
            status: 'error',
            prompt,
            content: accumulatedText,
            error: 'AI 생성이 취소되었습니다.',
            authorName,
            model: lastAttemptModel,
            provider: lastAttemptModel.startsWith('grok-') ? 'xai' : lastAttemptModel.startsWith('glm-') ? 'glm' : 'gemini',
            timing: getAttemptTiming(),
          },
        };
        return;
      }

      attempt++;
      const errorMessage = processGeminiError(error);
      const isRetryable = isRetryableGenerationError(errorMessage);
      const willRetry = attempt < maxAttempts && isRetryable && !accumulatedText;
      const failedModel = lastAttemptModel;
      const fallbackModel: string | null = willRetry
        ? getGeminiWritingOverloadFallbackModel(failedModel, requestedGeminiModel || failedModel)
        : null;

      yield {
        log: {
          id: `${sessionId}-attempt-${attempt}`,
          sessionId,
          attemptNumber: attempt,
          maxAttempts,
          timestamp: Date.now(),
          status: 'error',
          prompt,
          content: accumulatedText,
          error: errorMessage,
          authorName,
          model: failedModel,
          provider: failedModel.startsWith('grok-') ? 'xai' : failedModel.startsWith('glm-') ? 'glm' : 'gemini',
          termination: getGeminiTerminationFromError(error),
          timing: getAttemptTiming(),
        },
        willRetry,
        retryModel: fallbackModel || undefined,
      };

      if (!willRetry) {
        clearAbortController(abortSignal);
        return;
      }

      // ★ 완충장치: 재시도 시 캐싱 스킵 (503 이중 발생 방지)
      skipCaching = true;
      if (fallbackModel && fallbackModel !== failedModel) {
        retryGeminiModel = fallbackModel;
        logger.log(`[Retry ${attempt}/${maxAttempts}] ${failedModel} 과부하 → ${fallbackModel}로 임시 전환`);
      }
      logger.log(`[Retry ${attempt}/${maxAttempts}] 캐싱 스킵, ${delay}ms 후 재시도...`);

      try {
        await waitForRetry(delay, abortSignal);
      } catch (retryError) {
        clearAbortController(abortSignal);
        if (!abortSignal.aborted) throw retryError;
        yield { cancelled: true };
        return;
      }
      delay = Math.min(delay * 1.5, 4000); // 지수 증가 완화 (2x→1.5x, 최대 4초)
    }
  }
  } finally {
    clearAbortController(abortSignal);
  }
}

/**
 * 텍스트 리라이팅
 */
export async function rewriteText(
  text: string,
  context: string,
  instruction: string
): Promise<string> {
  const systemInstruction = `당신은 문장 확장 및 윤문 전문 편집자입니다.

[절대 임무: 분량 확장]
1. 요약 금지: 원문을 축약하지 마십시오.
2. 분량 유지 및 확대: 원문 대비 120% 이상으로 작성하십시오.
3. 상세화: 감각적인 묘사를 더해 구체화하십시오.

[지시사항]
"${instruction}"

[출력 형식]
설명 없이 오직 '수정된 본문'만 출력하십시오.`;

  const prompt = `--- 원문 (${text.length}자) ---\n${text}\n\n--- 문맥 ---\n${context}`;

  try {
    const result = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
    });
    return result || text;
  } catch {
    return text;
  }
}

/**
 * 텍스트 재작성 (단일 버전) - 빠른 응답을 위한 개선된 버전
 */
async function rewriteSingle(
  content: string,
  instruction: string,
  versionHint: string
): Promise<string> {
  const systemInstruction = `당신은 문장 재작성 전문 편집자입니다.

[절대 원칙]
1. 요약 금지: 원문을 축약하지 마세요.
2. 분량 유지: 원문과 비슷하거나 약간 더 길게 작성하세요.
3. ${versionHint}
4. 완전한 문장으로 마무리하세요.

[출력 형식]
설명이나 머릿말 없이 오직 '수정된 본문'만 출력하세요.`;

  const prompt = `--- 원문 (${content.length}자) ---
${content}

--- 수정 지시 ---
${instruction || '더 자연스럽게 다듬어주세요'}

위 원문을 지시에 따라 다시 작성하세요.`;

  const result = await generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction,
  });
  return result?.trim() || content;
}

/**
 * 챕터 재구성 (3가지 버전) - 병렬 처리로 개선
 */
export async function reconstructChapter(
  content: string,
  instruction: string
): Promise<string[]> {
  const versionHints = [
    '스타일1: 원문의 톤을 유지하면서 표현을 다듬어주세요.',
    '스타일2: 감정 묘사와 분위기를 더 살려주세요.',
    '스타일3: 문장 리듬과 호흡을 개선해주세요.',
  ];

  const results = await Promise.allSettled(
    versionHints.map((hint) => rewriteSingle(content, instruction, hint))
  );

  const versions = results
    .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
    .map((result) => result.value.trim())
    .filter((value) => value.length > 0);

  if (versions.length === 0) {
    const firstError = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    const message = firstError?.reason instanceof Error ? firstError.reason.message : '응답을 생성하지 못했습니다.';
    console.error('[reconstructChapter] 재구성 실패:', firstError?.reason);
    throw new Error(`재구성 실패: ${message}`);
  }

  return versions;
}
