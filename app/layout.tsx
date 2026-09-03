import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  // Akar absolut untuk semua metadata ber-URL (og:image, og:url, canonical).
  // Tanpa ini, og:image kebit sebagai path relatif (/media/...) yang tidak
  // bisa diambil crawler WhatsApp/Twitter — pratinjau bagikan tautan jadi
  // kosong. Diambil dari env supaya instance staging bisa menimpanya.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://fire.nusantara.earth"),
  title: "Fire — Pantauan Karhutla Indonesia",
  description:
    "Pantauan kebakaran hutan dan lahan di Indonesia — berita terkini, statistik harian, dan peta sebaran wilayah rawan.",
  // Gambar bagikan (WhatsApp/Twitter/Facebook). URL relatif diselesaikan
  // absolut lewat metadataBase di atas. Halaman /fire/<slug> menimpanya dengan
  // poster kejadiannya sendiri lewat generateMetadata.
  openGraph: {
    title: "Fire — Pantauan Karhutla Indonesia",
    description:
      "Pantauan kebakaran hutan dan lahan di Indonesia — berita terkini, statistik harian, dan peta sebaran wilayah rawan.",
    url: "/",
    siteName: "Fire",
    locale: "id_ID",
    type: "website",
    images: [
      { url: "/assets/img/og-fire.jpg", width: 1200, height: 630, alt: "Fire — Pantauan Karhutla Indonesia" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fire — Pantauan Karhutla Indonesia",
    description:
      "Pantauan kebakaran hutan dan lahan di Indonesia — berita terkini, statistik harian, dan peta sebaran wilayah rawan.",
    images: ["/assets/img/og-fire.jpg"],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const lang = headerList.get("x-locale") || "id";

  // suppressHydrationWarning pada <html>: skrip --skala di <head> menulis
  // atribut style pada <html> SEBELUM hidrasi, jadi React melihat atribut yang
  // tidak ia render dan memperingatkan "server rendered HTML didn't match".
  // Nilai itu memang harus bertahan (bukan dipatch React) — pola yang sama
  // seperti next-themes. Peringatannya dimatikan di elemen ini saja.
  return (
    <html lang={lang} className={poppins.className} suppressHydrationWarning>
      <head>
        {/* Kanvas panggung diskalakan lewat --skala, yang dipasang
            gunakanPanggung() SETELAH hidrasi. Isi yang di-stream masuk bisa
            tergambar SEBELUM itu — satu bingkai kanvas 1920px tak terskala
            (kartu raksasa) lalu melompat ke ukurannya: kedipan. Skrip ini
            memasang nilai yang sama di akar dokumen sebelum isi mana pun
            digambar; hook kemudian mengambil alih (nilai sama, ditambah
            resize). Aliran tidak membaca --skala, jadi tak ada efeknya di
            sana. */}
        <script dangerouslySetInnerHTML={{ __html:
          "(function(){function s(){try{document.documentElement.style.setProperty('--skala',Math.min(window.innerWidth/1920,window.innerHeight/1080))}catch(e){}}s();window.addEventListener('resize',s)})();"
        }} />
        {/* CSS komponen ditulis tangan, di luar Tailwind: pop-up rincian,
            lencana video, angka peta, dan tepi lunak. Dimuat sebagai berkas
            statis supaya tetap satu berkas per komponen seperti di Pasopati. */}
        <link rel="stylesheet" href="/css/rincian-laporan.css" />
        <link rel="stylesheet" href="/css/kartu-kursor.css" />
        <link rel="stylesheet" href="/css/kartu-video.css" />
        <link rel="stylesheet" href="/css/pantauan-kosong.css" />
        <link rel="stylesheet" href="/css/peta-angka.css" />
        <link rel="stylesheet" href="/css/peta-popup.css" />
        {/* Turnstile untuk kolom komentar pop-up rincian dan form laporan. Tanpa site key (dev),
            widget tidak dirender dan verifikasi di server pun dilewati. */}
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="beforeInteractive"
          />
        )}
        {/* Google Analytics (gtag.js). Dimuat afterInteractive supaya tidak
            memblokir render halaman; mount HTML klasik tidak cukup karena
            `next/script` menangani pemuatan gtag yang asinkron. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-TDJESR6SNL"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive" dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-TDJESR6SNL');
          `,
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
