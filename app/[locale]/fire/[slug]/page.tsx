import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ambilBerita, ambilBeritaSlug, hitungLaporanProvinsi } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { JsonLd } from "@/components/json-ld";
import { ambilTigaTeratas } from "@/lib/wms";
import { ambilStatistik } from "@/lib/statistik";
import { HalamanFire } from "@/components/halaman-fire";
import { KerangkaBeranda } from "@/components/kerangka-beranda";
import { Nav } from "@/components/nav";
import { adaBahasa, type Bahasa } from "@/lib/bahasa";

// Halaman rincian kejadian dengan slug dinamis dari database (dibuat di CMS kapan saja).
// Diizinkan blocking (instant = false) agar tidak memblokir prerender build.
export const instant = false;

// Basis absolut yang sama dengan fallback og:video di bawah — JSON-LD wajib
// URL absolut, sementara metadataBase hanya me-resolve kolom Metadata.
const DASAR_SITUS = process.env.NEXT_PUBLIC_SITE_URL || "https://fire.nusantara.earth";

// Kolom SEO mentah (EN + tanggal) belum ada di tipe Berita lib/events.ts —
// diambil langsung di sini supaya tak menyentuh berkas milik agen lain.
async function ambilRincianSeo(slug: string) {
  return prisma.events.findUnique({
    where: { slug },
    select: { title_en: true, description_en: true, event_date: true, updated_at: true },
  });
}

// Judul/deskripsi sesuai locale — versi EN kosong kembali ke versi id supaya
// locale=id berperilaku persis seperti sebelumnya (tanpa cabang khusus).
function teksSeo(seo: Awaited<ReturnType<typeof ambilRincianSeo>>, kejadian: { judul: string; deskripsi: string | null }, locale: string) {
  const inggris = locale === "en";
  const judul = (inggris ? seo?.title_en?.trim() : "") || kejadian.judul;
  const deskripsi = (inggris ? seo?.description_en?.trim() : "") || kejadian.deskripsi;
  return { judul, deskripsi };
}

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!adaBahasa(locale)) return {};

  const [kejadian, seo] = await Promise.all([ambilBeritaSlug(slug), ambilRincianSeo(slug)]);
  if (!kejadian) {
    return {
      title: "Laporan Tidak Ditemukan — Fire",
    };
  }

  const { judul: judulSeo, deskripsi: deskripsiSeo } = teksSeo(seo, kejadian, locale);
  const judul = `${judulSeo} — Fire`;
  const deskripsi =
    deskripsiSeo ||
    `Pantauan karhutla di ${kejadian.lokasi ?? "Indonesia"} (${kejadian.tanggal}).`;
  const gambar = kejadian.poster;
  // og:video: kolom `video` lama ATAU video pertama di galeri `media` — kejadian
  // yang dibuat lewat CMS menaruh videonya di galeri, kolom lamanya kosong.
  // Tanpa ini, kejadian bervideo-galeri dibagikan tanpa og:video sama sekali.
  const video = kejadian.video ?? kejadian.media.find((m) => m.jenis === "video")?.url ?? null;

  return {
    title: judul,
    description: deskripsi,
    // Kanonik per locale + hreflang id/en: path relatif diselesaikan absolut
    // lewat metadataBase di root layout (pola yang sama seperti og:url).
    alternates: {
      canonical: `/${locale}/fire/${slug}`,
      languages: {
        id: `/id/fire/${slug}`,
        en: `/en/fire/${slug}`,
        "x-default": `/id/fire/${slug}`,
      },
    },
    openGraph: {
      title: judul,
      description: deskripsi,
      // URL absolut og:url & og:image dijamin oleh metadataBase di root layout.
      // Tanpa og:url yang absolut, sebagian crawler memperlakukan tautan yang
      // dibagikan (dengan prefiks /id/ dst.) dan kanoniknya sebagai dua halaman.
      url: `/${locale}/fire/${slug}`,
      siteName: "Fire",
      locale: locale === "en" ? "en_US" : "id_ID",
      images: gambar ? [{ url: gambar, alt: judulSeo }] : [],
      // og:video: WhatsApp/Twitter kadang memutar mp4 langsung dari pratinjau.
      // Fallback utamanya tetap og:image di atas (poster video) — jauh lebih
      // andal di semua perangkat. URL-nya dibuat absolut sendiri: tidak seperti
      // images, metadataBase TIDAK me-resolve og:video di versi Next ini.
      videos: video
        ? [{ url: new URL(video, process.env.NEXT_PUBLIC_SITE_URL || "https://fire.nusantara.earth").toString() }]
        : [],
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
  await connection();
  const [berita, jumlahLaporan, tigaTeratas, kejadian, statistik, seo] = await Promise.all([
    ambilBerita(),
    hitungLaporanProvinsi(),
    ambilTigaTeratas(),
    ambilBeritaSlug(slug),
    ambilStatistik(bahasa),
    ambilRincianSeo(slug),
  ]);

  if (!kejadian) notFound();

  // Pastikan kejadian selalu ada di daftar berita meskipun sudah lama (di luar top 10)
  const daftarBerita = berita.some((b) => b.id === kejadian.id)
    ? berita
    : [kejadian, ...berita];

  // Data terstruktur untuk crawler — URL/gambar absolut karena JSON-LD tidak
  // ikut di-resolve metadataBase; nama organisasi mengikuti siteName layout.
  const { judul: judulSeo, deskripsi: deskripsiSeo } = teksSeo(seo, kejadian, bahasa);
  const urlHalaman = new URL(`/${bahasa}/fire/${slug}`, DASAR_SITUS).toString();
  const gambarAbsolut = kejadian.poster ? new URL(kejadian.poster, DASAR_SITUS).toString() : null;
  const terbit = seo?.event_date?.toISOString() ?? null;
  const diubah = seo?.updated_at?.toISOString() ?? terbit;
  const organisasi = { "@type": "Organization", name: "Fire", url: DASAR_SITUS };
  const beritaLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: judulSeo,
    ...(deskripsiSeo ? { description: deskripsiSeo } : {}),
    ...(gambarAbsolut ? { image: [gambarAbsolut] } : {}),
    ...(terbit ? { datePublished: terbit } : {}),
    ...(diubah ? { dateModified: diubah } : {}),
    inLanguage: bahasa,
    mainEntityOfPage: { "@type": "WebPage", "@id": urlHalaman },
    author: organisasi,
    publisher: {
      ...organisasi,
      logo: {
        "@type": "ImageObject",
        url: new URL("/assets/img/og-fire.jpg", DASAR_SITUS).toString(),
      },
    },
  };
  const remahLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: bahasa === "en" ? "Home" : "Beranda", item: `${DASAR_SITUS}/` },
      { "@type": "ListItem", position: 2, name: "Fire", item: `${DASAR_SITUS}/${bahasa}` },
      { "@type": "ListItem", position: 3, name: judulSeo, item: urlHalaman },
    ],
  };

  return (
    <>
      <h1 className="sr-only">{judulSeo}</h1>
      <JsonLd data={beritaLd} />
      <JsonLd data={remahLd} />
      <HalamanFire
        berita={daftarBerita}
        jumlahLaporan={jumlahLaporan}
        tigaTeratas={tigaTeratas}
        statistik={statistik}
        kejadianAwal={kejadian}
        bahasa={bahasa}
      />
    </>
  );
}

export default async function HalamanKejadian({ params }: Props) {
  const { locale, slug } = await params;
  if (!adaBahasa(locale)) notFound();

  return (
    <>
      <Nav bahasa={locale as Bahasa} />
      <Suspense fallback={<KerangkaBeranda bahasa={locale as Bahasa} />}>
        <IsiHalaman bahasa={locale as Bahasa} slug={slug} />
      </Suspense>
    </>
  );
}
