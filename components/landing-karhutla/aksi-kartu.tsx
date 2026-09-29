"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import type { Bahasa } from "@/lib/bahasa";
import { TEKS } from "./teks";
import type { Laporan } from "./tipe";
import { IkonBagikan, IkonCentang, IkonJempol, IkonKomentar } from "./ikon";
import { aturHitung, bacaHitung, useHitungHidup } from "./hitung-hidup";

/* Id laporan yang sudah disukai perangkat ini — hanya untuk menyalakan
   jempol; server yang menjaga satu suka per perangkat (ip + user agent). */
const KUNCI_SUKA = "lk-suka";
function bacaSuka(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI_SUKA) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function tulisSuka(id: number, suka: boolean) {
  try {
    const lain = bacaSuka().filter((x) => x !== id);
    localStorage.setItem(KUNCI_SUKA, JSON.stringify(suka ? [...lain, id] : lain));
  } catch {
    /* penyimpanan diblokir */
  }
  window.dispatchEvent(new Event(KUNCI_SUKA));
}
function langganSuka(ubah: () => void) {
  window.addEventListener(KUNCI_SUKA, ubah);
  window.addEventListener("storage", ubah);
  return () => {
    window.removeEventListener(KUNCI_SUKA, ubah);
    window.removeEventListener("storage", ubah);
  };
}

/* Baris aksi kartu umpan — di bawah media. Kiri: suka (jempol), komentar
   (langsung ke rincian laporan), bagikan (salin tautan). Angka suka &
   komentar tepat di kanan ikonnya. */
export function AksiKartu({ laporan: l, bahasa, onKomentar }: {
  laporan: Laporan;
  bahasa: Bahasa;
  onKomentar: () => void;
}) {
  const t = TEKS[bahasa];
  // Umpan balik "tersalin" untuk tombol kirim — tampil sebagai centang 2 dtk.
  const [tersalin, setTersalin] = useState(false);
  const timer = useRef<number | null>(null);
  const tandaiTersalin = () => {
    setTersalin(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setTersalin(false), 2000);
  };
  const disukai = useSyncExternalStore(langganSuka, () => bacaSuka().includes(l.id), () => false);
  // Angka hidup (/api/hitung), angka umpan yang di-cache hanya cadangan.
  const hidup = useHitungHidup(l.id);
  const jumlahSuka = hidup?.suka ?? l.suka ?? 0;
  const komentar = hidup?.komentar ?? l.komentar ?? 0;

  async function alihSuka() {
    const suka = !disukai;
    const sebelum = bacaHitung(l.id)?.suka ?? l.suka ?? 0;
    tulisSuka(l.id, suka);
    aturHitung(l.id, { komentar, suka: Math.max(0, sebelum + (suka ? 1 : -1)) });
    try {
      const r = await fetch(`/api/laporan/${l.id}/suka`, { method: suka ? "POST" : "DELETE" });
      if (r.status === 429) return; // ketukan beruntun: biarkan tampilan optimistis
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { jumlah?: number };
      if (typeof j.jumlah === "number") aturHitung(l.id, { suka: j.jumlah });
    } catch {
      tulisSuka(l.id, !suka);
      aturHitung(l.id, { suka: sebelum });
    }
  }

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
  const angka = new Intl.NumberFormat(bahasa === "en" ? "en" : "id-ID", { notation: "compact" });

  return (
    <div className="lk-kartu-aksi">
      <button
        type="button"
        aria-label={jumlahSuka > 0 ? `${t.suka} (${angka.format(jumlahSuka)})` : t.suka}
        aria-pressed={disukai}
        onClick={alihSuka}
        className={`${tombol}${disukai ? " lk-aksi-disukai" : ""}`}
      >
        <IkonJempol aktif={disukai} />
        {jumlahSuka > 0 && <span aria-hidden="true" className="lk-aksi-angka">{angka.format(jumlahSuka)}</span>}
      </button>
      <button
        type="button"
        aria-label={komentar > 0 ? `${t.komentar} (${angka.format(komentar)})` : t.komentar}
        onClick={onKomentar}
        className={tombol}
      >
        <IkonKomentar />
        {komentar > 0 && <span aria-hidden="true" className="lk-aksi-angka">{angka.format(komentar)}</span>}
      </button>
      <button
        type="button"
        aria-label={tersalin ? t.lembarTersalin : t.salinTautan}
        onClick={salinTautan}
        className={`${tombol} lk-aksi-bagikan`}
      >
        {tersalin ? <IkonCentang /> : <IkonBagikan />}
      </button>
    </div>
  );
}
