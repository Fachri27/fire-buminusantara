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
  // Rasio asli tiap media (lebar ÷ tinggi), diisi saat metadata video / gambar
  // selesai dimuat. Menyetel aspect-ratio bingkai slide agar bingkai menempel
  // pada isi media, bukan pada kotak slide yang bisa lebih besar.
  const [rasioMedia, setRasioMedia] = useState<(number | undefined)[]>([]);

  // Apakah bilah kendali video sedang tampak. Peramban tidak memberi tahu kapan
  // ia menyembunyikan kontrolnya sendiri, jadi keadaannya ditiru: kontrol
  // dianggap tampak saat video dijeda / disentuh / kursor bergerak di atasnya,
  // lalu menghilang sendiri setelah diam sesaat SAAT MEMUTAR. Kredit hanya
  // diangkat di atas bilah itu selagi ia tampak; begitu hilang, kredit turun
  // kembali ke dasar media.
  const [kendaliTampak, setKendaliTampak] = useState(true);
  const sembunyiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const simpanRasio = useCallback((lebar: number, tinggi: number, idx: number) => {
    if (!lebar || !tinggi) return;
    const rasio = lebar / tinggi;
    setRasioMedia((r) => {
      if (r[idx] === rasio) return r;
      const n = [...r];
      n[idx] = rasio;
      return n;
    });
  }, []);

  const kini = Math.min(Math.max(0, indeks), media.length - 1);

  // Jadwalkan sembunyi HANYA kalau videonya sedang memutar — video yang dijeda,
  // habis, atau gambar diam selalu menampilkan kontrolnya, jadi kreditnya tetap
  // terangkat.
  const jadwalSembunyi = useCallback((el: HTMLVideoElement | null) => {
    if (sembunyiTimer.current) clearTimeout(sembunyiTimer.current);
    sembunyiTimer.current = null;
    if (el && !el.paused && !el.ended) {
      // Diselaraskan dengan waktu bilah kendali bawaan menghilang. Terlalu
      // panjang → kredit terasa menggantung lama sebelum turun; terlalu pendek
      // → kredit turun selagi kontrol masih tampak dan sempat bertumpuk.
      sembunyiTimer.current = setTimeout(() => setKendaliTampak(false), 1400);
    }
  }, []);

  const tunjukKendali = useCallback((el: HTMLVideoElement | null) => {
    setKendaliTampak(true);
    jadwalSembunyi(el);
  }, [jadwalSembunyi]);

  // Gerak / sentuh di mana pun pada slider dihitung sebagai aktivitas terhadap
  // video yang sedang aktif — termasuk di bilah hitam di luar bingkai video.
  const aktivitasPointer = useCallback(() => {
    tunjukKendali(videoRefs.current[kini] ?? null);
  }, [tunjukKendali, kini]);

  // Bereskan timer saat komponen dibongkar.
  useEffect(() => () => {
    if (sembunyiTimer.current) clearTimeout(sembunyiTimer.current);
  }, []);

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
    let aktif = true;
    const pertama = media[0];
    if (!pertama) return;

    if (pertama.jenis === "gambar") {
      const img = new Image();
      img.onload = () => { if (aktif) setAwalSiap(true); };
      img.onerror = () => { if (aktif) setAwalSiap(true); };
      img.src = pertama.url;
    } else {
      const p = pertama.poster ?? poster;
      if (p) {
        const img = new Image();
        img.onload = () => { if (aktif) setAwalSiap(true); };
        img.onerror = () => { if (aktif) setAwalSiap(true); };
        img.src = p;
      } else {
        if (aktif) setAwalSiap(true);
      }
    }

    return () => {
      aktif = false;
    };
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
    <div
      className="rincian__slider-wadah"
      onPointerMove={aktivitasPointer}
      onPointerDown={aktivitasPointer}
    >
      {/* Trek geser horizontal dengan animasi halus */}
      <div
        className="rincian__slider-track"
        style={{
          transform: `translateX(-${kini * 100}%)`,
          transition: kurangiGerak ? "none" : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {media.map((m, idx) => {
          // Rasio asli media (lebar ÷ tinggi). Dipakai untuk menyetel aspect-ratio
          // bingkai di bawah, supaya bingkainya menempel persis pada isi video —
          // bukan pada kotak slide yang bisa lebih besar (bilah hitam), sehingga
          // kredit selalu berada DI DALAM gambar/video, bukan di bilah hitamnya.
          const rasio = rasioMedia[idx];
          return (
            <div key={idx} className="rincian__slider-slide">
              <div
                className="rincian__slide-bingkai"
                style={
                  rasio
                    ? { aspectRatio: `${rasio}`, width: "100%" }
                    : { height: "100%" }
                }
              >
                {/* Kredit/hak cipta pelapor di kiri-bawah medianya. Diambil dari
                    `keterangan`. Untuk video, label diangkat di atas bilah kendali
                    bawaan HANYA selagi kendali itu tampak; saat kendali menghilang
                    sendiri, kredit turun kembali ke dasar media. aria-hidden:
                    alt/aria-label medianya sudah membawa teks yang sama untuk
                    pembaca layar. */}
                {m.keterangan && (
                  <span
                    className={`rincian__kredit ${
                      m.jenis === "video" && idx === kini && kendaliTampak
                        ? "rincian__kredit--di-kendali"
                        : ""
                    }`}
                    aria-hidden="true"
                  >
                    <span className="rincian__kredit-tanda">©</span>
                    {m.keterangan}
                  </span>
                )}
                {m.jenis === "video" ? (
                  <video
                    ref={(el) => {
                      videoRefs.current[idx] = el;
                    }}
                    src={m.url}
                    poster={(m.poster ?? poster) ?? undefined}
                    aria-label={m.keterangan || `${label} - video ${idx + 1}`}
                    controls
                    playsInline
                    preload={idx === 0 ? "metadata" : "none"}
                    onCanPlay={() => {
                      if (idx === 0) setAwalSiap(true);
                    }}
                    onLoadedMetadata={(e) => {
                      const el = e.currentTarget;
                      simpanRasio(el.videoWidth, el.videoHeight, idx);
                      if (idx === 0) setAwalSiap(true);
                    }}
                    // Selaraskan kredit dengan kontrol bawaan: mulai memutar →
                    // hitung mundur sembunyi; dijeda/habis → kontrol (dan kredit)
                    // kembali naik.
                    onPlay={(e) => jadwalSembunyi(e.currentTarget)}
                    onPause={() => {
                      if (sembunyiTimer.current) clearTimeout(sembunyiTimer.current);
                      sembunyiTimer.current = null;
                      setKendaliTampak(true);
                    }}
                    onEnded={() => {
                      if (sembunyiTimer.current) clearTimeout(sembunyiTimer.current);
                      sembunyiTimer.current = null;
                      setKendaliTampak(true);
                    }}
                    className="rincian__slide-media"
                  />
                ) : (
                  <img
                    src={m.url}
                    alt={m.keterangan || `${label} - gambar ${idx + 1}`}
                    decoding="async"
                    loading={idx === 0 ? "eager" : "lazy"}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      simpanRasio(el.naturalWidth, el.naturalHeight, idx);
                      if (idx === 0) setAwalSiap(true);
                    }}
                    className="rincian__slide-media"
                  />
                )}
              </div>
            </div>
          );
        })}
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
