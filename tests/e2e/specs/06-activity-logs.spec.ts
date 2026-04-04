import { test, expect } from '../fixtures/auth.fixture';

test.describe.serial('Activity Logs', () => {
  test('view activity logs', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-activity-log').click();
    await page.waitForURL('**/activity-logs**');

    await expect(page.getByTestId('activity-log-table')).toBeVisible({ timeout: 10_000 });

    const rows = page.locator('[data-testid^="activity-log-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('filter by action type via multi-select', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-activity-log').click();
    await page.waitForURL('**/activity-logs**');
    await expect(page.getByTestId('activity-log-table')).toBeVisible({ timeout: 10_000 });

    // Open multi-select for action filter
    await page.getByTestId('tk-multi-select-trigger-activity-action').click();
    await expect(page.getByTestId('tk-multi-select-panel-activity-action')).toBeVisible({ timeout: 5_000 });

    // Select "user_registered" option
    await page.getByTestId('tk-multi-select-option-user_registered').click();

    // Close panel by clicking trigger again
    await page.getByTestId('tk-multi-select-trigger-activity-action').click();

    // Wait for table to refresh
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('activity-log-table')).toBeVisible();

    // Verify URL has the filter param
    expect(page.url()).toContain('action=user_registered');
  });

  test('filter by user via multi-select', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-activity-log').click();
    await page.waitForURL('**/activity-logs**');
    await expect(page.getByTestId('activity-log-table')).toBeVisible({ timeout: 10_000 });

    // Open user filter multi-select
    await page.getByTestId('tk-multi-select-trigger-activity-user').click();
    await expect(page.getByTestId('tk-multi-select-panel-activity-user')).toBeVisible({ timeout: 5_000 });

    // Select the first available user option
    const options = page.locator('[data-testid^="tk-multi-select-option-"]');
    await expect(options.first()).toBeVisible({ timeout: 3_000 });
    await options.first().click();

    // Close panel
    await page.getByTestId('tk-multi-select-trigger-activity-user').click();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('activity-log-table')).toBeVisible();
  });

  test('action descriptions are human-readable', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-activity-log').click();
    await page.waitForURL('**/activity-logs**');
    await expect(page.getByTestId('activity-log-table')).toBeVisible({ timeout: 10_000 });

    const actionCell = page.getByTestId('activity-log-row-action-0');
    if (await actionCell.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const text = await actionCell.textContent();
      expect(text!.trim().length).toBeGreaterThan(3);
      expect(text).not.toMatch(/^[a-z_]+$/);
    }
  });
});
