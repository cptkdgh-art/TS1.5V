import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('dialog', async (dialog) => {
    throw new Error(`Unexpected native browser dialog: ${dialog.type()} ${dialog.message()}`);
  });
});

test('series volume IDs survive reorder, plan deletion, reload, and standalone detach', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByTestId('workspace-select')).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const makeNovel = (id: string, title: string, volumeId: string, volumeNumber: number) => ({
      id,
      title,
      subject: '장편 판타지',
      mood: '진중함',
      plotSummary: `${title} 줄거리`,
      seriesId: 'mapping-series',
      seriesVolumeId: volumeId,
      volumeNumber,
      aiAuthorId: null,
      createdAt: Date.now(),
      history: [],
      characters: [],
      chapters: [{ id: `${id}-chapter`, title: '1화', content: `${title} 원고는 보존되어야 한다.` }],
    });
    const novels = [
      makeNovel('novel-1', '첫 번째 원고', 'volume-a', 1),
      makeNovel('novel-3', '세 번째 원고', 'volume-b', 3),
    ];
    const series = {
      id: 'mapping-series',
      title: '장편 매핑 검증 시리즈',
      seriesPlotSummary: '권 순서를 자유롭게 바꾸는 장편',
      characters: [{
        id: 'shared-character', name: '공유 주인공', personality: '신중함', appearance: '', background: '', log: '',
      }],
      worldviewFiles: [{ filename: '공용 세계관', content: '모든 권이 같은 도시를 공유한다.' }],
      novelIds: novels.map((novel) => novel.id),
      createdAt: Date.now(),
      blueprint: {
        worldview: '', mainConflict: '', characterArcs: '', lastUpdated: Date.now(),
        volumes: [
          {
            id: 'volume-a', volumeNumber: 1, displayLabel: '1권', title: '첫 권 계획',
            goal: '출발', mainConflict: '첫 갈등', keyEvents: '문을 연다', status: 'drafting', linkedNovelId: 'novel-1',
          },
          {
            id: 'volume-b', volumeNumber: 3, displayLabel: '3권', title: '세 번째 권 계획',
            goal: '귀환', mainConflict: '최종 갈등', keyEvents: '돌아온다', status: 'drafting', linkedNovelId: 'novel-3',
          },
        ],
      },
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readwrite');
      const store = transaction.objectStore('KeyValueStore');
      store.put(novels, 'workspace:workspace-default:novels');
      store.put([series], 'workspace:workspace-default:series');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });
  await page.reload();

  await page.getByRole('button', { name: '청사진', exact: true }).click();
  await expect(page.getByRole('heading', { name: /시리즈 아키텍트/ })).toBeVisible();
  await page.getByText('첫 권 계획', { exact: true }).first().click();
  await page.locator('input[type="number"]').fill('3');
  await page.getByRole('button', { name: '저장', exact: true }).click();

  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = <T,>(key: string) => new Promise<T>((resolve, reject) => {
      const request = database.transaction('KeyValueStore', 'readonly').objectStore('KeyValueStore').get(key);
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
    const [novels, seriesList] = await Promise.all([
      read<Array<{ id: string; seriesVolumeId?: string; volumeNumber?: number }>>('workspace:workspace-default:novels'),
      read<Array<{ blueprint: { volumes: Array<{ id: string; volumeNumber: number }> } }>>('workspace:workspace-default:series'),
    ]);
    const novel1 = novels.find((novel) => novel.id === 'novel-1');
    const novel3 = novels.find((novel) => novel.id === 'novel-3');
    const volumes = seriesList[0].blueprint.volumes;
    return {
      volumeA: volumes.find((volume) => volume.id === 'volume-a')?.volumeNumber,
      volumeB: volumes.find((volume) => volume.id === 'volume-b')?.volumeNumber,
      novel1: [novel1?.seriesVolumeId, novel1?.volumeNumber],
      novel3: [novel3?.seriesVolumeId, novel3?.volumeNumber],
    };
  })).toEqual({
    volumeA: 3,
    volumeB: 1,
    novel1: ['volume-a', 3],
    novel3: ['volume-b', 1],
  });

  await page.reload();
  await page.getByRole('button', { name: '시리즈 장편 매핑 검증 시리즈 펼치기' }).click();
  await expect(page.getByRole('heading', { name: '[1권] 세 번째 원고' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '[3권] 첫 번째 원고' })).toBeVisible();

  await page.getByRole('button', { name: '청사진', exact: true }).click();
  await page.getByText('첫 권 계획', { exact: true }).first().click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page.getByRole('dialog', { name: '3권 삭제' }).getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByText('첫 권 계획', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '저장', exact: true }).click();

  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('KeyValueStore', 'readonly');
    const store = transaction.objectStore('KeyValueStore');
    const read = <T,>(key: string) => new Promise<T>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
    const [novels, seriesList] = await Promise.all([
      read<Array<{ id: string; seriesVolumeId?: string; volumeNumber?: number }>>('workspace:workspace-default:novels'),
      read<Array<{ blueprint: { volumes: Array<{ id: string }> } }>>('workspace:workspace-default:series'),
    ]);
    const novel = novels.find((item) => item.id === 'novel-1');
    return {
      volumeIds: seriesList[0].blueprint.volumes.map((volume) => volume.id),
      novelVolumeId: novel?.seriesVolumeId ?? null,
      novelVolumeNumber: novel?.volumeNumber ?? null,
    };
  })).toEqual({
    volumeIds: ['volume-b'],
    novelVolumeId: null,
    novelVolumeNumber: null,
  });

  await page.reload();
  const seriesToggle = page.getByRole('button', { name: /시리즈 장편 매핑 검증 시리즈 (펼치기|접기)/ });
  if (await seriesToggle.getAttribute('aria-expanded') !== 'true') await seriesToggle.click();
  await expect(page.getByRole('heading', { name: '[권 미지정] 첫 번째 원고' })).toBeVisible();
  await page.getByRole('heading', { name: '[권 미지정] 첫 번째 원고' }).click();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.getByText('이전 계획 보존 · 3권')).toBeVisible();
  await page.getByRole('button', { name: '이 작품을 시리즈에서 독립 분리' }).click();
  await page.getByRole('dialog', { name: '시리즈에서 독립 분리' })
    .getByRole('button', { name: '독립 작품으로 분리' }).click();

  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = <T,>(key: string) => new Promise<T>((resolve, reject) => {
      const request = database.transaction('KeyValueStore', 'readonly').objectStore('KeyValueStore').get(key);
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
    const [novels, seriesList] = await Promise.all([
      read<Array<{ id: string; seriesId?: string; chapters: unknown[]; characters: unknown[]; worldviewFiles?: unknown[] }>>('workspace:workspace-default:novels'),
      read<Array<{ novelIds: string[] }>>('workspace:workspace-default:series'),
    ]);
    const novel = novels.find((item) => item.id === 'novel-1');
    return {
      seriesId: novel?.seriesId ?? null,
      chapters: novel?.chapters.length,
      characters: novel?.characters.length,
      worldviewFiles: novel?.worldviewFiles?.length,
      stillInSeries: seriesList[0].novelIds.includes('novel-1'),
    };
  })).toEqual({
    seriesId: null,
    chapters: 1,
    characters: 1,
    worldviewFiles: 1,
    stillInSeries: false,
  });
});

test('series memory center shows per-volume refresh state on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('workspace-select')).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const novels = [1, 2].map((number) => ({
      id: `memory-novel-${number}`,
      title: `연대기 ${number}권`,
      subject: '', mood: '', plotSummary: '', aiAuthorId: null, createdAt: Date.now(),
      history: [], characters: [], chapters: [], seriesId: 'memory-series',
      seriesVolumeId: `memory-volume-${number}`, volumeNumber: number,
      contextSummary: {
        content: `${number}권에서 일어난 확정 사건`, summarizedChapters: 1, createdAt: Date.now(),
        entries: [{
          chapterId: `memory-chapter-${number}`, chapterNumber: 1, chapterTitle: '1화',
          summary: `${number}권에서 일어난 확정 사건`, timestamp: Date.now(),
        }],
      },
    }));
    const series = {
      id: 'memory-series', title: '연대기 상태 검증', seriesPlotSummary: '', characters: [],
      novelIds: novels.map((novel) => novel.id), createdAt: Date.now(),
      blueprint: {
        worldview: '', mainConflict: '', characterArcs: '', lastUpdated: Date.now(),
        volumes: novels.map((novel, index) => ({
          id: novel.seriesVolumeId, volumeNumber: index + 1, title: `${index + 1}권`,
          goal: '', mainConflict: '', keyEvents: '', status: 'drafting', linkedNovelId: novel.id,
        })),
      },
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readwrite');
      const store = transaction.objectStore('KeyValueStore');
      store.put(novels, 'workspace:workspace-default:novels');
      store.put([series], 'workspace:workspace-default:series');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });
  await page.reload();
  await page.getByRole('button', { name: '연대기 상태 검증 펼치기' }).click();
  await page.getByRole('button', { name: '시리즈 메뉴' }).click();
  await page.getByRole('button', { name: '기억 관리', exact: true }).click();

  await expect(page.getByRole('heading', { name: /연대기 관리실/ })).toBeVisible();
  await expect(page.getByText('최신 0권')).toBeVisible();
  await expect(page.getByText('갱신 필요 2권')).toBeVisible();
  await expect(page.getByText('삭제 정리 0권')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
