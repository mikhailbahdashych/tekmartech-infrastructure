# E2E Browser Test Results (Playwright)

**Date:** 2026-03-27
**Run time:** ~4 minutes
**Runner:** Playwright 1.58.2, Chromium (headless), Node.js
**GitHub credentials:** Real PAT (knowde org)
**AWS credentials:** Real credentials (us-east-1)

## Service Status

| Service | URL | Status |
|---------|-----|--------|
| Angular Frontend (tekmar-interface) | http://localhost:4200 | Running |
| Application API (tekmar-api) | http://localhost:3000 | Running |
| Pipeline Service (tekmar-pipeline) | http://localhost:8100 | Healthy, v1.0.0 |
| PostgreSQL (tekmar-db) | localhost:5432 | Running (Docker) |

## Results Summary

| Metric | Count |
|--------|-------|
| Total tests | 35 |
| Passed | 35 |
| Skipped | 0 |
| Failed | 0 |

## Results by Spec File

| File | Tests | Passed |
|------|-------|--------|
| 01-auth.spec.ts | 7 | 7 |
| 02-integrations.spec.ts | 4 | 4 |
| 03-query-lifecycle.spec.ts | 5 | 5 |
| 04-user-management.spec.ts | 3 | 3 |
| 05-settings.spec.ts | 3 | 3 |
| 06-activity-logs.spec.ts | 4 | 4 |
| 07-security.spec.ts | 9 | 9 |

## Detailed Results

### 01-auth.spec.ts — Authentication (7/7)

- Register new org + user, verify sidebar shows name and role badge
- Logout redirects to /login
- Login with valid credentials redirects to /queries
- Silent refresh preserves session on page reload (F5)
- Protected route redirects unauthenticated users to /login
- Invalid credentials shows error message, stays on /login
- Duplicate email registration shows error message

### 02-integrations.spec.ts — Integration Management (4/4)

- Empty state shown when no integrations exist
- Connect GitHub integration with real PAT, verify it persists on page reload
- Connect AWS integration with real credentials
- Health check button updates health badge on integration card

### 03-query-lifecycle.spec.ts — Query Lifecycle (5/5)

- Submit query, see streaming AI interpretation text, verify plan with GitHub tool reference
- Approve plan, execute against real GitHub API (224 repos from knowde org), verify results table, CSV download, transparency log
- Completed query appears in history, detail page loads from history row click
- Reject a plan, verify rejection confirmation text
- Nonsensical input ("xyz") handled gracefully by LLM

### 04-user-management.spec.ts — User Management (3/3)

- View team members table with admin user visible
- Invite a user, see pending invitation in table
- Full lifecycle: invite user, accept invitation (via EXPOSE_INVITATION_TOKENS), verify user in table, change role via dialog, remove user via dialog, verify user disappears

### 05-settings.spec.ts — Organization Settings (3/3)

- View settings: org name input, subscription badge, org ID (UUID format validated)
- Update organization name, verify persistence on page reload
- Copy organization ID to clipboard (clipboard assertion)

### 06-activity-logs.spec.ts — Activity Logs (4/4)

- View activity logs table with entries from test actions
- Filter by action type via dropdown
- Filter by user via dropdown
- Verify action descriptions are human-readable (not raw snake_case enums)

### 07-security.spec.ts — Authorization & Security (9/9)

- Register admin user
- Invite member user, capture invitation token from POST response
- Accept invitation as member in fresh browser context
- Member cannot see admin-only sidebar links (Integrations, Team, Activity Log, Settings)
- Member is redirected away from admin pages (/integrations, /users, /activity-logs, /settings)
- Member can access query input on /queries
- Member can view query history
- Unauthenticated access to /queries, /integrations, /users all redirect to /login
- Invalid invitation token shows error after form submission
