import { test as base, expect } from '@playwright/test';
import { config } from '../helpers/config.helper';

const adminEmail = `e2e-sec-admin-${config.runId}@tekmar.test`;
const memberEmail = `e2e-sec-member-${config.runId}@tekmar.test`;
const password = config.testUserPassword;
const orgName = `Security Test Org ${config.runId}`;

base.describe.serial('Authorization & Security', () => {
  let invitationToken: string;

  base('setup: register admin', async ({ page }) => {
    await page.goto('/register');
    await page.getByTestId('register-org-name-input').fill(orgName);
    await page.getByTestId('register-display-name-input').fill('Security Admin');
    await page.getByTestId('register-email-input').fill(adminEmail);
    await page.getByTestId('register-password-input').fill(password);
    await page.getByTestId('register-confirm-password-input').fill(password);
    await page.getByTestId('register-submit-button').click();
    await page.waitForURL('**/new**', { timeout: 15_000 });
    await expect(page.getByTestId('sidebar-container')).toBeVisible({ timeout: 10_000 });
  });

  base('setup: invite member and get token', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(adminEmail);
    await page.getByTestId('login-password-input').fill(password);
    await page.getByTestId('login-submit-button').click();
    await page.waitForURL('**/new**', { timeout: 15_000 });

    // Invite — intercept the POST response to capture the invitation token
    await page.getByTestId('sidebar-nav-team').click();
    await page.waitForURL('**/users**');
    await page.getByTestId('user-invite-button').click();
    await expect(page.getByTestId('user-invite-dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('user-invite-email-input').fill(memberEmail);

    // Intercept the invite API response to get the token
    const [inviteResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/users/invite') && resp.status() === 201),
      page.getByTestId('user-invite-submit-button').click(),
    ]);
    const inviteBody = await inviteResponse.json();
    const invitation = inviteBody.invitation || inviteBody;
    invitationToken = invitation.token || inviteBody.token || '';
    expect(invitationToken).toBeTruthy();

    await expect(page.getByTestId('user-invite-dialog')).toBeHidden({ timeout: 10_000 });
  });

  base('setup: accept invitation as member', async ({ browser }) => {
    base.skip(!invitationToken, 'Invitation token not available');

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/invitations/accept?token=${invitationToken}&email=${encodeURIComponent(memberEmail)}`);
    await page.getByTestId('invitation-display-name-input').fill('Security Member');
    await page.getByTestId('invitation-password-input').fill(password);
    await page.getByTestId('invitation-confirm-password-input').fill(password);
    await page.getByTestId('invitation-submit-button').click();
    await page.waitForURL('**/new**', { timeout: 15_000 });
    await ctx.close();
  });

  base('member cannot see admin-only sidebar links', async ({ page }) => {
    base.skip(!invitationToken, 'Member not created');

    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(memberEmail);
    await page.getByTestId('login-password-input').fill(password);
    await page.getByTestId('login-submit-button').click();
    await page.waitForURL('**/new**', { timeout: 15_000 });
    await expect(page.getByTestId('sidebar-container')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId('sidebar-nav-integrations')).toBeHidden();
    await expect(page.getByTestId('sidebar-nav-team')).toBeHidden();
    await expect(page.getByTestId('sidebar-nav-activity-log')).toBeHidden();
    await expect(page.getByTestId('sidebar-nav-settings')).toBeHidden();
  });

  base('member is redirected from admin pages', async ({ page }) => {
    base.skip(!invitationToken, 'Member not created');

    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(memberEmail);
    await page.getByTestId('login-password-input').fill(password);
    await page.getByTestId('login-submit-button').click();
    await page.waitForURL('**/new**', { timeout: 15_000 });

    for (const route of ['/integrations', '/users', '/activity-logs', '/settings']) {
      await page.goto(route);
      await page.waitForTimeout(2000);
      const url = page.url();
      expect(url).not.toContain(route);
    }
  });

  base('member can access query input', async ({ page }) => {
    base.skip(!invitationToken, 'Member not created');

    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(memberEmail);
    await page.getByTestId('login-password-input').fill(password);
    await page.getByTestId('login-submit-button').click();
    await page.waitForURL('**/new**', { timeout: 15_000 });

    await expect(page.getByTestId('query-input-textarea')).toBeVisible();
    // Submit button only appears when text is present (chat-style input)
    await expect(page.getByTestId('query-input-textarea')).toBeEnabled();
  });

  base('member can view query history', async ({ page }) => {
    base.skip(!invitationToken, 'Member not created');

    await page.goto('/login');
    await page.getByTestId('login-email-input').fill(memberEmail);
    await page.getByTestId('login-password-input').fill(password);
    await page.getByTestId('login-submit-button').click();
    await page.waitForURL('**/new**', { timeout: 15_000 });

    await page.getByTestId('sidebar-nav-history').click();
    await page.waitForURL('**/queries/history**');
    await expect(page.getByTestId('sidebar-container')).toBeVisible();
  });

  base('unauthenticated access is rejected', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    for (const route of ['/new', '/integrations', '/users']) {
      await page.goto(route);
      await page.waitForURL('**/login**', { timeout: 10_000 });
    }

    await ctx.close();
  });

  base('invalid invitation token shows error on submit', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/invitations/accept?token=invalid_token_abc&email=test@test.com');

    await expect(page.getByTestId('invitation-submit-button')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('invitation-display-name-input').fill('Test');
    await page.getByTestId('invitation-password-input').fill('TestPass123!');
    await page.getByTestId('invitation-confirm-password-input').fill('TestPass123!');
    await page.getByTestId('invitation-submit-button').click();

    await expect(page.getByTestId('invitation-error-text')).toBeVisible({ timeout: 10_000 });

    await ctx.close();
  });
});
