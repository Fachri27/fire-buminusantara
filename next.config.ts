import type { NextConfig } from "next";

/**
 * Header keamanan untuk SEMUA rute.
 *
 * Ditaruh di sini, bukan di tiap respons, supaya tidak ada halaman yang
 * terlewat — termasuk rute yang belum ada. CSP-nya sengaja menahan diri pada
 * yang tidak bisa memecah aplikasi: `frame-ancestors`/`object-src`/`base-uri`
 * menutup clickjacking dan penyuntikan <base>, tanpa membatasi `script-src`
 * (Next.js menyuntik skrip inline, dan halaman memuat Turnstile + Leaflet dari
 * CDN — CSP script yang keliru akan mematikan halaman, bukan sekadar
 * memperketatnya). `geolocation=(self)` DISENGAJA: form laporan memakai "Pakai
 * lokasi saya".
 */
const HEADER_KEAMANAN = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), geolocation=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; frame-src 'self' http://localhost:3001 https://*.windy.com https://windy.com https://challenges.cloudflare.com; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  // Buang X-Powered-By: Next.js — versi framework tidak perlu diumumkan.
  poweredByHeader: false,

  // Dipakai Docker (Dockerfile di root): `next build` menyalin server minimal
  // ke .next/standalone sehingga image produksi tidak perlu node_modules penuh.
  output: "standalone",

  // @prisma/client dan @aws-sdk/client-s3 sudah eksternal secara bawaan, tapi
  // adapter MariaDB belum: tanpa ini webpack membundelnya ke chunk server, ia
  // tidak pernah tersalin ke node_modules standalone, dan skrip di prisma/
  // (backfill-poster.mjs dkk.) yang meng-import-nya secara polos gagal dengan
  // ERR_MODULE_NOT_FOUND di dalam kontainer produksi.
  serverExternalPackages: ["@prisma/adapter-mariadb"],

  // Batas upload video kejadian 100 MB (sama dengan CMS Laravel). Diberi 1 MB
  // napas di atas batas klien (BATAS_TOTAL_BYTE = 100 MB di lib/batas-laporan.ts):
  // body multipart = berkas + bidang isian + boundary, jadi kiriman yang lolos
  // cek klien tepat di batas masih melebihi atap yang sama nilainya.
  experimental: {
    serverActions: {
      bodySizeLimit: "101mb",
    },
    // Selama proxy.ts dipakai, Next menyangga body permintaan di memori dan
    // batas bawaannya 10 MB — sisanya DIPOTONG. Kiriman lapor berlampiran
    // melewati proxy (matcher hanya mengecualikan _next/admin/api/media), dan
    // multipart yang terpotong meledak sebagai "Unexpected end of form": 500
    // polos ber-digest, tanpa pesan apa pun bagi pelapor. Naikkan sampai
    // menutup bodySizeLimit supaya tidak ada kiriman yang lolos batas klien
    // tapi terpotong di sini.
    proxyClientMaxBodySize: "101mb",
  },

  async headers() {
    return [
      // /media melayani berkas UNGGAHAN orang luar — CSP-nya lebih keras:
      // "default-src 'none'; sandbox" membuat berkasnya tidak bisa memuat atau
      // menjalankan apa pun kalau sampai dirender sebagai dokumen. Aturan ini
      // didahulukan, dan aturan umum di bawah SENGAJA mengecualikan /media
      // (lookahead negatif) supaya tidak ada dua header CSP yang bertumpuk.
      {
        source: "/media/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: "default-src 'none'; sandbox" },
        ],
      },
      {
        source: "/api/forecasting",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'" },
        ],
      },
      { source: "/((?!media/|api/forecasting).*)", headers: HEADER_KEAMANAN },
      // Header tanpa-cache untuk dokumen & rute aplikasi: browser, proxy, dan
      // CDN tidak boleh menahan dokumen HTML usang lintas deploy, sehingga
      // pengguna tidak perlu hard reload untuk mendapatkan bundel skrip terbaru.
      // Aset statis ber-hash di _next/static tetap membawa cache immutable bawaan Next.js.
      {
        source: "/((?!_next/static|_next/image|media/|api/forecasting).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, max-age=0, must-revalidate",
          },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
