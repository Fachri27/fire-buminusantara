import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Fire — Pantauan Karhutla Indonesia",
  description:
    "Pantauan kebakaran hutan dan lahan di Indonesia — berita terkini, statistik harian, dan peta sebaran wilayah rawan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={poppins.className}>
      <head>
        {/* CSS komponen ditulis tangan, di luar Tailwind: pop-up rincian,
            lencana video, angka peta, dan tepi lunak. Dimuat sebagai berkas
            statis supaya tetap satu berkas per komponen seperti di Pasopati. */}
        <link rel="stylesheet" href="/css/rincian-laporan.css" />
        <link rel="stylesheet" href="/css/kartu-kursor.css" />
        <link rel="stylesheet" href="/css/kartu-video.css" />
        <link rel="stylesheet" href="/css/pantauan-kosong.css" />
        <link rel="stylesheet" href="/css/peta-angka.css" />
        <link rel="stylesheet" href="/css/peta-popup.css" />
        {/* Turnstile untuk kolom komentar pop-up rincian. Tanpa site key (dev),
            widget tidak dirender dan verifikasi di server pun dilewati. */}
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
