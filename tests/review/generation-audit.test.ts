import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Novel } from '@core/types';

const mock = vi.hoisted(() => ({
  request: vi.fn(),
  cache: vi.fn(),
  controller: new AbortController(),
  usage: vi.fn(),
  memory: vi.fn(),
}));

vi.mock('@services/ai/config', async (importOriginal) => ({
  ...await importOriginal<typeof import('@services/ai/config')>(),
  ai: { models: { generateContentStream: mock.request } },
  createAbortSignal: () => mock.controller.signal,
  clearAbortController: vi.fn(),
}));
vi.mock('@services/ai/caching', () => ({ manageContextCache: mock.cache }));
vi.mock('@services/ai/prompts', () => ({
  buildWriterStableInstruction: () => 'AUTHOR_INSTRUCTION',
  buildWriterDynamicInstruction: () => 'CURRENT_CHAPTER_DIRECTION',
}));
vi.mock('@services/ai/writingContext', () => ({
  resolveStoryMemory: mock.memory,
}));
vi.mock('@services/ai/briefing', () => ({ injectUnifiedBriefing: () => '' }));
vi.mock('@services/costEstimator', () => ({ recordAiUsage: mock.usage }));

import { continueNovelStream } from '@services/ai/generation';

const novel = {
  id: 'audit-novel', title: 'Audit', subject: '', mood: '', plotSummary: '',
  chapters: [
    { id: 'past', title: 'Past', content: 'PAST_RAW_SENTINEL' },
    { id: 'recent', title: 'Recent', content: 'RECENT_RAW_SENTINEL' },
  ],
  history: [], characters: [], aiAuthorId: null, createdAt: 1,
  generationEngine: 'gemini-3.7-flash',
} as Novel;

async function* successfulStream() {
  yield { text: 'Generated manuscript '.repeat(10), candidates: [{ finishReason: 'STOP' }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.controller = new AbortController();
  mock.memory.mockReturnValue({
    status: 'valid', summary: 'PAST_SUMMARY_SENTINEL',
    coveredChapterCount: 1, fullTextChapters: 1, rawChapterStartIndex: 1,
  });
  mock.cache.mockResolvedValue({
    cachedContentName: 'caches/test', cacheMode: 'summary', activeBufferStartIndex: 1,
  });
  mock.request.mockResolvedValue(successfulStream());
});

describe('Review regressions: generation transport and context', () => {
  it('retains partial manuscript without restarting after a retryable stream failure', async () => {
    mock.request.mockResolvedValueOnce((async function* () {
      yield { text: 'PARTIAL_MANUSCRIPT '.repeat(10) };
      throw new Error('503 cache unavailable');
    })());
    const events = [];
    for await (const event of continueNovelStream('audit', 'Continue', [], null, novel, null, 2)) events.push(event);
    expect(mock.request).toHaveBeenCalledTimes(1);
    expect(events.at(-1)?.willRetry).toBe(false);
    expect(events.at(-1)?.log?.content).toContain('PARTIAL_MANUSCRIPT');
  });

  it('cancels while waiting for the first token and returns a cancellation log', async () => {
    mock.request.mockImplementationOnce(({ config }) => new Promise((_resolve, reject) => {
      config.abortSignal.addEventListener('abort', () => reject(config.abortSignal.reason), { once: true });
      mock.controller.abort();
    }));
    const events = [];
    for await (const event of continueNovelStream('audit', 'Continue', [], null, novel, null, 0)) events.push(event);
    expect(events.at(-1)?.cancelled).toBe(true);
    expect(events.at(-1)?.log?.status).toBe('error');
    expect(mock.request).toHaveBeenCalledTimes(1);
  });

  it('preserves the streamed text when cancellation occurs between chunks', async () => {
    mock.request.mockResolvedValueOnce((async function* () {
      yield { text: 'CANCELLED_DRAFT '.repeat(10) };
      mock.controller.abort();
      yield { text: 'MUST_NOT_APPEND' };
    })());
    const events = [];
    for await (const event of continueNovelStream('audit', 'Continue', [], null, novel, null, 0)) events.push(event);
    expect(events.at(-1)?.cancelled).toBe(true);
    expect(events.at(-1)?.log?.content).toContain('CANCELLED_DRAFT');
    expect(events.at(-1)?.log?.content).not.toContain('MUST_NOT_APPEND');
  });
  it('keeps every uncached recent chapter for Pro raw-cache requests', async () => {
    const proNovel = {
      ...novel, generationEngine: 'gemini-2.5-pro' as const,
      chapters: Array.from({ length: 30 }, (_, i) => ({
        id: `chapter-${i + 1}`, title: `Chapter ${i + 1}`, content: `RAW_SENTINEL_${i + 1}`,
      })),
    };
    mock.memory.mockReturnValue({
      status: 'missing', coveredChapterCount: 0, fullTextChapters: 5, rawChapterStartIndex: 0,
    });
    mock.cache.mockResolvedValue({
      cachedContentName: 'caches/raw-1-to-25', cacheMode: 'raw', activeBufferStartIndex: 25,
    });
    for await (const event of continueNovelStream('audit', 'Continue', [], null, proNovel, null, 0)) void event;
    expect(mock.request).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mock.request.mock.calls[0][0].contents)).toContain('RAW_SENTINEL_26');
  });

  it('does not shrink the recent raw baseline for an uncached Pro request', async () => {
    const proNovel = {
      ...novel, generationEngine: 'gemini-2.5-pro' as const,
      chapters: Array.from({ length: 5 }, (_, i) => ({
        id: `chapter-${i + 1}`, title: `Chapter ${i + 1}`, content: `RAW_SENTINEL_${i + 1}`,
      })),
    };
    mock.memory.mockReturnValue({
      status: 'missing', coveredChapterCount: 0, fullTextChapters: 3, rawChapterStartIndex: 2,
    });
    mock.cache.mockResolvedValue({ cacheMode: 'none', activeBufferStartIndex: 0 });

    for await (const event of continueNovelStream('audit', 'Continue', [], null, proNovel, null, 0)) void event;

    const contents = JSON.stringify(mock.request.mock.calls[0][0].contents);
    expect(contents).not.toContain('RAW_SENTINEL_2');
    expect(contents).toContain('RAW_SENTINEL_3');
    expect(contents).toContain('RAW_SENTINEL_4');
    expect(contents).toContain('RAW_SENTINEL_5');
  });

  it('restores cached past memory when retrying a missing cache', async () => {
    mock.request.mockRejectedValueOnce(new Error('404 cache not found'));
    const events = [];
    for await (const event of continueNovelStream('audit', 'Continue', [], null, novel, null, 0)) events.push(event);

    expect(events.at(-1)?.log?.status).toBe('success');
    expect(mock.request).toHaveBeenCalledTimes(2);
    const retry = mock.request.mock.calls[1][0];
    expect(retry.config.systemInstruction).toBe('AUTHOR_INSTRUCTION');
    expect(JSON.stringify(retry.contents)).toContain('PAST_SUMMARY_SENTINEL');
  });

  it('passes the cancellation signal to the Gemini transport', async () => {
    for await (const event of continueNovelStream('audit', 'Continue', [], null, novel, null, 0)) void event;
    const request = mock.request.mock.calls[0][0];
    expect(request.config.abortSignal).toBe(mock.controller.signal);
  });

  it('records prompt-level policy blocks instead of reporting an unexplained empty success', async () => {
    mock.cache.mockResolvedValue({ cacheMode: 'none' });
    mock.request.mockResolvedValueOnce((async function* () {
      yield {
        promptFeedback: {
          blockReason: 'PROHIBITED_CONTENT',
          safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'HIGH', blocked: true }],
        },
      };
    })());

    const events = [];
    for await (const event of continueNovelStream('audit', 'Continue', [], null, novel, null, 0)) events.push(event);
    const final = events.at(-1);

    expect(final?.log?.status).toBe('error');
    expect(final?.log?.error).toContain('PROHIBITED_CONTENT');
    expect(final?.log?.termination?.promptBlockReason).toBe('PROHIBITED_CONTENT');
    expect(final?.willRetry).toBe(false);
  });

  it('keeps the second safety reason when an uncached retry is blocked too', async () => {
    const blocked = () => (async function* () {
      yield { candidates: [{ finishReason: 'SAFETY', safetyRatings: [{ category: 'HARM_CATEGORY_HARASSMENT', probability: 'HIGH', blocked: true }] }] };
    })();
    mock.request.mockResolvedValueOnce(blocked()).mockResolvedValueOnce(blocked());

    const events = [];
    for await (const event of continueNovelStream('audit', 'Continue', [], null, novel, null, 0)) events.push(event);
    const final = events.at(-1);

    expect(mock.request).toHaveBeenCalledTimes(2);
    expect(final?.log?.status).toBe('error');
    expect(final?.log?.termination?.finishReason).toBe('SAFETY');
    expect(final?.willRetry).toBe(false);
  });
});
