import { test, expect } from '@playwright/test';
import { config } from '../helpers/config.helper';

test.describe.serial('Authentication', () => {
  const creds = {
    email: config.testUserEmail,
    password: config.testUserPassword,
    orgName: config.testOrgName,
    displayName: config.testUserDisplayName,
  };

  test('register a new organization and user', async ({ page }) => {
    await page.goto('/register');
    await page.getByTestId('register-org-name-input').fill(creds.orgName);
    await page.getByTestId('register-display-name-input').fill(creds.displayName);
    await page.getByTestId('register-email-input').fill(creds.email);
    await page.getByTestId('register-password-input').fill(creds.password);
    await page.getByTestId('register-confirm-password-input').fill(creds.password);
    await page.getByTestId('register-submit-button').click();

    await page.waitForURL('**/new**', { timeout: 15_000 });
    await expect(page.getByTestId('sidebar-user-name')).toBeVisible();
    await expect(page.getByTestId('sidebar-new-query-button')).toBeVisible();
  });

  test('logout redirects to login', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(creds.email);
    await page.getByTestId('login-password-input').fill(creds.password);
    await page.getByTestId('login-submit-button').click();
    await page.waitForURL('**/new**', { timeout: 15_000 });
    await expect(page.getByTestId('sidebar-container')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('sidebar-logout-button').click();
    await page.waitForURL('**/login**', { timeout: 10_000 });
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(creds.email);
    await page.getByTestId('login-password-input').fill(creds.password);
    await page.getByTestId('login-submit-button').click();

    await page.waitForURL('**/new**', { timeout: 15_000 });
    await expect(page.getByTestId('sidebar-user-name')).toBeVisible();
  });

  test('silent refresh preserves session on page reload', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(creds.email);
    await page.getByTestId('login-password-input').fill(creds.password);
    await page.getByTestId('login-submit-button').click();
    await page.waitForURL('**/new**', { timeout: 15_000 });
    await expect(page.getByTestId('sidebar-container')).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.getByTestId('sidebar-container')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('sidebar-user-name')).toBeVisible();
  });

  test('protected route redirects to login when unauthenticated', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/new');
    await page.waitForURL('**/login**', { timeout: 10_000 });
    await context.close();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(creds.email);
    await page.getByTestId('login-password-input').fill('WrongPassword!');
    await page.getByTestId('login-submit-button').click();

    await expect(page.getByTestId('login-error-text')).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('registration with duplicate email shows error', async ({ page }) => {
    await page.goto('/register');
    await page.getByTestId('register-org-name-input').fill('Duplicate Org');
    await page.getByTestId('register-display-name-input').fill('Dup User');
    await page.getByTestId('register-email-input').fill(creds.email);
    await page.getByTestId('register-password-input').fill(creds.password);
    await page.getByTestId('register-confirm-password-input').fill(creds.password);
    await page.getByTestId('register-submit-button').click();

    await expect(page.getByTestId('register-error-text')).toBeVisible({ timeout: 10_000 });
  });
});
