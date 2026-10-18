#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${KUBE_CONTEXT:?Set KUBE_CONTEXT explicitly (for example teamtasks-devops)}"
: "${VERSION:?Set VERSION to the tested Git commit or image tag}"
API_IMAGE=${API_IMAGE:-teamtasks-api:$VERSION}
WEB_IMAGE=${WEB_IMAGE:-teamtasks-web:$VERSION}
k=(kubectl --context "$KUBE_CONTEXT" -n teamtasks)
python3 scripts/create_secrets.py
"${k[@]}" apply -f deploy/base/namespace.yaml
# Create distinct secrets so API pods never receive database administrator credentials.
python3 scripts/install_secrets.py "$KUBE_CONTEXT"
render_dir=$(mktemp -d)
trap 'rm -rf "$render_dir"' EXIT
cp -R deploy/base/. "$render_dir/"
cat >> "$render_dir/kustomization.yaml" <<EOF
images:
- name: teamtasks-api
  newName: ${API_IMAGE%:*}
  newTag: ${API_IMAGE##*:}
- name: teamtasks-web
  newName: ${WEB_IMAGE%:*}
  newTag: ${WEB_IMAGE##*:}
EOF
"${k[@]}" apply -k "$render_dir"
"${k[@]}" apply -k deploy/observability
"${k[@]}" rollout status statefulset/mongo --timeout=240s
"${k[@]}" rollout status deployment/api --timeout=240s
"${k[@]}" rollout status deployment/web --timeout=240s
"${k[@]}" rollout status deployment/prometheus --timeout=240s
"${k[@]}" rollout status deployment/jaeger --timeout=240s
printf 'Deployed %s. Access: kubectl --context %s -n teamtasks port-forward svc/web 8080:8080\n' "$VERSION" "$KUBE_CONTEXT"
