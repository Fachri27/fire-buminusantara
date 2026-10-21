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

export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const bahasa: Bahasa = adaBahasa(locale) ? locale : "id";
  return {
    title: JUDUL_SITUS,
    description: DESKRIPSI_SITUS,
    alternates: {
      canonical: `/${bahasa}`,
      languages: { id: "/id", en: "/en", "x-default": "/id" },
    },
    other: {
      "content-language": bahasa,
    },
    openGraph: {
      title: JUDUL_SITUS,
      description: DESKRIPSI_SITUS,
      url: `/${bahasa}`,
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

export default async function Halaman({ params }: Props) {
  const { locale } = await params;
  if (!adaBahasa(locale)) notFound();

  await connection();
  const [jumlahLaporan, berita, sorotan, kolomAwal] = await Promise.all([
    hitungLaporanProvinsi(),
    ambilUmpan(locale),
    ambilSorotan(),
    ambilKolomUmpanAwal(),
  ]);

  return (
    <LandingKarhutla
      bahasa={locale}
      jumlahLaporan={jumlahLaporan}
      berita={berita.slice(0, UMPAN_AWAL)}
      totalBerita={berita.length}
      statistik={sorotan[locale]}
      kolomAwal={kolomAwal}
    />
  );
}
