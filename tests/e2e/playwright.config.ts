import { defineConfig } from '@playwright/test';

// Env loading is handled by helpers/config.helper.ts based on NODE_ENV.
// NODE_ENV=development → loads env/.env.development
// NODE_ENV=production  → loads env/.env.production

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:4200',
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
