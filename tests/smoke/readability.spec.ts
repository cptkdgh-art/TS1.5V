import { expect, test } from '@playwright/test';

test.use({
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
  userAgent: 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36',
  viewport: { width: 390, height: 844 },
});

const seriesTitle = '프라이빗 재단 통합 세계관 장기 시리즈';
const novelTitle = '제1권 프라이빗 센터 신규 직원 교육과 첫 번째 장기 고객 관리 기록';
const chapterTitle = '제1부 1화 처음 출근한 날 비공개 상담실에서 마주친 예상하지 못한 장기 고객과의 첫 상담';
const unbrokenImportedText = `외부 패키지 원고 폭 검사 ${'긴문자열'.repeat(180)}`;

test('imported series manuscripts keep the normal mobile viewport and cannot widen the page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-select')).toBeVisible();

  await page.evaluate(async ({ seriesTitle, novelTitle, chapterTitle, unbrokenImportedText }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const novel = {
      id: 'readability-novel',
      title: novelTitle,
      subject: '외부 제작 패키지에서 가져온 장편 시리즈',
      mood: '차분함',
      plotSummary: '외부에서 작성된 긴 작품명과 회차명을 실제 시리즈처럼 가져온다.',
      seriesId: 'readability-series',
      volumeNumber: 1,
      aiAuthorId: null,
      createdAt: Date.now(),
      history: [],
      characters: [],
      chapters: [{
        id: 'readability-chapter',
        title: chapterTitle,
        content: `일반 문단은 첫 번째 화면과 같은 크기로 표시되어야 한다.\n\n${unbrokenImportedText}`,
      }],
    };
    const series = {
      id: 'readability-series',
      title: seriesTitle,
      seriesPlotSummary: '여러 권으로 이어지는 외부 제작 시리즈',
      novelIds: [novel.id],
      characters: [],
      worldviewFiles: [],
      createdAt: Date.now(),
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readwrite');
      const store = transaction.objectStore('KeyValueStore');
      store.put([novel], 'workspace:workspace-default:novels');
      store.put([series], 'workspace:workspace-default:series');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }, { seriesTitle, novelTitle, chapterTitle, unbrokenImportedText });

  await page.reload();
  const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewportMeta).toContain('width=device-width');
  expect(viewportMeta).toContain('minimum-scale=1.0');
  expect(viewportMeta).toContain('maximum-scale=5.0');
  expect(viewportMeta).toContain('user-scalable=yes');

  await page.getByRole('button', { name: `시리즈 ${seriesTitle} 펼치기` }).click();
  await page.getByRole('heading', { name: `[1권] ${novelTitle}` }).click();
  await expect(page.getByRole('heading', { name: 'AI 작가 제어 패널' })).toBeVisible();

  const chapterHeading = page.getByRole('heading', { name: chapterTitle });
  const manuscript = page.locator('.chapter-content').filter({ hasText: '외부 패키지 원고 폭 검사' });
  await expect(chapterHeading).toBeVisible();
  await expect(manuscript).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    rootWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    scale: window.visualViewport?.scale ?? 1,
  }))).toEqual({ viewportWidth: 390, rootWidth: 390, bodyWidth: 390, scale: 1 });
  await expect.poll(() => manuscript.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect.poll(() => manuscript.evaluate((element) => element.clientWidth)).toBeGreaterThanOrEqual(330);

  await page.getByRole('button', { name: '독서 모드 열기' }).click();
  const readingManuscript = page.locator('.jinpok-manuscript-text').filter({ hasText: '외부 패키지 원고 폭 검사' }).last();
  await expect(readingManuscript).toBeVisible();
  await expect.poll(() => readingManuscript.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect.poll(() => readingManuscript.evaluate((element) => element.clientWidth)).toBeGreaterThanOrEqual(350);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
