import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ambilUmpan, hitungLaporanProvinsi, UMPAN_AWAL } from "@/lib/events";
import { ambilSorotan } from "@/lib/statistik-sorotan";
import { ambilKolomUmpanAwal } from "@/lib/perangkat";
import { LandingKarhutla } from "@/components/landing-karhutla";
import { BAHASA, adaBahasa, type Bahasa } from "@/lib/bahasa";
import { DESKRIPSI_SITUS, JUDUL_SITUS, NAMA_SITUS } from "@/lib/situs";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return BAHASA.map((locale) => ({ locale }));
}

// Halaman panel situasi untuk seluler: peta + cuaca + statistik dasbor
// karhutla yang berdiri sendiri. Di desktop rute ini sama utuhnya dengan
// dasbor (dua rel) — yang dipisah hanya seluler.
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const bahasa: Bahasa = adaBahasa(locale) ? locale : "id";
  return {
    title: JUDUL_SITUS,
    description: DESKRIPSI_SITUS,
    alternates: {
      canonical: `/${bahasa}/karhutla/panel`,
      languages: { id: "/id/karhutla/panel", en: "/en/karhutla/panel", "x-default": "/id/karhutla/panel" },
    },
    other: {
      "content-language": bahasa,
    },
    openGraph: {
      title: JUDUL_SITUS,
      description: DESKRIPSI_SITUS,
      url: `/${bahasa}/karhutla/panel`,
      siteName: NAMA_SITUS,
      locale: bahasa === "en" ? "en_US" : "id_ID",
      type: "website",
      images: [{ url: "/assets/img/og-lapor.jpg", width: 1200, height: 630, alt: "Lapor Karhutla" }],
    },
    twitter: {
      card: "summary_large_image",
      title: JUDUL_SITUS,
      description: DESKRIPSI_SITUS,
      images: ["/assets/img/og-lapor.jpg"],
    },
  };
}

export default async function HalamanPanel({ params }: Props) {
  const { locale } = await params;
  if (!adaBahasa(locale)) notFound();

  // Peta mewarnai tiap provinsi menurut jumlah laporannya. Umpan (potongan
  // awal) ikut dikirim walau halaman ini tak merender umpannya: pop-up
  // provinsi di peta membaca daftar laporan dari prop ini — tanpanya popup
  // terbuka kosong. Sisa daftar dimuat klien dari /api/umpan begitu popup
  // dibuka (butuhPenuh di komponen). Tanpa prop ini pula guard "prop berita
  // berubah" di komponen membandingkan default [] yang baru tiap render —
  // itulah biang "Too many re-renders" kemarin.
  await connection();
  const [jumlahLaporan, berita, sorotan, kolomAwal] = await Promise.all([
    hitungLaporanProvinsi(),
    ambilUmpan(locale),
    ambilSorotan(),
    ambilKolomUmpanAwal(),
  ]);

  return (
    <div className="min-h-dvh bg-white text-tinta dark:bg-[#0a0a0a] dark:text-[#f5f5f5] transition-colors duration-200">
      <LandingKarhutla
        bahasa={locale}
        jumlahLaporan={jumlahLaporan}
        berita={berita.slice(0, UMPAN_AWAL)}
        totalBerita={berita.length}
        statistik={sorotan[locale]}
        tampil="panel"
        kolomAwal={kolomAwal}
      />
    </div>
  );
}
