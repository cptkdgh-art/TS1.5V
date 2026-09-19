import { expect, test } from '@playwright/test';

test('a work can select an author copied from another workspace on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('workspace-select')).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = Date.now();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readwrite');
      const store = transaction.objectStore('KeyValueStore');
      store.put({
        schemaVersion: 1,
        legacyDataMigrated: true,
        workspaces: [
          { id: 'workspace-default', slot: 1, name: '현재 작업실', createdAt: now, updatedAt: now },
          { id: 'workspace-source', slot: 2, name: '판타지 작가실', createdAt: now, updatedAt: now },
        ],
      }, 'studioWorkspaces');
      store.put([], 'workspace:workspace-default:aiAuthors');
      store.put([{
        id: 'source-author',
        name: '윤슬',
        specialty: '현대 판타지',
        writingStyle: '짧고 선명한 문장',
        coreDirectives: '생활 디테일을 놓치지 않는다.',
        createdAt: now - 1000,
        memoryCache: ['인물의 선택을 먼저 본다.'],
        generalChatHistory: [{ role: 'user', parts: [{ text: '이전 작품 대화' }] }],
      }], 'workspace:workspace-source:aiAuthors');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });

  await page.goto('/?workspace=workspace-default');
  await page.getByRole('button', { name: '새 작품', exact: true }).click();
  await page.getByTestId('create-work-author-import').click();
  const importer = page.getByRole('dialog', { name: '다른 작업실 작가 불러오기' });
  await expect(importer.getByTestId('author-source-workspace')).toHaveValue('workspace-source');
  await expect(importer.getByText('윤슬', { exact: true })).toBeVisible();
  await importer.getByText('윤슬', { exact: true }).click();
  await importer.getByTestId('workspace-author-import-confirm').click();

  const authorSelect = page.locator('#create-work-author');
  await expect(authorSelect.locator('option:checked')).toHaveText('윤슬');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const stored = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = <T,>(key: string) => new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readonly');
      const request = transaction.objectStore('KeyValueStore').get(key);
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
    return {
      current: await read<Array<{
        id: string;
        name: string;
        isDefault?: boolean;
        memoryCache?: string[];
        generalChatHistory?: unknown[];
      }>>('workspace:workspace-default:aiAuthors'),
      source: await read<Array<{ id: string; name: string }>>('workspace:workspace-source:aiAuthors'),
    };
  });
  const copied = stored.current.find((author) => author.name === '윤슬');
  expect(copied?.id).not.toBe('source-author');
  expect(copied?.isDefault).toBe(false);
  expect(copied?.memoryCache).toEqual(['인물의 선택을 먼저 본다.']);
  expect(copied?.generalChatHistory).toBeUndefined();
  expect(stored.source).toEqual([expect.objectContaining({ id: 'source-author', name: '윤슬' })]);
});
