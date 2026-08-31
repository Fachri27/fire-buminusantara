# ── Tahap 1: build standalone ────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# prisma.config.ts me-resolve DATABASE_URL saat dimuat; `prisma generate` hanya
# perlu placeholder — koneksi asli tetap dibaca dari env saat runtime.
ARG DATABASE_URL=mysql://build:build@localhost:3306/build
ENV DATABASE_URL=$DATABASE_URL

# NEXT_PUBLIC_* dipanggang saat build — harus lewat build-args dari CI.
ARG NEXT_PUBLIC_MEDIA_URL=""
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ENV NEXT_PUBLIC_MEDIA_URL=$NEXT_PUBLIC_MEDIA_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY

# ponytail: --webpack — build Turbopack (bawaan Next 16) gagal spawn proses
# anak di beberapa lingkungan; webpack terverifikasi menghasilkan standalone.
# Bisa dilepas bila Turbopack build terbukti stabil di CI.
RUN npx prisma generate && npx next build --webpack

# ── Tahap 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Asuransi kalau pelacakan berkas Next tidak menyalin klien Prisma hasil generate.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# server.js standalone mendengarkan di $HOSTNAME, dan Docker mengisi HOSTNAME
# dengan ID container (mis. 08aafe8f2476 → 172.21.0.4) — akibatnya port 3000
# hanya hidup di satu antarmuka: 127.0.0.1 di dalam container mati dan
# pemetaan port host ikut gagal. 0.0.0.0 membuatnya mendengarkan semuanya.
ENV HOSTNAME=0.0.0.0 PORT=3000

EXPOSE 3000
CMD ["node", "server.js"]