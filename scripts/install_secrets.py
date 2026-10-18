#!/usr/bin/env python3
import os
from pathlib import Path
import subprocess
import sys
import tempfile
values = dict(line.split("=", 1) for line in Path(".local/runtime.env").read_text().splitlines() if line)
k = ["kubectl", "--context", sys.argv[1], "-n", "teamtasks"]
for name, keys in {
    "app-secrets": ["MONGO_URL", "DB_NAME", "JWT_SECRET", "JWT_REFRESH_SECRET"],
    "mongo-secrets": ["MONGO_INITDB_ROOT_USERNAME", "MONGO_INITDB_ROOT_PASSWORD", "APP_DB_PASSWORD"],
}.items():
    if subprocess.run(k + ["get", "secret", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
        continue
    with tempfile.NamedTemporaryFile(mode="w") as f:
        os.chmod(f.name, 0o600)
        f.write("".join(f"{key}={values[key]}\n" for key in keys))
        f.flush()
        subprocess.run(k + ["create", "secret", "generic", name, "--from-env-file=" + f.name], check=True)
