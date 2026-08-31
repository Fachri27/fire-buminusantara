"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function jam(detik: number): string {
  if (!isFinite(detik) || detik < 0) return "";
  const m = Math.floor(detik / 60);
  const s = Math.floor(detik % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

type Props = {
  src: string;
  poster: string | null;
  label: string;
  /** Kartu ini sedang di tengah? Hanya yang tengah yang diputar dan bisa diklik. */
  aktif: boolean;
  kurangiGerak: boolean;
  className: string;
  onBuka: () => void;
};

/**
 * Video pada kartu korsel: tidak diulang sendiri, berhenti di bingkai terakhir,
 * lalu tombol putar ulang yang meneruskan.
 *
 * Di Alpine keadaan ini disimpan sebagai map ber-kunci kartu karena satu
 * komponen mengurus semua kartu sekaligus. Di sini tiap video memegang
 * keadaannya sendiri, jadi tidak ada kunci yang perlu dijaga tetap selaras.
 */
export function VideoKartu({ src, poster, label, aktif, kurangiGerak, className, onBuka }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [durasi, setDurasi] = useState("");
  const [usai, setUsai] = useState(false);

  /** Selama berjalan yang ditampilkan SISA waktunya; sebelum diputar dan
   *  sesudah habis, durasi penuhnya. */
  const catat = useCallback(() => {
    const el = ref.current;
    if (!el || !isFinite(el.duration) || el.duration <= 0) return;
    const sisa = el.paused || el.ended ? el.duration : el.duration - el.currentTime;
    setDurasi(jam(Math.ceil(sisa)));
  }, []);

  // Kartu tengah diputar, sisanya berhenti dan mundur ke awal.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Sebagian peramban hanya mengizinkan putar-otomatis bila PROPERTI muted
    // bernilai true, bukan sekadar atributnya.
    el.muted = true;

    if (aktif && !kurangiGerak) {
      setUsai(false);
      el.play().catch(() => {}); // ditolak mode hemat daya: poster tetap tampil
      return;
    }
    el.pause();
    if (el.currentTime) el.currentTime = 0;
    setUsai(false);
  }, [aktif, kurangiGerak]);

  const ulang = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    setUsai(false);
    el.currentTime = 0;
    el.play().catch(() => {});
  }, []);

  return (
    <>
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        aria-label={label}
        controls={kurangiGerak}
        muted
        playsInline
        preload={poster ? "none" : "metadata"}
        onLoadedMetadata={catat}
        onTimeUpdate={catat}
        onEnded={() => { setUsai(true); catat(); }}
        onClick={(e) => { if (aktif) { e.stopPropagation(); onBuka(); } }}
        className={`${className} ${aktif ? "grayscale-0" : "grayscale-[0.65]"}`}
      />

      {durasi && (
        <p className="kartu-durasi" aria-hidden="true">{durasi}</p>
      )}

      {usai && (
        <div className="kartu-ulang-wadah">
          <button type="button" className="kartu-ulang" aria-label="Putar ulang video" onClick={ulang}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4.5V10h5.5" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
