import { test, expect } from '../fixtures/auth.fixture';
import { config } from '../helpers/config.helper';

test.describe('User Management', () => {
  test('view team members table with admin user', async ({ authenticatedPage: page }) => {
    await page.getByTestId('sidebar-nav-team').click();
    await page.waitForURL('**/users**');
    await expect(page.getByTestId('user-table')).toBeVisible({ timeout: 10_000 });

    const rows = page.locator('[data-testid^="user-row-"]').filter({ has: page.locator('td') });
    await expect(rows.first()).toBeVisible();
  });

  test('invite a user and see pending invitation', async ({ authenticatedPage: page }) => {
    const inviteEmail = `e2e-invite-check-${Date.now()}@tekmar.test`;

    await page.getByTestId('sidebar-nav-team').click();
    await page.waitForURL('**/users**');

    await page.getByTestId('user-invite-button').click();
    await expect(page.getByTestId('user-invite-dialog')).toBeVisible({ timeout: 5_000 });

    await page.getByTestId('user-invite-email-input').fill(inviteEmail);
    // Role defaults to "Member" — only interact if it shows a different value
    const roleSelect = page.getByTestId('user-invite-role-select');
    if (await roleSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const currentRole = await roleSelect.textContent();
      if (currentRole && !/member/i.test(currentRole)) {
        await roleSelect.click();
        await page.getByText('Member').first().click();
      }
    }

    await page.getByTestId('user-invite-submit-button').click();
    await expect(page.getByTestId('user-invite-dialog')).toBeHidden({ timeout: 10_000 });

    // Invitation should appear in invitations table
    await expect(page.getByTestId('invitation-table')).toBeVisible({ timeout: 10_000 });
  });

  test('invite, accept, change role, and remove user — full lifecycle', async ({ authenticatedPage: page, credentials, apiToken }) => {
    const inviteEmail = `e2e-lifecycle-${Date.now()}@tekmar.test`;

    await page.getByTestId('sidebar-nav-team').click();
    await page.waitForURL('**/users**');

    // --- Invite (intercept response to capture token) ---
    await page.getByTestId('user-invite-button').click();
    await expect(page.getByTestId('user-invite-dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('user-invite-email-input').fill(inviteEmail);

    const [inviteResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/users/invite') && resp.status() === 201),
      page.getByTestId('user-invite-submit-button').click(),
    ]);
    const inviteBody = await inviteResponse.json();
    const invitation = inviteBody.invitation || inviteBody;
    const invitationToken = invitation.token || inviteBody.token || '';
    expect(invitationToken).toBeTruthy();

    await expect(page.getByTestId('user-invite-dialog')).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId('invitation-table')).toBeVisible({ timeout: 10_000 });

    // --- Accept invitation in a fresh browser context ---
    const browser = page.context().browser()!;
    const acceptCtx = await browser.newContext();
    const acceptPage = await acceptCtx.newPage();
    const acceptUrl = `${config.frontendUrl}/invitations/accept?token=${invitationToken}&email=${encodeURIComponent(inviteEmail)}`;
    await acceptPage.goto(acceptUrl);

    await acceptPage.getByTestId('invitation-display-name-input').fill('Lifecycle User');
    await acceptPage.getByTestId('invitation-password-input').fill(config.secondUserPassword);
    await acceptPage.getByTestId('invitation-confirm-password-input').fill(config.secondUserPassword);
    await acceptPage.getByTestId('invitation-submit-button').click();
    await acceptPage.waitForURL('**/new**', { timeout: 15_000 });
    await expect(acceptPage.getByTestId('sidebar-container')).toBeVisible({ timeout: 10_000 });
    await acceptCtx.close();

    // --- Verify user appears in admin's team page ---
    await page.reload();
    await expect(page.getByTestId('user-table')).toBeVisible({ timeout: 10_000 });

    // Find the new user's row
    const userRows = page.locator('[data-testid^="user-row-"]').filter({ has: page.locator('td') });
    const rowCount = await userRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Get the invited user's ID from their row testid
    let invitedUserId = '';
    for (let i = 0; i < rowCount; i++) {
      const row = userRows.nth(i);
      const text = await row.textContent();
      if (text?.includes(inviteEmail)) {
        const testid = await row.getAttribute('data-testid');
        invitedUserId = testid!.replace('user-row-', '');
        break;
      }
    }
    expect(invitedUserId).toBeTruthy();

    // --- Change role ---
    await page.getByTestId(`user-row-actions-menu-${invitedUserId}`).click();
    await page.getByTestId(`user-row-change-role-${invitedUserId}`).click();
    await expect(page.getByTestId('user-role-change-dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('user-role-change-confirm-button').click();
    await expect(page.getByTestId('user-role-change-dialog')).toBeHidden({ timeout: 10_000 });

    // --- Remove user ---
    await page.getByTestId(`user-row-actions-menu-${invitedUserId}`).click();
    await page.getByTestId(`user-row-remove-${invitedUserId}`).click();
    await expect(page.getByTestId('user-remove-dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('user-remove-confirm-button').click();
    await expect(page.getByTestId('user-remove-dialog')).toBeHidden({ timeout: 10_000 });

    // User row should disappear
    await expect(page.getByTestId(`user-row-${invitedUserId}`)).toBeHidden({ timeout: 10_000 });
  });
});
