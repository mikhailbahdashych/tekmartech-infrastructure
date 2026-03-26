"""Shared pytest fixtures and configuration."""

import pytest


def pytest_configure(config):
    config.addinivalue_line("markers", "requires_github: test needs real GitHub credentials")
    config.addinivalue_line("markers", "requires_interpretation: test needs successful query interpretation")
