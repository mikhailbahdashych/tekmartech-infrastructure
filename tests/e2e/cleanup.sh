#!/usr/bin/env bash
set -euo pipefail

# Clean up test data from the database after E2E test runs.
# Only deletes data from the current run (identified by .run-id file),
# so it's safe when multiple developers share the same database.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Determine which env file to load
ENV_NAME="${NODE_ENV:-development}"
ENV_FILE="$SCRIPT_DIR/../../env/.env.${ENV_NAME}"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-tekmar_dev}"
DB_USER="${POSTGRES_USER:-tekmar}"

export PGPASSWORD="${POSTGRES_PASSWORD:-tekmar_dev_password}"

echo "=== E2E Test Data Cleanup ==="
echo "Database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"

# Read the run ID from the .run-id file
RUN_ID_FILE="$SCRIPT_DIR/.run-id"

if [ ! -f "$RUN_ID_FILE" ]; then
  echo "No .run-id file found — nothing to clean up."
  exit 0
fi

RUN_ID=$(cat "$RUN_ID_FILE")
echo "Run ID: $RUN_ID"
echo ""

# Match emails containing this run ID (e2e-test-{runId}, e2e-fixture-{runId}, e2e-sec-*-{runId})
EMAIL_PATTERN="%${RUN_ID}@tekmar.test"

# Find organization IDs created by this run's test users
ORG_IDS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "
  SELECT DISTINCT organization_id FROM users WHERE email LIKE '${EMAIL_PATTERN}';
")

if [ -z "$ORG_IDS" ]; then
  echo "No test data found for run $RUN_ID."
  rm -f "$RUN_ID_FILE"
  exit 0
fi

# Convert to comma-separated quoted list for IN clause
IN_CLAUSE=$(echo "$ORG_IDS" | sed "s/^/'/" | sed "s/$/'/" | paste -sd, -)
COUNT=$(echo "$ORG_IDS" | wc -l | tr -d ' ')

echo "Found $COUNT test organization(s) to clean up."
echo ""

# Delete in foreign-key dependency order (leaves → root)
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
BEGIN;

DELETE FROM activity_logs  WHERE organization_id IN ($IN_CLAUSE);
DELETE FROM queries        WHERE organization_id IN ($IN_CLAUSE);
DELETE FROM integrations   WHERE organization_id IN ($IN_CLAUSE);
DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE organization_id IN ($IN_CLAUSE));
DELETE FROM invitations    WHERE organization_id IN ($IN_CLAUSE);
DELETE FROM users          WHERE organization_id IN ($IN_CLAUSE);
DELETE FROM organizations  WHERE id IN ($IN_CLAUSE);

COMMIT;
SQL

echo ""
echo "Cleaned up $COUNT test organization(s) for run $RUN_ID."

# Remove the run ID file
rm -f "$RUN_ID_FILE"
