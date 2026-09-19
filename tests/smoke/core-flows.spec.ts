import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('dialog', async (dialog) => {
    throw new Error(`Unexpected native browser dialog: ${dialog.type()} ${dialog.message()}`);
  });
});

async function createNovelAndOpenEditor(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByText('첫 작품을 시작해보세요')).toBeVisible();

  await page.getByRole('button', { name: '새 작품 만들기' }).click();
  await expect(page.getByRole('heading', { name: '새 작품 만들기' })).toBeVisible();

  await page.getByLabel('주 장르').selectOption('현대판타지');
  await page.getByRole('group', { name: '부 장르 선택' }).getByRole('button', { name: '헌터', exact: true }).click();
  await page.getByRole('group', { name: '주제 선택' }).getByRole('button', { name: '성장', exact: true }).click();
  await page.getByRole('group', { name: '분위기 선택' }).getByRole('button', { name: '긴장감', exact: true }).click();
  await page.getByPlaceholder('예: 퇴사한 헌터가 낡은 여관을 되살리는 이야기').fill('던전 관리 공기업 직장물');
  await page.getByPlaceholder('작품 제목').fill('테스트 던전 사무소');
  await page.getByPlaceholder(/소설의 핵심 뼈대/).fill('주인공이 던전 관리 공기업에 입사해 첫 사건을 해결한다.');

  await page.getByRole('button', { name: '소설 시작' }).click();
  await expect(page.getByText('테스트 던전 사무소')).toBeVisible();
  await page.getByRole('heading', { name: '테스트 던전 사무소' }).click();
  await expect(page.getByRole('heading', { name: 'AI 작가 제어 패널' })).toBeVisible();
}

test('new work worldbuilding path surfaces required fields and no-key failure cleanly', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('첫 작품을 시작해보세요')).toBeVisible();

  await page.getByRole('button', { name: '새 작품 만들기' }).click();
  await expect(page.getByRole('heading', { name: '새 작품 만들기' })).toBeVisible();

  const worldviewButton = page.getByRole('button', { name: 'AI로 기본 세계관 생성하기' });
  await expect(worldviewButton).toBeDisabled();
  await expect(page.getByText(/세계관 생성 전 필수 입력/)).toBeVisible();

  await page.getByLabel('주 장르').selectOption('현대판타지');
  await page.getByRole('group', { name: '부 장르 선택' }).getByRole('button', { name: '헌터', exact: true }).click();
  await page.getByRole('group', { name: '주제 선택' }).getByRole('button', { name: '성장', exact: true }).click();
  await page.getByRole('group', { name: '분위기 선택' }).getByRole('button', { name: '긴장감', exact: true }).click();
  await page.getByPlaceholder('예: 퇴사한 헌터가 낡은 여관을 되살리는 이야기').fill('던전 관리 공기업 직장물');
  await page.getByPlaceholder('작품 제목').fill('테스트 던전 사무소');
  await page.getByPlaceholder(/소설의 핵심 뼈대/).fill('주인공이 던전 관리 공기업에 입사해 첫 사건을 해결한다.');

  await expect(worldviewButton).toBeEnabled();
  await worldviewButton.click();

  await expect(page.getByText('기본 세계관 생성 실패: Gemini API 키를 먼저 확인해주세요.')).toBeVisible();
  await expect(worldviewButton).toBeEnabled();

  await page.getByRole('button', { name: '소설 시작' }).click();
  await expect(page.getByText('테스트 던전 사무소')).toBeVisible();
  await page.getByRole('heading', { name: '테스트 던전 사무소' }).click();
  await expect(page.getByRole('heading', { name: 'AI 작가 제어 패널' })).toBeVisible();
  await expect(page.getByText('AI 라우팅 진단')).toBeVisible();
  await expect(page.getByText('gemini-3.7-flash').first()).toBeVisible();
  await expect(page.getByText('최대 호출')).toBeVisible();
  await expect(page.getByText('묶음 상한')).toBeVisible();
  await page.getByRole('button', { name: '설정' }).click();
  await expect(page.getByLabel('주 장르')).toHaveValue('현대판타지');
  await expect(page.getByRole('group', { name: '부 장르 선택' }).getByRole('button', { name: '헌터', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: '주제 선택' }).getByRole('button', { name: '성장', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: '분위기 선택' }).getByRole('button', { name: '긴장감', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '세계관' }).click();
  await expect(page.getByRole('checkbox', { name: '세계관 기록보관자 활성화' })).toBeChecked();
});

test('new work direction guide stays usable on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '새 작품 만들기' }).click();

  const dialog = page.getByRole('dialog', { name: '새 작품 만들기' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth;
  })).toBe(true);

  await dialog.getByLabel('주 장르').selectOption('로맨스판타지');
  await expect(dialog.getByText(/관계의 변화와 판타지 세계의 갈등/)).toBeVisible();
  await expect(dialog.getByRole('group', { name: '부 장르 선택' }).getByRole('button', { name: '계약결혼' })).toBeVisible();
  await dialog.getByRole('group', { name: '주제 선택' }).getByRole('button', { name: '구원', exact: true }).click();
  await expect(dialog.getByRole('group', { name: '주제 선택' }).getByRole('button', { name: '구원', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('AI author recommendation keeps the existing author flow and adds a compact brief', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            role: 'model',
            parts: [{
              text: JSON.stringify({
                authors: [
                  {
                    name: '속도선',
                    specialty: '빠른 사건 전개에 강한 현대 판타지 작가',
                    writingStyle: '짧고 선명한 문장으로 행동과 사건을 빠르게 연결한다.',
                    coreDirectives: '선택이 즉시 결과를 만들게 하고 끝난 장면을 반복 설명하지 않는다.',
                    tags: ['현대판타지', '속도감'],
                  },
                  {
                    name: '대화선',
                    specialty: '인물 관계와 대사의 말맛에 강한 작가',
                    writingStyle: '인물마다 어휘를 달리하고 대화 사이 행동으로 속뜻을 드러낸다.',
                    coreDirectives: '관계를 움직이지 않는 대화는 줄이고 갈등의 결과를 다음 장면에 남긴다.',
                    tags: ['대화', '관계'],
                  },
                  {
                    name: '잔향선',
                    specialty: '감각적인 공간과 긴장 축적에 강한 미스터리 작가',
                    writingStyle: '제한적 시점에서 필요한 감각만 포착하고 문장 길이를 대비한다.',
                    coreDirectives: '정보를 단계적으로 공개하고 장면 말미의 추상적인 총평을 피한다.',
                    tags: ['미스터리', '긴장'],
                  },
                ],
              }),
            }],
          },
          finishReason: 'STOP',
          index: 0,
        }],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 300,
          totalTokenCount: 400,
        },
      }),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'API 설정하기' }).click();
  await page.locator('input[type="password"]').fill('test-gemini-key');
  await page.getByRole('button', { name: '저장' }).click();
  await page.getByRole('button', { name: '작가', exact: true }).click();
  await page.getByRole('button', { name: 'AI 추천', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'AI 추천 작가 생성' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('원하는 작가와 키워드')).toBeVisible();
  await expect(dialog.getByLabel('원하는 분위기')).toBeVisible();
  await expect(dialog.getByLabel('특히 잘했으면 하는 것')).toBeVisible();
  await expect(dialog.getByLabel('피하고 싶은 것')).toBeVisible();
  await expect(dialog.getByLabel('추천 모델')).toHaveValue('gemini-3.7-flash');
  await expect(dialog.getByLabel('추천 모델').locator('option[value="gemini-3.8-flash"]')).toHaveCount(0);
  await expect(dialog.getByLabel('추천 모델').locator('option[value="gemini-3.7-flash"]')).toHaveCount(1);
  await expect(dialog.getByLabel('추천 모델').locator('option[value="gemini-3.6-flash"]')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: '작가 후보 추천받기' })).toBeDisabled();

  await dialog.getByLabel('원하는 작가와 키워드').fill('현대 판타지, 빠른 사건 전개');
  await dialog.getByLabel('원하는 분위기').fill('유쾌하지만 가볍지 않게');
  await dialog.getByLabel('특히 잘했으면 하는 것').fill('인물별 대사와 회차 후킹');
  await dialog.getByLabel('피하고 싶은 것').fill('과한 수식어');
  await dialog.getByLabel('추천 모델').selectOption('gemini-3.6-flash');
  await expect(dialog.getByRole('button', { name: '작가 후보 추천받기' })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await dialog.getByRole('button', { name: '작가 후보 추천받기' }).click();
  await expect(dialog.getByText('속도선', { exact: true })).toBeVisible();
  await expect(dialog.getByText('대화선', { exact: true })).toBeVisible();
  await expect(dialog.getByText('잔향선', { exact: true })).toBeVisible();

  await dialog.getByText('대화선', { exact: true }).click();
  await expect(dialog.getByLabel('작가 이름')).toHaveValue('대화선');
  await dialog.getByLabel('작가 이름').fill('대화 설계자');
  await dialog.getByRole('button', { name: '이 작가로 생성' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('대화 설계자', { exact: true })).toBeVisible();
});

test('natural one-turn and targeted generation modes persist without exposing token controls', async ({ page }) => {
  await createNovelAndOpenEditor(page);

  const writingEngine = page.getByRole('combobox', { name: '집필 엔진 선택' });
  await expect(writingEngine).toHaveValue('gemini-3.7-flash');
  await expect(writingEngine.locator('option[value="gemini-3.8-flash"]')).toHaveCount(1);
  await expect(writingEngine.locator('option[value="gemini-3.7-flash"]')).toHaveCount(1);
  await expect(writingEngine.locator('option[value="gemini-3.6-flash"]')).toHaveCount(1);
  await writingEngine.selectOption('gemini-3.8-flash');

  const targetCharacters = page.getByRole('spinbutton', { name: '회차 목표 글자 수' });
  const targetedGeneration = page.getByRole('switch', { name: '목표 분량·연속 집필 토글' });
  await expect(targetedGeneration).toHaveAttribute('aria-checked', 'true');
  await expect(targetCharacters).toHaveValue('6000');
  await expect(page.getByRole('spinbutton', { name: '최대 출력 토큰' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '1화 쓰기', exact: true })).toHaveClass(/bg-indigo-600/);

  await targetCharacters.fill('20000');
  await expect(targetCharacters).toHaveValue('15000');
  await page.getByRole('button', { name: '3화 연속', exact: true }).click();
  await expect(page.getByText('최대 3회 호출 · 완성된 화부터 즉시 저장')).toBeVisible();
  await targetedGeneration.click();
  await expect(targetedGeneration).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('자율 한 턴', { exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: '회차 목표 글자 수' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '3화 연속', exact: true })).toHaveCount(0);

  await page.getByRole('switch', { name: '집필 집중 모드 토글' }).click();
  await page.getByRole('button', { name: '목표 달성까지', exact: true }).click();
  await page.getByRole('textbox', { name: '집필 집중 방향' }).fill('재단에 대한 위화감을 의심으로 키운다.');
  await page.getByRole('textbox', { name: '집필 집중 도달점' }).fill('제한 구역을 직접 확인하기로 결심한다.');
  await expect(page.getByText('문장 호흡', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '느리게' }).click();
  await expect(page.getByRole('button', { name: '느리게' })).toHaveClass(/bg-indigo-600/);

  await page.reload();
  await page.getByRole('heading', { name: '테스트 던전 사무소' }).click();
  await expect(page.getByRole('combobox', { name: '집필 엔진 선택' })).toHaveValue('gemini-3.8-flash');
  const reloadedTargetedGeneration = page.getByRole('switch', { name: '목표 분량·연속 집필 토글' });
  await expect(reloadedTargetedGeneration).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('자율 한 턴', { exact: true })).toBeVisible();
  await reloadedTargetedGeneration.click();
  await expect(page.getByRole('spinbutton', { name: '회차 목표 글자 수' })).toHaveValue('15000');
  await expect(page.getByRole('button', { name: '3화 연속', exact: true })).toHaveClass(/bg-indigo-600/);
  await expect(page.getByRole('switch', { name: '집필 집중 모드 토글' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: '목표 달성까지', exact: true })).toHaveClass(/bg-indigo-600/);
  await expect(page.getByRole('textbox', { name: '집필 집중 방향' })).toHaveValue('재단에 대한 위화감을 의심으로 키운다.');
  await expect(page.getByRole('textbox', { name: '집필 집중 도달점' })).toHaveValue('제한 구역을 직접 확인하기로 결심한다.');
  await expect(page.getByRole('button', { name: '느리게' })).toHaveClass(/bg-indigo-600/);
});

test('editor AI generation modals recover cleanly when the Gemini key is missing', async ({ page }) => {
  await createNovelAndOpenEditor(page);

  await page.getByRole('button', { name: '인물' }).click();
  await page.getByRole('button', { name: 'AI로 인물 추천받기' }).click();
  const characterModal = page.getByRole('heading', { name: 'AI 캐릭터 생성' }).locator('..');
  await expect(characterModal.getByText('짧은 소설 정보와 세계관 요약만 참고해 빠르게 새 캐릭터를 생성합니다.')).toBeVisible();
  await characterModal.getByPlaceholder('예: 주인공의 멘토, 적대자 등').fill('공기업 감사팀 선배');
  await characterModal.getByPlaceholder('예: 신비로운, 지혜로운, 노인').fill('냉정한, 현장형, 비밀');
  await characterModal.getByRole('button', { name: 'AI 생성' }).click();
  await expect(page.getByText(/Gemini API 키를 먼저 확인해주세요|캐릭터 생성에 실패했습니다/)).toBeVisible();
  await expect(characterModal.getByRole('button', { name: 'AI 생성' })).toBeEnabled();
  await characterModal.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('heading', { name: 'AI 캐릭터 생성' })).toBeHidden();

  await page.getByRole('button', { name: '세계관' }).click();
  await page.getByRole('button', { name: 'AI 생성' }).click();
  const aspectModal = page.getByRole('heading', { name: '세계관 설정 추가 생성' }).locator('..');
  await expect(aspectModal.getByText('짧은 소설 정보와 입력한 주문 중심으로 빠르게 설정을 생성합니다.')).toBeVisible();
  await aspectModal.getByRole('button', { name: '마법 체계' }).click();
  await aspectModal.getByRole('button', { name: '생성', exact: true }).click();
  await expect(page.getByText(/Gemini API 키를 먼저 확인해주세요|세계관 설정 생성에 실패했습니다/)).toBeVisible();
  await expect(aspectModal.getByRole('button', { name: '생성', exact: true })).toBeEnabled();
  await aspectModal.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('heading', { name: '세계관 설정 추가 생성' })).toBeHidden();
});

test('analysis actions use confirmation modals before sending full manuscript context', async ({ page }) => {
  await createNovelAndOpenEditor(page);

  await page.getByRole('button', { name: '인물' }).click();
  await page.getByRole('button', { name: '본문에서 분석' }).click();
  const characterAnalysisDialog = page.getByRole('dialog', { name: '등장인물 분석 확인' });
  await expect(characterAnalysisDialog).toBeVisible();
  await expect(characterAnalysisDialog.getByRole('button', { name: '분석 시작' })).toBeVisible();
  await characterAnalysisDialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('heading', { name: '등장인물 분석 확인' })).toBeHidden();

  await page.getByRole('button', { name: '세계관' }).click();
  await page.getByRole('button', { name: '본문 분석' }).click();
  const worldviewAnalysisDialog = page.getByRole('dialog', { name: '세계관 분석 확인' });
  await expect(worldviewAnalysisDialog).toBeVisible();
  await expect(worldviewAnalysisDialog.getByRole('button', { name: '분석 시작' })).toBeVisible();
  await worldviewAnalysisDialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('heading', { name: '세계관 분석 확인' })).toBeHidden();
});

test('API key deletion uses the shared confirmation modal instead of native confirm', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'API 설정하기' }).click();
  await expect(page.getByRole('heading', { name: 'API 설정' })).toBeVisible();
  await expect(page.getByText('Gemini API', { exact: true })).toBeVisible();
  await expect(page.getByText('Codex 브리지', { exact: true })).toBeVisible();
  await expect(page.getByText('집필 컨텍스트 준비됨')).toBeVisible();

  await page.locator('input[type="password"]').fill('test-gemini-key');
  await page.getByRole('button', { name: '저장' }).click();

  await page.getByRole('button', { name: 'API 설정 ✓' }).click();
  await expect(page.getByText('API 키가 설정되어 있습니다')).toBeVisible();

  await page.getByRole('button', { name: 'API 키 삭제' }).click();
  const cancelDeleteDialog = page.getByRole('dialog', { name: 'API 키 삭제' });
  await expect(cancelDeleteDialog).toBeVisible();
  await cancelDeleteDialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByText('API 키가 설정되어 있습니다')).toBeVisible();

  await page.getByRole('button', { name: 'API 키 삭제' }).click();
  const confirmDeleteDialog = page.getByRole('dialog', { name: 'API 키 삭제' });
  await confirmDeleteDialog.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByText('API 키가 설정되지 않았습니다')).toBeVisible();
});

test('shared modal keeps dialog semantics and closes only the top layer with Escape', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'API 설정하기' }).click();
  const settingsDialog = page.getByRole('dialog', { name: 'API 설정' });
  await expect(settingsDialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

  await settingsDialog.locator('input[type="password"]').fill('test-gemini-key');
  await settingsDialog.getByRole('button', { name: '저장' }).click();
  await page.getByRole('button', { name: 'API 설정 ✓' }).click();

  await page.getByRole('button', { name: 'API 키 삭제' }).click();
  const confirmDialog = page.getByRole('dialog', { name: 'API 키 삭제' });
  await expect(confirmDialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(confirmDialog).toBeHidden();
  await expect(settingsDialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

  await page.keyboard.press('Escape');
  await expect(settingsDialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('Director Clio keeps a selected novel and read scope separate from the writer Clio', async ({ page }) => {
  await createNovelAndOpenEditor(page);

  await page.getByRole('button', { name: '목록으로' }).click();
  await page.getByRole('button', { name: 'AI 작가 관리' }).click();
  await expect(page.getByRole('heading', { name: 'AI 작가 관리' })).toBeVisible();

  await page.getByRole('button', { name: '총괄 감독 클리오' }).click();
  const dialog = page.getByRole('dialog', { name: '총괄감독 클리오' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/기본작가 클리오와 별개/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth;
  })).toBe(true);
  const mobileChat = dialog.getByTestId('director-clio-chat');
  await expect.poll(async () => (await mobileChat.boundingBox())?.height || 0).toBeGreaterThan(300);

  await dialog.getByRole('button', { name: '작품 설정 열기' }).click();
  await dialog.getByLabel('모바일 총괄감독 상담 작품').selectOption({ index: 1 });
  const mobileContext = dialog.getByTestId('director-clio-mobile-context');
  await expect(mobileContext.getByText('테스트 던전 사무소', { exact: true })).toBeVisible();
  await expect(mobileContext.getByText(/작품 ID/)).toBeVisible();
  const fullReadButton = dialog.getByRole('button', { name: '전권 원문' });
  await fullReadButton.click();
  await expect(mobileContext.getByText('전권 원문 연결')).toBeVisible();
  await expect(fullReadButton).toBeEnabled();

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'AI 작가 관리' }).click();
  await page.getByRole('button', { name: '총괄 감독 클리오' }).click();
  const reopened = page.getByRole('dialog', { name: '총괄감독 클리오' });
  await expect(reopened.getByTestId('director-clio-desktop-context').getByText('전권 원문 연결')).toBeVisible();
});

test('Director Clio creates and assigns an editable structured author proposal', async ({ page }) => {
  await createNovelAndOpenEditor(page);
  await page.getByRole('button', { name: '목록으로' }).click();

  const novelId = await page.evaluate(async () => {
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
    const novels = await read<Array<{ id: string }>>('workspace:workspace-default:novels');
    const id = novels[0].id;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.objectStore('KeyValueStore').put({
        schemaVersion: 1,
        memories: [],
        activeNovelId: id,
        legacyMigrationCompleted: true,
        sessions: {
          [id]: {
            novelId: id,
            history: [
              { role: 'user', parts: [{ text: '이 작품용 작가를 설계해줘.' }] },
              { role: 'model', parts: [{ text: '사건과 인물의 선택을 함께 밀어붙이는 작가가 맞아.' }] },
            ],
            authorProposals: [{
              id: 'proposal-smoke',
              createdAt: Date.now(),
              afterMessageIndex: 1,
              sourceNovelId: id,
              name: '경계선 기록자',
              specialty: '현대 판타지와 조직 미스터리',
              writingStyle: '간결한 제한적 3인칭으로 사건과 인물 반응을 교차한다.',
              coreDirectives: '정보를 행동에 실어 전달하고 선택에는 분명한 결과를 남긴다.',
              tags: ['현대판타지', '미스터리'],
            }],
            readMode: 'recent',
            updatedAt: Date.now(),
          },
        },
      }, `workspace:workspace-default:directorClio`);
    });
    database.close();
    return id;
  });

  await page.reload();
  await page.getByRole('button', { name: 'AI 작가 관리' }).click();
  await page.getByRole('button', { name: '총괄 감독 클리오' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = page.getByRole('dialog', { name: '총괄감독 클리오' });
  const proposal = dialog.getByTestId('director-author-proposal');
  await expect(proposal).toBeVisible();
  await expect(proposal.getByLabel('작가명')).toHaveValue('경계선 기록자');
  await proposal.getByLabel('작가명').fill('경계선 설계자');
  await proposal.getByLabel('자기 정의').fill('나는 선택의 대가를 끝까지 바라보는 작가다.');
  await expect(proposal.getByRole('checkbox', { name: /담당 작가로 지정/ })).toBeChecked();
  await proposal.getByRole('button', { name: '이대로 작가 생성' }).click();
  await expect(proposal.getByText('작가 생성 완료')).toBeVisible();

  await expect.poll(() => page.evaluate(async ({ targetNovelId }) => {
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
    const authors = await read<Array<{ id: string; name: string; identityCore?: { selfDefinition?: string; coreId?: string } }>>('workspace:workspace-default:aiAuthors');
    const novels = await read<Array<{ id: string; aiAuthorId: string | null }>>('workspace:workspace-default:novels');
    database.close();
    const author = authors.find((item) => item.name === '경계선 설계자');
    return Boolean(
      author
      && author.identityCore?.selfDefinition === '나는 선택의 대가를 끝까지 바라보는 작가다.'
      && author.identityCore.coreId
      && novels.find((item) => item.id === targetNovelId)?.aiAuthorId === author.id
    );
  }, { targetNovelId: novelId })).toBe(true);
});

test('manual chapter content survives reload and deletion remains persisted', async ({ page }) => {
  await createNovelAndOpenEditor(page);

  const manuscript = '비가 그친 새벽, 한서윤은 봉인된 던전의 셔터를 올렸다. 안쪽에서 누군가 세 번 노크했다.';
  await page.getByRole('button', { name: '직접 작성' }).click();
  const editor = page.getByRole('main').getByRole('textbox');
  await editor.fill(manuscript);
  await page.getByRole('main').getByRole('button', { name: '저장' }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('main').getByText(manuscript)).toBeVisible();
  await expect(page.getByRole('main').getByText(/^CH-[A-Z0-9]{6}$/)).toBeVisible();
  await expect(page.getByRole('main').getByText('v1', { exact: true })).toBeVisible();

  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<string>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readonly');
      const request = transaction.objectStore('KeyValueStore').get('workspace:workspace-default:novels');
      request.onsuccess = () => resolve(request.result?.[0]?.chapters?.[0]?.content || '');
      request.onerror = () => reject(request.error);
    });
  })).toBe(manuscript);

  await page.reload();
  await expect(page.getByRole('heading', { name: '테스트 던전 사무소' })).toBeVisible();
  await expect(page.getByText('1화')).toBeVisible();
  await page.getByRole('heading', { name: '테스트 던전 사무소' }).click();
  await expect(page.getByRole('main').getByText(manuscript)).toBeVisible();

  await page.getByRole('main').getByRole('button', { name: '챕터 삭제' }).click();
  const deleteDialog = page.getByRole('dialog', { name: '회차 정리 방식 선택' });
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog.getByText('두 방식 모두 실행 직전 상태를 자동 복구 스냅샷으로 남깁니다.')).toBeVisible();
  await expect(deleteDialog.getByRole('button', { name: /첫 회차 이전으로 되돌리기/ })).toBeVisible();
  await deleteDialog.getByRole('button', { name: /이 회차만 삭제/ }).click();
  await expect(deleteDialog).toBeHidden();
  await expect(page.getByRole('heading', { name: '첫 번째 챕터를 시작하세요' })).toBeVisible();

  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<string>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readonly');
      const request = transaction.objectStore('KeyValueStore').get('workspace:workspace-default:novels');
      request.onsuccess = () => resolve(request.result?.[0]?.snapshots?.[0]?.kind || '');
      request.onerror = () => reject(request.error);
    });
  })).toBe('auto-recovery');

  await page.reload();
  await expect(page.getByRole('heading', { name: '테스트 던전 사무소' })).toBeVisible();
  await page.getByRole('heading', { name: '테스트 던전 사무소' }).click();
  await expect(page.getByRole('button', { name: '직접 작성' })).toBeVisible();
  await expect(page.getByText(manuscript)).toBeHidden();

  await page.getByRole('button', { name: '설정' }).click();
  await expect(page.getByText('자동 복구', { exact: true })).toBeVisible();
  await expect(page.getByText(/1화 상태 · 1화 작업 전/)).toBeVisible();
  await page.getByRole('button', { name: '복원', exact: true }).click();
  const restoreDialog = page.getByRole('dialog', { name: '스냅샷 복원' });
  await restoreDialog.getByRole('button', { name: '복원', exact: true }).click();
  await page.getByRole('button', { name: '본문' }).click();
  await expect(page.getByRole('main').getByText(manuscript)).toBeVisible();

  await page.reload();
  await page.getByRole('heading', { name: '테스트 던전 사무소' }).click();
  await expect(page.getByRole('main').getByText(manuscript)).toBeVisible();

  await page.getByRole('main').getByRole('button', { name: '챕터 삭제' }).click();
  const rollbackDialog = page.getByRole('dialog', { name: '회차 정리 방식 선택' });
  await rollbackDialog.getByRole('button', { name: /첫 회차 이전으로 되돌리기/ }).click();
  await expect(page.getByRole('heading', { name: '첫 번째 챕터를 시작하세요' })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('JinpokStidoDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<{ chapterCount: number; operation: string }>((resolve, reject) => {
      const transaction = database.transaction('KeyValueStore', 'readonly');
      const request = transaction.objectStore('KeyValueStore').get('workspace:workspace-default:novels');
      request.onsuccess = () => {
        const storedNovel = request.result?.[0];
        const snapshots = storedNovel?.snapshots || [];
        resolve({
          chapterCount: storedNovel?.chapters?.length ?? -1,
          operation: snapshots[snapshots.length - 1]?.recoveryMeta?.operation || '',
        });
      };
      request.onerror = () => reject(request.error);
    });
  })).toEqual({ chapterCount: 0, operation: 'rollback' });
});

test('mobile manuscript taps toggle the floating table-of-contents button without hiding controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createNovelAndOpenEditor(page);

  const manuscript = '모바일 화면에서 제어 패널 토글 동작을 확인하는 테스트 본문입니다.';
  await page.getByRole('button', { name: '직접 작성' }).click();
  await page.getByRole('main').getByRole('textbox').fill(manuscript);
  await page.getByRole('main').getByRole('button', { name: '저장' }).click();

  const controlPanelHeading = page.getByRole('heading', { name: 'AI 작가 제어 패널' });
  const manuscriptParagraph = page.getByRole('main').getByText(manuscript);
  const tableOfContentsButton = page.getByRole('button', { name: '챕터 목록 열기' });
  await expect(controlPanelHeading).toBeVisible();
  await expect(tableOfContentsButton).toBeVisible();

  await manuscriptParagraph.click();
  await expect(controlPanelHeading).toBeVisible();
  await expect(tableOfContentsButton).toBeHidden();

  await manuscriptParagraph.click();
  await expect(controlPanelHeading).toBeVisible();
  await expect(tableOfContentsButton).toBeVisible();

  await page.getByTitle('제어패널 숨기기').click();
  await expect(controlPanelHeading).toBeHidden();
  await page.getByTitle('제어패널 보이기').click();
  await expect(controlPanelHeading).toBeVisible();

  await page.getByRole('button', { name: '챕터 목록 열기' }).click();
  await page.getByRole('button', { name: '목차 닫기' }).click();
  await expect(controlPanelHeading).toBeVisible();
});

test('memory center shows full-series coverage and persists automation settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createNovelAndOpenEditor(page);

  await page.getByRole('button', { name: '캐시' }).click();
  await expect(page.getByRole('heading', { name: '이번 집필 적용 현황' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '전 화 기억 지도' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /시간축 Canon 장부/ })).toBeVisible();
  await expect(page.getByText('0/0화 · 100%')).toBeVisible();
  await expect(page.getByRole('button', { name: '스마트 동기화' })).toBeDisabled();
  await expect(page.getByText('자동 요약 꺼짐', { exact: true })).toBeVisible();

  const triggerSelect = page.getByLabel('자동 요약 주기');
  await expect(page.getByText('최근 3화 원문 전체', { exact: true })).toBeVisible();
  await triggerSelect.selectOption('4');
  await page.getByLabel('챕터 저장 후 자동 요약 API 호출').check();
  await expect(triggerSelect).toHaveValue('4');
  await expect(page.getByText('현재 0화 · 다음 자동 요약은 7화 저장 시')).toBeVisible();
  const memorySection = page.locator('section[aria-labelledby="memory-map-title"]');
  await expect(memorySection.getByText('다음 화 저장: 일반 저장 · 요약 호출 없음')).toBeVisible();
  await expect(memorySection.getByText('요약 대기 누적 0/4화')).toBeVisible();

  const authorContextSection = page.locator('section[aria-labelledby="author-context-title"]');
  await expect.poll(() => memorySection.evaluate((element) => element.getBoundingClientRect().right <= window.innerWidth + 1)).toBe(true);
  await expect.poll(() => authorContextSection.evaluate((element) => element.getBoundingClientRect().right <= window.innerWidth + 1)).toBe(true);

  const bridgeContext = await page.evaluate(async () => {
    const bridge = (window as Window & {
      __JINPOK_WRITING_BRIDGE__?: {
        version: string;
        call: (action: string, params?: Record<string, unknown>) => Promise<unknown>;
      };
    }).__JINPOK_WRITING_BRIDGE__;
    if (!bridge) return null;
    const novels = await bridge.call('getNovels') as Array<{ id: string }>;
    const context = await bridge.call('getWritingContext', { novelId: novels[0].id }) as {
      schemaVersion: number;
      priorityPolicy: string[];
      work: { id: string };
    };
    return { version: bridge.version, context };
  });
  expect(bridgeContext?.version).toBe('1.0');
  expect(bridgeContext?.context.schemaVersion).toBe(1);
  expect(bridgeContext?.context.priorityPolicy[0]).toContain('AI 작가');

  await page.waitForTimeout(100);
  await page.reload();
  await page.getByRole('heading', { name: '테스트 던전 사무소' }).click();
  await page.getByRole('button', { name: '캐시' }).click();
  await expect(page.getByText('최근 3화 원문 전체', { exact: true })).toBeVisible();
  await expect(page.getByLabel('자동 요약 주기')).toHaveValue('4');
  await expect(page.getByLabel('챕터 저장 후 자동 요약 API 호출')).toBeChecked();
});
