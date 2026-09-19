import { expect, test } from '@playwright/test';

test('Chrome can install Jinpok TS Studio as a standalone PWA', async ({ page }) => {
  await page.goto('/');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();

  const manifestUrl = new URL(manifestHref!, page.url()).toString();
  const manifestResponse = await page.request.get(manifestUrl);
  expect(manifestResponse.ok()).toBe(true);

  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    id: '/',
    name: '진폭 TS STUDIO - TS 장르 전문 AI 소설 스튜디오',
    short_name: '진폭 TS STUDIO',
    start_url: '/',
    scope: '/',
    display: 'standalone',
  });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: '/pwa-v2-192x192.png', sizes: '192x192', purpose: 'any' }),
    expect.objectContaining({ src: '/pwa-v2-512x512.png', sizes: '512x512', purpose: 'any' }),
    expect.objectContaining({ src: '/pwa-maskable-v2-512x512.png', sizes: '512x512', purpose: 'maskable' }),
  ]));

  for (const icon of manifest.icons) {
    const iconResponse = await page.request.get(new URL(icon.src, page.url()).toString());
    expect(iconResponse.ok(), `${icon.src} must load`).toBe(true);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
  }

  await expect.poll(() => page.evaluate(async () => (
    Boolean(await navigator.serviceWorker.getRegistration())
  ))).toBe(true);

  await page.evaluate(() => {
    const promptEvent = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted'; platform: string }>;
    };
    promptEvent.prompt = async () => {
      (window as typeof window & { __pwaPromptCalled?: boolean }).__pwaPromptCalled = true;
    };
    promptEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(promptEvent);
  });

  const installButton = page.getByTestId('pwa-install-button');
  await expect(installButton).toBeVisible();
  await installButton.click();
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __pwaPromptCalled?: boolean }).__pwaPromptCalled
  ))).toBe(true);
  await expect(installButton).toBeHidden();
  await expect(page.getByText('진폭 STIDO 앱을 설치했습니다.')).toBeVisible();
});

test('install entry explains how to continue when the browser prompt is unavailable', async ({ page }) => {
  await page.goto('/');

  const installButton = page.getByTestId('pwa-install-button');
  await expect(installButton).toBeVisible();
  await installButton.click();

  const dialog = page.getByRole('dialog', { name: '진폭 STIDO 앱 설치' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Chrome 또는 Edge');
  await expect(dialog).toContainText('홈 화면에 추가');
});

test('PWA metadata keeps the mobile home screen inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111827');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon-v2.png');
  await expect.poll(() => page.evaluate(() => ({
    viewport: window.innerWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))).toEqual({ viewport: 390, root: 390, body: 390 });
});
