import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BAHASA, TEKS_LAPOR, TEKS_NAV, adaBahasa, type Bahasa } from "@/lib/bahasa";
import { FormLaporan } from "./form-laporan";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return BAHASA.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!adaBahasa(locale)) return {};
  const teks = TEKS_LAPOR[locale];

  const judul = `${teks.judulHalaman} — Fire`;

  return {
    title: judul,
    description: teks.catatan,
    // Halaman kiriman: tidak ada isi yang perlu diindeks, dan tautan ke form
    // terbuka di hasil pencarian hanya mengundang bot.
    robots: { index: false, follow: true },
    // openGraph SENGAJA disetel di sini, bukan diwarisi dari root layout: tanpa
    // ini pratinjau bagikan halaman lapor memakai judul & deskripsi beranda
    // yang generik. Gambar tetap logo (og-fire.jpg) — halaman form tidak punya
    // gambar sendiri.
    openGraph: {
      title: judul,
      description: teks.catatan,
      url: `/${locale}/lapor`,
      siteName: "Fire",
      locale: locale === "en" ? "en_US" : "id_ID",
      type: "website",
      images: [{ url: "/assets/img/og-fire.jpg", width: 1200, height: 630, alt: "Fire" }],
    },
    twitter: {
      card: "summary_large_image",
      title: judul,
      description: teks.catatan,
      images: ["/assets/img/og-fire.jpg"],
    },
  };
}

export default async function HalamanLapor({ params }: Props) {
  const { locale } = await params;
  if (!adaBahasa(locale)) notFound();

  const bahasa = locale as Bahasa;
  const teks = TEKS_LAPOR[bahasa];

  return (
    // <html> berlatar gelap untuk panggung beranda; halaman ini bidang tulis,
    // jadi ia membawa alas terangnya sendiri.
    <div className="min-h-screen bg-[#faf8f5] text-tinta">
      <KopLapor bahasa={bahasa} />

      <main className="mx-auto w-full max-w-[680px] px-[var(--pias)] pt-10 pb-20">
        <h1 className="text-[clamp(24px,6vw,32px)] leading-tight font-semibold">
          {teks.judulHalaman}
        </h1>
        <p className="mt-3 mb-9 max-w-[52ch] text-[14px] leading-[1.6] text-tinta/60">
          {teks.catatan}
        </p>

        <FormLaporan bahasa={bahasa} />
      </main>
    </div>
  );
}

/**
 * Kepala halaman lapor — sengaja BUKAN <Nav>.
 *
 * Nav beranda berisi tautan yang menggulir ke #beranda dan #peta; di halaman
 * ini kedua bagian itu tidak ada, jadi tautannya akan diam saja saat ditekan.
 * Yang dibutuhkan di sini cuma dua: jalan pulang, dan penukar bahasa.
 */
function KopLapor({ bahasa }: { bahasa: Bahasa }) {
  const teks = TEKS_NAV[bahasa];

  return (
    <header className="sticky top-0 z-50 h-16 w-full border-b border-black/[0.06] bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[680px] items-center justify-between gap-4 px-[var(--pias)]">
        <Link href={`/${bahasa}`}
              className="text-[13px] font-semibold text-tinta/70 underline-offset-4 transition-colors hover:text-tinta">
          ← {teks.bagian.beranda}
        </Link>

        <div role="group" aria-label={teks.ganti}
             className="flex items-center rounded-full border border-black/[0.06] bg-black/[0.04] p-0.5 text-xs font-bold">
          {BAHASA.map((kode) =>
            kode === bahasa ? (
              <span key={kode} aria-current="true"
                    className="rounded-full bg-tinta px-2.5 py-0.5 uppercase text-white">
                {kode}
              </span>
            ) : (
              <Link key={kode} href={`/${kode}/lapor`}
                    aria-label={`${teks.ganti} (${kode.toUpperCase()})`}
                    className="rounded-full px-2.5 py-0.5 uppercase text-tinta/50 transition-colors hover:text-tinta">
                {kode}
              </Link>
            ),
          )}
        </div>
      </div>
    </header>
  );
}
