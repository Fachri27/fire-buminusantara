import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BAHASA, TEKS_LAPOR, adaBahasa } from "@/lib/bahasa";
import { DESKRIPSI_SITUS, JUDUL_SITUS, NAMA_SITUS } from "@/lib/situs";
import { FormLaporan } from "./form-laporan";
import { KerangkaKop, KopHalaman } from "@/components/kop-halaman";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return BAHASA.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!adaBahasa(locale)) return {};

  return {
    title: JUDUL_SITUS,
    description: DESKRIPSI_SITUS,
    // Halaman kiriman: tidak ada isi yang perlu diindeks, dan tautan ke form
    // terbuka di hasil pencarian hanya mengundang bot.
    robots: { index: false, follow: true },
    alternates: {
      canonical: `/${locale}/lapor`,
      languages: {
        id: "/id/lapor",
        en: "/en/lapor",
        "x-default": "/id/lapor",
      },
    },
    other: {
      "content-language": locale,
    },
    // openGraph SENGAJA disetel di sini, bukan diwarisi dari root layout: tanpa
    // ini og:url pratinjau bagikan menunjuk beranda. Gambar tetap logo
    // (og-lapor.jpg) — halaman form tidak punya gambar sendiri.
    openGraph: {
      title: JUDUL_SITUS,
      description: DESKRIPSI_SITUS,
      url: `/${locale}/lapor`,
      siteName: NAMA_SITUS,
      locale: locale === "en" ? "en_US" : "id_ID",
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

// Kerangka halaman SENGAJA tidak async dan tidak menyentuh `params`: App Shell
// rute ini dipakai bersama /id/lapor dan /en/lapor, jadi membaca segmen
// [locale] di sini mengikat shell-nya ke satu URL (insight
// instant-shell-url-data). Alas dan geometri kolom tetap tinggal di shell;
// yang berbahasa turun ke dalam <Suspense>.
export default function HalamanLapor({ params }: Props) {
  return (
    // Bidang halaman lapor — mendukung mode terang dan gelap
    <div className="min-h-screen bg-white text-tinta dark:bg-[#0a0a0a] dark:text-[#f5f5f5] transition-colors duration-200">
      <Suspense fallback={<KerangkaKop />}>
        <KopLokal params={params} />
      </Suspense>

      <main className="mx-auto w-full max-w-[680px] px-[var(--pias)] pt-10 pb-20">
        <Suspense fallback={<KerangkaIsi />}>
          <IsiLapor params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function KopLokal({ params }: Props) {
  const { locale } = await params;
  // Backstop: proxy.ts sudah menjamin prefiks /id atau /en sebelum permintaan
  // sampai ke sini, jadi cabang ini praktis tak terjangkau.
  if (!adaBahasa(locale)) notFound();
  return <KopHalaman bahasa={locale} jalur="lapor" />;
}

async function IsiLapor({ params }: Props) {
  const { locale } = await params;
  if (!adaBahasa(locale)) notFound();
  const teks = TEKS_LAPOR[locale];

  return (
    <>
      <h1 className="text-[clamp(24px,6vw,32px)] leading-tight font-semibold">
        {teks.judulHalaman}
      </h1>
      <p className="mt-3 mb-9 max-w-[52ch] text-[14px] leading-[1.6] text-tinta/60 dark:text-[#a0a0a0]">
        {teks.catatan}
      </p>

      <FormLaporan bahasa={locale} />

      <p className="mt-8 text-[12px] leading-[1.5] text-tinta/45 dark:text-[#a0a0a0]">
        <Link href={`/${locale}/privasi`} className="underline underline-offset-4 hover:text-tinta dark:hover:text-white">
          {locale === "en" ? "Privacy policy" : "Kebijakan privasi"}
        </Link>
      </p>
    </>
  );
}

/** Judul dan catatan menahan tingginya sendiri supaya formulir di bawahnya
 *  tidak bergeser. Teksnya tidak bisa tahu bahasa halaman — itu data URL —
 *  jadi bawaannya Indonesia, sama seperti KerangkaBeranda. */
function KerangkaIsi() {
  return (
    <div role="status">
      <p className="sr-only">Memuat formulir laporan…</p>
      <div aria-hidden="true">
        <div className="h-[clamp(24px,6vw,32px)] w-3/4 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
        <div className="mt-3 mb-9 h-[42px] max-w-[52ch] animate-pulse rounded bg-black/[0.04] dark:bg-white/5" />
      </div>
    </div>
  );
}
