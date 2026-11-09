"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Akar IntersectionObserver untuk umpan: panggung menggulir di dalam <main>
 *  (.lk-kanan overflow-y:auto), aliran menggulir jendela. rootMargin hanya
 *  berlaku pada akar — salah akar = margin diabaikan. */
export function akarGulir(el: Element): Element | null {
  const rel = el.closest("main");
  return rel && getComputedStyle(rel).overflowY !== "visible" ? rel : null;
}

/** Rasio kerangka bergiliran supaya kolom yang menunggu tetap tampak masonry,
 *  bukan kisi seragam. Lima rasio: tak sejajar dengan 2/3/4 kolom. */
const RASIO_KERANGKA = ["aspect-[4/5]", "aspect-[4/3]", "aspect-[2/3]", "aspect-square", "aspect-[3/4]"];
export const rasioKerangka = (n: number) => RASIO_KERANGKA[Math.abs(n) % RASIO_KERANGKA.length];

/** Media kartu umpan yang baru dipasang saat kartunya ≤300px dari layar —
 *  loading="lazy" peramban mengambil ~1250px di depan, jadi seluruh halaman
 *  umpan ikut terunduh. Sampai gambarnya termuat, kerangka berdenyut menahan
 *  tempatnya lalu gambar memudar masuk. `langsung` (baris pertama, kandidat
 *  LCP) melewati semuanya: dirender server dan dimuat seketika. */
export function MediaTunda({ langsung = false, rasio = RASIO_KERANGKA[0], children }: {
  langsung?: boolean;
  /** Kelas aspect-* kerangka selama menunggu (rasioKerangka). */
  rasio?: string;
  children: (selesai: () => void) => ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [dekat, setDekat] = useState(langsung);
  const [termuat, setTermuat] = useState(langsung);
  useEffect(() => {
    const el = ref.current;
    if (dekat || !el) return;
    const pengamat = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setDekat(true);
      pengamat.disconnect();
    }, { root: akarGulir(el), rootMargin: "300px 0px" });
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [dekat]);

  if (langsung) return children(() => {});
  return (
    <span
      ref={ref}
      className={`block ${termuat
        ? "motion-safe:*:animate-[lk-media-muncul_300ms_ease-out]"
        : `${rasio} animate-pulse rounded-lg bg-black/[0.06] *:opacity-0 dark:bg-white/[0.08]`}`}
    >
      {dekat && children(() => setTermuat(true))}
    </span>
  );
}
