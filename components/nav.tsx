"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { BAHASA, TEKS_NAV, type Bahasa } from "@/lib/bahasa";

/** Bagian halaman yang bisa dituju dari bilah ini — dua layar utama. */
const BAGIAN = ["beranda", "peta"] as const;

type Props = { bahasa: Bahasa };

/**
 * Bilah Navigasi Minimalis.
 *
 * Tingginya TETAP 4rem (h-16): seluruh halaman menghitung jarak amannya dari angka itu
 * (`pt-[calc(4rem+…)]` di kedua section, posisi atas pop-up peta), jadi
 * ukuran luarnya tetap dipertahankan.
 */
export function Nav({ bahasa }: Props) {
  const teks = TEKS_NAV[bahasa];
  const [aktif, setAktif] = useState<string>(BAGIAN[0]);
  const [tergulir, setTergulir] = useState(false);
  const lokasi = usePathname();

  // Sinkronisasi <html lang> dengan bahasa aktif
  useEffect(() => {
    document.documentElement.lang = bahasa;
  }, [bahasa]);

  // Pantau scroll untuk deteksi bagian aktif & efek border header
  useEffect(() => {
    const elemen = BAGIAN.map((b) => document.getElementById(b)).filter(
      (el): el is HTMLElement => el !== null,
    );

    const perbarui = () => {
      setTergulir(window.scrollY > 8);

      const tengah = window.innerHeight / 2;
      let terpilih: string = BAGIAN[0];
      for (const el of elemen) {
        const kotak = el.getBoundingClientRect();
        if (kotak.top <= tengah && kotak.bottom > tengah) terpilih = el.id;
      }
      setAktif(terpilih);
    };

    perbarui();
    window.addEventListener("scroll", perbarui, { passive: true });
    window.addEventListener("resize", perbarui);
    return () => {
      window.removeEventListener("scroll", perbarui);
      window.removeEventListener("resize", perbarui);
    };
  }, []);

  /** Tukar prefiks bahasa pada URL */
  const tautanBahasa = useCallback(
    (target: Bahasa) => {
      const sisa = BAHASA.find((b) => lokasi.startsWith(`/${b}/`) || lokasi === `/${b}`);
      return sisa ? `/${target}${lokasi.slice(1 + sisa.length)}` : `/${target}`;
    },
    [lokasi],
  );

  /** Gulir halus ke sebuah bagian (terintegrasi dengan Lenis jika tersedia) */
  const keBagian = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();

    let y = 0;
    if (id !== BAGIAN[0]) {
      const sasaran = document.getElementById(id);
      if (!sasaran) return;
      for (let n: HTMLElement | null = sasaran; n; n = n.offsetParent as HTMLElement | null) {
        y += n.offsetTop;
      }
    }

    const lenis = (window as unknown as { lenis?: { scrollTo(t: number): void } }).lenis;
    if (lenis?.scrollTo) {
      lenis.scrollTo(y);
      return;
    }

    const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: y, behavior: kurangiGerak ? "auto" : "smooth" });
  };

  return (
    <header
      aria-label={teks.navigasi}
      className={`fixed top-0 left-0 z-50 h-16 w-full bg-white/80 backdrop-blur-md transition-all duration-200 ${
        tergulir
          ? "border-b border-black/[0.08] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]"
          : "border-b border-black/[0.03]"
      }`}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-[var(--pias)]">
        {/* Logo + wordmark — tautan ke beranda dalam bahasa aktif. Ikon sendirian
            terlihat kecil & sepi di kiri; dipasangkan teks "Fire" jadi kesatuan
            merek yang mengisi ruang. */}
        <a href={`/${bahasa}`} aria-label="Fire — beranda"
           className="flex shrink-0 items-center gap-2">
          <img src="/assets/img/logo-fire.png" alt="" aria-hidden="true"
               width={95} height={160} className="h-11 w-auto" />
          <span className="text-[22px] font-bold leading-none tracking-tight text-tinta">
            Fire
          </span>
        </a>

        {/* Menu Navigasi & Penukar Bahasa */}
        <div className="flex items-center gap-4 sm:gap-7">
          <nav aria-label={teks.navigasi} className="flex items-center gap-1 sm:gap-2">
            {BAGIAN.map((id) => {
              const sedang = aktif === id;
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => keBagian(e, id)}
                  aria-current={sedang ? "page" : undefined}
                  className={`relative rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold tracking-wide uppercase transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-api ${
                    sedang
                      ? "text-api"
                      : "text-tinta/60 hover:text-tinta hover:bg-black/[0.04]"
                  }`}
                >
                  {teks.bagian[id]}
                  {sedang && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0.5 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-api"
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Jalan masuk ke form laporan warga. Tautan sungguhan, bukan jangkar
              gulir seperti dua tombol di sebelahnya — halamannya lain. */}
          <a
            href={`/${bahasa}/lapor`}
            className="rounded-full bg-api px-3 py-1.5 text-xs sm:text-sm font-semibold tracking-wide uppercase text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-api"
          >
            {teks.lapor}
          </a>

          {/* Garis Pemisah Tipis */}
          <div className="h-4 w-[1px] bg-black/10" aria-hidden="true" />

          {/* Penukar Bahasa Minimalis */}
          <div
            role="group"
            aria-label={teks.ganti}
            className="flex items-center rounded-full bg-black/[0.04] p-0.5 border border-black/[0.06] text-xs font-bold"
          >
            {BAHASA.map((kode) => {
              const terpilih = kode === bahasa;
              return terpilih ? (
                <span
                  key={kode}
                  aria-current="true"
                  className="rounded-full bg-tinta px-2.5 py-0.5 uppercase text-white shadow-xs"
                >
                  {kode}
                </span>
              ) : (
                <a
                  key={kode}
                  href={tautanBahasa(kode)}
                  aria-label={`${teks.ganti} (${kode.toUpperCase()})`}
                  className="rounded-full px-2.5 py-0.5 uppercase text-tinta/50 transition-colors hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-api"
                >
                  {kode}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}