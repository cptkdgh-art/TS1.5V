import { expect, test } from '@playwright/test';

test('malformed backup is rejected before workspace replacement', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-select')).toBeVisible();
  await page.getByTestId('workspace-backup-button').click();
  const dialog = page.getByRole('dialog', { name: '작업실 백업 관리' });
  await page.getByTestId('backup-import-target').selectOption('workspace-default');
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'invalid-backup.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ novels: [{ id: 'broken', title: 'Broken' }], authors: [], series: [] })),
  });
  await expect(page.getByRole('button', { name: '선택한 작업실 덮어쓰기', exact: true })).toHaveCount(0);
  await expect(page.getByText(/올바른 백업|지원하지 않는|유효하지|올바르지 않은/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('workspace-select')).toHaveValue('workspace-default');
  await expect(page.getByText('첫 작품을 시작해보세요')).toBeVisible();
});

test('two open tabs create different workspace slots without losing either entry', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('workspace-select')).toBeVisible();
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByTestId('workspace-select')).toBeVisible();
  await page.getByTestId('workspace-create-button').click();
  await page.getByTestId('workspace-name-input').fill('Concurrent A');
  await second.getByTestId('workspace-create-button').click();
  await second.getByTestId('workspace-name-input').fill('Concurrent B');
  const firstPopup = page.waitForEvent('popup');
  const secondPopup = second.waitForEvent('popup');
  await Promise.all([
    page.getByTestId('workspace-submit-button').click(),
    second.getByTestId('workspace-submit-button').click(),
  ]);
  const popups = await Promise.all([firstPopup, secondPopup]);
  for (const popup of popups) await expect(popup.getByTestId('workspace-select')).toBeVisible();
  await page.reload();
  const select = page.getByTestId('workspace-select');
  await expect(select).toContainText('Concurrent A');
  await expect(select).toContainText('Concurrent B');
  const entries = await select.locator('option').allTextContents();
  const added = entries.filter((entry) => entry.includes('Concurrent'));
  expect(added).toHaveLength(2);
  expect(new Set(added.map((entry) => entry.split(' · ')[0])).size).toBe(2);
  await page.screenshot({ path: 'test-results/review-workspaces-desktop.png' });
});
