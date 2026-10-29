"use client";

import { Pemuat } from "../pemuat";
import { useAksi } from "../use-aksi";
import { Ikon } from "../menu-admin";
import { TombolAkhiri } from "../siaran/tombol-akhiri";
import { aksiKomentarDilaporkan, aksiTandaiDitinjau } from "./aksi";

/**
 * Keputusan atas satu konten yang dilaporkan. Setiap keputusan menandai semua
 * laporannya ditinjau sehingga konten itu keluar dari antrean.
 */
export function AksiLaporanKonten({ jenis, target, komentarTampil, siaranHidup }: {
  jenis: string;
  target: string;
  /** Komentar yang masih ada: true = tampil, false = tersembunyi. null = bukan komentar / sudah dihapus. */
  komentarTampil: boolean | null;
  /** Siaran yang dilaporkan masih berlangsung. */
  siaranHidup: boolean;
}) {
  const [sibuk, jalankan] = useAksi();
  const kecil = "cms-tombol cms-tombol--kecil";

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {komentarTampil === true && (
        <button type="button" disabled={sibuk} aria-busy={sibuk}
                onClick={() => jalankan(() => aksiKomentarDilaporkan(target, false), "Komentar disembunyikan; laporannya ditandai ditinjau.")}
                className={`${kecil} cms-tombol--garis`}>
          {sibuk ? <Pemuat /> : <Ikon nama="mata" className="size-3.5" />}
          Sembunyikan
        </button>
      )}
      {komentarTampil === false && (
        <button type="button" disabled={sibuk} aria-busy={sibuk}
                onClick={() => jalankan(() => aksiKomentarDilaporkan(target, true), "Komentar dipulihkan dan tampil lagi.")}
                className={`${kecil} cms-tombol--garis`}>
          {sibuk ? <Pemuat /> : <Ikon nama="centang" className="size-3.5" />}
          Pulihkan
        </button>
      )}
      {jenis === "siaran" && siaranHidup && <TombolAkhiri ruang={target} ringkas />}
      <button type="button" disabled={sibuk} aria-busy={sibuk}
              onClick={() => jalankan(() => aksiTandaiDitinjau(jenis, target), "Laporan ditandai ditinjau.")}
              className={`${kecil} cms-tombol--hantu`}>
        {sibuk && <Pemuat />}
        Tandai ditinjau
      </button>
    </div>
  );
}
