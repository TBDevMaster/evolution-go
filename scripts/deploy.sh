#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_DIR="/docker/evolution-go-qtd2"
CONTAINER_NAME="evolution-go-qtd2-api-1"

git -C "$REPO_ROOT" fetch origin
git -C "$REPO_ROOT" reset --hard origin/main
git -C "$REPO_ROOT" submodule sync --recursive
git -C "$REPO_ROOT" submodule update --init --recursive

docker build -t evolution-go-recebafacil:main "$REPO_ROOT"

cd "$COMPOSE_DIR"
docker compose up -d api

ATTEMPTS=0
until [ $ATTEMPTS -ge 20 ]
do
  if docker exec "$CONTAINER_NAME" sh -c 'wget -qO- http://127.0.0.1:4000 >/dev/null 2>&1 || nc -z 127.0.0.1 4000 >/dev/null 2>&1'; then
    break
  fi
  ATTEMPTS=$((ATTEMPTS+1))
  sleep 3
done

set -a
. "$COMPOSE_DIR/.env"
set +a
curl -fsS -H "apikey: $API_KEY" http://127.0.0.1:4000/instance/all >/dev/null

docker ps --filter name=evolution-go-qtd2-api-1 --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'