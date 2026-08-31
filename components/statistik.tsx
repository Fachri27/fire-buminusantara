"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Statistik as Data } from "@/lib/statistik";

/**
 * Strip "Angka hari ini".
 *
 * Di mode aliran ia digulir mendatar dengan snap; di panggung kelimanya
 * berjajar tetap di bawah korsel (top 836px), jadi tombol gesernya tidak
 * diperlukan di sana.
 */
export function Statistik({ daftar }: { daftar: Data[] }) {
  const jalurRef = useRef<HTMLDivElement | null>(null);
  const [bisaKiri, setBisaKiri] = useState(false);
  const [bisaKanan, setBisaKanan] = useState(false);

  /** Tandai sisi yang masih bisa digulir (ambang 4px untuk toleransi). */
  const tandaiGulir = useCallback(() => {
    const j = jalurRef.current;
    if (!j) return;
    setBisaKiri(j.scrollLeft > 4);
    setBisaKanan(j.scrollLeft < j.scrollWidth - j.clientWidth - 4);
  }, []);

  useEffect(() => {
    tandaiGulir();
    let tunda: ReturnType<typeof setTimeout> | null = null;
    const saatUbah = () => {
      if (tunda) clearTimeout(tunda);
      tunda = setTimeout(tandaiGulir, 60);
    };
    window.addEventListener("resize", saatUbah);
    return () => { window.removeEventListener("resize", saatUbah); if (tunda) clearTimeout(tunda); };
  }, [tandaiGulir]);

  /** Geser satu kartu; snap yang merapikan posisi akhirnya. */
  const geser = (arah: -1 | 1) => {
    const j = jalurRef.current;
    if (!j) return;
    const kartu = j.querySelector("article");
    const langkah = kartu ? kartu.offsetWidth + 16 : j.clientWidth * 0.8;
    j.scrollBy({ left: arah * langkah, behavior: "smooth" });
  };

  if (!daftar.length) return null;

  return (
    <div className="relative mt-[clamp(14px,3.6vw,20px)] panggung:absolute panggung:top-[836px] panggung:right-[95px] panggung:left-[95px] panggung:mt-0">
      <p className="mb-[6px] text-[length:var(--ukuran-eyebrow)] font-medium tracking-[0.14em] uppercase
                    text-[rgb(26_25_25/0.72)] [text-shadow:0_1px_10px_rgb(255_255_255/0.75)] panggung:hidden">
        Angka hari ini
      </p>

      <div
        ref={jalurRef}
        onScroll={tandaiGulir}
        className="tanpa-bilah-gulir flex snap-x snap-mandatory gap-[var(--sela)] overflow-x-auto
                   panggung:justify-between panggung:gap-0 panggung:overflow-visible"
      >
        {daftar.map((item) => (
          <article key={item.label}
                   className="w-[var(--statistik-lebar)] shrink-0 snap-start bg-white p-[var(--statistik-pias)]
                              text-left panggung:h-[208px] panggung:w-[307px]">
            <p className="text-[length:var(--ukuran-tanggal)] leading-[1.2] font-normal whitespace-nowrap">
              • {item.tanggal} •
            </p>
            <h3 className="mt-[var(--statistik-jarak-label)] text-[length:var(--ukuran-label)] leading-[1.2] font-bold">
              {item.label}
            </h3>
            {item.nilai && (
              <p className="mt-2 text-[length:var(--ukuran-nilai)] leading-[1.1] font-bold text-api">{item.nilai}</p>
            )}
            {item.keterangan && (
              <p className="mt-1 text-[length:var(--ukuran-catatan)] leading-[1.3] font-normal text-[rgb(26_25_25/0.6)]">
                {item.keterangan}
              </p>
            )}
          </article>
        ))}
      </div>

      {/* Tombol geser hanya berguna selama stripnya memang bisa digulir. */}
      {(bisaKiri || bisaKanan) && (
        <div className="panggung:hidden">
          {bisaKiri && <TombolStrip arah={-1} onClick={() => geser(-1)} />}
          {bisaKanan && <TombolStrip arah={1} onClick={() => geser(1)} />}
        </div>
      )}
    </div>
  );
}

function TombolStrip({ arah, onClick }: { arah: -1 | 1; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
            aria-label={arah === -1 ? "Statistik sebelumnya" : "Statistik berikutnya"}
            className={`absolute top-1/2 ${arah === -1 ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"}
                        z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white
                        shadow-[0_2px_10px_rgb(0_0_0/0.25)] text-tinta`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" className="size-4">
        <path d={arah === -1 ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </svg>
    </button>
  );
}
