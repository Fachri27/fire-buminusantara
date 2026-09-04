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
