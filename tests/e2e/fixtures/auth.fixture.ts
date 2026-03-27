import { test as base, expect, Page } from '@playwright/test';
import { config } from '../helpers/config.helper';

export interface TestCredentials {
  email: string;
  password: string;
  orgName: string;
  displayName: string;
}

interface WorkerFixtures {
  workerCredentials: TestCredentials;
  workerApiToken: string;
}

interface TestFixtures {
  authenticatedPage: Page;
  credentials: TestCredentials;
  apiToken: string;
}

// Single shared credentials for the entire run.
// Uses config.runId so all spec files get the same user.
const sharedCredentials: TestCredentials = {
  email: `e2e-fixture-${config.runId}@tekmar.test`,
  password: config.testUserPassword,
  orgName: `E2E Fixture Org ${config.runId}`,
  displayName: config.testUserDisplayName,
};

let registeredToken: string | null = null;

async function ensureRegistered(): Promise<string> {
  if (registeredToken) return registeredToken;

  const regResp = await fetch(`${config.apiUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organization_name: sharedCredentials.orgName,
      email: sharedCredentials.email,
      password: sharedCredentials.password,
      display_name: sharedCredentials.displayName,
    }),
  });

  if (regResp.status === 201) {
    registeredToken = (await regResp.json()).access_token;
  } else {
    const loginResp = await fetch(`${config.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sharedCredentials.email, password: sharedCredentials.password }),
    });
    registeredToken = (await loginResp.json()).access_token;
  }

  return registeredToken!;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  workerCredentials: [async ({}, use) => {
    await use(sharedCredentials);
  }, { scope: 'worker' }],

  workerApiToken: [async ({}, use) => {
    const token = await ensureRegistered();
    await use(token);
  }, { scope: 'worker' }],

  // Each test gets a fresh page, logs in via UI, uses the shared user
  authenticatedPage: async ({ page, workerApiToken }, use) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(sharedCredentials.email);
    await page.getByTestId('login-password-input').fill(sharedCredentials.password);
    await page.getByTestId('login-submit-button').click();
    await page.waitForURL('**/queries**', { timeout: 15_000 });
    await expect(page.getByTestId('sidebar-container')).toBeVisible({ timeout: 10_000 });
    await use(page);
  },

  credentials: async ({ workerCredentials }, use) => {
    await use(workerCredentials);
  },

  apiToken: async ({ workerApiToken }, use) => {
    await use(workerApiToken);
  },
});

export { expect };
