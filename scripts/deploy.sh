#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_DIR="/docker/evolution-go-qtd2"

git -C "$REPO_ROOT" fetch origin
git -C "$REPO_ROOT" reset --hard origin/main
git -C "$REPO_ROOT" submodule sync --recursive
git -C "$REPO_ROOT" submodule update --init --recursive

docker build -t evolution-go-recebafacil:main "$REPO_ROOT"

sed -i 's|image: ghcr.io/tbdevmaster/evolution-go-recebafacil:main|image: evolution-go-recebafacil:main|g' "$COMPOSE_DIR/docker-compose.yml"
sed -i 's|image: evolution-go-recebafacil:2026-04-13|image: evolution-go-recebafacil:main|g' "$COMPOSE_DIR/docker-compose.yml"

cd "$COMPOSE_DIR"
docker compose up -d api

set -a
. "$COMPOSE_DIR/.env"
set +a
curl -fsS -H "apikey: $API_KEY" http://127.0.0.1:4000/instance/all >/dev/null

docker ps --filter name=evolution-go-qtd2-api-1 --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
