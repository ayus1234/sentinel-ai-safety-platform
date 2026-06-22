import os
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def isolated_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    yield


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"
