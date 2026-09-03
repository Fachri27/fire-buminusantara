import Script from "next/script";

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
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
