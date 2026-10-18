import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock
os.environ.update(MONGO_URL="mongodb://localhost:27017/test", JWT_SECRET="a" * 40,
                  JWT_REFRESH_SECRET="b" * 40, APP_VERSION="unit-test")
sys.path.insert(0, str(Path(__file__).parents[1]))
from fastapi.testclient import TestClient
from pymongo.errors import ServerSelectionTimeoutError
import server


def test_health_and_readiness_have_different_failure_semantics(monkeypatch):
    monkeypatch.setattr(server, "db", type("DB", (), {"command": AsyncMock(side_effect=ServerSelectionTimeoutError("offline"))})())
    with TestClient(server.app) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/health").json()["version"] == "unit-test"
        assert client.get("/api/ready").status_code == 503


def test_ready_with_database(monkeypatch):
    monkeypatch.setattr(server, "db", type("DB", (), {"command": AsyncMock(return_value={"ok": 1})})())
    with TestClient(server.app) as client:
        assert client.get("/api/ready").status_code == 200


def test_auth_metrics_and_cors():
    with TestClient(server.app) as client:
        assert client.get("/api/tasks").status_code == 401
        assert client.get("/api/tasks", headers={"Authorization": "Bearer invalid"}).status_code == 401
        response = client.get("/api/health", headers={"Origin": "https://untrusted.example"})
        assert "access-control-allow-origin" not in response.headers
        client.get("/unknown-private-id?secret=do-not-log")
        metrics = client.get("/metrics").text
        assert 'route="/api/tasks"' in metrics
        assert "unknown-private-id" not in metrics
        assert "do-not-log" not in metrics


def test_access_and_refresh_tokens_are_not_interchangeable():
    import jwt
    from jwt.exceptions import PyJWTError as JWTError
    token = server.create_refresh_token({"sub": "test-user"})
    try:
        jwt.decode(token, server.SECRET_KEY, algorithms=[server.ALGORITHM])
    except JWTError:
        pass
    else:
        raise AssertionError("Refresh token accepted with access signing key")


def test_tracing_enabled_startup():
    import subprocess
    env = dict(os.environ, OTEL_EXPORTER_OTLP_ENDPOINT="http://127.0.0.1:4318")
    subprocess.run([sys.executable, "-c", "import server; assert server.telemetry_provider is not None; server.telemetry_provider.shutdown()"],
                   cwd=Path(__file__).parents[1], env=env, check=True, capture_output=True, timeout=20)
