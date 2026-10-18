#!/usr/bin/env python3
"""Generate local secrets once. Never print their values or commit this file's output."""
from pathlib import Path
import os
import sys
import secrets

path = Path(".local/runtime.env")
path.parent.mkdir(mode=0o700, exist_ok=True)
os.chmod(path.parent, 0o700)
if path.exists():
    print("Existing secrets retained: .local/runtime.env")
    sys.exit(0)
password = secrets.token_hex(24)
values = {
    "MONGO_INITDB_ROOT_USERNAME": "root",
    "MONGO_INITDB_ROOT_PASSWORD": secrets.token_hex(24),
    "APP_DB_PASSWORD": password,
    "MONGO_URL": f"mongodb://teamtasks:{password}@mongo:27017/collaborative_todo?authSource=collaborative_todo",
    "DB_NAME": "collaborative_todo",
    "JWT_SECRET": secrets.token_hex(32),
    "JWT_REFRESH_SECRET": secrets.token_hex(32),
}
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, "w") as out:
    out.write("".join(f"{key}={value}\n" for key, value in values.items()))
print("Created .local/runtime.env with mode 0600")
