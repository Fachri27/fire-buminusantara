import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ambilBerita, hitungLaporanProvinsi } from "@/lib/events";
import { ambilTigaTeratas } from "@/lib/wms";
import { ambilStatistik } from "@/lib/statistik";
import { HalamanFire } from "@/components/halaman-fire";
import { KerangkaBeranda } from "@/components/kerangka-beranda";
import { Nav } from "@/components/nav";
import { adaBahasa, type Bahasa } from "@/lib/bahasa";

// Dua prefiks yang sah — /id dan /en. Segmen lain (mis. /xyz) ditolak
// lewat notFound() di bawah.
export function generateStaticParams() {
  return [{ locale: "id" }, { locale: "en" }];
}

// Judul/deskripsi dinilai crawler per URL (/id vs /en), jadi versi Inggris
// diterjemahkan penuh — bukan fallback bahasa Indonesia.
const TEKS_BERANDA: Record<Bahasa, { judul: string; deskripsi: string; ogLocale: string }> = {
  id: {
    judul: "Fire — Pantauan Karhutla Indonesia",
    deskripsi:
      "Pantauan kebakaran hutan dan lahan di Indonesia — berita terkini, statistik harian, dan peta sebaran wilayah rawan.",
    ogLocale: "id_ID",
  },
  en: {
    judul: "Fire — Forest and Land Fire Monitoring in Indonesia",
    deskripsi:
      "Forest and land fire monitoring in Indonesia — latest news, daily statistics, and maps of fire-prone areas.",
    ogLocale: "en_US",
  },
};

// Metadata per locale — halaman ini force-dynamic, jadi generateMetadata
// berjalan per permintaan tanpa menambah biaya cache baru.
export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  // Segmen tak dikenal tetap 404 lewat notFound() di bawah; metadata butuh
  // nilai aman sementara supaya tak ada judul kosong.
  const bahasa: Bahasa = adaBahasa(locale) ? locale : "id";
  const teks = TEKS_BERANDA[bahasa];
  return {
    title: teks.judul,
    description: teks.deskripsi,
    // Kanonis menunjuk URL prefiks bahasanya sendiri; hreflang id/en
    // menandai keduanya sederajat supaya tak dianggap konten duplikat.
    // Path relatif diselesaikan absolut lewat metadataBase di layout akar.
    alternates: {
      canonical: `/${bahasa}`,
      languages: { id: "/id", en: "/en", "x-default": "/id" },
    },
    openGraph: {
      title: teks.judul,
      description: teks.deskripsi,
      url: `/${bahasa}`,
      siteName: "Fire",
      locale: teks.ogLocale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: teks.judul,
      description: teks.deskripsi,
      images: ["/assets/img/og-fire.jpg"],
    },
  };
}

// Isi halaman dipisah dari kerangkanya supaya kerangka — Nav — terstream
// seketika, sementara data di bawah ini masih diambil. Tanpa pemisahan ini
// HTML baru tiba setelah seluruh kueri selesai dan pengunjung menatap
// layar kosong selama itu.
async function IsiHalaman({ bahasa }: { bahasa: Bahasa }) {
  await connection();
  const [berita, jumlahLaporan, tigaTeratas, statistik] = await Promise.all([
    ambilBerita(),
    hitungLaporanProvinsi(),
    ambilTigaTeratas(),
    ambilStatistik(bahasa),
  ]);

  return (
    <HalamanFire
      berita={berita}
      jumlahLaporan={jumlahLaporan}
      tigaTeratas={tigaTeratas}
      statistik={statistik}
      bahasa={bahasa}
    />
  );
}

export default async function Halaman({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!adaBahasa(locale)) notFound();

  // Basis absolut disamakan dengan metadataBase di layout akar supaya URL
  // skema tetap benar di staging maupun produksi.
  const situs = process.env.NEXT_PUBLIC_SITE_URL || "https://fire.nusantara.earth";
  // Skema WebSite ditulis sebaris — components/json-ld.tsx milik agen lain,
  // jadi satu sumber kebenaran di sini menghindari konflik penggabungan.
  const skemaSitus = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Fire",
    url: `${situs}/${locale}`,
    inLanguage: locale,
    publisher: { "@type": "Organization", name: "Fire", url: situs },
  };

  return (
    <>
      {/* ponytail: <html lang> di layout akar tidak bisa membaca segmen [locale]
          tanpa memindahkan seluruh struktur — Nav yang membetulkannya di sisi
          klien; pindahkan layout akar ke [locale] kalau rasa bahasa halaman
          perlu benar sejak byte pertama (SEO). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(skemaSitus) }}
      />
      <Nav bahasa={locale as Bahasa} />
      {/* H1 ikut bahasa halaman — satu H1 berbahasa salah per URL merusak
          relevansi kata kunci untuk versi Inggrisnya. */}
      <h1 className="sr-only">
        {locale === "en"
          ? "Forest and land fire monitoring in Indonesia"
          : "Pantauan kebakaran hutan dan lahan Indonesia"}
      </h1>
      {/* Kerangka pemuatan menahan geometri dua layar supaya isi yang
          menggantikannya tidak menggeser tata letak saat data tiba. */}
      <Suspense fallback={<KerangkaBeranda bahasa={locale as Bahasa} />}>
        <IsiHalaman bahasa={locale as Bahasa} />
      </Suspense>
    </>
  );
}
