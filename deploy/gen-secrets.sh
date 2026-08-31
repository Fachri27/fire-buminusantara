#!/usr/bin/env bash
# Mengisi setiap slot *_SECRET / *_PASS yang kosong di file .env dengan
# openssl rand. Kunci lain (DATABASE_URL, domain, API key) dibiarkan untuk
# manusia — provision.sh yang mencetak daftarnya.
# Jalankan di server: deploy/gen-secrets.sh [path/.env]
set -euo pipefail

FILE="${1:-.env}"
[ -f "$FILE" ] || { echo "tidak ada $FILE" >&2; exit 1; }

TMP="$(mktemp)"
CHANGED=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    *_SECRET=|*_PASS=)
      printf '%s%s\n' "$line" "$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-40)"
      CHANGED=$((CHANGED + 1))
      ;;
    *) printf '%s\n' "$line" ;;
  esac
done <"$FILE" >"$TMP"

mv "$TMP" "$FILE"
chmod 600 "$FILE"
echo "terisi: $CHANGED kunci acak di $FILE"