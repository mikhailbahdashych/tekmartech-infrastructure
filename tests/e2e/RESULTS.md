# E2E Test Results

**Date:** 2026-03-26
**Run time:** ~33 seconds
**Runner:** pytest 9.0.2, Python 3.12.10
**GitHub credentials:** Real PAT used (loaded from `env/.env.development`)

## Service Status

| Service | URL | Status |
|---------|-----|--------|
| Application API (tekmar-api) | http://localhost:3000 | Running (401 on protected endpoint) |
| Pipeline Service (tekmar-pipeline) | http://localhost:8100 | Healthy, v1.0.0, uptime 1194s |
| PostgreSQL (tekmar-db) | localhost:5432 | Running (via Docker) |
| LLM Provider | Ollama (configured) | Status: unknown (but functional) |
| GitHub MCP Server | Child process of Pipeline | Functional (224 repos fetched) |

## Results Summary

| Metric | Count |
|--------|-------|
| Total tests | 26 |
| Passed | 26 |
| Skipped | 0 |
| Failed | 0 |

## Detailed Results

### Test 1: Registration and Authentication - PASS (5/5)

| Test | Status | Notes |
|------|--------|-------|
| POST /auth/register | PASS | 201, access_token + tekmar_refresh_token cookie returned |
| GET /organization | PASS | 200, organization name matches |
| POST /auth/refresh | PASS | 200, new access_token issued from cookie |
| POST /auth/logout | PASS | 204, session revoked |
| POST /auth/login | PASS | 200, fresh tokens issued |

### Test 2: User Management - PASS (6/6)

| Test | Status | Notes |
|------|--------|-------|
| GET /users (initial) | PASS | Admin user present in list |
| POST /users/invite | PASS | 201, invitation created with token |
| POST /invitations/accept | PASS | 201, second user created with tokens |
| GET /users (both) | PASS | Both users appear |
| PATCH /users/:id/role | PASS | 200, second user promoted to admin |
| DELETE /users/:id | PASS | 204, second user removed |

### Test 3: Integration Management - PASS (2/2)

| Test | Status | Notes |
|------|--------|-------|
| POST /integrations | PASS | 201, integration created with real GitHub PAT, status "active" |
| GET /integrations | PASS | Integration appears in list |

### Test 4: Query Interpretation - PASS (3/3)

| Test | Status | Notes |
|------|--------|-------|
| POST /queries | PASS | 201, query created with status "interpreting" |
| WebSocket interpretation | PASS | ~250 text_delta events + query_plan_ready received |
| GET /queries/:id | PASS | Status: awaiting_approval, plan_summary populated |

The full interpretation lifecycle works:
- WebSocket connection authenticated via query param token
- Text deltas streamed in real-time (LLM reasoning visible)
- Plan generated: "List all repositories in the GitHub organization."
- Query transitioned to `awaiting_approval` with plan and summary populated

### Test 5: Query Execution - PASS (4/4)

| Test | Status | Notes |
|------|--------|-------|
| POST /queries/:id/approve | PASS | Query approved (returns 201, see issues) |
| WebSocket execution events | PASS | `query_execution_started` -> `query_step_started` -> `query_step_completed` -> `query_completed` |
| GET /queries/:id (completed) | PASS | 1 result table, 1 transparency log entry, result_data populated |
| GET /queries/:id/export/csv | PASS | 225 lines of CSV data (224 repositories + header) |

Full execution lifecycle verified:
- Query plan approved and execution started
- GitHub MCP server invoked as child process of Pipeline Service
- `list_repos` tool executed against the `knowde` GitHub organization
- 224 repositories returned in structured result_data
- CSV export working with correct content-type
- Transparency log records the tool invocation

### Test 6: Query Rejection - PASS (3/3)

| Test | Status | Notes |
|------|--------|-------|
| POST /queries (second) | PASS | 201, second query submitted |
| Poll for interpretation | PASS | Reached awaiting_approval |
| POST /queries/:id/reject | PASS | Query rejected (returns 201, see issues), completed_at set |

### Test 7: Activity Logs - PASS (2/2)

| Test | Status | Notes |
|------|--------|-------|
| GET /activity-logs | PASS | 10 entries found |
| GET /activity-logs?action=query_submitted | PASS | 2 filtered entries |

Actions recorded: `query_plan_rejected`, `query_submitted` (x2), `query_plan_approved`, `integration_connected`, `user_removed`, `user_role_changed`, `user_invited`, `user_login`, `user_registered`.

### Test 8: Pipeline Health - PASS (1/1)

| Test | Status | Notes |
|------|--------|-------|
| GET /health | PASS | status: healthy, version: 1.0.0, uptime: 1194s |

## Issues Found

### Issue 1: POST /queries/:id/approve returns 201 instead of 200

- **Severity:** Low (contract mismatch)
- **Location:** tekmar-api, query approval endpoint
- **Expected:** HTTP 200 (per `contracts/public-api.yaml` line 975)
- **Actual:** HTTP 201 Created
- **Impact:** Functionally correct. Query transitions to "approved" and execution begins.

### Issue 2: POST /queries/:id/reject returns 201 instead of 200

- **Severity:** Low (contract mismatch)
- **Location:** tekmar-api, query rejection endpoint
- **Expected:** HTTP 200 (per `contracts/public-api.yaml` line 1008)
- **Actual:** HTTP 201 Created
- **Impact:** Functionally correct. Query transitions to "rejected", completed_at set.

### Issue 3: `total_records` and `execution_duration_ms` are 0 in `query_completed` WebSocket event

- **Severity:** Medium
- **Location:** tekmar-api, WebSocket event relay
- **Expected:** `total_records` > 0 (224 repos were returned), `execution_duration_ms` > 0
- **Actual:** Both fields are 0 in the WebSocket event
- **Impact:** The actual result data is correct (verified via GET /queries/:id), but the WebSocket summary event doesn't reflect the real counts. The Interface Layer would show "0 records" in the completion notification even though data is present.
- **Recommendation:** Populate `total_records` from `result_data` row counts and `execution_duration_ms` from actual timing before emitting the WebSocket event.

### Issue 4: WebSocket does not send `query_interpreting` event

- **Severity:** Low
- **Details:** The contract (`public-api.yaml` line 1205-1216) specifies a `query_interpreting` event should be sent before text deltas. The first events received were `query_interpretation_text_delta`.
- **Possible cause:** Event sent before WS connection established, or not implemented.
- **Recommendation:** Verify emission; consider buffering recent events for late-connecting clients.

### Issue 5: LLM provider health status is "unknown"

- **Severity:** Informational
- **Details:** Pipeline health reports LLM provider (ollama) status as "unknown" with `last_check_at: null`, despite interpretation working correctly.
- **Recommendation:** Run health check on startup so `/health` reflects actual provider status.

## Recommendations

1. **Fix approve/reject status codes** in tekmar-api to return 200 per contract (both currently return 201).
2. **Populate `total_records` and `execution_duration_ms`** in the `query_completed` WebSocket event.
3. **Investigate `query_interpreting` WebSocket event** emission.
4. **Run LLM health check proactively** so `/health` reports accurate provider status.
5. **Remove real GitHub PAT from `env/.env.example`** — that file is meant to be committed with placeholders only.
