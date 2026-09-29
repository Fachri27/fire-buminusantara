"use client";

import { useRef, useState } from "react";
import type { Bahasa } from "@/lib/bahasa";
import { TEKS } from "./teks";
import type { Laporan } from "./tipe";
import { IkonCentang, IkonKirim, IkonKomentar, IkonSuka } from "./ikon";

/* Baris aksi kartu umpan ala IG — di bawah media, di atas teks (mobile) atau
   di bawah media (desktop). Hati = suka perangkat-lokal (ketuk lagi batal),
   komentar = angka asli + langsung ke rincian laporan, kirim = salin tautan.

   Suka tak punya angka global: backend tak mencatatnya, jadi angkanya
   sengaja TIDAK ditampilkan — hanya status milikmu (isi penuh). */
export function AksiKartu({ laporan: l, bahasa, onKomentar }: {
  laporan: Laporan;
  bahasa: Bahasa;
  onKomentar: () => void;
}) {
  const t = TEKS[bahasa];
  const baca = (kunci: string) => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(`lk-${kunci}:${l.id}`) === "1";
    } catch {
      return false;
    }
  };
  const tulis = (kunci: string, nilai: boolean) => {
    try {
      window.localStorage.setItem(`lk-${kunci}:${l.id}`, nilai ? "1" : "0");
    } catch {
      /* penyimpanan diblokir: status hanya sesi ini */
    }
  };
  const [suka, setSuka] = useState(() => baca("suka"));
  // Umpan balik "tersalin" untuk tombol kirim — tampil sebagai centang 2 dtk.
  const [tersalin, setTersalin] = useState(false);
  const timer = useRef<number | null>(null);
  const tandaiTersalin = () => {
    setTersalin(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setTersalin(false), 2000);
  };
  const tautan = () => `${window.location.origin}${l.href}`;

  async function salinTautan() {
    try {
      await navigator.clipboard.writeText(tautan());
      tandaiTersalin();
    } catch {
      /* izin clipboard diblokir */
    }
  }

  const tombol =
    "lk-aksi-tombol cursor-pointer rounded-full text-tinta transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[#ff5a26] dark:text-[#f5f5f5] dark:hover:bg-white/10";
  const komentar = l.komentar ?? 0;
  const angkaKomentar =
    komentar > 0
      ? new Intl.NumberFormat(bahasa === "en" ? "en" : "id-ID", { notation: "compact" }).format(komentar)
      : null;

  return (
    <div className="lk-kartu-aksi">
      <button
        type="button"
        aria-label={t.suka}
        aria-pressed={suka}
        onClick={() => {
          const nilai = !suka;
          setSuka(nilai);
          tulis("suka", nilai);
        }}
        className={`${tombol}${suka ? " lk-aksi-aktif-suka" : ""}`}
      >
        <IkonSuka aktif={suka} />
      </button>
      <button
        type="button"
        aria-label={angkaKomentar !== null ? `${t.komentar} (${angkaKomentar})` : t.komentar}
        onClick={onKomentar}
        className={`${tombol}${angkaKomentar !== null ? " lk-aksi-komentar-ada" : ""}`}
      >
        {/* Ikon + lencana dibungkus wadah setinggi ikonnya: lencana dipatok ke
            bahu IKON, bukan ke tombol yang jauh lebih tinggi (40px) — di sana
            ia melayang beberapa piksel di atas ikonnya. */}
        <span className="lk-aksi-ikon-bungkus">
          <IkonKomentar />
          {angkaKomentar !== null && (
            <span aria-hidden="true" className="lk-aksi-lencana">{angkaKomentar}</span>
          )}
        </span>
      </button>
      <button
        type="button"
        aria-label={tersalin ? t.lembarTersalin : t.salinTautan}
        onClick={salinTautan}
        className={tombol}
      >
        {tersalin ? <IkonCentang /> : <IkonKirim />}
      </button>
    </div>
  );
}
