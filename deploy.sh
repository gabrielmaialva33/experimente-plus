#!/usr/bin/env bash
# Deploy entrypoint for CI. This is the forced command on the CI SSH key, so
# that key can do nothing else on this host.
set -euo pipefail

cd /opt/experimente-plus
COMPOSE="docker compose -f docker-compose.vps.yml"

git fetch --quiet origin master
PREV=$(git rev-parse HEAD)
git reset --hard --quiet origin/master
NEW=$(git rev-parse HEAD)

if [ "$PREV" = "$NEW" ]; then
  echo "já em $(git log --oneline -1)"
else
  echo "deploy $(git rev-parse --short "$PREV") -> $(git rev-parse --short "$NEW")"
fi

$COMPOSE build app
# The image CMD runs pending migrations before starting the HTTP server.
$COMPOSE up -d

for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: experimente-plus.mahina.fun' \
         http://127.0.0.1:3400/ 2>/dev/null || true)
  if [ "$code" = "200" ]; then
    echo "app respondendo 200 após ${i} tentativa(s)"
    git log --oneline -1
    exit 0
  fi
  sleep 3
done

# Code-level rollback only: migrations already applied are NOT reverted.
echo "FALHA: app não respondeu 200 em 120s. Revertendo código para $PREV." >&2
$COMPOSE logs --tail 40 app >&2 || true
git reset --hard --quiet "$PREV"
$COMPOSE build app
$COMPOSE up -d
exit 1
