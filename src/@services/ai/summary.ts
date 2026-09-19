/**
 * ============================================================
 * @module services/ai/summary
 * @file summary.ts
 * ============================================================
 * @description 자동 요약 갱신 서비스 (체크포인트 기반)
 *
 * 설계 철학:
 * - Flash 모델로 저비용 요약 (비용 최적화 최우선)
 * - 구조화된 화별 요약 (entries) → UI에서 개별 수정/삭제 가능
 * - 체크포인트 검증으로 stale 요약 자동 감지
 * - 증분 업데이트: 새 챕터만 추가 요약 (최소 비용)
 * - 전체 재생성: 삭제/수정 시 Flash로 저렴하게 갱신
 * - 이정표(milestones): 모든 변경 추적
 * ============================================================
 */

import type { Novel, ContextSummary, SummaryEntry, SummaryMilestone, Chapter } from '@core/types';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import { generateContent, getAiTaskModel, getSummaryTriggerChapters } from './config';
import { withRetry, computeChapterSignature, computeStableSignature, matchesChapterSignature } from './utils';
import { PLOT_ARCHIVIST_INSTRUCTION } from './prompts';
import { logger } from '@shared/utils/logger';
import { attachSummaryRollups } from './summaryHierarchy';

/** 자동 요약 트리거 기본 주기 (N화마다) */
const DEFAULT_AUTO_SUMMARY_INTERVAL = 5;

/** 최근 원문 구간을 벗어난 첫 화부터 기억 공백 없이 요약한다. */
const MIN_CHAPTERS_FOR_SUMMARY = 1;

export interface AutoSummarySchedule {
  isEnabled: boolean;
  isDue: boolean;
  triggerChapters: number;
  fullTextChapters: number;
  totalChapters: number;
  summarizableCount: number;
  coveredCount: number;
  pendingCount: number;
  chaptersUntilNextRun: number | null;
  nextRunAtChapter: number | null;
  nextSaveWillTrigger: boolean;
  nextSummaryStartChapter: number | null;
  nextSummaryEndChapter: number | null;
  reason: 'disabled' | 'waiting' | 'interval' | 'recheck' | 'deleted';
}

/** 이정표 ID 생성 */
function createMilestoneId(): string {
  return `ms_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
}

/** 단일 챕터 서명 (수정 감지용) */
export function computeSingleChapterSignature(ch: Chapter): string {
  return computeStableSignature(JSON.stringify([ch.id || '?', ch.title, ch.content]));
}

export function matchesSingleChapterSignature(signature: string | undefined, chapter: Chapter): boolean {
  if (!signature) return false;
  const legacy = `${chapter.id || '?'}:${chapter.title}:${chapter.content.length}:${chapter.content.slice(0, 16)}`;
  return signature === computeSingleChapterSignature(chapter) || signature === legacy;
}

/**
 * 자동 요약이 필요한 시점인지 확인
 *
 * 트리거 조건 (ID 기반, 삭제/중간삽입에도 안정적):
 * 1. 문맥 관리가 활성화되어 있어야 함
 * 2. 요약 대상 챕터가 MIN_CHAPTERS_FOR_SUMMARY 이상
 * 3. needsRecheck 플래그 OR 삭제 감지 OR 미요약 N화 이상 누적
 */
export function getAutoSummarySchedule(novel: Novel): AutoSummarySchedule {
  const isEnabled = !!novel.contextManagement?.isEnabled;
  const fullTextChapters = FIXED_RECENT_RAW_CHAPTERS;
  const summaryTriggerChapters = getSummaryTriggerChapters(
    novel.contextManagement?.summaryTriggerChapters ?? DEFAULT_AUTO_SUMMARY_INTERVAL
  );
  const summarizableCount = Math.max(0, novel.chapters.length - fullTextChapters);
  const coveredIds = novel.contextSummary?.coveredChapterIds || [];
  const chaptersToSummarize = novel.chapters.slice(0, summarizableCount);
  const currentIdSet = new Set(chaptersToSummarize.map(ch => ch.id).filter(Boolean));
  const hasDeleted = coveredIds.some(id => !currentIdSet.has(id));
  const coveredIdSet = new Set(coveredIds);
  const pendingChapters = chaptersToSummarize.filter(ch => ch.id && !coveredIdSet.has(ch.id));
  const pendingCount = pendingChapters.length;
  const coveredCount = Math.max(0, summarizableCount - pendingCount);
  const needsRecheck = !!novel.contextSummary?.needsRecheck;
  const isImmediate = needsRecheck || hasDeleted;
  const isIntervalDue = pendingCount >= summaryTriggerChapters;
  const isDue = isEnabled
    && summarizableCount >= MIN_CHAPTERS_FOR_SUMMARY
    && (isImmediate || isIntervalDue);
  const bufferDeficit = Math.max(0, fullTextChapters - novel.chapters.length);
  const chaptersUntilNextRun = !isEnabled
    ? null
    : isDue ? 0 : bufferDeficit + Math.max(0, summaryTriggerChapters - pendingCount);
  const nextSummaryStartChapter = isImmediate ? 1 : coveredCount + 1;
  const nextSummaryEndChapter = nextSummaryStartChapter === null || chaptersUntilNextRun === null
    ? null
    : isImmediate ? summarizableCount : summarizableCount + chaptersUntilNextRun - bufferDeficit;

  return {
    isEnabled,
    isDue,
    triggerChapters: summaryTriggerChapters,
    fullTextChapters,
    totalChapters: novel.chapters.length,
    summarizableCount,
    coveredCount,
    pendingCount,
    chaptersUntilNextRun,
    nextRunAtChapter: chaptersUntilNextRun === null
      ? null
      : novel.chapters.length + chaptersUntilNextRun,
    nextSaveWillTrigger: chaptersUntilNextRun === 0 || chaptersUntilNextRun === 1,
    nextSummaryStartChapter,
    nextSummaryEndChapter,
    reason: !isEnabled
      ? 'disabled'
      : needsRecheck ? 'recheck' : hasDeleted ? 'deleted' : isIntervalDue ? 'interval' : 'waiting',
  };
}

export function shouldAutoSummarize(novel: Novel): boolean {
  return getAutoSummarySchedule(novel).isDue;
}

/** 청크당 최대 챕터 수와 원문 글자 수 */
const SUMMARY_CHUNK_SIZE = 10;
const SUMMARY_CHUNK_MAX_CHARS = 60_000;

export interface SummaryChunk {
  chapters: Chapter[];
  startNumber: number;
}

/** 화수뿐 아니라 실제 원문량까지 고려해 긴 화가 한 요청에 몰리지 않게 한다. */
export function buildSummaryChunks(
  chapters: Chapter[],
  startNumber: number,
  maxChapters = SUMMARY_CHUNK_SIZE,
  maxChars = SUMMARY_CHUNK_MAX_CHARS
): SummaryChunk[] {
  const chunks: SummaryChunk[] = [];
  let current: Chapter[] = [];
  let currentChars = 0;
  let currentStart = startNumber;

  chapters.forEach((chapter, index) => {
    const chapterChars = chapter.title.length + chapter.content.length;
    const exceedsBudget = current.length > 0
      && (current.length >= maxChapters || currentChars + chapterChars > maxChars);
    if (exceedsBudget) {
      chunks.push({ chapters: current, startNumber: currentStart });
      current = [];
      currentChars = 0;
      currentStart = startNumber + index;
    }
    current.push(chapter);
    currentChars += chapterChars;
  });

  if (current.length > 0) chunks.push({ chapters: current, startNumber: currentStart });
  return chunks;
}

/**
 * 화별 구조화 요약 생성 (AI 호출, 청크 분할)
 *
 * 최대 10화/6만자 단위로 순차 처리 → 품질 균일 + 과부하 방지
 */
async function summarizeChaptersStructured(
  chapters: Chapter[],
  startNumber: number
): Promise<SummaryEntry[]> {
  if (chapters.length === 0) return [];

  const chunks = buildSummaryChunks(chapters, startNumber);
  const allEntries: SummaryEntry[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    logger.log(`[AutoSummary] 청크 ${index + 1}/${chunks.length}: ${chunk.startNumber}~${chunk.startNumber + chunk.chapters.length - 1}화`);
    const entries = await summarizeChunk(chunk.chapters, chunk.startNumber);
    allEntries.push(...entries);
  }

  return allEntries;
}

/** 단일 청크 요약 */
async function summarizeChunk(
  chapters: Chapter[],
  startNumber: number
): Promise<SummaryEntry[]> {
  const chaptersText = chapters
    .map((ch, idx) => `[${startNumber + idx}화] "${ch.title}"\n${ch.content}`)
    .join('\n\n---\n\n');

  const prompt = `다음 소설 챕터들을 각각 요약하세요.

[규칙]
1. 각 화별로 구분하여 요약
2. 형식: [N화] 핵심 사건, 인물 변화, 미해결 사항
3. 화당 2-4문장으로 간결하게
4. 미사여구 없이 사실만 기록
5. 반드시 모든 화를 빠짐없이 요약

--- 챕터 내용 ---
${chaptersText}`;

  const response = await withRetry(() =>
    generateContent({
      model: getAiTaskModel('summary'),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: PLOT_ARCHIVIST_INSTRUCTION,
    })
  );

  return parseStructuredResponse(response || '', chapters, startNumber);
}

/**
 * AI 응답을 화별 SummaryEntry로 파싱
 */
function parseStructuredResponse(
  response: string,
  chapters: Chapter[],
  startNumber: number
): SummaryEntry[] {
  const entries: SummaryEntry[] = [];
  const now = Date.now();

  // [N화] 패턴으로 분리 시도
  const chapterPattern = /\[(\d+)화\]\s*/g;
  const segments: { num: number; start: number }[] = [];

  let match;
  while ((match = chapterPattern.exec(response)) !== null) {
    segments.push({ num: parseInt(match[1]), start: match.index + match[0].length });
  }

  if (segments.length > 0) {
    // AI가 화별로 구분해서 응답한 경우
    for (let i = 0; i < segments.length; i++) {
      const end = i + 1 < segments.length ? segments[i + 1].start - `[${segments[i + 1].num}화] `.length : response.length;
      const summaryText = response.slice(segments[i].start, end).trim();
      const chapterIdx = segments[i].num - startNumber;

      if (chapterIdx >= 0 && chapterIdx < chapters.length) {
        entries.push({
          chapterId: chapters[chapterIdx].id || `unknown_${chapterIdx}`,
          chapterNumber: segments[i].num,
          chapterTitle: chapters[chapterIdx].title,
          summary: summaryText,
          timestamp: now,
          chapterSignature: computeSingleChapterSignature(chapters[chapterIdx]),
        });
      }
    }
  }

  // 파싱 실패하거나 누락된 챕터가 있으면 전체를 하나로
  if (entries.length < chapters.length) {
    const coveredNums = new Set(entries.map(e => e.chapterNumber));

    for (let i = 0; i < chapters.length; i++) {
      const num = startNumber + i;
      if (coveredNums.has(num)) continue;

      // 누락된 챕터는 전체 응답에서 해당 부분 추정
      entries.push({
        chapterId: chapters[i].id || `unknown_${i}`,
        chapterNumber: num,
        chapterTitle: chapters[i].title,
        summary: entries.length === 0 ? response.trim() : `(${num}화 요약 포함)`,
        timestamp: now,
        chapterSignature: computeSingleChapterSignature(chapters[i]),
      });
    }

    // 번호순 정렬
    entries.sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  return entries;
}

async function summarizeSelectedChapters(
  allChapters: Chapter[],
  selectedIndexes: number[],
): Promise<SummaryEntry[]> {
  if (selectedIndexes.length === 0) return [];
  const groups: number[][] = [];
  for (const index of selectedIndexes) {
    const current = groups[groups.length - 1];
    if (current && current[current.length - 1] === index - 1) {
      current.push(index);
    } else {
      groups.push([index]);
    }
  }

  const entries: SummaryEntry[] = [];
  for (const group of groups) {
    const chapters = group.map((index) => allChapters[index]);
    entries.push(...await summarizeChaptersStructured(chapters, group[0] + 1));
  }
  return entries;
}

/**
 * 구조화된 entries를 통합 텍스트로 병합
 */
export function mergeEntriesToText(entries: SummaryEntry[]): string {
  if (entries.length === 0) return '';

  return entries
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map(e => `[${e.chapterNumber}화] ${e.summary}`)
    .join('\n\n');
}

/**
 * 레거시 요약 감지: content는 있지만 entries/coveredChapterIds가 없는 상태
 * (기존 수동 요약 방식으로 저장된 데이터)
 */
export function isLegacySummary(summary?: ContextSummary): boolean {
  if (!summary) return false;
  return !!(
    summary.content &&
    summary.content.trim().length > 0 &&
    (!summary.entries || summary.entries.length === 0) &&
    (!summary.coveredChapterIds || summary.coveredChapterIds.length === 0)
  );
}

/** 레거시 마이그레이션 결과 */
export interface LegacyMigrationResult {
  /** 로컬 파싱으로 추출된 entries */
  parsedEntries: SummaryEntry[];
  /** 파싱되지 않은 자유 텍스트 (작가 메모 등) */
  unparsedText: string;
  /** 파싱된 entries가 커버하지 않는 챕터 인덱스들 */
  uncoveredChapterIndices: number[];
  /** 전체 챕터 중 파싱 커버율 (0~1) */
  coverageRatio: number;
}

/**
 * 레거시 텍스트를 로컬에서 entries로 파싱 (AI 호출 없음, 무료)
 *
 * [N화] 패턴이 있으면 추출, 없으면 자유 텍스트로 분류
 * 추출된 entries는 현재 챕터 목록과 매칭하여 ID/서명 부여
 */
export function parseLegacyText(
  text: string,
  chapters: Chapter[],
): LegacyMigrationResult {
  const now = Date.now();
  const parsedEntries: SummaryEntry[] = [];

  // [N화] 패턴 추출
  const chapterPattern = /\[(\d+)화\]\s*/g;
  const segments: { num: number; matchStart: number; textStart: number }[] = [];

  let match;
  while ((match = chapterPattern.exec(text)) !== null) {
    segments.push({
      num: parseInt(match[1]),
      matchStart: match.index,
      textStart: match.index + match[0].length,
    });
  }

  // [N화] 패턴 앞의 텍스트 = 자유 텍스트 (작가 메모 등)
  const unparsedParts: string[] = [];
  if (segments.length > 0 && segments[0].matchStart > 0) {
    const before = text.slice(0, segments[0].matchStart).trim();
    if (before) unparsedParts.push(before);
  }

  // 각 세그먼트에서 요약 텍스트 추출
  if (segments.length > 0) {
    for (let i = 0; i < segments.length; i++) {
      const end = i + 1 < segments.length
        ? segments[i + 1].matchStart
        : text.length;
      const summaryText = text.slice(segments[i].textStart, end).trim();
      const chapterIdx = segments[i].num - 1; // 1-indexed → 0-indexed

      if (chapterIdx >= 0 && chapterIdx < chapters.length) {
        parsedEntries.push({
          chapterId: chapters[chapterIdx].id || `legacy_${chapterIdx}`,
          chapterNumber: segments[i].num,
          chapterTitle: chapters[chapterIdx].title,
          summary: summaryText,
          timestamp: now,
          chapterSignature: computeSingleChapterSignature(chapters[chapterIdx]),
        });
      } else {
        // 챕터 번호가 범위 밖이면 자유 텍스트로
        unparsedParts.push(`[${segments[i].num}화] ${summaryText}`);
      }
    }
  } else {
    // [N화] 패턴이 전혀 없으면 전체가 자유 텍스트
    unparsedParts.push(text.trim());
  }

  // 커버되지 않은 챕터 찾기
  const coveredNums = new Set(parsedEntries.map(e => e.chapterNumber));
  const uncoveredChapterIndices = chapters
    .map((_, idx) => idx)
    .filter(idx => !coveredNums.has(idx + 1));

  const coverageRatio = chapters.length > 0
    ? parsedEntries.length / chapters.length
    : 0;

  return {
    parsedEntries,
    unparsedText: unparsedParts.join('\n\n'),
    uncoveredChapterIndices,
    coverageRatio,
  };
}

/** 자동 요약 결과 */
export interface AutoSummaryResult {
  source: SummaryRequestSource;
  updated: boolean;
  contextSummary: ContextSummary;
  mode: 'incremental' | 'reconciled' | 'full' | 'skipped' | 'legacy_migrated' | 'hierarchy_built';
  newEntriesCount: number;
  /** 레거시 마이그레이션 시 보존된 원본 텍스트 */
  preservedLegacyText?: string;
}

export interface ManualSummaryResult {
  source: SummaryRequestSource;
  contextSummary: ContextSummary;
  refreshedCount: number;
  filledGapCount: number;
}

export interface SummaryRequestSource {
  manuscriptSignature: string;
  summarySignature: string;
  summary?: ContextSummary;
}

/** Manuscript changes reject a response; summary changes instead require an entry-level merge. */
export function computeSummaryManuscriptSignature(novel: Novel): string {
  const fullTextChapters = FIXED_RECENT_RAW_CHAPTERS;
  const coveredEnd = Math.max(0, novel.chapters.length - fullTextChapters);
  return `${novel.id}:${novel.chapters.length}:${fullTextChapters}:${novel.contextManagement?.isEnabled}:${computeChapterSignature(novel.chapters.slice(0, coveredEnd))}`;
}

function summaryStateSignature(summary: ContextSummary | undefined): string {
  return computeStableSignature(JSON.stringify(summary ?? null));
}

/** Safe for replace-only legacy callers: either manuscript or memory edits invalidate the snapshot. */
export function computeSummarySourceSignature(novel: Novel): string {
  return `${computeSummaryManuscriptSignature(novel)}:${summaryStateSignature(novel.contextSummary)}`;
}

function captureSummaryRequestSource(novel: Novel): SummaryRequestSource {
  return {
    manuscriptSignature: computeSummaryManuscriptSignature(novel),
    summarySignature: summaryStateSignature(novel.contextSummary),
    summary: novel.contextSummary ? structuredClone(novel.contextSummary) : undefined,
  };
}

/** Apply inside mutateNovel, never against the request's captured Novel object. */
export function mergeSummaryResult(
  currentNovel: Novel,
  result: Pick<AutoSummaryResult, 'source' | 'contextSummary'>,
): ContextSummary | undefined {
  const { source, contextSummary: proposed } = result;
  if (computeSummaryManuscriptSignature(currentNovel) !== source.manuscriptSignature) return undefined;
  const current = currentNovel.contextSummary;
  if (summaryStateSignature(current) === source.summarySignature) return proposed;

  // A deleted summary or an opaque whole-text edit cannot be safely merged by chapter ID.
  if (!current?.entries?.length || !proposed.entries?.length) return undefined;
  const before = source.summary;
  const sameEntries = JSON.stringify(current.entries) === JSON.stringify(before?.entries);
  if (sameEntries && current.content !== before?.content) return undefined;
  if (current.content !== mergeEntriesToText(current.entries)) return undefined;

  const beforeById = new Map((before?.entries ?? []).map((entry) => [entry.chapterId, entry]));
  const proposedById = new Map(proposed.entries.map((entry) => [entry.chapterId, entry]));
  const mergedById = new Map(current.entries.map((entry) => [entry.chapterId, entry]));
  const touchedIds = new Set([...beforeById.keys(), ...proposedById.keys()]);
  for (const id of touchedIds) {
    const baseline = beforeById.get(id);
    const generated = proposedById.get(id);
    if (JSON.stringify(baseline) === JSON.stringify(generated)) continue;
    // User edits, deletes, and another completed request all win over this older response.
    if (JSON.stringify(mergedById.get(id)) !== JSON.stringify(baseline)) continue;
    if (generated) mergedById.set(id, generated);
    else mergedById.delete(id);
  }

  const entries = [...mergedById.values()].sort((a, b) => a.chapterNumber - b.chapterNumber);
  const archiveEnd = Math.max(0, currentNovel.chapters.length - FIXED_RECENT_RAW_CHAPTERS);
  let coveredEnd = 0;
  while (coveredEnd < archiveEnd) {
    const chapter = currentNovel.chapters[coveredEnd];
    const entry = chapter.id ? mergedById.get(chapter.id) : undefined;
    if (!entry?.summary.trim() || !matchesSingleChapterSignature(entry.chapterSignature, chapter)) break;
    coveredEnd++;
  }
  const beforeMilestoneIds = new Set((before?.milestones ?? []).map((milestone) => milestone.id));
  const milestones = new Map((current.milestones ?? []).map((milestone) => [milestone.id, milestone]));
  for (const milestone of proposed.milestones ?? []) {
    if (!beforeMilestoneIds.has(milestone.id) && !milestones.has(milestone.id)) milestones.set(milestone.id, milestone);
  }
  return attachSummaryRollups({
    ...current,
    content: mergeEntriesToText(entries),
    entries,
    summarizedChapters: coveredEnd,
    coveredChapterIds: currentNovel.chapters.slice(0, coveredEnd).map((chapter) => chapter.id!).filter(Boolean),
    contentSignature: computeChapterSignature(currentNovel.chapters.slice(0, coveredEnd)),
    needsRecheck: coveredEnd < archiveEnd,
    milestones: [...milestones.values()].slice(-20),
    createdAt: Date.now(),
  });
}

/**
 * 자동 요약 갱신 (메인 함수)
 *
 * [비용 최적화]
 * - 증분 모드: 새 챕터만 요약 → 최소 API 비용
 * - 전체 재생성: 삭제/수정 시 → Flash로 저렴하게
 * - 로컬 검증: 체크포인트로 API 호출 없이 stale 판단
 *
 * @returns 업데이트된 contextSummary 또는 null (스킵 시)
 */
export async function autoUpdateSummary(novel: Novel, options?: { force?: boolean }): Promise<AutoSummaryResult> {
  const source = captureSummaryRequestSource(novel);
  return { ...await generateAutoSummary(novel, options), source };
}

async function generateAutoSummary(novel: Novel, options?: { force?: boolean }): Promise<Omit<AutoSummaryResult, 'source'>> {
  const fullTextChapters = FIXED_RECENT_RAW_CHAPTERS;
  const coveredEnd = Math.max(0, novel.chapters.length - fullTextChapters);
  const chaptersToSummarize = novel.chapters.slice(0, coveredEnd);

  const existingSummary = novel.contextSummary;
  const existingEntries = existingSummary?.entries || [];
  const existingMilestones = existingSummary?.milestones || [];

  // 요약할 챕터가 없으면 스킵
  if (chaptersToSummarize.length < MIN_CHAPTERS_FOR_SUMMARY) {
    return {
      updated: false,
      contextSummary: existingSummary || { content: '', summarizedChapters: 0, createdAt: Date.now() },
      mode: 'skipped',
      newEntriesCount: 0,
    };
  }

  // 체크포인트 검증
  const coveredIds = existingSummary?.coveredChapterIds || [];
  const currentIds = chaptersToSummarize.map(ch => ch.id).filter(Boolean) as string[];

  // 삭제 감지
  const deletedIds = coveredIds.filter(id => !currentIds.includes(id));
  const hasDeleted = deletedIds.length > 0;

  // 수정 감지: 기존 요약이 커버한 범위만 비교해야 새 화를 수정으로 오인하지 않는다.
  const currentSignature = computeChapterSignature(chaptersToSummarize);
  const chaptersById = new Map(chaptersToSummarize.map((chapter) => [chapter.id, chapter]));
  const previouslyCoveredChapters = coveredIds
    .map((id) => chaptersById.get(id))
    .filter((chapter): chapter is Chapter => !!chapter);
  const hasEdited = existingSummary?.contentSignature
    ? !matchesChapterSignature(existingSummary.contentSignature, previouslyCoveredChapters) && !hasDeleted
    : false;

  // 새 챕터 감지 (기존 요약이 커버하지 않는 챕터)
  const coveredIdSet = new Set(coveredIds);
  const newChapters = chaptersToSummarize.filter(ch => ch.id && !coveredIdSet.has(ch.id));
  const hasNewOnly = !hasDeleted && !hasEdited && newChapters.length > 0;

  const forceRegenerate = options?.force === true;
  const isLegacy = isLegacySummary(existingSummary);

  // === 레거시 스마트 마이그레이션 (자동) ===
  // 레거시 감지 시 자동으로 구조화 변환 실행
  // 기존 요약은 AI 생성물이므로 보존 불필요 → Flash로 재스캔이 더 정확함
  // 비용: 10만자 기준 ~7원 (1회성)
  // 1단계: 기존 텍스트에서 [N화] 로컬 파싱 (무료)
  // 2단계: 파싱 안 된 챕터만 AI 요약 (최소 비용)
  // 3단계: 자유 텍스트는 이정표에 보존
  if (isLegacy) {
    const legacyText = existingSummary!.content;
    const migration = parseLegacyText(legacyText, chaptersToSummarize);

    logger.log(`[AutoSummary] 레거시 마이그레이션: 로컬 파싱 ${migration.parsedEntries.length}화, 미커버 ${migration.uncoveredChapterIndices.length}화, 커버율 ${(migration.coverageRatio * 100).toFixed(0)}%`);

    let allEntries = [...migration.parsedEntries];

    // 갭 챕터만 AI 요약 (파싱되지 않은 것만)
    if (migration.uncoveredChapterIndices.length > 0) {
      const gapChapters = migration.uncoveredChapterIndices.map(i => chaptersToSummarize[i]);
      const gapStartNumber = migration.uncoveredChapterIndices[0] + 1;
      const aiEntries = await summarizeChaptersStructured(gapChapters, gapStartNumber);
      allEntries = [...allEntries, ...aiEntries];
    }

    // 번호순 정렬
    allEntries.sort((a, b) => a.chapterNumber - b.chapterNumber);
    const combinedText = mergeEntriesToText(allEntries);

    // 이정표: 마이그레이션 기록 + 자유 텍스트 보존
    const milestoneDesc = migration.unparsedText
      ? `레거시 → 구조화 변환 (파싱 ${migration.parsedEntries.length}화 + AI ${migration.uncoveredChapterIndices.length}화)\n[보존된 메모] ${migration.unparsedText.slice(0, 200)}${migration.unparsedText.length > 200 ? '...' : ''}`
      : `레거시 → 구조화 변환 (파싱 ${migration.parsedEntries.length}화 + AI ${migration.uncoveredChapterIndices.length}화)`;

    const milestone: SummaryMilestone = {
      id: createMilestoneId(),
      timestamp: Date.now(),
      type: 'regenerated',
      description: milestoneDesc,
    };

    const contextSummary: ContextSummary = attachSummaryRollups({
      content: combinedText,
      summarizedChapters: coveredEnd,
      createdAt: Date.now(),
      coveredChapterIds: currentIds,
      contentSignature: currentSignature,
      entries: allEntries,
      milestones: [...existingMilestones, milestone].slice(-20),
      needsRecheck: false,
    });

    return {
      updated: true,
      contextSummary,
      mode: 'legacy_migrated',
      newEntriesCount: allEntries.length,
      preservedLegacyText: legacyText,
    };
  }

  if (!forceRegenerate && (hasDeleted || hasEdited || existingSummary?.needsRecheck)) {
    const entriesById = new Map(existingEntries.map((entry) => [entry.chapterId, entry]));
    const retainedEntries: SummaryEntry[] = [];
    const repairIndexes: number[] = [];

    chaptersToSummarize.forEach((chapter, index) => {
      const entry = chapter.id ? entriesById.get(chapter.id) : undefined;
      if (entry && matchesSingleChapterSignature(entry.chapterSignature, chapter)) {
        retainedEntries.push({
          ...entry,
          chapterNumber: index + 1,
          chapterTitle: chapter.title,
        });
      } else {
        repairIndexes.push(index);
      }
    });

    const repairedEntries = await summarizeSelectedChapters(chaptersToSummarize, repairIndexes);
    const allEntries = [...retainedEntries, ...repairedEntries]
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
    const repairedIds = repairIndexes
      .map((index) => chaptersToSummarize[index]?.id)
      .filter((id): id is string => !!id);
    const milestone: SummaryMilestone = {
      id: createMilestoneId(),
      timestamp: Date.now(),
      type: hasDeleted ? 'chapter_deleted' : hasEdited ? 'chapter_edited' : 'incremental',
      description: hasDeleted
        ? `삭제 구간 정리 + 필요한 화만 보수 (${repairedEntries.length}화 AI 요약)`
        : hasEdited
          ? `수정된 화만 보수 (${repairedEntries.length}화 AI 요약)`
          : `요약 범위 이어맞춤 (${repairedEntries.length}화 AI 요약)`,
      affectedChapterIds: [...deletedIds, ...repairedIds],
    };

    return {
      updated: true,
      contextSummary: attachSummaryRollups({
        content: mergeEntriesToText(allEntries),
        summarizedChapters: coveredEnd,
        createdAt: Date.now(),
        coveredChapterIds: currentIds,
        contentSignature: currentSignature,
        entries: allEntries,
        milestones: [...existingMilestones, milestone].slice(-20),
        needsRecheck: false,
      }),
      mode: 'reconciled',
      newEntriesCount: repairedEntries.length,
    };
  }

  if (forceRegenerate) {
    // === 전체 재생성 모드 ===
    logger.log('[AutoSummary] 사용자 요청으로 전체 재생성');

    const newEntries = await summarizeChaptersStructured(chaptersToSummarize, 1);
    const combinedText = mergeEntriesToText(newEntries);

    const milestone: SummaryMilestone = {
      id: createMilestoneId(),
      timestamp: Date.now(),
      type: 'regenerated',
      description: `사용자 요청 전체 재생성 (${chaptersToSummarize.length}화)`,
    };

    const contextSummary: ContextSummary = attachSummaryRollups({
      content: combinedText,
      summarizedChapters: coveredEnd,
      createdAt: Date.now(),
      coveredChapterIds: currentIds,
      contentSignature: currentSignature,
      entries: newEntries,
      milestones: [...existingMilestones, milestone].slice(-20),
      needsRecheck: false,
    });

    return {
      updated: true,
      contextSummary,
      mode: 'full',
      newEntriesCount: newEntries.length,
    };

  } else if (hasNewOnly) {
    // === 증분 모드 ===
    logger.log(`[AutoSummary] 증분 업데이트: ${newChapters.length}개 새 챕터`);

    const startNumber = coveredEnd - newChapters.length + 1;
    const newEntries = await summarizeChaptersStructured(newChapters, startNumber);
    const allEntries = [...existingEntries, ...newEntries];
    const combinedText = mergeEntriesToText(allEntries);

    const milestone: SummaryMilestone = {
      id: createMilestoneId(),
      timestamp: Date.now(),
      type: 'incremental',
      description: `${newChapters.length}개 챕터 증분 추가 (${startNumber}~${coveredEnd}화)`,
      affectedChapterIds: newChapters.map(ch => ch.id!),
    };

    const contextSummary: ContextSummary = attachSummaryRollups({
      content: combinedText,
      summarizedChapters: coveredEnd,
      createdAt: Date.now(),
      coveredChapterIds: currentIds,
      contentSignature: currentSignature,
      entries: allEntries,
      milestones: [...existingMilestones, milestone].slice(-20),
      needsRecheck: false,
    });

    return {
      updated: true,
      contextSummary,
      mode: 'incremental',
      newEntriesCount: newEntries.length,
    };

  } else {
    // 변경 없음 → 스킵
    const enrichedSummary = existingSummary ? attachSummaryRollups(existingSummary) : undefined;
    const hierarchyChanged = !!enrichedSummary
      && JSON.stringify(enrichedSummary.rollups ?? []) !== JSON.stringify(existingSummary?.rollups ?? []);
    return {
      updated: hierarchyChanged,
      contextSummary: enrichedSummary || { content: '', summarizedChapters: 0, createdAt: Date.now() },
      mode: hierarchyChanged ? 'hierarchy_built' : 'skipped',
      newEntriesCount: 0,
    };
  }
}

/**
 * 선택 구간을 다시 요약하되 장기 기억은 항상 1화부터 연속된 체크포인트로 유지한다.
 * 기존에 유효한 화별 요약은 재사용하고, 선택 구간과 비어 있는 구간만 AI로 보수한다.
 */
export async function refreshSummaryRange(
  novel: Novel,
  requestedStart: number,
  requestedEnd: number,
): Promise<ManualSummaryResult> {
  const source = captureSummaryRequestSource(novel);
  return { ...await generateSummaryRange(novel, requestedStart, requestedEnd), source };
}

async function generateSummaryRange(
  novel: Novel,
  requestedStart: number,
  requestedEnd: number,
): Promise<Omit<ManualSummaryResult, 'source'>> {
  const fullTextChapters = FIXED_RECENT_RAW_CHAPTERS;
  const coveredEnd = Math.max(0, novel.chapters.length - fullTextChapters);
  const chaptersToSummarize = novel.chapters.slice(0, coveredEnd);
  if (chaptersToSummarize.length === 0) {
    throw new Error('최근 원문 구간을 제외하면 요약할 챕터가 없습니다.');
  }

  const start = Math.max(0, Math.min(requestedStart, chaptersToSummarize.length - 1));
  const end = Math.max(start, Math.min(requestedEnd, chaptersToSummarize.length - 1));
  const selectedIndexes = new Set(
    Array.from({ length: end - start + 1 }, (_, offset) => start + offset),
  );
  const existingEntriesById = new Map(
    (novel.contextSummary?.entries || []).map((entry) => [entry.chapterId, entry]),
  );
  const retainedEntries: SummaryEntry[] = [];
  const repairIndexes: number[] = [];
  let filledGapCount = 0;

  chaptersToSummarize.forEach((chapter, index) => {
    const entry = chapter.id ? existingEntriesById.get(chapter.id) : undefined;
    const isReusable = !!entry && matchesSingleChapterSignature(entry.chapterSignature, chapter);
    if (!selectedIndexes.has(index) && isReusable) {
      retainedEntries.push({
        ...entry,
        chapterNumber: index + 1,
        chapterTitle: chapter.title,
      });
      return;
    }

    repairIndexes.push(index);
    if (!selectedIndexes.has(index)) filledGapCount += 1;
  });

  const repairedEntries = await summarizeSelectedChapters(chaptersToSummarize, repairIndexes);
  const allEntries = [...retainedEntries, ...repairedEntries]
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
  const currentIds = chaptersToSummarize.map((chapter) => chapter.id).filter(Boolean) as string[];
  const milestone: SummaryMilestone = {
    id: createMilestoneId(),
    timestamp: Date.now(),
    type: 'manual_edit',
    description: filledGapCount > 0
      ? `수동 구간 갱신 (${start + 1}~${end + 1}화) + 기억 공백 ${filledGapCount}화 보수`
      : `수동 구간 갱신 (${start + 1}~${end + 1}화)`,
    affectedChapterIds: chaptersToSummarize
      .slice(start, end + 1)
      .map((chapter) => chapter.id)
      .filter(Boolean) as string[],
  };

  return {
    contextSummary: attachSummaryRollups({
      content: mergeEntriesToText(allEntries),
      summarizedChapters: coveredEnd,
      createdAt: Date.now(),
      coveredChapterIds: currentIds,
      contentSignature: computeChapterSignature(chaptersToSummarize),
      entries: allEntries,
      milestones: [...(novel.contextSummary?.milestones || []), milestone].slice(-20),
      needsRecheck: false,
    }),
    refreshedCount: end - start + 1,
    filledGapCount,
  };
}

/**
 * 개별 요약 항목 수정 시 이정표 추가 + needsRecheck 설정
 */
export function editSummaryEntry(
  summary: ContextSummary,
  chapterId: string,
  newSummaryText: string
): ContextSummary {
  const entries = (summary.entries || []).map(e =>
    e.chapterId === chapterId
      ? { ...e, summary: newSummaryText, timestamp: Date.now() }
      : e
  );

  const milestone: SummaryMilestone = {
    id: createMilestoneId(),
    timestamp: Date.now(),
    type: 'manual_edit',
    description: `수동 수정: ${chapterId}`,
    affectedChapterIds: [chapterId],
  };

  return attachSummaryRollups({
    ...summary,
    content: mergeEntriesToText(entries),
    entries,
    milestones: [...(summary.milestones || []), milestone].slice(-20),
    createdAt: Date.now(),
    // 수동 수정은 AI 재확인 불필요 (사용자가 직접 고친 것)
  });
}

/**
 * 개별 요약 항목 삭제 시 이정표 추가 + needsRecheck 설정
 */
export function deleteSummaryEntry(
  summary: ContextSummary,
  chapterId: string
): ContextSummary {
  const entries = (summary.entries || []).filter(e => e.chapterId !== chapterId);

  const milestone: SummaryMilestone = {
    id: createMilestoneId(),
    timestamp: Date.now(),
    type: 'manual_edit',
    description: `수동 삭제: ${chapterId}`,
    affectedChapterIds: [chapterId],
  };

  return attachSummaryRollups({
    ...summary,
    content: mergeEntriesToText(entries),
    entries,
    milestones: [...(summary.milestones || []), milestone].slice(-20),
    coveredChapterIds: (summary.coveredChapterIds || []).filter(id => id !== chapterId),
    createdAt: Date.now(),
    needsRecheck: true, // 삭제 후 다음 기회에 재확인
  });
}
