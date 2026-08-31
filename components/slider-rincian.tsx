"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemMedia } from "@/lib/media";

type Props = {
  media: ItemMedia[];
  poster: string | null;
  label: string;
  kurangiGerak: boolean;
};

/**
 * Slider media di pop-up rincian.
 *
 * Berbeda dengan kartu, video di sini BERSUARA. Karena itu media yang
 * ditinggalkan harus benar-benar dijeda, bukan sekadar disembunyikan: di
 * Alpine seluruh media dipasang bersamaan dengan x-show, dan video sebelumnya
 * terus terdengar setelah tombol next ditekan. Di sini hanya media yang sedang
 * ditunjuk yang dirender, jadi yang ditinggalkan otomatis lepas dari DOM dan
 * berhenti.
 *
 * Pemanggil memberi `key` per kejadian: pop-up memakai komponen yang sama saat
 * laporan berganti, dan remount itulah yang mengembalikan slider ke media
 * pertama — tanpa perlu efek penyetel state.
 */
export function SliderRincian({ media, poster, label, kurangiGerak }: Props) {
  const [indeks, setIndeks] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || kurangiGerak) return;
    // Putar-otomatis bersuara kerap ditolak peramban; kontrolnya tetap tampil,
    // jadi tidak ada yang perlu dilakukan saat ditolak.
    el.play().catch(() => {});
  }, [indeks, kurangiGerak]);

  const kini = indeks < media.length ? indeks : 0;
  const m = media[kini];
  if (!m) return null;

  const geser = (arah: number) => {
    setIndeks((i) => {
      const n = (i + arah) % media.length;
      return n < 0 ? n + media.length : n;
    });
  };

  return (
    <>
      {m.jenis === "video" ? (
        <video key={`v${kini}`} ref={videoRef} src={m.url} poster={poster ?? undefined}
               aria-label={label} controls playsInline preload="metadata" />
      ) : (
        <img key={`g${kini}`} src={m.url} alt={label} />
      )}

      {media.length > 1 && (
        <>
          <button type="button" aria-label="Media sebelumnya" onClick={() => geser(-1)}
                  className="rincian__slider-tombol rincian__slider-tombol--kiri">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18 9 12l6-6" />
            </svg>
          </button>
          <button type="button" aria-label="Media berikutnya" onClick={() => geser(1)}
                  className="rincian__slider-tombol rincian__slider-tombol--kanan">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <div className="rincian__dots">
            {media.map((_, i) => (
              <button key={i} type="button" aria-label={`Media ${i + 1}`} aria-current={i === kini}
                      onClick={() => setIndeks(i)}
                      className={`h-2 w-2 rounded-full transition-all ${
                        i === kini ? "scale-125 bg-white" : "bg-white/50 hover:bg-white/75"
                      }`} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
