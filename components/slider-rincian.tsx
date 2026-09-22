"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { mediaLokal, type ItemMedia } from "@/lib/media";

/** `sizes` foto lokal di slider — diekspor supaya pratinjau geser tegak di
 *  rincian meminta berkas optimizer yang sama persis (tembolok bersama). */
export const UKURAN_GAMBAR_RINCIAN = "(max-width: 767px) 92vw, 55vw";

/** Rasio (lebar ÷ tinggi) media yang pernah terbaca, per URL. Di ponsel tinggi
 *  kotak media mengikuti rasio slide aktif; tanpa ingatan ini slider yang
 *  baru dipasang (pindah laporan) memulai dari tinggi penuh lalu menyusut
 *  sebingkai kemudian. Pratinjau geser tegak ikut mengisinya dari foto yang
 *  sudah ia muat, jadi panel asli langsung berukuran benar. */
export const RASIO_MEDIA = new Map<string, number>();

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
  // Jika media awal sudah selesai dimuat di memori peramban (cache), langsung
  // tandai siap dan simpan rasionya agar tidak berkedip kerangka 1-frame saat
  // pop-up dibuka.
  const [awalSiap, setAwalSiap] = useState(false);
  const [rasioMedia, setRasioMedia] = useState<(number | undefined)[]>(
    () => media.map((m) => RASIO_MEDIA.get(m.url)),
  );

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
    const url = media[idx]?.url;
    if (url) RASIO_MEDIA.set(url, rasio);
    setRasioMedia((r) => {
      if (r[idx] === rasio) return r;
      const n = [...r];
      n[idx] = rasio;
      return n;
    });
  }, [media]);

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

  // Foto yang sudah ada di tembolok memori (mis. baru saja ditampilkan
  // pratinjau geser tegak) sudah `complete` begitu elemennya terpasang —
  // tandai siap saat itu juga. Pembaruan dari callback ref diproses sebelum
  // peramban melukis, jadi kerangka gelap tak sempat muncul sama sekali;
  // menunggu onLoad membuatnya berkedip satu bingkai lalu memudar 300ms.
  const gambarTerpasang = useCallback((el: HTMLImageElement | null, idx: number) => {
    if (!el || !el.complete || !el.naturalWidth) return;
    simpanRasio(el.naturalWidth, el.naturalHeight, idx);
    if (idx === 0) setAwalSiap(true);
  }, [simpanRasio]);

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

    // Penunggu terpisah hanya untuk video: elemen <video> tidak menembak event
    // onLoad untuk posternya, jadi kesiapan posternya diawasi lewat elemen img
    // di sini (createElement, bukan new Image() — nama Image dipakai komponen
    // next/image di berkas ini). Gambar tidak perlu preloader — onLoad elemen
    // medianya sendiri (di bawah) yang menandakan siap, dan preloader terpisah
    // justru mengunduh dua kali sekarang fotonya lewat next/image (URL
    // teroptimasi ≠ URL mentah yang dimuat preloader).
    if (pertama.jenis === "video") {
      const p = pertama.poster ?? poster;
      if (p) {
        const img = document.createElement("img");
        img.onload = () => { if (aktif) setAwalSiap(true); };
        img.onerror = () => { if (aktif) setAwalSiap(true); };
        img.src = p;
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

  // Slide aktif dan tetangganya dimuat lebih awal; sisanya menunggu. Tanpa
  // ini media di luar layar baru diunduh persis saat ia bergeser masuk,
  // sehingga bingkainya berubah ukuran DI TENGAH transisi — itulah kedipannya.
  // Perbandingan tanpa putaran (slide terakhir → pertama) memang tidak
  // tercakup; satu kedipan di ujung putaran tidak sebanding dengan mengunduh
  // media tambahan untuk tiap galeri.
  const dekat = (idx: number) => Math.abs(idx - kini) <= 1;

  const sentuhRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const s = e.touches[0];
    sentuhRef.current = { x: s.clientX, y: s.clientY };
    aktivitasPointer();
  }, [aktivitasPointer]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const awal = sentuhRef.current;
    sentuhRef.current = null;
    if (!awal || media.length <= 1) return;
    const s = e.changedTouches[0];
    const dx = s.clientX - awal.x;
    const dy = s.clientY - awal.y;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0) geser(1);
      else geser(-1);
    }
  }, [geser, media.length]);

  if (!media || media.length === 0) return null;

  return (
    <div
      className="rincian__slider-wadah"
      /* Di ponsel tinggi kotak media = lebar layar ÷ rasio slide aktif
         (dibatasi 48svh) — foto mendatar tampil utuh tanpa bilah hitam dan
         tanpa dipotong. Lihat .rincian__slider-wadah di rincian-laporan.css. */
      style={rasioMedia[kini] ? ({ "--rasio-media": rasioMedia[kini] } as React.CSSProperties) : undefined}
      onPointerMove={aktivitasPointer}
      onPointerDown={aktivitasPointer}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
                /* Sebelum rasio aslinya terbaca, bingkai memakai rasio bawaan
                   4/3 — bukan `height: 100%` yang tingginya runtuh ke 0 bila
                   rantai induknya tak punya tinggi pasti (kasus ponsel: baris
                   grid media mengikuti isi). Tinggi 0 itu bukan cuma
                   membuat slide tampak kosong lalu menyentak begitu ukurannya
                   terbaca, tapi juga memicu galat next/image ("fill" dengan
                   tinggi 0) untuk unggahan lokal. Rasio asli menimpa bawaan
                   ini begitu onLoad/onLoadedMetadata tiba. */
                style={
                  rasio
                    ? { aspectRatio: `${rasio}`, width: "100%" }
                    : { width: "100%", aspectRatio: "4 / 3" }
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
                    } ${
                      // Kredit hanya perlu menyingkir bila baris titik memang
                      // dirender — dan itu hanya terjadi pada media jamak
                      // (lihat penjaga media.length > 1 di bawah). Media
                      // tunggal tidak punya titik, jadi kreditnya tetap di
                      // dasar; tanpa syarat ini ia mengambang di tengah gambar.
                      media.length > 1 ? "rincian__kredit--di-atas-titik" : ""
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
                      if (el && el.readyState >= 1 && el.videoWidth > 0) {
                        simpanRasio(el.videoWidth, el.videoHeight, idx);
                        if (idx === 0) setAwalSiap(true);
                      }
                    }}
                    src={m.url}
                    poster={(m.poster ?? poster) ?? undefined}
                    aria-label={m.keterangan || `${label} - video ${idx + 1}`}
                    controls
                    playsInline
                    preload={dekat(idx) ? "metadata" : "none"}
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
                ) : mediaLokal(m.url) ? (
                  /* Unggahan lokal lewat optimizer next/image — pop-up rincian
                     ini justru pemboros terbesar: ia menampilkan foto orisinal
                     multi-MB pada kotak maksimal 860px. Bingkainya (relative)
                     sudah ada rasionya dari naturalWidth/Height di bawah, dan
                     object-fit: contain datang dari kelas rincian__slide-media. */
                  <Image
                    ref={(el) => gambarTerpasang(el, idx)}
                    src={m.url}
                    alt={m.keterangan || `${label} - gambar ${idx + 1}`}
                    fill
                    sizes={UKURAN_GAMBAR_RINCIAN}
                    className="rincian__slide-media"
                    decoding="async"
                    loading={dekat(idx) ? "eager" : "lazy"}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      simpanRasio(el.naturalWidth, el.naturalHeight, idx);
                      if (idx === 0) setAwalSiap(true);
                    }}
                    onError={() => {
                      if (idx === 0) setAwalSiap(true);
                    }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- URL media remote warisan, host dinamis di luar remotePatterns
                  <img
                    ref={(el) => gambarTerpasang(el, idx)}
                    src={m.url}
                    alt={m.keterangan || `${label} - gambar ${idx + 1}`}
                    decoding="async"
                    loading={dekat(idx) ? "eager" : "lazy"}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      simpanRasio(el.naturalWidth, el.naturalHeight, idx);
                      if (idx === 0) setAwalSiap(true);
                    }}
                    onError={() => {
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
            className="rincian__slider-tombol rincian__slider-tombol--kiri cursor-pointer"
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
            className="rincian__slider-tombol rincian__slider-tombol--kanan cursor-pointer"
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

          {/* Titik penunjuk posisi media. Bentuknya sama di semua lebar;
              di ponsel kotak sentuhnya 24px (batas bawah WCAG 2.5.8) dan
              jaraknya dirapatkan lewat .rincian__dots supaya pilnya muat. */}
          <div
            role="group"
            aria-label={`Media ${kini + 1} dari ${media.length}`}
            className={`rincian__dots ${
              media[kini]?.jenis === "video" ? "rincian__dots--di-kendali" : ""
            }`}
          >
            {media.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Lihat media ${i + 1} dari ${media.length}`}
                aria-current={i === kini}
                onClick={() => setIndeks(i)}
                className="inline-flex min-h-[28px] min-w-[28px] items-center justify-center p-1 bg-transparent border-0 cursor-pointer"
              >
                <span
                  aria-hidden="true"
                  className={`rincian__dot-item block transition-all duration-300 ${
                    i === kini
                      ? "w-3.5 bg-white shadow-xs"
                      : "w-2 bg-white/50 hover:bg-white/80"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
