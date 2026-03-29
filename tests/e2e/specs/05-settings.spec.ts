import { test, expect } from '../fixtures/auth.fixture';

test.describe.serial('Organization Settings', () => {
  test('view settings page', async ({ authenticatedPage: page, credentials }) => {
    await page.getByTestId('sidebar-nav-settings').click();
    await page.waitForURL('**/settings**');

    await expect(page.getByTestId('settings-container')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('settings-org-name-input')).toHaveValue(credentials.orgName);
    await expect(page.getByTestId('settings-subscription-badge')).toBeVisible();

    const orgIdText = await page.getByTestId('settings-org-id-text').textContent();
    // UUID v4 format
    expect(orgIdText).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  test('update organization name', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-settings').click();
    await page.waitForURL('**/settings**');

    const newName = 'Updated E2E Org';
    const nameInput = page.getByTestId('settings-org-name-input');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.getByTestId('settings-org-name-save-button').click();

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Reload and verify
    await page.reload();
    await expect(page.getByTestId('settings-org-name-input')).toHaveValue(newName, { timeout: 10_000 });
  });

  test('copy organization ID', async ({ authenticatedPage: page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByTestId('sidebar-nav-settings').click();
    await page.waitForURL('**/settings**');

    const orgId = await page.getByTestId('settings-org-id-text').textContent();
    await page.getByTestId('settings-org-id-copy-button').click();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(orgId!.trim());
  });
});
