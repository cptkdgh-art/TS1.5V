import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationLog, Novel } from '@core/types';

const mock = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  useState: (value: unknown) => [value, vi.fn()],
}));
vi.mock('@shared/components', () => ({
  toast: { info: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));
vi.mock('@services/ai', () => ({
  continueNovelStream: mock.stream,
  convertMemoToForeshadowings: () => ({ newItems: [], updatedIds: [] }),
  computeChapterSignature: (chapters: unknown) => JSON.stringify(chapters),
  generateChapterId: () => 'new-chapter',
  getCurrentApiInfo: () => ({ provider: 'gemini', model: 'gemini-3.7-flash' }),
  isApiKeyConfigured: () => true,
}));

import { useChapterGeneration } from '@modules/editor/hooks/useChapterGeneration';

const log = (status: 'success' | 'error', model: string, attemptNumber: number, content: string): GenerationLog => ({
  id: `attempt-${attemptNumber}`, sessionId: 'audit', timestamp: 1,
  status, model, attemptNumber, maxAttempts: 3, prompt: 'Continue', content,
  authorName: 'Audit', error: status === 'error' ? '503 busy' : undefined,
  timing: { preparationMs: 0, cachePreparationMs: 0, totalMs: 1000, cacheMode: 'none', cacheStatus: 'disabled' },
});

async function runHook() {
  let current = {
    id: 'audit', title: 'Audit', subject: '', mood: '', plotSummary: '',
    chapters: [], history: [], characters: [], aiAuthorId: null, createdAt: 1,
    chapterGenerationMode: 'single', generationEngine: 'gemini-3.7-flash',
  } as Novel;
  const hook = useChapterGeneration({
    novel: current, series: null, authors: [], onGenerationSaved: vi.fn(),
    onMutateNovel: async (_id, updater) => { current = updater(current); return current; },
  });
  await hook.continueChapter('natural');
  return current;
}

beforeEach(() => vi.clearAllMocks());

describe('Review regressions: attempt persistence', () => {
  it('preserves an explicit cancellation draft longer than fifty characters', async () => {
    const content = 'Partial manuscript '.repeat(10);
    mock.stream.mockImplementation(async function* () {
      yield { streamingText: content };
      yield { cancelled: true };
    });
    const novel = await runHook();
    expect(novel.chapters[0].content).toBe(content.trim());
    expect(novel.pendingChapterGeneration?.draftChapterId).toBe(novel.chapters[0].id);
  });

  it('retains the failed model attempt before a successful fallback', async () => {
    mock.stream.mockImplementation(async function* () {
      yield { log: log('error', 'gemini-3.7-flash', 1, ''), willRetry: true, retryModel: 'gemini-3.8-flash' };
      yield { log: log('success', 'gemini-3.8-flash', 2, 'Complete manuscript '.repeat(10)) };
    });
    const novel = await runHook();
    expect(novel.chapters).toHaveLength(1);
    expect(novel.generationLogs?.map((item) => item.model)).toEqual(['gemini-3.7-flash', 'gemini-3.8-flash']);
  });

  it('retains a terminal failure even when the model produced no manuscript', async () => {
    mock.stream.mockImplementation(async function* () {
      yield { log: log('error', 'gemini-3.7-flash', 1, ''), willRetry: false };
    });
    const novel = await runHook();
    expect(novel.pendingChapterGeneration?.status).toBe('paused');
    expect(novel.generationLogs).toHaveLength(1);
  });
});
