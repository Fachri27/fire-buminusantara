"use client";

import { useEffect, useRef } from "react";
import { gunakanKorsel } from "@/hooks/gunakan-korsel";
import { KartuBerita } from "./kartu-berita";
import { Statistik } from "./statistik";
import type { Statistik as DataStatistik } from "@/lib/statistik";
import type { Berita } from "@/lib/events";

export function Korsel({
  berita, statistik, onBuka,
}: {
  berita: Berita[];
  statistik: DataStatistik[];
  onBuka: (i: number) => void;
}) {
  const {
    kartu, aktif, geser, diam, jalurRef, kurangiGerak,
    pindah, keKartu, normalkan, mulaiOtomatis, hentikanOtomatis, setTerlihat,
  } = gunakanKorsel(berita);

  const sectionRef = useRef<HTMLElement | null>(null);
  const sentuh = useRef<{ x: number; y: number; id: number } | null>(null);

  // Korsel berhenti saat sectionnya keluar dari pandangan.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const pengamat = new IntersectionObserver(
      ([e]) => setTerlihat(e.isIntersecting),
      { threshold: 0.4 },
    );
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [setTerlihat]);

  useEffect(() => {
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") pindah(-1);
      else if (e.key === "ArrowRight") pindah(1);
    };
    window.addEventListener("keydown", saatTombol);
    return () => window.removeEventListener("keydown", saatTombol);
  }, [pindah]);

  return (
    <section
      ref={sectionRef}
      id="beranda"
      aria-label="Beranda"
      onMouseEnter={hentikanOtomatis}
      onMouseLeave={mulaiOtomatis}
      onFocus={hentikanOtomatis}
      className="sticky top-0 z-[1] flex min-h-[100svh] flex-col justify-center overflow-hidden
                 px-[var(--pias)] pt-[calc(4rem+clamp(18px,5vw,56px))] pb-[clamp(20px,5vw,56px)]
                 pendek:static pendek:z-auto pendek:min-h-0
                 panggung:block panggung:h-screen panggung:min-h-0
                 panggung:sticky panggung:top-0 panggung:z-[1] panggung:p-0"
    >
      {/* Foto latar hero — DIAM, tanpa parallax.

          Dulu di-oversize (tinggi 180%, top -40%) supaya bisa digeser tanpa
          menyingkap tepi. Karena sekarang tidak digeser sama sekali, ukuran
          lebihnya tidak ada gunanya lagi: cukup menutupi layar persis. */}
      <img src="/assets/img/bg-karhutla.jpg" alt="" aria-hidden="true" fetchPriority="high"
           className="absolute inset-0 h-full w-full object-cover" />

      <div data-kanvas
           className="relative mx-auto w-full max-w-[940px]
                      panggung:absolute panggung:top-1/2 panggung:left-1/2 panggung:mx-0
                      panggung:mt-[-540px] panggung:ml-[-960px] panggung:h-[1080px]
                      panggung:w-[1920px] panggung:max-w-none panggung:origin-center
                      panggung:scale-[var(--skala,1)] panggung:overflow-hidden">

        {berita.length === 0 ? <RakKosong /> : (
        <section aria-roledescription="korsel" aria-label="Berita karhutla terkini"
                 className="relative panggung:absolute panggung:inset-0">
          {/* Jendela: menyembunyikan kartu kembaran di luar kartu utama. */}
          <div
            onTouchStart={(e) => {
              if (e.touches.length > 1) return;
              const t = e.touches[0];
              sentuh.current = { x: t.clientX, y: t.clientY, id: t.identifier };
            }}
            onTouchEnd={(e) => {
              const a = sentuh.current;
              if (!a) return;
              const t = Array.from(e.changedTouches).find((touch) => touch.identifier === a.id);
              if (t) {
                const dx = t.clientX - a.x, dy = t.clientY - a.y;
                // Hanya sapuan mendatar; sapuan tegak itu guliran halaman.
                if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) pindah(dx < 0 ? 1 : -1);
              }
              sentuh.current = null;
            }}
            onTouchCancel={() => {
              sentuh.current = null;
            }}
            className="relative w-full overflow-hidden pt-[10px] pb-[18px]
                       panggung:absolute panggung:top-[140px] panggung:left-[70px]
                       panggung:h-[680px] panggung:w-[1780px] panggung:p-0"
          >
            <div
              ref={jalurRef}
              onTransitionEnd={(e) => { if (e.propertyName === "transform" && e.target === e.currentTarget) normalkan(); }}
              // Sebelum terapkan() memasang angka piksel, geser masih null —
              // pusatkan lewat calc() CSS: hasilnya nilai yang SAMA dengan
              // -(aktif*langkah + lebarKartu/2), tapi dihitung peramban pada
              // bingkai pertama, bukan menunggu efek pasang. Token menangani
              // kedua mode sekaligus (aliran maupun panggung).
              style={{ transform: geser === null
                ? `translateX(calc(${-(aktif)} * (var(--kartu-lebar) + var(--kartu-sela)) - var(--kartu-lebar) / 2))`
                : `translateX(${geser}px)` }}
              className={`relative left-1/2 flex items-stretch gap-[var(--kartu-sela)]
                          transition-transform duration-[550ms] ease-[cubic-bezier(0.4,0,0.2,1)]
                          panggung:absolute panggung:top-[40px] ${diam ? "transition-none" : ""}`}
            >
              {kartu.map((k, i) => (
                <KartuBerita key={k.kunci} k={k} aktif={i === aktif} kurangiGerak={kurangiGerak}
                             onPilih={() => keKartu(i)} onBuka={() => onBuka(k.asli)}
                             onGeserMedia={mulaiOtomatis} />
              ))}
            </div>
          </div>

          {berita.length > 1 && (
            <>
              <Panah arah={-1} label="Berita sebelumnya" onClick={() => pindah(-1)} />
              <Panah arah={1} label="Berita berikutnya" onClick={() => pindah(1)} />
            </>
          )}
        </section>
        )}

        <Statistik daftar={statistik} />
      </div>
    </section>
  );
}

function Panah({ arah, label, onClick }: { arah: -1 | 1; label: string; onClick: () => void }) {
  const sisi = arah === -1
    ? "left-0 panggung:left-[9px]"
    : "right-0 panggung:right-[9px]";
  return (
    <button type="button" aria-label={label} onClick={onClick}
            className={`absolute top-1/2 ${sisi} z-20 grid size-[var(--panah-ukuran)] -translate-y-1/2
                        place-items-center rounded-full bg-black/30 text-white backdrop-blur-[6px]
                        transition-colors hover:bg-black/55 focus-visible:outline-2
                        focus-visible:outline-offset-2 focus-visible:outline-white
                        panggung:top-[468px] panggung:bg-transparent panggung:backdrop-blur-none
                        panggung:drop-shadow-[0_2px_6px_rgb(0_0_0/0.45)]
                        panggung:hover:bg-transparent panggung:hover:opacity-75`}>
      <svg viewBox="0 0 27 45" aria-hidden="true" fill="none" stroke="currentColor"
           strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
           className="h-[var(--panah-ikon)] w-auto">
        <path d={arah === -1
          ? "M13.5 3 3.5 22.5 13.5 42M25 3 15 22.5 25 42"
          : "M13.5 3 23.5 22.5 13.5 42M2 3 12 22.5 2 42"} />
      </svg>
    </button>
  );
}

/** Belum ada kejadian di CMS: rak kosong berukuran sama persis dengan kartu
 *  berita, jadi tata letaknya sendiri sudah memperlihatkan apa yang akan
 *  muncul di sini. Hanya isinya — kerangka hero, foto parallax, dan kanvas
 *  panggung dipegang <section> di atas supaya keduanya berbagi struktur yang
 *  sama; tanpa itu parallax dan penskalaan kanvas mati saat CMS kosong. */
function RakKosong() {
  return (
    <div role="status" className="pantauan-kosong">
      <div className="pantauan-kosong__jendela">
        <div className="pantauan-kosong__rak">
          <div aria-hidden="true" className="pantauan-kosong__slot pantauan-kosong__slot--sisi" />
          <article className="pantauan-kosong__slot pantauan-kosong__slot--utama">
            <div className="pantauan-kosong__isi">
              <p className="pantauan-kosong__judul">Belum ada laporan</p>
              <p className="pantauan-kosong__catatan">
                Laporan lapangan karhutla akan muncul di kartu ini begitu yang pertama tercatat.
              </p>
            </div>
            <div aria-hidden="true" className="pantauan-kosong__bingkai">
              <div className="pantauan-kosong__sapuan" />
            </div>
          </article>
          <div aria-hidden="true" className="pantauan-kosong__slot pantauan-kosong__slot--sisi" />
        </div>
      </div>
    </div>
  );
}
