import { test, expect } from '../fixtures/auth.fixture';
import { config } from '../helpers/config.helper';

/**
 * Connect a GitHub integration in the current authenticated session.
 */
async function connectGitHub(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('sidebar-nav-integrations').click();
  await page.waitForURL('**/integrations**');

  const cards = page.locator('[data-testid^="integration-card-name-"]');
  if (await cards.count() > 0) return; // already connected

  await page.getByTestId('integration-connect-button').click();
  await expect(page.getByTestId('integration-connect-dialog')).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('integration-type-card-github').click();
  await page.getByTestId('integration-connect-display-name-input').fill('E2E GitHub');
  await page.getByTestId('integration-connect-github-pat-input').fill(config.githubPat);
  await page.getByTestId('integration-connect-github-org-input').fill(config.githubOrg);
  await page.getByTestId('integration-connect-submit-button').click();
  await expect(page.getByTestId('integration-connect-dialog')).toBeHidden({ timeout: 30_000 });
  await expect(cards.first()).toBeVisible({ timeout: 10_000 });
}

/**
 * Type into the chat-style query input.
 * The testid is on a div container; the actual textarea is nested inside.
 */
async function typeQuery(page: import('@playwright/test').Page, text: string): Promise<void> {
  const container = page.getByTestId('query-input-textarea');
  const textarea = container.locator('textarea');
  await textarea.fill(text);
}

/**
 * Submit a query and wait for the plan to appear.
 * Scrolls the plan into view once it appears (the interpretation text
 * pushes the plan below the viewport).
 * Retries up to 3 times if the LLM produces an invalid plan.
 */
async function submitQueryAndWaitForPlan(
  page: import('@playwright/test').Page,
  queryText: string,
  maxAttempts = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await page.getByTestId('sidebar-nav-queries').click();
    await page.waitForURL('**/new**');
    await typeQuery(page, queryText);
    await page.getByTestId('query-submit-button').click();
    await expect(page.getByTestId('query-interpretation-container')).toBeVisible({ timeout: 15_000 });

    // Keep scrolling to the bottom while waiting — the plan container renders
    // below the interpretation text which can be very long.
    const scrollInterval = setInterval(() => {
      page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    }, 2_000);

    try {
      const outcome = await Promise.race([
        page.getByTestId('query-plan-container').waitFor({ state: 'attached', timeout: 90_000 }).then(() => 'plan' as const),
        page.getByTestId('query-interpretation-error-text').waitFor({ state: 'attached', timeout: 90_000 }).then(() => 'error' as const),
        page.getByTestId('query-failed-error-text').waitFor({ state: 'attached', timeout: 90_000 }).then(() => 'failed' as const),
      ]);

      if (outcome === 'plan') {
        await page.getByTestId('query-plan-container').scrollIntoViewIfNeeded();
        return;
      }
    } finally {
      clearInterval(scrollInterval);
    }

    // LLM produced invalid plan or no plan — retry if attempts remain
    if (attempt < maxAttempts) {
      console.log(`  LLM interpretation failed (attempt ${attempt}/${maxAttempts}), retrying...`);
      await page.goto('/new');
      await expect(page.getByTestId('sidebar-container')).toBeVisible({ timeout: 10_000 });
    }
  }

  throw new Error(`LLM failed to produce a valid plan after ${maxAttempts} attempts`);
}

test.describe('Query Lifecycle', () => {

  test('submit query and see streaming interpretation with plan', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasGitHub, 'GITHUB_TEST_PAT required');
    test.setTimeout(90_000);
    await connectGitHub(page);

    await page.getByTestId('sidebar-nav-queries').click();
    await page.waitForURL('**/new**');

    await typeQuery(page, 'List all repositories in our GitHub organization');
    await page.getByTestId('query-submit-button').click();

    // Verify interpretation streaming starts
    await expect(page.getByTestId('query-interpretation-container')).toBeVisible({ timeout: 15_000 });
    const interpretationText = page.getByTestId('query-interpretation-text');
    await expect(interpretationText).toBeVisible({ timeout: 60_000 });
    await expect(interpretationText).not.toBeEmpty({ timeout: 60_000 });

    // Plan should appear after interpretation completes — scroll it into view
    const planContainer = page.getByTestId('query-plan-container');
    await expect(planContainer).toBeVisible({ timeout: 90_000 });
    await planContainer.scrollIntoViewIfNeeded();

    await expect(page.getByTestId('query-plan-summary-text')).not.toBeEmpty();
    await expect(page.getByTestId('query-plan-steps-list')).toBeVisible();
    await expect(page.getByTestId('query-plan-step-0')).toBeVisible();

    // Verify the plan step has a tool name (may show friendly name like "List Repositories"
    // instead of raw tool name "github.list_repositories")
    const toolName = await page.getByTestId('query-plan-step-tool-name-0').textContent();
    expect(toolName!.trim().length).toBeGreaterThan(0);

    // Scroll to and verify action buttons
    const approveBtn = page.getByTestId('query-plan-approve-button');
    await approveBtn.scrollIntoViewIfNeeded();
    await expect(approveBtn).toBeVisible();
    await expect(page.getByTestId('query-plan-reject-button')).toBeVisible();
  });

  test('approve plan, execute, and see results with CSV export', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasGitHub, 'GITHUB_TEST_PAT required');
    test.setTimeout(180_000);
    await connectGitHub(page);
    await submitQueryAndWaitForPlan(page, 'List all repositories in our GitHub organization');

    // Scroll to and click approve
    const approveBtn = page.getByTestId('query-plan-approve-button');
    await approveBtn.scrollIntoViewIfNeeded();
    await approveBtn.click();

    // Execution container should appear
    await expect(page.getByTestId('query-execution-container')).toBeVisible({ timeout: 15_000 });

    // Wait for results (real API calls — may take time)
    const resultsContainer = page.getByTestId('query-results-container');
    await expect(resultsContainer).toBeVisible({ timeout: 120_000 });
    await resultsContainer.scrollIntoViewIfNeeded();

    // Verify results content
    await expect(page.getByTestId('query-results-summary-text')).not.toBeEmpty();
    const totalText = await page.getByTestId('query-results-total-records').textContent();
    const total = parseInt(totalText!.replace(/[^\d]/g, ''), 10);
    expect(total).toBeGreaterThan(0);

    // At least one result table
    await expect(page.getByTestId('query-results-table-0')).toBeVisible();

    // CSV download
    const downloadBtn = page.getByTestId('query-results-download-csv-button');
    await downloadBtn.scrollIntoViewIfNeeded();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click(),
    ]);
    expect(download.suggestedFilename()).toContain('.csv');

    // Transparency log
    const logToggle = page.getByTestId('query-results-transparency-log-toggle');
    await logToggle.scrollIntoViewIfNeeded();
    await logToggle.click();
    await expect(page.getByTestId('query-results-transparency-log-container')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('query-results-transparency-log-entry-0')).toBeVisible();
  });

  test('completed query appears in history and detail page loads', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasGitHub, 'GITHUB_TEST_PAT required');
    test.setTimeout(180_000);
    await connectGitHub(page);
    await submitQueryAndWaitForPlan(page, 'List all repositories in our GitHub organization');

    // Approve and wait for completion
    const approveBtn = page.getByTestId('query-plan-approve-button');
    await approveBtn.scrollIntoViewIfNeeded();
    await approveBtn.click();
    await expect(page.getByTestId('query-results-container')).toBeVisible({ timeout: 120_000 });

    // Navigate to history
    await page.getByTestId('sidebar-nav-history').click();
    await page.waitForURL('**/queries/history**');
    await expect(page.getByTestId('query-history-table')).toBeVisible({ timeout: 10_000 });

    // At least one row
    const rows = page.locator('[data-testid^="query-history-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });

    // Click first row to view detail
    await rows.first().click();
    await page.waitForURL('**/queries/**', { timeout: 10_000 });
    await expect(page.getByTestId('query-detail-container')).toBeVisible({ timeout: 10_000 });
  });

  test('reject a plan', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasGitHub, 'GITHUB_TEST_PAT required');
    test.setTimeout(300_000);
    await connectGitHub(page);
    await submitQueryAndWaitForPlan(page, 'List all repositories in our GitHub organization');

    const rejectBtn = page.getByTestId('query-plan-reject-button');
    await rejectBtn.scrollIntoViewIfNeeded();
    await rejectBtn.click();
    await expect(page.getByTestId('query-rejected-text')).toBeVisible({ timeout: 10_000 });
  });

  test('query failure or recovery for nonsensical input', async ({ authenticatedPage: page }) => {
    test.skip(!config.hasGitHub, 'GITHUB_TEST_PAT required');
    test.setTimeout(90_000);
    await connectGitHub(page);

    await page.getByTestId('sidebar-nav-queries').click();
    await page.waitForURL('**/new**');
    await typeQuery(page, 'xyz');
    await page.getByTestId('query-submit-button').click();

    // Wait for any terminal state — plan, error, or failure
    const outcome = await Promise.race([
      page.getByTestId('query-plan-container').waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'plan'),
      page.getByTestId('query-interpretation-error-text').waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'interp-error'),
      page.getByTestId('query-failed-error-text').waitFor({ state: 'visible', timeout: 60_000 }).then(() => 'failed'),
    ]);

    expect(['plan', 'interp-error', 'failed']).toContain(outcome);
  });
});
