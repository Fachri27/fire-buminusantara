import Link from "next/link";
import { BAHASA, TEKS_NAV, type Bahasa } from "@/lib/bahasa";
import { SakelarTema } from "@/components/sakelar-tema";

/**
 * Kepala halaman tunggal (/lapor, /privasi) — sengaja BUKAN <Nav>.
 *
 * Nav beranda berisi tautan yang menggulir ke #beranda dan #peta; di halaman
 * ini kedua bagian itu tidak ada, jadi tautannya akan diam saja saat ditekan.
 * Yang dibutuhkan di sini: jalan pulang, penukar bahasa, dan sakelar tema.
 * `jalur` = segmen halaman ini, supaya penukar bahasa tetap di halaman yang sama.
 */
export function KopHalaman({ bahasa, jalur }: { bahasa: Bahasa; jalur: string }) {
  const teks = TEKS_NAV[bahasa];

  return (
    <header className="sticky top-0 z-50 h-16 w-full border-b border-black/[0.06] bg-white/85 dark:border-white/10 dark:bg-pantau-konsol/90 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[680px] items-center justify-between gap-4 px-[var(--pias)]">
        {/* Pulang ke halaman utama (konsol peta) — /beranda ditutup proxy. */}
        <Link href={`/${bahasa}`}
              className="text-[13px] font-semibold text-tinta/70 dark:text-white/70 underline-offset-4 transition-colors hover:text-tinta dark:hover:text-white">
          ← {teks.bagian.beranda}
        </Link>

        <div className="flex items-center gap-2">
          <div role="group" aria-label={teks.ganti}
               className="flex items-center rounded-full border border-black/[0.06] bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.05] p-0.5 text-xs font-bold">
            {BAHASA.map((kode) =>
              kode === bahasa ? (
                <span key={kode} aria-current="true"
                      className="rounded-full bg-[#ff5a26] px-2.5 py-0.5 uppercase text-white shadow-xs">
                  {kode}
                </span>
              ) : (
                <Link key={kode} href={`/${kode}/${jalur}`}
                      aria-label={`${teks.ganti} (${kode.toUpperCase()})`}
                      className="rounded-full px-2.5 py-0.5 uppercase text-tinta/50 dark:text-white/60 transition-colors hover:text-tinta dark:hover:text-white">
                  {kode}
                </Link>
              ),
            )}
          </div>

          {/* Sakelar Tema tepat di samping penukar bahasa */}
          <SakelarTema bahasa={bahasa} />
        </div>
      </div>
    </header>
  );
}

/** Bilah kosong setinggi kepala aslinya (h-16, sticky): isi di bawahnya tidak
 *  melompat saat kepala berbahasa menggantikannya. */
export function KerangkaKop() {
  return (
    <header className="sticky top-0 z-50 h-16 w-full border-b border-black/[0.06]
                       bg-white/85 dark:border-white/10 dark:bg-pantau-konsol/90 backdrop-blur-md" />
  );
}
