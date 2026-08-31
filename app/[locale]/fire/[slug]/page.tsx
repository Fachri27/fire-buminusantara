import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ambilBerita, ambilBeritaSlug, hitungLaporanProvinsi } from "@/lib/events";
import { ambilTigaTeratas } from "@/lib/wms";
import { HalamanFire } from "@/components/halaman-fire";
import { Nav } from "@/components/nav";
import { adaBahasa, type Bahasa } from "@/lib/bahasa";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!adaBahasa(locale)) return {};

  const kejadian = await ambilBeritaSlug(slug);
  if (!kejadian) {
    return {
      title: "Laporan Tidak Ditemukan — Fire",
    };
  }

  const judul = `${kejadian.judul} — Fire`;
  const deskripsi =
    kejadian.deskripsi ||
    `Pantauan karhutla di ${kejadian.lokasi ?? "Indonesia"} (${kejadian.tanggal}).`;
  const gambar = kejadian.poster;

  return {
    title: judul,
    description: deskripsi,
    openGraph: {
      title: judul,
      description: deskripsi,
      images: gambar ? [{ url: gambar }] : [],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: judul,
      description: deskripsi,
      images: gambar ? [gambar] : [],
    },
  };
}

async function IsiHalaman({ bahasa, slug }: { bahasa: Bahasa; slug: string }) {
  const [berita, jumlahLaporan, tigaTeratas, kejadian] = await Promise.all([
    ambilBerita(),
    hitungLaporanProvinsi(),
    ambilTigaTeratas(),
    ambilBeritaSlug(slug),
  ]);

  if (!kejadian) notFound();

  // Pastikan kejadian selalu ada di daftar berita meskipun sudah lama (di luar top 10)
  const daftarBerita = berita.some((b) => b.id === kejadian.id)
    ? berita
    : [kejadian, ...berita];

  return (
    <HalamanFire
      berita={daftarBerita}
      jumlahLaporan={jumlahLaporan}
      tigaTeratas={tigaTeratas}
      kejadianAwal={kejadian}
      bahasa={bahasa}
    />
  );
}

export default async function HalamanKejadian({ params }: Props) {
  const { locale, slug } = await params;
  if (!adaBahasa(locale)) notFound();

  return (
    <>
      <Nav bahasa={locale as Bahasa} />
      <h1 className="sr-only">Pantauan kebakaran hutan dan lahan Indonesia</h1>
      <Suspense fallback={null}>
        <IsiHalaman bahasa={locale as Bahasa} slug={slug} />
      </Suspense>
    </>
  );
}
