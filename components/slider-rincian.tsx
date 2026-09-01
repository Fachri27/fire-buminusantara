"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ItemMedia } from "@/lib/media";

type Props = {
  media: ItemMedia[];
  poster: string | null;
  label: string;
  kurangiGerak: boolean;
};

/**
 * Slider media di pop-up rincian dengan animasi transisi halus tanpa kedipan (flicker).
 *
 * Seluruh slide dirender dalam satu trek horizontal bersambung (CSS transform translateX)
 * sehingga perpindahan slide bergerak mulus. Video di slide yang tidak aktif
 * otomatis di-pause agar suaranya tidak bertumpuk.
 */
export function SliderRincian({ media, poster, label, kurangiGerak }: Props) {
  const [indeks, setIndeks] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [awalSiap, setAwalSiap] = useState(false);

  const kini = Math.min(Math.max(0, indeks), media.length - 1);

  // Putar video di slide aktif dan jeda video di slide lain
  useEffect(() => {
    videoRefs.current.forEach((el, i) => {
      if (!el) return;
      if (i === kini) {
        if (!kurangiGerak) {
          el.play().catch(() => {});
        }
      } else {
        el.pause();
      }
    });
  }, [kini, kurangiGerak]);

  // Cek apakah media awal sudah siap (tanpa reset state antar slide agar tidak berkedip)
  useEffect(() => {
    const pertama = media[0];
    if (!pertama) return;

    if (pertama.jenis === "gambar") {
      const img = new Image();
      img.onload = () => setAwalSiap(true);
      img.onerror = () => setAwalSiap(true);
      img.src = pertama.url;
    } else {
      const p = pertama.poster ?? poster;
      if (p) {
        const img = new Image();
        img.onload = () => setAwalSiap(true);
        img.onerror = () => setAwalSiap(true);
        img.src = p;
      } else {
        setAwalSiap(true);
      }
    }
  }, [media, poster]);

  const geser = useCallback((arah: number) => {
    setIndeks((i) => {
      const n = i + arah;
      if (n < 0) return media.length - 1;
      if (n >= media.length) return 0;
      return n;
    });
  }, [media.length]);

  // Dukungan navigasi panah kiri/kanan keyboard
  useEffect(() => {
    if (media.length <= 1) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") geser(-1);
      if (e.key === "ArrowRight") geser(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [media.length, geser]);

  if (!media || media.length === 0) return null;

  return (
    <div className="rincian__slider-wadah">
      {/* Trek geser horizontal dengan animasi halus */}
      <div
        className="rincian__slider-track"
        style={{
          transform: `translateX(-${kini * 100}%)`,
          transition: kurangiGerak ? "none" : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {media.map((m, idx) => (
          <div key={idx} className="rincian__slider-slide">
            {m.jenis === "video" ? (
              <video
                ref={(el) => {
                  videoRefs.current[idx] = el;
                }}
                src={m.url}
                poster={(m.poster ?? poster) ?? undefined}
                aria-label={m.keterangan || `${label} - video ${idx + 1}`}
                title={m.keterangan}
                controls
                playsInline
                preload={idx === 0 ? "metadata" : "none"}
                onCanPlay={() => {
                  if (idx === 0) setAwalSiap(true);
                }}
                onLoadedMetadata={() => {
                  if (idx === 0) setAwalSiap(true);
                }}
                className="rincian__slide-media"
              />
            ) : (
              <img
                src={m.url}
                alt={m.keterangan || `${label} - gambar ${idx + 1}`}
                title={m.keterangan}
                decoding="async"
                loading={idx === 0 ? "eager" : "lazy"}
                onLoad={() => {
                  if (idx === 0) setAwalSiap(true);
                }}
                className="rincian__slide-media"
              />
            )}
          </div>
        ))}
      </div>

      {/* Kerangka pemuatan awal (gelap halus, hanya muncul di awal buka modal) */}
      <div aria-hidden="true" className={`rincian__kerangka ${awalSiap ? "tutup" : ""}`} />

      {/* Navigasi panah jika media lebih dari 1 */}
      {media.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Media sebelumnya"
            onClick={() => geser(-1)}
            className="rincian__slider-tombol rincian__slider-tombol--kiri"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18 9 12l6-6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Media berikutnya"
            onClick={() => geser(1)}
            className="rincian__slider-tombol rincian__slider-tombol--kanan"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          {/* Titik navigasi slide (Dots indicator) */}
          <div
            className={`rincian__dots ${
              media[kini]?.jenis === "video" ? "rincian__dots--di-kendali" : ""
            }`}
          >
            {media.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Lihat media ${i + 1}`}
                aria-current={i === kini}
                onClick={() => setIndeks(i)}
                className={`rincian__dot-item transition-all duration-300 ${
                  i === kini
                    ? "w-5 bg-white"
                    : "w-2 bg-white/45 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}