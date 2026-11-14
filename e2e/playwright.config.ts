import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    // Yêu cầu của thầy: luôn quay video, dù test đạt hay hỏng, ở máy mình lẫn trên GitHub.
    video: 'on',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Có đặt E2E_BROWSER_PATH thì dùng Brave, không thì dùng Chromium của Playwright
        launchOptions: process.env.E2E_BROWSER_PATH
          ? { executablePath: process.env.E2E_BROWSER_PATH }
          : {},
      },
    },
  ],
});
