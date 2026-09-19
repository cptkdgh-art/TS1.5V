import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('legacy studio data becomes workspace 1 without deleting the recovery copy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-select')).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readwrite');
      const store = transaction.objectStore('KeyValueStore');
      store.put([{
        id: 'legacy-novel',
        title: '기존 작업 데이터',
        subject: '마이그레이션',
        mood: '안정적',
        aiAuthorId: null,
        plotSummary: '업그레이드 전 단일 작업실에서 쓰던 작품',
        chapters: [],
        history: [],
        characters: [],
        worldviewFiles: [],
        createdAt: Date.now(),
      }], 'novels');
      store.delete('workspace:workspace-default:novels');
      store.delete('studioWorkspaces');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });

  await page.reload();
  await expect(page.getByTestId('workspace-select')).toContainText('1 · 기본 작업실');
  await expect(page.getByText('기존 작업 데이터')).toBeVisible();

  const copies = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = (key: string) => new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readonly');
      const request = transaction.objectStore('KeyValueStore').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return {
      legacy: await read('novels'),
      workspace: await read('workspace:workspace-default:novels'),
    };
  });
  const legacy = copies.legacy as Array<{ title: string; generationEngine?: string }>;
  const workspace = copies.workspace as Array<{ title: string; generationEngine?: string }>;
  expect(legacy[0].title).toBe('기존 작업 데이터');
  expect(legacy[0].generationEngine).toBeUndefined();
  expect(workspace[0].title).toBe('기존 작업 데이터');
  expect(workspace[0].generationEngine).toBe('gemini-3.7-flash');
});

test('legacy localStorage cannot overwrite a non-default workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-select')).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = Date.now();
    const workspaceId = 'workspace-two';
    const workspaceNovel = [{
      id: 'workspace-two-novel', title: '두 번째 작업실 원고', subject: '', mood: '',
      aiAuthorId: null, plotSummary: '', chapters: [], history: [], characters: [], createdAt: now,
    }];
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readwrite');
      const store = transaction.objectStore('KeyValueStore');
      store.put({
        schemaVersion: 1,
        legacyDataMigrated: true,
        workspaces: [
          { id: 'workspace-default', slot: 1, name: '기본 작업실', createdAt: now, updatedAt: now },
          { id: workspaceId, slot: 2, name: '두 번째 작업실', createdAt: now, updatedAt: now },
        ],
      }, 'studioWorkspaces');
      store.put(workspaceNovel, `workspace:${workspaceId}:novels`);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    localStorage.setItem('novels', JSON.stringify([{
      id: 'legacy-local-novel', title: '덮어쓰면 안 되는 구버전 원고', subject: '', mood: '',
      aiAuthorId: null, plotSummary: '', chapters: [], history: [], characters: [], createdAt: now,
    }]));
  });

  await page.goto('/?workspace=workspace-two');

  await expect(page.getByText('두 번째 작업실 원고')).toBeVisible();
  await expect(page.getByText('덮어쓰면 안 되는 구버전 원고')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('novels'))).not.toBeNull();
});

test('a new named workspace opens separately and stays isolated', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-select')).toHaveValue('workspace-default');
  await expect(page.getByText('첫 작품을 시작해보세요')).toBeVisible();

  await page.getByRole('button', { name: '새 작품 만들기' }).click();
  await page.getByLabel('주 장르').selectOption('현대판타지');
  await page.getByPlaceholder('추가 분위기 설명 (예: 따뜻하지만 사건 장면은 서늘하게)').fill('경쾌함');
  await page.getByPlaceholder('작품 제목').fill('첫 작업실 전용 작품');
  await page.getByPlaceholder(/소설의 핵심 뼈대/).fill('첫 작업실에만 남아야 하는 테스트 작품이다.');
  await page.getByRole('button', { name: '소설 시작' }).click();
  await expect(page.getByText('첫 작업실 전용 작품')).toBeVisible();

  await page.getByTestId('workspace-create-button').click();
  await page.getByTestId('workspace-name-input').fill('판타지 작업실');

  const popupPromise = page.waitForEvent('popup');
  await page.getByTestId('workspace-submit-button').click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');

  await expect(popup).toHaveURL(/\?workspace=/);
  await expect(popup.getByTestId('workspace-select')).toContainText('2 · 판타지 작업실');
  await expect(popup.getByText('첫 작품을 시작해보세요')).toBeVisible();
  await expect(popup.getByText('첫 작업실 전용 작품')).toHaveCount(0);

  await popup.getByRole('button', { name: '현재 작업실 이름 변경' }).click();
  await popup.getByTestId('workspace-name-input').fill('판타지 장편');
  await popup.getByTestId('workspace-submit-button').click();
  await expect(popup.getByTestId('workspace-select')).toContainText('2 · 판타지 장편');

  await popup.reload();
  await expect(popup.getByTestId('workspace-select')).toContainText('2 · 판타지 장편');
  await expect(popup.getByText('첫 작품을 시작해보세요')).toBeVisible();

  await page.bringToFront();
  await page.getByTestId('workspace-backup-button').click();
  const backupDialog = page.getByRole('dialog', { name: '작업실 백업 관리' });
  await expect(backupDialog).toBeVisible();
  await page.getByTestId('backup-export-scope').selectOption('all');
  await expect(page.getByTestId('backup-import-target')).toContainText('1 · 기본 작업실에 덮어쓰기');
  await expect(page.getByTestId('backup-import-target')).toContainText('2 · 판타지 장편에 덮어쓰기');
  await expect(page.getByTestId('backup-import-target')).toContainText('+ 새 작업실로 추가');

  const downloadPromise = page.waitForEvent('download');
  await backupDialog.getByRole('button', { name: '내보내기', exact: true }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const backup = JSON.parse(await readFile(downloadPath!, 'utf8')) as {
    kind: string;
    workspaces: Array<{ workspace: { name: string } }>;
  };
  expect(backup.kind).toBe('jinpok-all-workspaces');
  expect(backup.workspaces.map((item) => item.workspace.name))
    .toEqual(['기본 작업실', '판타지 장편']);

  await backupDialog.locator('input[type="file"]').setInputFiles(downloadPath!);
  const importDialog = page.getByRole('dialog', { name: '모든 작업실 가져오기' });
  await expect(importDialog.getByText('현재 작업실들은 덮어쓰거나 지우지 않습니다.')).toBeVisible();
  await importDialog.getByRole('button', { name: '새 작업실들로 추가' }).click();
  await expect(page.getByTestId('workspace-select')).toContainText('3 · 기본 작업실');
  await expect(page.getByTestId('workspace-select')).toContainText('4 · 판타지 장편');

  const restoredWorkspaceId = await page.getByTestId('workspace-select')
    .locator('option', { hasText: '3 · 기본 작업실' })
    .getAttribute('value');
  await page.getByTestId('workspace-select').selectOption(restoredWorkspaceId!);
  await expect(page.getByText('첫 작업실 전용 작품')).toBeVisible();
});

test('a non-default workspace can be permanently deleted on mobile', async ({ page }) => {
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
          { id: 'workspace-default', slot: 1, name: '기본 작업실', createdAt: now, updatedAt: now },
          { id: 'workspace-delete', slot: 2, name: '임시 기획실', createdAt: now, updatedAt: now },
        ],
      }, 'studioWorkspaces');
      store.put([{
        id: 'default-novel', title: '보존할 작품', subject: '', mood: '', aiAuthorId: null,
        plotSummary: '', chapters: [], history: [], characters: [], createdAt: now,
      }], 'workspace:workspace-default:novels');
      store.put([{
        id: 'delete-novel', title: '삭제될 작품', subject: '', mood: '', aiAuthorId: null,
        plotSummary: '', chapters: [], history: [], characters: [], createdAt: now,
      }], 'workspace:workspace-delete:novels');
      store.put({ cached: true }, 'workspace:workspace-delete:futureCache');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });

  await page.goto('/?workspace=workspace-delete');
  await expect(page.getByText('삭제될 작품')).toBeVisible();
  await page.getByTestId('workspace-delete-button').click();
  const dialog = page.getByRole('dialog', { name: '작업실 삭제' });
  await expect(dialog).toContainText('소설, 작가, 시리즈, 캐시와 대화 자료가 모두 삭제됩니다.');
  await expect(page.getByTestId('workspace-delete-confirm-button')).toBeDisabled();
  await page.getByTestId('workspace-delete-confirmation').fill('임시 기획실');

  await Promise.all([
    page.waitForURL(/workspace=workspace-default/),
    page.getByTestId('workspace-delete-confirm-button').click(),
  ]);
  await expect(page.getByText('보존할 작품')).toBeVisible();
  await expect(page.getByTestId('workspace-select')).not.toContainText('임시 기획실');
  await expect(page.getByTestId('workspace-delete-button')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const stored = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<{ keys: IDBValidKey[]; workspaceIds: string[] }>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readonly');
      const store = transaction.objectStore('KeyValueStore');
      const keysRequest = store.getAllKeys();
      const registryRequest = store.get('studioWorkspaces');
      transaction.oncomplete = () => resolve({
        keys: keysRequest.result,
        workspaceIds: (registryRequest.result as { workspaces: Array<{ id: string }> }).workspaces
          .map((workspace) => workspace.id),
      });
      transaction.onerror = () => reject(transaction.error);
    });
  });
  expect(stored.workspaceIds).toEqual(['workspace-default']);
  expect(stored.keys.some((key) => String(key).startsWith('workspace:workspace-delete:'))).toBe(false);
});
