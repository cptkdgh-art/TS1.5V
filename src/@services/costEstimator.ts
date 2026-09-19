/**
 * ============================================================
 * @module services
 * @file costEstimator.ts
 * ============================================================
 * @description AI 사용 비용 추산 서비스
 * ============================================================
 */

import type { Novel, Series } from '@core/types';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import {
  buildCharacterContext,
  buildWorldviewContext,
  buildWritingDirectivesContext,
} from './ai/promptBudget';
import { getSummaryCoveredCount } from './ai/utils';
import { isLorekeeperEnabled } from './ai/lorekeeperPolicy';
import {
  isLargeWorldview,
  LOREKEEPER_PACKET_CHARS,
  resolveWorldviewFiles,
} from './ai/worldviewPolicy';

// --- Pricing Constants (Approximate USD) ---
const EXCHANGE_RATE = 1450; // 1 USD = 1450 KRW
const FLASH_INTRO_PRICE_END = Date.UTC(2027, 0, 1);

// Cost per 1 Million Tokens
const PRICING = {
  'gemini-3.8-flash': { input: 0.75, cachedInput: 0.075, output: 3.75 },
  'gemini-3.7-flash': { input: 0.75, cachedInput: 0.075, output: 3.75 },
  'gemini-3-flash-preview': { input: 0.5, cachedInput: 0.05, output: 3.0 },
  'gemini-3.6-flash': { input: 0.75, cachedInput: 0.075, output: 3.75 },
  'gemini-2.5-flash': { input: 0.3, cachedInput: 0.03, output: 2.5 },
  'gemini-3.5-flash-lite': { input: 0.3, cachedInput: 0.03, output: 2.5 },
  'gemini-3.1-flash-lite': { input: 0.25, cachedInput: 0.025, output: 1.5 },
  'gemini-3.1-pro-preview': { input: 2.0, cachedInput: 0.2, output: 12.0 },
  'gemini-2.5-pro': { input: 1.25, cachedInput: 0.125, output: 10.0 },
  'grok-4-fast': { input: 0.2, output: 0.5 },
  'grok-4': { input: 3.0, output: 15.0 },
  'grok-3': { input: 3.0, output: 15.0 },
  'glm-5': { input: 1.0, output: 3.2 },
  'imagen-3.0-generate-002': { perImage: 0.04 },
};

export interface DailyUsageLog {
  date: string;
  totalCost: number;
  inputChars: number;
  outputChars: number;
  imageCount: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  measuredCalls?: number;
  estimatedCalls?: number;
  cacheSavings?: number;
  modelBreakdown: {
    [modelName: string]: number;
  };
}

export interface UsageHistory {
  [date: string]: DailyUsageLog;
}

const STORAGE_KEY = 'ai_novelist_usage_history_v1';

export const estimateTokens = (text: string): number => {
  return text ? Math.ceil(text.length / 4) : 0;
};

export const calculateCost = (
  model: string,
  inputTokens: number,
  outputTokens: number,
  at = Date.now()
): number => {
  return calculateUsageCost(model, inputTokens, outputTokens, 0, at).costKRW;
};

type TextPricing = { input: number; cachedInput?: number; output: number };

function getTextPricing(model: string, at: number): TextPricing {
  const entry = PRICING[model as keyof typeof PRICING];
  let price: TextPricing = entry && 'input' in entry ? entry : PRICING['gemini-3.8-flash'];

  if (
    at >= FLASH_INTRO_PRICE_END &&
    (model === 'gemini-3.8-flash' || model === 'gemini-3.7-flash' || model === 'gemini-3.6-flash')
  ) {
    price = { input: 1.5, cachedInput: 0.15, output: 7.5 };
  }
  return price;
}

export function calculateUsageCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0,
  at = Date.now(),
): { costKRW: number; cacheSavingsKRW: number } {
  const price = getTextPricing(model, at);
  const safeInput = Math.max(0, inputTokens);
  const safeCached = Math.min(safeInput, Math.max(0, cachedInputTokens));
  const uncachedInput = safeInput - safeCached;
  const cachedRate = price.cachedInput ?? price.input;
  const inputCostUSD = (uncachedInput * price.input + safeCached * cachedRate) / 1_000_000;
  const outputCostUSD = (Math.max(0, outputTokens) / 1_000_000) * price.output;
  const allUncachedInputCostUSD = (safeInput / 1_000_000) * price.input;

  return {
    costKRW: (inputCostUSD + outputCostUSD) * EXCHANGE_RATE,
    cacheSavingsKRW: Math.max(0, allUncachedInputCostUSD - inputCostUSD) * EXCHANGE_RATE,
  };
}

export interface AiUsageMetadata {
  promptTokenCount?: number;
  cachedContentTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface RecordAiUsageInput {
  model: string;
  inputChars: number;
  outputChars: number;
  usageMetadata?: AiUsageMetadata | null;
  inputTokens?: number;
  outputTokens?: number;
}

export const calculateImageCost = (count: number): number => {
  const costUSD = count * PRICING['imagen-3.0-generate-002'].perImage;
  return costUSD * EXCHANGE_RATE;
};

export interface NovelContextCostEstimate {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costKRW: number;
  parts: {
    recentRawTokens: number;
    summaryTokens: number;
    systemTokens: number;
    briefingTokens: number;
    outputTokens: number;
  };
  warnings: string[];
}

function estimateTextTokens(...parts: Array<string | undefined | null>): number {
  return estimateTokens(parts.filter(Boolean).join('\n'));
}

function estimateCharacterTokens(novel: Novel, series: Series | null): number {
  const characters = series?.characters ?? novel.characters ?? [];
  return estimateTokens(buildCharacterContext(characters));
}

function estimateWorldviewTokens(novel: Novel, series: Series | null): number {
  const files = resolveWorldviewFiles(novel, series);
  return estimateTokens(buildWorldviewContext(files, isLorekeeperEnabled(novel.useLorekeeper)));
}

function estimateDirectiveTokens(novel: Novel): number {
  return estimateTokens(buildWritingDirectivesContext(novel.writingDirectives));
}

function estimateEpisodeTokens(novel: Novel): number {
  return estimateTextTokens(
    novel.episodeArc?.goal,
    novel.episodeArc?.chapters
      .map((chapter) => [
        chapter.goal,
        chapter.keyEvents,
        chapter.cliffhanger,
        chapter.directorsNote,
      ].filter(Boolean).join('\n'))
      .join('\n\n') || '',
    novel.episodePacing?.goal,
    novel.episodePacing?.destination
  );
}

function estimateBriefingTokens(novel: Novel, series: Series | null): number {
  const lastChapter = novel.chapters[novel.chapters.length - 1];
  const lastScene = lastChapter?.content?.slice(-300) || '';
  const foreshadowingItems = novel.foreshadowingSystem?.items || [];
  const activeForeshadowing = foreshadowingItems
    .filter((item) => item.status !== 'fully_paid')
    .slice(0, 8)
    .map((item) => `${item.name}\n${item.description}\n${item.aiGuidance.payoffTiming}`)
    .join('\n\n');

  const worldviewFiles = resolveWorldviewFiles(novel, series);
  const lorekeeperWorldview = isLorekeeperEnabled(novel.useLorekeeper) && isLargeWorldview(worldviewFiles)
    ? '가'.repeat(LOREKEEPER_PACKET_CHARS)
    : '';

  return estimateTextTokens(lastScene, activeForeshadowing, lorekeeperWorldview);
}

export function estimateNovelContextCost(
  novel: Novel,
  model: string,
  options?: {
    series?: Series | null;
    fullTextChapters?: number;
    outputTokens?: number;
  }
): NovelContextCostEstimate {
  const fullTextChapters = FIXED_RECENT_RAW_CHAPTERS;
  const rawStartIndex = novel.contextSummary?.content
    ? getSummaryCoveredCount(novel.contextSummary, novel.chapters.length, fullTextChapters)
    : Math.max(0, novel.chapters.length - fullTextChapters);
  const recentRawText = novel.chapters
    .slice(rawStartIndex)
    .map((chapter) => `${chapter.title}\n${chapter.content}`)
    .join('\n\n');

  const recentRawTokens = estimateTokens(recentRawText);
  const summaryTokens = estimateTokens(novel.contextSummary?.content || '');
  const rawWorldviewTokens = estimateTextTokens(
    resolveWorldviewFiles(novel, options?.series ?? null)
      .map((file) => `${file.filename}\n${file.content}`)
      .join('\n\n')
  );
  const rawDirectiveTokens = estimateTextTokens(
    (novel.writingDirectives || [])
      .map((directive) => directive.parts?.map((part) => part.text || '').join('\n') || '')
      .join('\n\n')
  );
  const systemTokens = estimateTextTokens(
    novel.title,
    novel.subject,
    novel.mood,
    novel.primaryGenre,
    novel.subgenres?.join(', '),
    novel.themes?.join(', '),
    novel.plotSummary,
    options?.series?.seriesPlotSummary,
    options?.series?.seriesMemoryCompendium,
  ) + estimateCharacterTokens(novel, options?.series ?? null)
    + estimateWorldviewTokens(novel, options?.series ?? null)
    + estimateDirectiveTokens(novel)
    + estimateEpisodeTokens(novel);
  const briefingTokens = estimateBriefingTokens(novel, options?.series ?? null);
  const outputTokens = options?.outputTokens ?? novel.maxTokens ?? 8192;
  const inputTokens = recentRawTokens + summaryTokens + systemTokens + briefingTokens;
  const warnings: string[] = [];

  if (summaryTokens === 0 && novel.chapters.length > fullTextChapters) {
    warnings.push('요약본이 없어 긴 작품에서 최근 원문 밖 맥락이 약해질 수 있습니다.');
  }
  if (systemTokens > 12000) {
    warnings.push('세계관/인물/지시문이 커서 시스템 프롬프트 비용이 큽니다.');
  }
  if (rawWorldviewTokens + rawDirectiveTokens > estimateWorldviewTokens(novel, options?.series ?? null) + estimateDirectiveTokens(novel)) {
    warnings.push('세계관/지시문 일부가 호출용으로 압축됩니다. 원본은 앱 데이터에 유지됩니다.');
  }
  if (recentRawTokens > 20000) {
    warnings.push('미요약/최근 원문 전송량이 큽니다. 스마트 동기화로 장기 기억을 갱신하세요.');
  }

  return {
    model,
    inputTokens,
    outputTokens,
    costKRW: calculateCost(model, inputTokens, outputTokens),
    parts: {
      recentRawTokens,
      summaryTokens,
      systemTokens,
      briefingTokens,
      outputTokens,
    },
    warnings,
  };
}

export const getUsageHistory = (): UsageHistory => {
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    return item ? JSON.parse(item) : {};
  } catch {
    return {};
  }
};

export const getTodayUsage = (): DailyUsageLog => {
  const today = new Date().toISOString().split('T')[0];
  const history = getUsageHistory();
  if (!history[today]) {
    return {
      date: today,
      totalCost: 0,
      inputChars: 0,
      outputChars: 0,
      imageCount: 0,
      modelBreakdown: {},
    };
  }
  return history[today];
};

export const recordTextUsage = (
  model: string,
  inputText: string,
  outputText: string
) => {
  recordAiUsage({
    model,
    inputChars: inputText.length,
    outputChars: outputText.length,
  });
};

export const recordAiUsage = ({
  model,
  inputChars,
  outputChars,
  usageMetadata,
  inputTokens: suppliedInputTokens,
  outputTokens: suppliedOutputTokens,
}: RecordAiUsageInput) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const history = getUsageHistory();
    const log = history[today] || {
      date: today,
      totalCost: 0,
      inputChars: 0,
      outputChars: 0,
      imageCount: 0,
      modelBreakdown: {},
    };

    const measured = typeof usageMetadata?.promptTokenCount === 'number';
    const inputTokens = usageMetadata?.promptTokenCount
      ?? suppliedInputTokens
      ?? Math.ceil(Math.max(0, inputChars) / 4);
    const thinkingTokens = usageMetadata?.thoughtsTokenCount ?? 0;
    const outputTokens = usageMetadata?.candidatesTokenCount
      ?? suppliedOutputTokens
      ?? Math.ceil(Math.max(0, outputChars) / 4);
    const billedOutputTokens = outputTokens + thinkingTokens;
    const cachedInputTokens = usageMetadata?.cachedContentTokenCount ?? 0;
    const { costKRW, cacheSavingsKRW } = calculateUsageCost(
      model,
      inputTokens,
      billedOutputTokens,
      cachedInputTokens,
    );

    log.inputChars += Math.max(0, inputChars);
    log.outputChars += Math.max(0, outputChars);
    log.inputTokens = (log.inputTokens || 0) + inputTokens;
    log.cachedInputTokens = (log.cachedInputTokens || 0) + cachedInputTokens;
    log.outputTokens = (log.outputTokens || 0) + outputTokens;
    log.thinkingTokens = (log.thinkingTokens || 0) + thinkingTokens;
    log.measuredCalls = (log.measuredCalls || 0) + (measured ? 1 : 0);
    log.estimatedCalls = (log.estimatedCalls || 0) + (measured ? 0 : 1);
    log.cacheSavings = (log.cacheSavings || 0) + cacheSavingsKRW;
    log.totalCost += costKRW;
    log.modelBreakdown[model] = (log.modelBreakdown[model] || 0) + costKRW;

    history[today] = log;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    window.dispatchEvent(new CustomEvent('usageUpdated', { detail: log }));
  } catch (e) {
    console.error('Failed to record AI usage:', e);
  }
};

export const recordImageUsage = (count: number = 1) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const history = getUsageHistory();
    const log = history[today] || {
      date: today,
      totalCost: 0,
      inputChars: 0,
      outputChars: 0,
      imageCount: 0,
      modelBreakdown: {},
    };

    const cost = calculateImageCost(count);
    const model = 'imagen-3.0-generate-002';

    log.imageCount += count;
    log.totalCost += cost;
    log.modelBreakdown[model] = (log.modelBreakdown[model] || 0) + cost;

    history[today] = log;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    window.dispatchEvent(new CustomEvent('usageUpdated', { detail: log }));
  } catch (e) {
    console.error('Failed to record image usage:', e);
  }
};
