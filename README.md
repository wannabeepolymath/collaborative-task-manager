# TeamTasks: Advanced DevOps project

TeamTasks is a React Native/Expo web client and FastAPI API for personal and shared tasks, backed by MongoDB. This PR turns the preserved application into a reproducible local Kubernetes deployment.

- Student: Daksh Jain, 23bcs10125.
- Baseline: [`cc8902b66535d5ef475ee9be153a3af2b205abb5`](https://github.com/wannabeepolymath/collaborative-task-manager/commit/cc8902b66535d5ef475ee9be153a3af2b205abb5).
- All course improvements are on one PR. The PR head and CI evidence identify the final revision; do not merge or rewrite the baseline before review.
- [Architecture, decisions and limitations](docs/OPERATIONS.md).
- [Validation evidence](docs/EVIDENCE.md).

## Prerequisites

Docker Engine with at least 4 GB available, Git, Python 3.12, kubectl with Kustomize, and Minikube (Docker driver). No cloud account is required. Ports 8080, 9090 and 16686 must be free. The CI runner uses kind instead of Minikube. Native mobile builds and Google OAuth are outside the tested deployment; email/password login is the supported demo path.

## Build and deploy locally

Run from the repository root. Keep `.local/runtime.env` private. It contains generated credentials and is ignored by Git and Docker. The original tracked frontend environment file is removed from the current tree; historical commits are preserved.

```bash
minikube start -p teamtasks-devops --driver=docker --cpus=2 --memory=4096 --keep-context
export KUBE_CONTEXT=teamtasks-devops
export VERSION=$(git rev-parse HEAD)
docker build --target api --build-arg APP_VERSION="$VERSION" -t teamtasks-api:$VERSION .
docker build --target web -t teamtasks-web:$VERSION .
minikube -p teamtasks-devops image load teamtasks-api:$VERSION teamtasks-web:$VERSION
bash scripts/deploy.sh
kubectl --context "$KUBE_CONTEXT" -n teamtasks port-forward svc/web 8080:8080
```

Open http://localhost:8080 and register a test account. The web client calls `/api` on the same origin; no environment-specific URL is baked into the web bundle. In another terminal:

```bash
EXPECTED_VERSION=$(git rev-parse HEAD) python3 scripts/smoke.py
kubectl --context teamtasks-devops -n teamtasks port-forward svc/prometheus 9090:9090
# Separate terminal:
kubectl --context teamtasks-devops -n teamtasks port-forward svc/jaeger 16686:16686
```

Prometheus: http://localhost:9090 (Targets, Graph and Alerts). Jaeger: http://localhost:16686, service `teamtasks-api`. Request logs: `kubectl --context teamtasks-devops -n teamtasks logs -l app=api --tail=100`. Logs include version, route template, duration, status and trace ID, without request bodies, tokens or query strings. Metrics are on the API's internal `/metrics`, not exposed through the web proxy.

## Optional Docker Compose path

```bash
python3 scripts/create_secrets.py
docker compose up --build -d
python3 scripts/smoke.py
```

Compose runs the app and MongoDB without the Kubernetes observability stack. Stop with `docker compose down`; do not add `-v` unless you intend to erase its database. Kubernetes and Compose have separate database volumes.

## Checks and delivery

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
.venv/bin/python -m pytest backend/tests -q
.venv/bin/pip-audit -r backend/requirements.txt
kubectl kustomize deploy/base > /tmp/teamtasks.yaml
```

The GitHub Actions workflow checks backend behavior and dependency advisories, rejects tracked environment files, builds both images for the exact source SHA, deploys them into an isolated kind cluster, and tests registration, login, task CRUD, token refresh and readiness. It uploads runtime evidence. A human promotes a passing revision to the local cluster with the same deployment script. No registry credentials or production kubeconfig are stored in CI. Local image loading is the artifact delivery mechanism.

## Release and rollback

API replicas use rolling updates with zero unavailable replicas and readiness gated on MongoDB. Image tags and `/api/health` carry the full source SHA. The web client uses the same release tag. Deployment configuration is rendered by Kustomize, with generated ConfigMap hashes triggering new pods when settings change.

```bash
kubectl --context teamtasks-devops -n teamtasks rollout history deployment/api
kubectl --context teamtasks-devops -n teamtasks rollout undo deployment/api
kubectl --context teamtasks-devops -n teamtasks rollout undo deployment/web
kubectl --context teamtasks-devops -n teamtasks rollout status deployment/api
python3 scripts/smoke.py
```

Prefer redeploying a previously tested Git revision with `VERSION=<that-sha>` after building/loading its images, so declared files and live state agree. Emergency `rollout undo` changes live state; reconcile it before the next release. Image rollback does not undo database changes. This project introduces no schema migration.

## Credentials and persistence

The deploy script generates random credentials once and creates a Kubernetes Secret only if absent. MongoDB initializes a dedicated `readWrite` application user on the first empty-volume startup. Keep the generated secret file for reproducibility. Replacing an environment variable does not rotate credentials in an existing database: rotate the database user first and then update the Secret and restart API pods. Do not delete the PVC to fix an authentication problem.

For cleanup, `minikube stop -p teamtasks-devops` retains the local cluster and data. Deleting the profile destroys this demo's database. Never run these commands against an unrelated context.
