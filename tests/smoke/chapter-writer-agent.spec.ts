import { expect, test } from '@playwright/test';

test('chapter writer agent edits, saves the original, and restores it on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const actions = [
    { action: 'plan', phase: 'propose', summary: '마지막 문장을 왜 바꿀지 살필게.' },
    { action: 'read_chapter', chapterId: 'agent-chapter' },
    { action: 'finish', message: '노크가 단순 정보로 끝나 긴장이 약해. 사건은 그대로 두고 소리의 체감만 바꾸는 게 좋아.', summary: '', proposal: {
      reason: '마지막 노크가 정보 전달에 머물러 장면의 긴장이 약하다.',
      preserve: ['세 번 노크하는 사건', '담담한 문체'],
      expectedEffect: '독자가 셔터 안쪽의 존재를 소리로 먼저 느낀다.',
      choices: [
        { id: 'a', label: '소리의 여운', direction: '노크가 어둠 속에 번지는 감각을 짧게 보강한다.', expectedEffect: '조용한 불안이 오래 남는다.' },
        { id: 'b', label: '인물의 반응', direction: '노크를 들은 한서윤의 짧은 신체 반응을 붙인다.', expectedEffect: '위험을 인물 가까이에서 느낀다.' },
      ],
    } },
    { action: 'plan', phase: 'apply', summary: '선택한 소리의 여운 방향을 반영할게.' },
    { action: 'read_chapter', chapterId: 'agent-chapter' },
    { action: 'replace_text', chapterId: 'agent-chapter', before: '안쪽에서 누군가 세 번 노크했다.', after: '어둠 속에서 세 번의 노크가 천천히 울렸다.' },
    { action: 'finish', message: '선택한 방향대로 사건은 유지하고 노크의 여운만 장면 안에 남겼어.', summary: '마지막 노크를 소리의 여운 중심으로 수정' },
  ];
  let call = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const text = JSON.stringify(actions[call++] ?? actions[actions.length - 1]);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP', index: 0 }],
        usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 20, totalTokenCount: 60 },
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByText('데이터를 불러오는 중...')).toBeHidden();
  const original = '비가 그친 새벽, 한서윤은 셔터를 올렸다. 안쪽에서 누군가 세 번 노크했다.';
  await page.evaluate(async ({ original }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = Date.now();
    const author = {
      id: 'agent-author', name: '윤슬', specialty: '현대 판타지', writingStyle: '담담한 감각 묘사',
      coreDirectives: '사건을 인물의 감각으로 보여준다.', createdAt: now, tags: ['에이전트'],
    };
    const novel = {
      id: 'agent-novel', title: '작가 에이전트 검증', subject: '약속', mood: '담담', plotSummary: '셔터 너머의 사람을 만난다.',
      aiAuthorId: author.id, generationEngine: 'gemini-3.7-flash',
      chapters: [{ id: 'agent-chapter', title: '1화', content: original, trace: { revision: 1, createdAt: now, updatedAt: now, source: 'manual' } }],
      history: [], characters: [], worldviewFiles: [], createdAt: now,
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readwrite');
      const store = transaction.objectStore('KeyValueStore');
      store.put([author], 'workspace:workspace-default:aiAuthors');
      store.put([novel], 'workspace:workspace-default:novels');
      store.put([], 'workspace:workspace-default:series');
      store.put({ geminiApiKey: 'agent-test-key' }, 'appSettings');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, { original });

  await page.reload();
  await page.getByRole('heading', { name: '작가 에이전트 검증' }).click();
  await page.getByRole('button', { name: '1화 작가와 작업' }).click();
  const dialog = page.getByRole('dialog', { name: '작가와 작업' });
  await expect(dialog.getByText('윤슬 · 1화')).toBeVisible();
  await dialog.getByLabel('작가에게 할 말').fill('마지막 노크 문장을 더 자연스럽게 고쳐줘');
  await dialog.getByRole('button', { name: '전송' }).click();
  await expect(dialog.getByText('두 방향을 준비했어요 · 선택 전이라 원고는 그대로예요.')).toBeVisible();
  await expect(dialog.getByText('왜 바꾸는가:')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'A안 소리의 여운 방향으로 현재 화 수정' })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<{ content: string; revisions: number; proposal: boolean }>((resolve, reject) => {
      const request = database.transaction('KeyValueStore').objectStore('KeyValueStore').get('workspace:workspace-default:novels');
      request.onsuccess = () => resolve({
        content: request.result[0].chapters[0].content,
        revisions: request.result[0].chapters[0].agentRevisions?.length ?? 0,
        proposal: !!request.result[0].chapters[0].agentPendingProposal,
      });
      request.onerror = () => reject(request.error);
    });
  })).toEqual({ content: original, revisions: 0, proposal: true });

  await dialog.getByRole('button', { name: 'A안 소리의 여운 방향으로 현재 화 수정' }).click();
  await expect(dialog.getByText('수정과 검토 완료 · 이유와 수정 전 원고도 보관했어요.')).toBeVisible();
  await expect(dialog.getByText('선택한 방향대로 사건은 유지하고 노크의 여운만 장면 안에 남겼어.')).toBeVisible();
  await dialog.getByRole('button', { name: /원고·작업 기록 1/ }).click();
  await dialog.getByTestId('chapter-work-revision').locator('summary').click();
  await expect(dialog.getByText(original)).toBeVisible();
  await expect(dialog.getByTestId('chapter-work-revision').getByText(/어둠 속에서 세 번의 노크가 천천히 울렸다/)).toBeVisible();

  await dialog.getByRole('button', { name: '이 작업 전으로 복원' }).click();
  const confirm = page.getByRole('dialog', { name: '수정 전 원고로 복원' });
  await confirm.getByRole('button', { name: '원고 복원' }).click();
  await expect(dialog.getByText('원고 복원 완료 · 복원 전 원고도 보관했어요.')).toBeVisible();
  await expect(dialog.getByText('작업 기록 2개')).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<{ content: string; revisions: number }>((resolve, reject) => {
      const request = database.transaction('KeyValueStore').objectStore('KeyValueStore').get('workspace:workspace-default:novels');
      request.onsuccess = () => resolve({ content: request.result[0].chapters[0].content, revisions: request.result[0].chapters[0].agentRevisions.length });
      request.onerror = () => reject(request.error);
    });
  })).toEqual({ content: original, revisions: 2 });
});
