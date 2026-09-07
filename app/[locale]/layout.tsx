import Script from "next/script";

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Prekoneksi CDN tile satelit (Sentinel-2 cloudless) untuk mempercepat
          pemuatan tile peta 150-250ms saat inisialisasi MapLibre. */}
      <link
        rel="preconnect"
        href="https://tiles.maps.eox.at"
        crossOrigin="anonymous"
      />
      <link rel="dns-prefetch" href="https://tiles.maps.eox.at" />

      {/* Prekoneksi beacon Google Analytics (www.google-analytics.com): skrip
          gtag sendiri sudah di-preload next/script, tapi beacon collect ke host
          ini yang membuka koneksi baru — tanpa preconnect, Lighthouse mencatat
          ~440ms latensi DNS+TLS saat pengiriman pertama. */}
      <link rel="preconnect" href="https://www.google-analytics.com" />
      <link rel="dns-prefetch" href="https://www.google-analytics.com" />

      {/* Prekoneksi Turnstile widget komentar/laporan — sama syaratnya dengan
          skripnya: hanya bila site key terpasang di lingkungan ini. */}
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <>
          <link rel="preconnect" href="https://challenges.cloudflare.com" />
          <link rel="dns-prefetch" href="https://challenges.cloudflare.com" />
        </>
      )}

      {/* Google Analytics (gtag.js). Hanya dimuat untuk halaman publik,
          tidak dimuat di panel CMS (/admin). */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-TDJESR6SNL"
        strategy="afterInteractive"
      />
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-TDJESR6SNL');
          `,
        }}
      />
      {children}
    </>
  );
}
