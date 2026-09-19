import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('a production package imports only the checked layers into a new workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-select')).toBeVisible();

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const author = {
      id: 'package-author', name: '패키지 작가', specialty: '판타지', writingStyle: '간결함',
      coreDirectives: '빠른 전개', createdAt: Date.now(), tags: ['외주'],
    };
    const novel = {
      id: 'package-novel', title: '패키지 원본 작품', subject: '기억', mood: '긴장',
      plotSummary: '기억을 되찾는 이야기', aiAuthorId: author.id, createdAt: Date.now(),
      chapters: [{ id: 'package-chapter', title: '1화', content: '패키지 원고 본문' }],
      history: [],
      characters: [{
        id: 'package-character', name: '윤', personality: '냉정', appearance: '검은 머리',
        background: '기억상', log: '',
      }],
      worldviewFiles: [{ filename: '도시.txt', content: '기억이 화폐다.' }],
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readwrite');
      const store = transaction.objectStore('KeyValueStore');
      store.put([author], 'workspace:workspace-default:aiAuthors');
      store.put([novel], 'workspace:workspace-default:novels');
      store.put([], 'workspace:workspace-default:series');
      store.put({ geminiApiKey: 'must-never-leave-browser' }, 'appSettings');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });
  await page.reload();
  await expect(page.getByText('패키지 원본 작품')).toBeVisible();

  await page.getByTestId('production-package-button').click();
  const center = page.getByRole('dialog', { name: '제작 패키지 센터' });
  await expect(center).toBeVisible();
  await center.getByTestId('package-export-target').selectOption('novel:package-novel');
  await center.getByRole('button', { name: '원고 납품' }).click();

  const downloadPromise = page.waitForEvent('download');
  await center.getByTestId('package-export-button').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const packageText = await readFile(downloadPath!, 'utf8');
  const packageJson = JSON.parse(packageText) as { kind: string; payload: { novels: Array<{ chapters: unknown[] }> } };
  expect(packageJson.kind).toBe('jinpok-production-package');
  expect(packageJson.payload.novels[0].chapters).toHaveLength(1);
  expect(packageText).not.toContain('must-never-leave-browser');

  await center.getByRole('button', { name: '패키지 가져오기' }).click();
  await center.locator('input[type="file"]').setInputFiles(downloadPath!);
  await expect(center.getByText('패키지 원본 작품 제작 패키지')).toBeVisible();
  await center.locator('label').filter({ hasText: '원고저장된 챕터 본문' }).locator('input').uncheck();
  await center.getByTestId('package-import-button').click();
  await expect(center).toBeHidden();

  const imported = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = <T,>(key: string) => new Promise<T | undefined>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readonly');
      const request = transaction.objectStore('KeyValueStore').get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
    const registry = await read<{ workspaces: Array<{ id: string; slot: number }> }>('studioWorkspaces');
    const target = registry!.workspaces.reduce((latest, item) => item.slot > latest.slot ? item : latest);
    return {
      novels: await read<Array<{ id: string; aiAuthorId: string; chapters: unknown[]; characters: unknown[] }>>(`workspace:${target.id}:novels`),
      authors: await read<Array<{ id: string }>>(`workspace:${target.id}:aiAuthors`),
      receipts: await read<unknown[]>(`workspace:${target.id}:productionPackageReceipts`),
    };
  });

  expect(imported.novels).toHaveLength(1);
  expect(imported.novels![0].chapters).toEqual([]);
  expect(imported.novels![0].characters).toHaveLength(1);
  expect(imported.authors).toHaveLength(1);
  expect(imported.novels![0].aiAuthorId).toBe(imported.authors![0].id);
  expect(imported.receipts).toHaveLength(1);
});

test('the production package center fits a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByTestId('production-package-button').click();
  const center = page.getByRole('dialog', { name: '제작 패키지 센터' });
  await expect(center).toBeVisible();
  await expect(center.getByRole('button', { name: '패키지 보내기' })).toBeVisible();
  await expect(center.getByRole('button', { name: 'JSON 만들기' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
