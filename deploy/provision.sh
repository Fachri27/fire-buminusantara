#!/usr/bin/env bash
# Dijalankan DARI LAPTOP: provision.sh <role> <ip> [path-kunci-ssh]
# Menyiapkan box baru end-to-end: bootstrap, secret acak, login registry.
set -euo pipefail

ROLE="${1:?usage: provision.sh <role> <ip> [ssh-key]}"
IP="${2:?usage: provision.sh <role> <ip> [ssh-key]}"
KEY="${3:-}"
DIR="$(cd "$(dirname "$0")" && pwd)"
STACK_DIR="/srv/fire"
DEPLOY_USER="docker"

SSH_OPTS=(-o IdentitiesOnly=yes)
[ -n "$KEY" ] && SSH_OPTS+=(-i "$KEY")

log() { printf '[provision] %s\n' "$*"; }

log "menyalin bootstrap.sh ke box"
scp "${SSH_OPTS[@]}" "$DIR/bootstrap.sh" "root@$IP:/tmp/bootstrap.sh"

log "menjalankan bootstrap sebagai root"
ssh "${SSH_OPTS[@]}" "root@$IP" "bash /tmp/bootstrap.sh '$ROLE'"

log "mengisi secret acak di .env"
ssh "${SSH_OPTS[@]}" "root@$IP" \
  "su - '$DEPLOY_USER' -c \"cd '$STACK_DIR' && ./deploy/gen-secrets.sh .env\""

log "login registry (ghcr.io) — image di GHCR privat sampai dibuat publik"
log "  buat read-only PAT (repo read + packages read) di:"
log "  https://github.com/settings/tokens"
printf 'Token GitHub (input disembunyikan): '
read -rs TOKEN
printf '\n'
ssh "${SSH_OPTS[@]}" "root@$IP" \
  "printf '%s' '$TOKEN' | docker login ghcr.io -u ultramenid --password-stdin"
unset TOKEN

log "kunci .env yang masih butuh nilai manusiawi:"
ssh "${SSH_OPTS[@]}" "root@$IP" \
  "grep -E '^[A-Z_]+=$' '$STACK_DIR/.env' | grep -vE '^[A-Z_]+_(SECRET|PASS)=' | cut -d= -f1 | sort -u" \
  || true
log "(DATABASE_URL, MINIO_ACCESS_KEY/SECRET_KEY, NEXT_PUBLIC_*, GEO_*, TURNSTILE_*, DB_CONTAINER)"
log "selesai — push pertama ke main akan mendeploy."