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
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  // Buang X-Powered-By: Next.js — versi framework tidak perlu diumumkan.
  poweredByHeader: false,

  // Batas upload video kejadian 100 MB (sama dengan CMS Laravel)
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
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
      { source: "/((?!media/).*)", headers: HEADER_KEAMANAN },
    ];
  },
};

export default nextConfig;
