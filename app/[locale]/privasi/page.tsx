import { Fragment, Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BAHASA, adaBahasa, type Bahasa } from "@/lib/bahasa";
import { KerangkaKop, KopHalaman } from "@/components/kop-halaman";
import { DIPERBARUI, SUREL_PRIVASI, TEKS_PRIVASI } from "./teks";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return BAHASA.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!adaBahasa(locale)) return {};
  const teks = TEKS_PRIVASI[locale];
  return {
    title: `${teks.judul} | Lapor Karhutla`,
    description: teks.pembuka,
    alternates: {
      canonical: `/${locale}/privasi`,
      languages: { id: "/id/privasi", en: "/en/privasi", "x-default": "/id/privasi" },
    },
    other: { "content-language": locale },
  };
}

// Kerangka SENGAJA tidak async dan tidak menyentuh `params` — sama seperti
// /lapor: shell rute dipakai bersama /id dan /en, yang berbahasa turun ke
// dalam <Suspense>.
export default function HalamanPrivasi({ params }: Props) {
  return (
    <div className="min-h-screen bg-white text-tinta dark:bg-[#0a0a0a] dark:text-[#f5f5f5] transition-colors duration-200">
      <Suspense fallback={<KerangkaKop />}>
        <KopLokal params={params} />
      </Suspense>

      <main className="mx-auto w-full max-w-[680px] px-[var(--pias)] pt-10 pb-20">
        <Suspense fallback={<p className="sr-only" role="status">Memuat kebijakan privasi…</p>}>
          <IsiPrivasi params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function KopLokal({ params }: Props) {
  const { locale } = await params;
  if (!adaBahasa(locale)) notFound();
  return <KopHalaman bahasa={locale} jalur="privasi" />;
}

async function IsiPrivasi({ params }: Props) {
  const { locale } = await params;
  if (!adaBahasa(locale)) notFound();
  const teks = TEKS_PRIVASI[locale];

  return (
    <article className="text-[14px] leading-[1.7]">
      <h1 className="text-[clamp(24px,6vw,32px)] leading-tight font-semibold">{teks.judul}</h1>
      <p className="mt-2 text-[12px] text-tinta/45 dark:text-[#a0a0a0]">
        {teks.diperbarui}: <time dateTime={DIPERBARUI.toISOString().slice(0, 10)}>{tanggal(locale)}</time>
      </p>
      <p className="mt-6 text-tinta/80 dark:text-[#d0d0d0]">{teks.pembuka}</p>

      {teks.bagian.map((b) => (
        <section key={b.judul} className="mt-9">
          <h2 className="text-[17px] font-semibold">{b.judul}</h2>
          {b.paragraf?.map((p) => (
            <p key={p} className="mt-3 text-tinta/80 dark:text-[#d0d0d0]"><Teks isi={p} /></p>
          ))}
          {b.butir && (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-tinta/80 dark:text-[#d0d0d0] marker:text-[#ff5a26]">
              {b.butir.map((p) => <li key={p}><Teks isi={p} /></li>)}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}

function tanggal(bahasa: Bahasa): string {
  return DIPERBARUI.toLocaleDateString(bahasa === "en" ? "en-GB" : "id-ID", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  });
}

/** Teks dengan `{surel}` diganti tautan mailto ke SUREL_PRIVASI. */
function Teks({ isi }: { isi: string }) {
  return isi.split("{surel}").map((potong, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <a href={`mailto:${SUREL_PRIVASI}`} className="font-medium text-tinta dark:text-white underline decoration-[#ff5a26] decoration-2 underline-offset-4">
          {SUREL_PRIVASI}
        </a>
      )}
      {potong}
    </Fragment>
  ));
}
