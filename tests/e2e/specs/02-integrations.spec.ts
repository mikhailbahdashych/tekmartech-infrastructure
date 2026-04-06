import { test, expect } from '../fixtures/auth.fixture';
import { config } from '../helpers/config.helper';

/**
 * Navigate through the catalog flow to connect an integration.
 * Old dialog flow is deprecated — now uses catalog page → connect page.
 */
async function connectViaPage(
  page: import('@playwright/test').Page,
  type: string,
  fillForm: () => Promise<void>,
): Promise<void> {
  await page.getByTestId('integration-connect-button').click();
  await expect(page.getByTestId('integration-catalog-container')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId(`integration-catalog-connect-button-${type}`).click();
  await expect(page.getByTestId('integration-connect-page')).toBeVisible({ timeout: 10_000 });
  await fillForm();
  await page.getByTestId('integration-connect-submit-button').click();
  await expect(page.getByTestId('integration-list-container')).toBeVisible({ timeout: 30_000 });
}

test.describe('Integration Management', () => {
  test('empty state is shown when no integrations exist', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-integrations').click();
    await page.waitForURL('**/integrations**');
    await expect(page.getByTestId('integration-empty-state')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('integration-connect-button')).toBeVisible();
  });

  test('connect GitHub via catalog and verify persistence', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasGitHub, 'GITHUB_TEST_PAT not set');

    await page.getByTestId('sidebar-nav-integrations').click();
    await page.waitForURL('**/integrations**');

    await connectViaPage(page, 'github', async () => {
      await page.getByTestId('integration-connect-display-name-input').fill('E2E GitHub');
      await page.getByTestId('integration-connect-github-pat-input').fill(config.githubPat);
      await page.getByTestId('integration-connect-github-org-input').fill(config.githubOrg);
    });

    // Verify card appears
    const cards = page.locator('[data-testid^="integration-card-name-"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    await expect(cards.first()).toContainText('E2E GitHub');

    // Verify persistence after reload
    await page.reload();
    await expect(page.locator('[data-testid^="integration-card-name-"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid^="integration-card-name-"]').first()).toContainText('E2E GitHub');
  });

  test('connect AWS via catalog', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasAws, 'AWS credentials not set');

    await page.getByTestId('sidebar-nav-integrations').click();
    await page.waitForURL('**/integrations**');

    await connectViaPage(page, 'aws', async () => {
      await page.getByTestId('integration-connect-display-name-input').fill('E2E AWS');
      await page.getByTestId('integration-connect-aws-access-key-input').fill(config.awsAccessKeyId);
      await page.getByTestId('integration-connect-aws-secret-key-input').fill(config.awsSecretAccessKey);
      await page.getByTestId('integration-connect-aws-region-select').click();
      await page.getByText(config.awsRegion).first().click();
    });

    const cards = page.locator('[data-testid^="integration-card-name-"]');
    await expect(cards.filter({ hasText: 'E2E AWS' })).toBeVisible({ timeout: 10_000 });
  });

  test('integration health check', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasGitHub, 'GITHUB_TEST_PAT not set');

    await page.getByTestId('sidebar-nav-integrations').click();
    await page.waitForURL('**/integrations**');

    await connectViaPage(page, 'github', async () => {
      await page.getByTestId('integration-connect-display-name-input').fill('Health Test GitHub');
      await page.getByTestId('integration-connect-github-pat-input').fill(config.githubPat);
      await page.getByTestId('integration-connect-github-org-input').fill(config.githubOrg);
    });

    const testButton = page.locator('[data-testid^="integration-card-test-button-"]').first();
    await expect(testButton).toBeVisible({ timeout: 10_000 });
    await testButton.click();

    const healthBadge = page.locator('[data-testid^="integration-card-health-badge-"]').first();
    await expect(healthBadge).toBeVisible({ timeout: 15_000 });
  });

  test('catalog search filters available integrations', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-integrations').click();
    await page.waitForURL('**/integrations**');

    await page.getByTestId('integration-connect-button').click();
    await expect(page.getByTestId('integration-catalog-container')).toBeVisible({ timeout: 10_000 });

    const items = page.locator('[data-testid^="integration-catalog-item-"]');
    await expect(items.first()).toBeVisible({ timeout: 5_000 });
    const initialCount = await items.count();
    expect(initialCount).toBeGreaterThan(0);

    // Search should filter items
    const searchInput = page.getByTestId('tk-search-input-integration-catalog');
    await searchInput.fill('github');
    await page.waitForTimeout(1500);

    const filteredCount = await items.count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  test('catalog display toggle switches between cards and list', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-integrations').click();
    await page.waitForURL('**/integrations**');

    await page.getByTestId('integration-connect-button').click();
    await expect(page.getByTestId('integration-catalog-container')).toBeVisible({ timeout: 10_000 });

    const listToggle = page.getByTestId('integration-catalog-display-toggle-list');
    const cardsToggle = page.getByTestId('integration-catalog-display-toggle-cards');
    await expect(listToggle).toBeVisible({ timeout: 5_000 });

    await listToggle.click();
    await page.waitForTimeout(500);
    await cardsToggle.click();
    await page.waitForTimeout(500);

    // Catalog items should still be visible after toggling
    await expect(page.locator('[data-testid^="integration-catalog-item-"]').first()).toBeVisible();
  });

  test('disconnect integration', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasGitHub, 'GITHUB_TEST_PAT not set');

    await page.getByTestId('sidebar-nav-integrations').click();
    await page.waitForURL('**/integrations**');

    await connectViaPage(page, 'github', async () => {
      await page.getByTestId('integration-connect-display-name-input').fill('Disconnect Test');
      await page.getByTestId('integration-connect-github-pat-input').fill(config.githubPat);
      await page.getByTestId('integration-connect-github-org-input').fill(config.githubOrg);
    });

    const disconnectBtn = page.locator('[data-testid^="integration-card-disconnect-button-"]').first();
    await expect(disconnectBtn).toBeVisible({ timeout: 10_000 });
    await disconnectBtn.click();

    await expect(page.getByTestId('integration-disconnect-dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('integration-disconnect-confirm-button').click();
    await expect(page.getByTestId('integration-disconnect-dialog')).toBeHidden({ timeout: 10_000 });
  });
});
