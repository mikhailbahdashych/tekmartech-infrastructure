import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import { config } from '../helpers/config.helper';

export interface TestCredentials {
  email: string;
  password: string;
  orgName: string;
  displayName: string;
}

export interface AuthFixtures {
  authenticatedPage: Page;
  credentials: TestCredentials;
  apiToken: string;
}

/**
 * Register a new user via the UI and return the page.
 * Each spec file gets a unique user/org so tests don't collide.
 */
async function registerViaUI(page: Page, creds: TestCredentials): Promise<void> {
  await page.goto('/register');
  await page.getByTestId('register-org-name-input').fill(creds.orgName);
  await page.getByTestId('register-display-name-input').fill(creds.displayName);
  await page.getByTestId('register-email-input').fill(creds.email);
  await page.getByTestId('register-password-input').fill(creds.password);
  await page.getByTestId('register-confirm-password-input').fill(creds.password);
  await page.getByTestId('register-submit-button').click();

  const result = await Promise.race([
    page.waitForURL('**/queries**', { timeout: 15_000 }).then(() => 'ok' as const),
    page.getByTestId('register-error-text').waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'error' as const),
  ]);

  if (result === 'error') {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(creds.email);
    await page.getByTestId('login-password-input').fill(creds.password);
    await page.getByTestId('login-submit-button').click();
    await page.waitForURL('**/queries**', { timeout: 15_000 });
  }

  await expect(page.getByTestId('sidebar-container')).toBeVisible({ timeout: 10_000 });
}

/**
 * Get a JWT access token via API login (for direct API calls in tests).
 */
async function getApiToken(creds: TestCredentials): Promise<string> {
  const resp = await fetch(`${config.apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  const body = await resp.json();
  return body.access_token || '';
}

// Per-worker counter for unique emails
let fixtureCounter = 0;

export const test = base.extend<AuthFixtures>({
  credentials: async ({}, use) => {
    const uniqueTs = Date.now() + (++fixtureCounter);
    await use({
      email: `e2e-fixture-${uniqueTs}@tekmar.test`,
      password: config.testUserPassword,
      orgName: `E2E Fixture Org ${uniqueTs}`,
      displayName: config.testUserDisplayName,
    });
  },

  authenticatedPage: async ({ page, credentials }, use) => {
    await registerViaUI(page, credentials);
    await use(page);
  },

  apiToken: async ({ credentials }, use) => {
    const token = await getApiToken(credentials);
    await use(token);
  },
});

export { expect };
