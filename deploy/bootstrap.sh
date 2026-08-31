#!/usr/bin/env bash
# Dijalankan SEKALI sebagai root di box baru (dipanggil provision.sh dari
# laptop): bootstrap.sh <role>. IDEMPOTEN — aman dijalankan ulang; TIDAK
# menyalakan stack (itu urusan CI).
set -euo pipefail

ROLE="${1:?usage: bootstrap.sh <role>}"
STACK_DIR="/srv/fire"
# Nama pengguna "docker": akun deploy khusus docker — grup docker tetap
# grupnya; tidak tabrakan karena user ≠ group.
DEPLOY_USER="docker"
REPO_URL="https://github.com/ultramenid/fire-buminusantara.git"

case "$ROLE" in
  prod) ENV_TEMPLATE="deploy/.env.prod.example" ;;
  *) echo "role tidak dikenal: $ROLE" >&2; exit 1 ;;
esac

log() { printf '[bootstrap] %s\n' "$*"; }

# ── Paket dasar ──────────────────────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ufw fail2ban >/dev/null

# ── Firewall + anti-bruteforce ───────────────────────────────────────────────
if ! ufw status | grep -q "Status: active"; then
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi
systemctl is-active --quiet fail2ban || systemctl enable --now fail2ban

# ── Docker + compose plugin ──────────────────────────────────────────────────
if ! command -v docker >/dev/null; then
  log "memasang Docker"
  curl -fsSL https://get.docker.com | sh
fi

# Rotasi log container — tanpa ini log memenuhi disk berbulan-bulan kemudian.
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  printf '{\n  "log-driver": "local",\n  "log-opts": { "max-size": "10m", "max-file": "3" }\n}\n' \
    > /etc/docker/daemon.json
  systemctl restart docker
fi

# ── Pengguna deploy tanpa privilege (tapi bisa docker) ──────────────────────
# Grup "docker" sudah ada (dibuat paket Docker) jadi useradd tidak boleh
# membuat grup dengan nama sama — grup docker dijadikan grup primer user,
# sekaligus keanggotaan docker tanpa usermod terpisah.
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash -g docker "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

# ── Kode + stub .env ────────────────────────────────────────────────────────
mkdir -p "$STACK_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$STACK_DIR"

run_as() { su - "$DEPLOY_USER" -c "cd '$STACK_DIR' && $*"; }

if [ ! -d "$STACK_DIR/.git" ]; then
  log "kloning repo ke $STACK_DIR"
  # Repo privat? Tambahkan deploy key (akses baca-saja) ke $DEPLOY_USER
  # lalu ganti REPO_URL ke bentuk git@github.com:… sebelum menjalankan ini.
  run_as "git clone '$REPO_URL' '$STACK_DIR'"
fi
run_as "git fetch --quiet origin main && git reset --hard --quiet origin/main"

if [ ! -f "$STACK_DIR/.env" ]; then
  cp "$STACK_DIR/$ENV_TEMPLATE" "$STACK_DIR/.env"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$STACK_DIR/.env"
  log "stub .env dibuat dari $ENV_TEMPLATE — jalankan deploy/gen-secrets.sh"
fi

log "selesai. Box belum menyala — deploy pertama lewat CI atau:"
log "  su - $DEPLOY_USER -c 'cd $STACK_DIR && ./deploy/gen-secrets.sh .env'"