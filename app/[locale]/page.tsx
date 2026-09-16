import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ambilRelKanan, ambilSemuaBerita, hitungLaporanProvinsi } from "@/lib/events";
import { ambilKabupaten } from "@/lib/wms";
import { HalamanPeta } from "@/components/halaman-peta";
import { KerangkaPeta } from "@/components/kerangka-peta";
import { Nav } from "@/components/nav";
import { adaBahasa, TEKS_PETA, type Bahasa } from "@/lib/bahasa";

// Dua prefiks yang sah — /id dan /en. Segmen lain (mis. /xyz) ditolak
// lewat notFound() di bawah.
export function generateStaticParams() {
  return [{ locale: "id" }, { locale: "en" }];
}

// Diizinkan blocking (instant = false) agar pembacaan URL params locale di level
// halaman tidak memicu peringatan Cache Components Instant Navigation.
export const instant = false;

// Metadata per locale — cangkang statis di-prerender, isi dinamis mengalir
// lewat connection() di IsiHalaman, jadi generateMetadata tidak menambah
// biaya cache baru.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  // Segmen tak dikenal tetap 404 lewat notFound() di bawah; metadata butuh
  // nilai aman sementara supaya tak ada judul kosong.
  const bahasa: Bahasa = adaBahasa(locale) ? locale : "id";
  const teks = TEKS_PETA[bahasa];
  return {
    title: teks.judulTab,
    description: teks.deskripsi,
    // Kanonis menunjuk URL prefiks bahasanya sendiri; hreflang id/en
    // menandai keduanya sederajat supaya tak dianggap konten duplikat.
    alternates: {
      canonical: `/${bahasa}`,
      languages: { id: "/id", en: "/en", "x-default": "/id" },
    },
    other: {
      "content-language": bahasa,
    },
    // openGraph SENGAJA disetel di sini, bukan diwarisi dari root layout: tanpa
    // ini pratinjau bagikan halaman peta memakai judul & deskripsi beranda yang
    // generik. Gambar tetap logo — halaman peta tidak punya gambar sendiri.
    openGraph: {
      title: teks.judulTab,
      description: teks.deskripsi,
      url: `/${bahasa}`,
      siteName: "Fire",
      locale: bahasa === "en" ? "en_US" : "id_ID",
      type: "website",
      images: [{ url: "/assets/img/og-fire.jpg", width: 1200, height: 630, alt: "Fire" }],
    },
    twitter: {
      card: "summary_large_image",
      title: teks.judulTab,
      description: teks.deskripsi,
      images: ["/assets/img/og-fire.jpg"],
    },
  };
}

// Isi halaman dipisah dari kerangkanya supaya kerangka — Nav — terstream
// seketika, sementara data di bawah ini masih diambil.
async function IsiHalaman({ params }: Props) {
  const { locale } = await params;
  const bahasa: Bahasa = adaBahasa(locale) ? locale : "id";
  await connection();
  const [rel, semuaBerita, jumlahLaporan, kabupaten] = await Promise.all([
    ambilRelKanan(),
    ambilSemuaBerita(),
    hitungLaporanProvinsi(),
    ambilKabupaten(),
  ]);

  return (
    <HalamanPeta
      berita={semuaBerita}
      terbaru={rel.terbaru}
      populer={rel.populer}
      komentar={rel.komentar}
      jumlahLaporan={jumlahLaporan}
      kabupaten={kabupaten}
      bahasa={bahasa}
    />
  );
}

// Kepala halaman yang bergantung locale — Nav dan H1. Keduanya membaca segmen
// [locale], jadi mereka pun harus berada di dalam <Suspense>.
async function KepalaLokal({ params }: Props) {
  const { locale } = await params;
  if (!adaBahasa(locale)) notFound();

  return (
    <>
      <Nav bahasa={locale} gelap />
      {/* H1 ikut bahasa halaman — satu H1 berbahasa salah merusak relevansi
          kata kunci untuk versi Inggrisnya. */}
      <h1 className="sr-only">
        {locale === "en"
          ? "Smoke spread map of forest and land fires in Indonesia"
          : "Peta sebaran asap kebakaran hutan dan lahan Indonesia"}
      </h1>
    </>
  );
}

// Kerangka halaman SENGAJA tidak async dan tidak menyentuh `params`: semua
// yang bergantung URL turun ke dalam <Suspense> di bawah, sehingga App Shell
// rute ini tetap bisa diprerender sekali dan dipakai ulang oleh /id dan /en.
export default function Halaman({ params }: Props) {
  return (
    <>
      <Suspense fallback={null}>
        <KepalaLokal params={params} />
      </Suspense>
      {/* Kerangka pemuatan menahan geometri layar peta supaya isi yang
          menggantikannya tidak menggeser tata letak saat data tiba. */}
      <Suspense fallback={<KerangkaPeta />}>
        <IsiHalaman params={params} />
      </Suspense>
    </>
  );
}
