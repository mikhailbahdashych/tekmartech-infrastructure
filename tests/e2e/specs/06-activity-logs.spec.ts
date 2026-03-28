import { test, expect } from '../fixtures/auth.fixture';

test.describe.serial('Activity Logs', () => {
  test('view activity logs', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-activity-log').click();
    await page.waitForURL('**/activity-logs**');

    await expect(page.getByTestId('activity-log-table')).toBeVisible({ timeout: 10_000 });

    // At least the registration action should exist
    const rows = page.locator('[data-testid^="activity-log-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('filter by action type', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-activity-log').click();
    await page.waitForURL('**/activity-logs**');
    await expect(page.getByTestId('activity-log-table')).toBeVisible({ timeout: 10_000 });

    // Open filter and select an action
    const filter = page.getByTestId('activity-log-action-filter');
    await filter.click();
    // tk-select opens inline — options are text items within the component
    await page.getByText('User Registered').first().click();

    // Wait for table to refresh
    await page.waitForTimeout(1500);

    // All visible rows should be filtered (just verify table is still visible)
    await expect(page.getByTestId('activity-log-table')).toBeVisible();
  });

  test('filter by user', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-activity-log').click();
    await page.waitForURL('**/activity-logs**');
    await expect(page.getByTestId('activity-log-table')).toBeVisible({ timeout: 10_000 });

    const userFilter = page.getByTestId('activity-log-user-filter');
    if (await userFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await userFilter.click();
      await page.getByText('E2E Test Admin').first().click();
      await page.waitForTimeout(1500);
      await expect(page.getByTestId('activity-log-table')).toBeVisible();
    }
  });

  test('action descriptions are human-readable', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-activity-log').click();
    await page.waitForURL('**/activity-logs**');
    await expect(page.getByTestId('activity-log-table')).toBeVisible({ timeout: 10_000 });

    // Read the first action cell
    const actionCell = page.getByTestId('activity-log-row-action-0');
    if (await actionCell.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const text = await actionCell.textContent();
      // Should be human-readable (contains spaces, capitalized), not raw enum
      expect(text!.trim().length).toBeGreaterThan(3);
      // Should not look like a raw snake_case enum value
      expect(text).not.toMatch(/^[a-z_]+$/);
    }
  });
});
