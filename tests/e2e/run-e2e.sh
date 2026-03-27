#!/usr/bin/env bash
set -euo pipefail

# Tekmar E2E Browser Test Runner
# Usage: ./run-e2e.sh [playwright args...]
# Examples:
#   ./run-e2e.sh                          # Run all tests (development)
#   NODE_ENV=production ./run-e2e.sh      # Run against production env
#   ./run-e2e.sh --headed                 # Watch tests in browser
#   ./run-e2e.sh specs/01-auth*           # Run auth tests only

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export NODE_ENV="${NODE_ENV:-development}"

echo "============================================"
echo "  Tekmar E2E Browser Tests (Playwright)"
echo "  Environment: $NODE_ENV"
echo "============================================"
echo ""

# Check services
echo "--- Pre-flight: Service Health Check ---"
echo ""
if curl -sf http://localhost:4200 > /dev/null 2>&1; then
  echo "  [OK] Frontend at localhost:4200"
else
  echo "  [FAIL] Frontend not running at localhost:4200"
  echo "         Start with: cd ../tekmar-interface && npm start"
  exit 1
fi

HTTP_CODE=$(curl -so /dev/null -w "%{http_code}" http://localhost:3000/api/v1/organization 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "  [OK] API at localhost:3000 (HTTP $HTTP_CODE)"
else
  echo "  [FAIL] API not reachable at localhost:3000 (HTTP $HTTP_CODE)"
  echo "         Start with: cd ../tekmar-api && npm run start:dev"
  exit 1
fi

if curl -sf http://localhost:8100/health > /dev/null 2>&1; then
  echo "  [OK] Pipeline at localhost:8100"
else
  echo "  [FAIL] Pipeline not running at localhost:8100"
  echo "         Start with: cd ../tekmar-pipeline && uv run uvicorn app.main:app --port 8100 --reload"
  exit 1
fi

echo ""
echo "All services are reachable."
echo ""

# Run tests
echo "--- Running Playwright Tests ---"
echo ""
npx playwright test "$@"
TEST_EXIT=$?

# Cleanup test data from database
echo ""
echo "--- Cleaning up test data ---"
echo ""
./cleanup.sh

exit $TEST_EXIT
