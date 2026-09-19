import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('dialog', async (dialog) => {
    throw new Error(`Unexpected native browser dialog: ${dialog.type()} ${dialog.message()}`);
  });
});

async function openCharacterChat(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '캐릭터챗' }).click();
  await expect(page.getByRole('heading', { name: '캐릭터챗' })).toBeVisible();
}

async function createManualPersona(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /캐릭터 가져오기|첫 캐릭터 가져오기/ }).first().click();
  await page.getByRole('tab', { name: '직접 만들기' }).click();
  await page.getByLabel('캐릭터 이름').fill('윤서');
  await page.getByRole('button', { name: '페르소나 만들기' }).click();
  await expect(page.getByRole('heading', { name: '페르소나 작업실' })).toBeVisible();
  await page.getByRole('textbox', { name: '성격', exact: true }).fill('신중하지만 친해지면 장난기가 있다.');
  await page.getByRole('textbox', { name: '말투', exact: true }).fill('짧고 차분하게 말한다.');
  await page.getByRole('textbox', { name: '첫 인사', exact: true }).fill('[표정:다정]\n*창가에서 몸을 돌린다.*\n“왔어? 기다리고 있었어.”');
}

async function startWithUserRole(
  page: import('@playwright/test').Page,
  role?: { name: string; role: string }
) {
  const setup = page.getByRole('dialog', { name: /와 만날 내 역할/ });
  await expect(setup).toBeVisible();
  if (role) {
    await setup.getByRole('button', { name: '새 역할' }).click();
    await setup.getByLabel('이름 또는 호칭').fill(role.name);
    await setup.getByLabel('세계관 속 역할').fill(role.role);
  }
  await setup.getByRole('button', { name: '이 역할로 시작' }).click();
  await expect(setup).toBeHidden();
}

async function putIndexedDbValue(page: import('@playwright/test').Page, key: string, value: unknown) {
  await page.evaluate(async ({ storageKey, storageValue }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('KeyValueStore')) {
          request.result.createObjectStore('KeyValueStore');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('KeyValueStore', 'readwrite');
      transaction.objectStore('KeyValueStore').put(storageValue, storageKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, { storageKey: key, storageValue: value });
}

test('manual character supports persistent chat, pin, branch, chat copy, and character copy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCharacterChat(page);
  await createManualPersona(page);

  await page.getByRole('button', { name: '저장하고 대화 시작' }).click();
  await startWithUserRole(page, { name: '카일', role: '왕실 기록관' });
  await expect(page.getByRole('heading', { name: '윤서', exact: true })).toBeVisible();
  const status = page.getByLabel('캐릭터 상태창');
  await expect(status.getByText('경계 중')).toBeVisible();
  await expect(status.getByText('호감도')).toBeVisible();
  await expect(status.getByText('다정', { exact: true })).toBeVisible();
  await expect(page.getByText('창가에서 몸을 돌린다.')).toBeVisible();
  await expect(page.getByText('왔어? 기다리고 있었어.')).toBeVisible();
  await expect(page.getByTitle('응답 재생성')).toHaveCount(0);

  await page.getByRole('button', { name: '표정 살피기' }).click();
  await expect(page.getByLabel('윤서에게 메시지')).toHaveValue('*상대의 표정을 가만히 살핀다.*');
  await page.getByLabel('윤서에게 메시지').fill('');

  await page.getByTitle('중요 기억으로 고정').click();
  await expect(page.getByTitle('고정 해제')).toBeVisible();

  await page.getByTitle('이 지점에서 대화 분기').click();
  await expect(page.getByLabel('대화 기록').locator('option')).toHaveCount(2);
  await page.getByTitle('대화 복제').click();
  await expect(page.getByLabel('대화 기록').locator('option')).toHaveCount(3);

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByTitle('캐릭터챗 홈').click();
  await page.getByTitle('캐릭터 복제').click();
  await expect(page.getByRole('heading', { name: '윤서 복사본' })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: '캐릭터챗' }).click();
  await expect(page.getByRole('heading', { name: '윤서', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '윤서 복사본', exact: true })).toBeVisible();
});

test('novel import respects selected chapter progress and creates an editable standalone persona', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-select')).toBeVisible();
  await putIndexedDbValue(page, 'workspace:workspace-default:novels', [{
    id: 'novel-1',
    title: '기억 도시',
    subject: '',
    mood: '',
    plotSummary: '',
    chapters: [
      { id: 'chapter-1', title: '1화', content: '윤서는 기록 보관소에서 낯선 사람을 만났다.' },
      { id: 'chapter-2', title: '2화', content: '윤서의 숨겨진 혈통이 드러났다.' },
    ],
    history: [],
    characters: [{
      id: 'character-1',
      name: '윤서',
      personality: '신중하다',
      appearance: '검은 머리',
      background: '왕실의 숨겨진 후계자',
      log: '2화에서 정체가 드러났다.',
    }],
    worldviewFiles: [{ filename: '비밀 세계관', content: '윤서는 후계자다.' }],
    createdAt: 1,
    aiAuthorId: null,
  }]);
  await page.reload();

  await page.getByRole('button', { name: '캐릭터챗' }).click();
  await page.getByRole('button', { name: /캐릭터 가져오기|첫 캐릭터 가져오기/ }).first().click();
  await page.getByLabel('AI 캐릭터 지식 진행도').fill('1');
  await expect(page.getByText('1화까지')).toBeVisible();
  await page.getByRole('button', { name: /윤서/ }).click();

  await expect(page.getByRole('textbox', { name: '성격', exact: true })).toHaveValue('신중하다');
  await expect(page.getByRole('textbox', { name: '배경', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: '현재 이야기 맥락', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: '세계관', exact: true })).toHaveValue('');
  await page.getByRole('textbox', { name: '첫 인사', exact: true }).fill('처음 보는 얼굴이네.');
  await page.getByRole('button', { name: '저장하고 대화 시작' }).click();
  await startWithUserRole(page);
  await expect(page.getByText('처음 보는 얼굴이네.')).toBeVisible();
});

test('TXT analysis asks before sending and persona AI autofill recovers from a missing key', async ({ page }) => {
  await openCharacterChat(page);
  await page.getByRole('button', { name: /캐릭터 가져오기|첫 캐릭터 가져오기/ }).first().click();
  await page.getByRole('tab', { name: '외부 TXT' }).click();
  await page.getByLabel('외부 원고 제목').fill('외부 작품');
  await page.getByLabel('외부 원고 내용').fill('윤서는 낯선 도시에 도착해 오래된 친구를 찾았다.');
  await page.getByRole('button', { name: '캐릭터 찾기' }).click();
  const sendDialog = page.getByRole('dialog', { name: '외부 원고 캐릭터 추출' });
  await expect(sendDialog).toBeVisible();
  await sendDialog.getByRole('button', { name: '취소', exact: true }).click();

  await page.getByRole('tab', { name: '직접 만들기' }).click();
  await page.getByLabel('캐릭터 이름').fill('윤서');
  await page.getByRole('button', { name: '페르소나 만들기' }).click();
  const speakingStyleAiButton = page.getByTitle('말투만 AI 보완');
  await speakingStyleAiButton.click();
  await expect(page.getByText(/Gemini API 키가 설정되지 않았습니다/)).toBeVisible();
  await expect(speakingStyleAiButton).toBeEnabled();
});
