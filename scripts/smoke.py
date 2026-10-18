#!/usr/bin/env python3
"""Exercise a real authenticated user journey without printing tokens or passwords."""
import json
import os
import secrets
import urllib.request
import urllib.error
import uuid
base = os.environ.get("BASE_URL", "http://localhost:8080").rstrip("/")
def request(method, path, payload=None, token=None, expected=200):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(base + path, data=json.dumps(payload).encode() if payload is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            assert res.status == expected
            return json.load(res)
    except urllib.error.HTTPError as e:
        if e.code == expected:
            return None
        raise RuntimeError(f"{method} {path}: HTTP {e.code}") from None

health = request("GET", "/api/health")
version = os.environ.get("EXPECTED_VERSION")
if version:
    assert health["version"] == version, (health, version)
request("GET", "/api/ready")
request("GET", "/api/tasks", expected=401)
account = {"email": f"smoke-{uuid.uuid4().hex}@example.com", "password": secrets.token_urlsafe(24), "name": "Smoke Test"}
user = request("POST", "/api/auth/register", account)
login = request("POST", "/api/auth/login", {"email": account["email"], "password": account["password"]})
token = login["access_token"]
task = request("POST", "/api/tasks", {"title": "Deployment smoke test", "priority": "high"}, token)
assert any(t["id"] == task["id"] for t in request("GET", "/api/tasks", token=token))
request("PATCH", "/api/tasks/" + task["id"], {"status": "done"}, token)
refreshed = request("POST", "/api/auth/refresh", {"refresh_token": login["refresh_token"]})
request("DELETE", "/api/tasks/" + task["id"], token=refreshed["access_token"])
print(json.dumps({"result": "PASS", "version": health["version"], "checks": ["liveness", "database readiness", "unauthenticated rejection", "register", "login", "create/list/update/delete task", "refresh token"]}))
# A synthetic account remains; use a disposable test database or remove it administratively.
