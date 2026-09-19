import { expect, test } from '@playwright/test';

test('completed generation keeps the viewport instead of scrolling again', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & { __jinpokScrollTargets?: string[] };
    state.__jinpokScrollTargets = [];
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(options?: boolean | ScrollIntoViewOptions) {
      state.__jinpokScrollTargets?.push((this as HTMLElement).textContent?.slice(0, 30) || this.tagName);
      return originalScrollIntoView.call(this, options);
    };
  });

  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const payload = {
      candidates: [{
        content: {
          role: 'model',
          parts: [{ text: '테스트 집필 본문입니다. 완료 뒤 화면은 현재 위치를 유지해야 합니다.' }],
        },
        finishReason: 'STOP',
        index: 0,
      }],
      usageMetadata: {
        promptTokenCount: 120,
        candidatesTokenCount: 24,
        totalTokenCount: 144,
      },
    };
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `data: ${JSON.stringify(payload)}\n\n`,
    });
  });

  await page.goto('/');
  await expect(page.getByText('데이터를 불러오는 중...')).toBeHidden();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const author = {
      id: 'scroll-test-author',
      name: '스크롤 테스트 작가',
      specialty: '회귀 검증',
      writingStyle: '간결한 문장',
      coreDirectives: '테스트 본문을 작성한다.',
      createdAt: Date.now(),
      tags: ['테스트'],
    };
    const novel = {
      id: 'scroll-test-novel',
      title: '완료 위치 유지 테스트',
      subject: '화면 위치',
      mood: '차분함',
      plotSummary: '집필 완료 뒤 읽던 위치를 유지한다.',
      aiAuthorId: author.id,
      generationEngine: 'gemini-3.7-flash',
      chapterGenerationMode: 'single',
      chapterTargetCharacters: 3000,
      chapters: [],
      history: [],
      characters: [],
      worldviewFiles: [],
      createdAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readwrite');
      const store = transaction.objectStore('KeyValueStore');
      store.put([author], 'workspace:workspace-default:aiAuthors');
      store.put([novel], 'workspace:workspace-default:novels');
      store.put([], 'workspace:workspace-default:series');
      store.put({ geminiApiKey: 'scroll-test-key' }, 'appSettings');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });

  await page.reload();
  await page.getByRole('heading', { name: '완료 위치 유지 테스트' }).click();
  await expect(page.getByRole('heading', { name: 'AI 작가 제어 패널' })).toBeVisible();
  await page.evaluate(() => {
    (window as Window & { __jinpokScrollTargets?: string[] }).__jinpokScrollTargets = [];
  });

  await page.getByRole('button', { name: '자연스럽게 1화 쓰기' }).click();
  await expect(page.getByText('테스트 집필 본문입니다. 완료 뒤 화면은 현재 위치를 유지해야 합니다.')).toBeVisible();
  await expect(page.getByText('집필을 완료했습니다.')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __jinpokScrollTargets?: string[] }).__jinpokScrollTargets?.length || 0
  ))).toBe(1);
  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const novels = await new Promise<Array<{ generationLogs?: Array<Record<string, unknown>> }>>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readonly');
      const request = transaction.objectStore('KeyValueStore').get('workspace:workspace-default:novels');
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    const log = novels[0]?.generationLogs?.at(-1) as {
      model?: string;
      timing?: { firstTokenMs?: number; totalMs?: number; cacheStatus?: string };
    } | undefined;
    return {
      model: log?.model,
      hasFirstToken: typeof log?.timing?.firstTokenMs === 'number',
      hasTotal: typeof log?.timing?.totalMs === 'number',
      cacheStatus: log?.timing?.cacheStatus,
    };
  })).toEqual({
    model: 'gemini-3.7-flash',
    hasFirstToken: true,
    hasTotal: true,
    cacheStatus: 'skipped',
  });

  await page.getByRole('button', { name: '분석', exact: true }).click();
  await expect(page.getByText('모델별 지연 비교')).toBeVisible();
  await expect(page.getByText('첫 글자 평균')).toBeVisible();
  await page.getByText(/by 스크롤 테스트 작가/).click();
  await expect(page.getByText(/시도 1\/3: 성공 · gemini-3\.7-flash/)).toBeVisible();
  await expect(page.getByText(/^첫 글자 \d/)).toBeVisible();
  await expect(page.getByText(/캐시 .*캐시 조건 미충족/)).toBeVisible();
});
