#!/usr/bin/env bash
# Mengisi setiap slot *_SECRET / *_PASS yang kosong di file .env dengan
# openssl rand. Kunci lain (DATABASE_URL, domain, API key) dibiarkan untuk
# manusia — provision.sh yang mencetak daftarnya.
# Jalankan di server: deploy/gen-secrets.sh [path/.env]
set -euo pipefail

FILE="${1:-.env}"
[ -f "$FILE" ] || { echo "tidak ada $FILE" >&2; exit 1; }

# Slot *_SECRET yang nilainya ditentukan PIHAK LAIN, bukan dibangkitkan di
# sini — nilai acak membuatnya tak cocok dengan pasangannya. Dibiarkan kosong
# untuk diisi manusia (provision.sh mencetaknya). Tambahkan nama dipisah spasi.
#   LIVEKIT_API_SECRET: harus sama dengan kunci di server LiveKit, atau token
#   siaran ditolak.
MANUAL_KEYS="LIVEKIT_API_SECRET"

manual() {
  case " $MANUAL_KEYS " in *" $1 "*) return 0 ;; esac
  return 1
}

TMP="$(mktemp)"
CHANGED=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    *_SECRET=|*_PASS=)
      if manual "${line%=}"; then
        printf '%s\n' "$line"
      else
        printf '%s%s\n' "$line" "$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-40)"
        CHANGED=$((CHANGED + 1))
      fi
      ;;
    *) printf '%s\n' "$line" ;;
  esac
done <"$FILE" >"$TMP"

mv "$TMP" "$FILE"
chmod 600 "$FILE"
echo "terisi: $CHANGED kunci acak di $FILE"
