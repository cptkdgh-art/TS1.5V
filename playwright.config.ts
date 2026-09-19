import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:3335',
    trace: 'on-first-retry',
  },
  webServer: externalBaseURL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 3335',
    url: 'http://127.0.0.1:3335',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
