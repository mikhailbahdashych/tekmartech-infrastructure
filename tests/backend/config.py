"""Test configuration — reads settings from env/.env.development, with env var overrides."""

import os
import time
from pathlib import Path


def _load_env_file() -> dict[str, str]:
    """Parse env/.env.development relative to the infrastructure repo root."""
    env_file = Path(__file__).resolve().parent.parent.parent / "env" / ".env.development"
    values: dict[str, str] = {}
    if not env_file.exists():
        return values
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        values[key.strip()] = val.strip().strip('"').strip("'")
    return values


_env_file = _load_env_file()


def _get(key: str, default: str = "") -> str:
    """Environment variable > .env.development file > default."""
    return os.environ.get(key, _env_file.get(key, default))


API_BASE_URL = _get("API_BASE_URL", "http://localhost:3000/api/v1")
PIPELINE_BASE_URL = _get("PIPELINE_BASE_URL", "http://localhost:8100")

GITHUB_TEST_PAT = _get("GITHUB_TEST_PAT")
GITHUB_TEST_ORG = _get("GITHUB_TEST_ORG")

_ts = int(time.time())
TEST_USER_EMAIL = os.environ.get("TEST_USER_EMAIL", f"e2e-test-{_ts}@tekmar.test")
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD", "E2eTestPass123!")
TEST_USER_DISPLAY_NAME = "E2E Test Admin"
TEST_ORG_NAME = f"E2E Test Org {_ts}"

SECOND_USER_EMAIL = f"e2e-invited-{_ts}@tekmar.test"
SECOND_USER_DISPLAY_NAME = "E2E Invited User"
SECOND_USER_PASSWORD = "InvitedPass456!"

# Timeouts
WS_INTERPRETATION_TIMEOUT = 60   # seconds
WS_EXECUTION_TIMEOUT = 120       # seconds
POLL_INTERVAL = 2                # seconds
POLL_TIMEOUT = 90                # seconds

# Derived
WS_URL = API_BASE_URL.replace("http://", "ws://").replace("https://", "wss://").replace("/api/v1", "/api/v1/ws")


def has_github_credentials() -> bool:
    return bool(GITHUB_TEST_PAT and GITHUB_TEST_ORG)
