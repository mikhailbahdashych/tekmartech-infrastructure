#!/usr/bin/env python3
"""Pre-flight health check — verifies all services are reachable before running tests."""

import sys

import httpx

from config import API_BASE_URL, PIPELINE_BASE_URL


def check_api() -> bool:
    """Check that the Application API is running (expect 401 on a protected endpoint)."""
    url = f"{API_BASE_URL}/organization"
    try:
        r = httpx.get(url, timeout=5)
        if r.status_code == 401:
            print(f"  [OK] Application API at {API_BASE_URL} — running (got 401 as expected)")
            return True
        print(f"  [OK] Application API at {API_BASE_URL} — running (status {r.status_code})")
        return True
    except httpx.ConnectError:
        print(f"  [FAIL] Application API at {API_BASE_URL} — connection refused")
        return False
    except Exception as e:
        print(f"  [FAIL] Application API at {API_BASE_URL} — {e}")
        return False


def check_pipeline() -> bool:
    """Check that the Pipeline Service is running (expect 200 on /health)."""
    url = f"{PIPELINE_BASE_URL}/health"
    try:
        r = httpx.get(url, timeout=5)
        if r.status_code == 200:
            data = r.json()
            status = data.get("status", "unknown")
            print(f"  [OK] Pipeline Service at {PIPELINE_BASE_URL} — status: {status}")
            return True
        print(f"  [WARN] Pipeline Service at {PIPELINE_BASE_URL} — status {r.status_code}")
        return True
    except httpx.ConnectError:
        print(f"  [FAIL] Pipeline Service at {PIPELINE_BASE_URL} — connection refused")
        return False
    except Exception as e:
        print(f"  [FAIL] Pipeline Service at {PIPELINE_BASE_URL} — {e}")
        return False


def main() -> int:
    print("Checking services...\n")
    api_ok = check_api()
    pipeline_ok = check_pipeline()
    print()

    if api_ok and pipeline_ok:
        print("All services are reachable. Ready to run tests.")
        return 0

    print("Some services are not reachable:")
    if not api_ok:
        print("  - Application API: start with 'cd ../tekmar-api && npm run start:dev'")
    if not pipeline_ok:
        print("  - Pipeline Service: start with 'cd ../tekmar-pipeline && uv run uvicorn app.main:app --port 8100 --reload'")
    print("\nEnsure the database is running: 'docker compose -f docker/docker-compose.yml up -d tekmar-db'")
    return 1


if __name__ == "__main__":
    sys.exit(main())
