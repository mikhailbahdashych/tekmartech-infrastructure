#!/usr/bin/env bash
set -euo pipefail

# E2E Test Runner for Tekmar Backend
# Usage: ./run.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo "  Tekmar Backend E2E Tests"
echo "============================================"
echo ""

# Step 1: Check services
echo "--- Pre-flight: Service Health Check ---"
echo ""
if ! uv run python check_services.py; then
    echo ""
    echo "Aborting: services are not ready."
    exit 1
fi
echo ""

# Step 2: Run tests
echo "--- Running Tests ---"
echo ""
uv run pytest test_backend_flow.py -v --tb=short 2>&1
TEST_EXIT=$?
echo ""

# Step 3: Summary
echo "============================================"
if [ $TEST_EXIT -eq 0 ]; then
    echo "  All tests passed."
elif [ $TEST_EXIT -eq 1 ]; then
    echo "  Some tests failed. See details above."
elif [ $TEST_EXIT -eq 5 ]; then
    echo "  No tests were collected."
else
    echo "  Tests exited with code $TEST_EXIT."
fi
echo "============================================"

exit $TEST_EXIT
