import { test, expect } from '../fixtures/auth.fixture';
import { config } from '../helpers/config.helper';

test.describe('Integration Management', () => {
  test('empty state is shown when no integrations exist', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-integrations').click();
    await page.waitForURL('**/integrations**');
    await expect(page.getByTestId('integration-empty-state')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('integration-connect-button')).toBeVisible();
  });

  test('connect GitHub integration and verify it persists', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasGitHub, 'GITHUB_TEST_PAT not set');

    await page.getByTestId('sidebar-nav-integrations').click();
    await page.waitForURL('**/integrations**');

    // Connect
    await page.getByTestId('integration-connect-button').click();
    await expect(page.getByTestId('integration-connect-dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('integration-type-card-github').click();
    await page.getByTestId('integration-connect-display-name-input').fill('E2E GitHub');
    await page.getByTestId('integration-connect-github-pat-input').fill(config.githubPat);
    await page.getByTestId('integration-connect-github-org-input').fill(config.githubOrg);
    await page.getByTestId('integration-connect-submit-button').click();

    await expect(page.getByTestId('integration-connect-dialog')).toBeHidden({ timeout: 30_000 });

    // Verify card appears with correct name
    const cards = page.locator('[data-testid^="integration-card-name-"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    await expect(cards.first()).toContainText('E2E GitHub');

    // Verify persistence — reload page and check card still shows
    await page.reload();
    await expect(page.locator('[data-testid^="integration-card-name-"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid^="integration-card-name-"]').first()).toContainText('E2E GitHub');
  });

  test('connect AWS integration', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasAws, 'AWS credentials not set');

    await page.getByTestId('sidebar-nav-integrations').click();
    await page.waitForURL('**/integrations**');

    await page.getByTestId('integration-connect-button').click();
    await expect(page.getByTestId('integration-connect-dialog')).toBeVisible({ timeout: 5_000 });

    await page.getByTestId('integration-type-card-aws').click();
    await page.getByTestId('integration-connect-display-name-input').fill('E2E AWS');
    await page.getByTestId('integration-connect-aws-access-key-input').fill(config.awsAccessKeyId);
    await page.getByTestId('integration-connect-aws-secret-key-input').fill(config.awsSecretAccessKey);
    await page.getByTestId('integration-connect-aws-region-select').click();
    await page.locator('mat-option').filter({ hasText: config.awsRegion }).click();
    await page.getByTestId('integration-connect-submit-button').click();

    await expect(page.getByTestId('integration-connect-dialog')).toBeHidden({ timeout: 30_000 });
    const cards = page.locator('[data-testid^="integration-card-name-"]');
    await expect(cards.filter({ hasText: 'E2E AWS' })).toBeVisible({ timeout: 10_000 });
  });

  test('test integration health check', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasGitHub, 'GITHUB_TEST_PAT not set');

    await page.getByTestId('sidebar-nav-integrations').click();
    await page.waitForURL('**/integrations**');

    // Connect GitHub first (fresh org)
    await page.getByTestId('integration-connect-button').click();
    await expect(page.getByTestId('integration-connect-dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('integration-type-card-github').click();
    await page.getByTestId('integration-connect-display-name-input').fill('Health Test GitHub');
    await page.getByTestId('integration-connect-github-pat-input').fill(config.githubPat);
    await page.getByTestId('integration-connect-github-org-input').fill(config.githubOrg);
    await page.getByTestId('integration-connect-submit-button').click();
    await expect(page.getByTestId('integration-connect-dialog')).toBeHidden({ timeout: 30_000 });

    // Find the test button on the card
    const testButton = page.locator('[data-testid^="integration-card-test-button-"]').first();
    await expect(testButton).toBeVisible({ timeout: 10_000 });
    await testButton.click();

    // Wait for health badge to appear/update
    const healthBadge = page.locator('[data-testid^="integration-card-health-badge-"]').first();
    await expect(healthBadge).toBeVisible({ timeout: 15_000 });
  });
});
