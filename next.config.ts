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
 * memperketatnya). `frame-src` memasukkan challenges.cloudflare.com karena
 * widget Turnstile merender dirinya dalam iframe dari sana. `geolocation=(self)`
 * DISENGAJA: form laporan memakai "Pakai lokasi saya".
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
    // localhost:3001 hanya untuk pengembangan — jangan sampai ikut ke produksi.
    value: `frame-ancestors 'none'; frame-src 'self'${process.env.NODE_ENV === "production" ? "" : " http://localhost:3001"} https://challenges.cloudflare.com https://*.windy.com https://windy.com; base-uri 'self'; object-src 'none'`,
  },
  // Tanpa includeSubDomains: subdomain lain di bawah domain bersama (CMS Laravel
  // dsb.) belum tentu semuanya HTTPS. Peramban mengabaikan header ini di HTTP.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  // Proteksi version skew: Next.js otomatis mendeteksi perubahan deployment ID
  // di header navigasi/RSC. Bila terdeteksi versi baru (setelah build/deploy baru),
  // Next.js otomatis melakukan reload browser penuh (MPA navigation) alih-alih
  // transisi SPA yang terjebak pada chunk atau state lama.
  deploymentId:
    process.env.NEXT_DEPLOYMENT_ID ||
    process.env.WEB_TAG ||
    (process.env.NODE_ENV === "production"
      ? (() => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { execSync } = require("node:child_process");
            return execSync("git rev-parse --short HEAD").toString().trim();
          } catch {
            return `${Date.now()}`;
          }
        })()
      : undefined),

  // Buang X-Powered-By: Next.js — versi framework tidak perlu diumumkan.
  poweredByHeader: false,

  // Cache Components & Partial Prefetching (Next.js 16.3+)
  cacheComponents: true,
  partialPrefetching: true,

  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Dipakai Docker (Dockerfile di root): `next build` menyalin server minimal
  // ke .next/standalone sehingga image produksi tidak perlu node_modules penuh.
  // Di Vercel output ini TIDAK dipakai (ia memakai .nft.json hasil tracing) —
  // jadi dinonaktifkan saat VERCEL=1, kalau tidak build gagal dengan
  // "ENOENT next-server.js.nft.json".
  ...(process.env.VERCEL ? {} : { output: "standalone" }),

  // @prisma/client dan @aws-sdk/client-s3 sudah eksternal secara bawaan, tapi
  // adapter MariaDB belum: tanpa ini webpack membundelnya ke chunk server, ia
  // tidak pernah tersalin ke node_modules standalone, dan skrip di prisma/
  // (backfill-poster.mjs dkk.) yang meng-import-nya secara polos gagal dengan
  // ERR_MODULE_NOT_FOUND di dalam kontainer produksi.
  serverExternalPackages: ["@prisma/adapter-mariadb"],

  // Unggahan besar (lapor warga, media kejadian CMS) lewat route handler di
  // /api — /api/lapor & /api/admin/kejadian — yang memeriksa panjang, captcha
  // atau sesi, dan slot serentak SEBELUM badan dibaca. Server action & proxy
  // tidak butuh badan besar lagi, dan JANGAN dinaikkan: Next menyangga badan
  // server action dan menyalin badan untuk proxy (di semua path halaman +
  // /admin) sampai batas ini sebelum sesi atau batas laju apa pun diperiksa —
  // 101 MB di sini dulu cukup untuk membuat container OOM tanpa login.
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
    // Bawaannya 10 MB, jadi harus disetel eksplisit.
    proxyClientMaxBodySize: "1mb",
  },

  // Reaksi dulu di bawah /admin/komentar; kini bagian itu punya layout daftar sendiri.
  async redirects() {
    return [{ source: "/admin/komentar/reaksi", destination: "/admin/reaksi", permanent: true }];
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
      // /api/forecasting ikut boleh dibingkai siapa saja: ia iframe di dalam
      // /<locale>/embed, dan frame-ancestors memeriksa SEMUA leluhur — termasuk
      // situs penyemat. Tanpa X-Frame-Options (SAMEORIGIN akan memblokirnya).
      {
        source: "/api/forecasting",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // sandbox tanpa allow-same-origin: HTML+skrip Windy dilayani dari asal kita,
          // jadi tanpa ini skrip pihak ketiga itu berjalan sebagai situs ini (bisa
          // memanggil aksi /admin dengan cookie editor). Next mengabaikan CSP yang
          // disetel rute bila config sudah menyetelnya — karena itu di sini.
          { key: "Content-Security-Policy", value: "frame-ancestors *; object-src 'none'; sandbox allow-scripts allow-popups" },
        ],
      },
      // Peta sematan (app/[locale]/embed) — satu-satunya halaman yang boleh
      // dibingkai situs lain. Isinya hanya peta tanpa aksi bersesi, jadi
      // clickjacking tak punya sasaran.
      {
        source: "/:locale(id|en)/embed",
        headers: [
          ...HEADER_KEAMANAN.filter((h) => h.key !== "X-Frame-Options" && h.key !== "Content-Security-Policy"),
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *; frame-src 'self' https://*.windy.com https://windy.com; base-uri 'self'; object-src 'none'",
          },
        ],
      },
      { source: "/((?!media/|api/forecasting|(?:id|en)/embed).*)", headers: HEADER_KEAMANAN },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/css/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/data/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/(favicon.ico|icon.png|apple-icon.png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      // Header tanpa-cache untuk dokumen & rute aplikasi: browser, proxy, dan
      // CDN tidak boleh menahan dokumen HTML usang lintas deploy, sehingga
      // pengguna tidak perlu hard reload untuk mendapatkan bundel skrip terbaru.
      // Aset statis ber-hash di _next/static serta berkas publik di assets/ & css/
      // membawa header cache tersendiri.
      {
        source:
          "/((?!_next/static|_next/image|assets/|css/|favicon\\.ico|icon\\.png|apple-icon\\.png|robots\\.txt|sitemap\\.xml|media/|api/forecasting|api/hotspot|api/sebaran-asap|api/udara|api/umpan|data/).*)",
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
