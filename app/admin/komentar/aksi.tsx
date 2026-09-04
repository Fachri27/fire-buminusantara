"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pemuat } from "../pemuat";
import { aksiSetujui, aksiHapus } from "./actions";

/**
 * Tombol moderasi satu komentar.
 *
 * Server action yang memutuskan; komponen ini memanggil lalu menyegarkan
 * halaman. Menghapus butuh dua tekan — bukan window.confirm, yang menyita
 * seluruh jendela untuk keputusan sekecil ini dan menyembunyikan komentar mana
 * yang sedang dibicarakan. Tekan pertama mengubah tombolnya sendiri jadi
 * pertanyaan, dan pertanyaan itu tetap duduk di baris komentarnya.
 */
export function AksiKomentar({
  id, disetujui, bolehHapus,
}: {
  id: number;
  disetujui: boolean;
  /** Membuang komentar hanya untuk admin — editor boleh meninjau, tidak membuang. */
  bolehHapus: boolean;
}) {
  const [sibuk, mulai] = useTransition();
  const [pastikan, setPastikan] = useState(false);
  const router = useRouter();

  // Pertanyaan yang ditinggalkan pulih sendiri; tombol hapus tidak boleh
  // menunggu terus dalam keadaan siap.
  useEffect(() => {
    if (!pastikan) return;
    const jam = setTimeout(() => setPastikan(false), 5000);
    return () => clearTimeout(jam);
  }, [pastikan]);

  const jalankan = (kerja: () => Promise<void>) =>
    mulai(async () => { await kerja(); router.refresh(); });

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {disetujui ? (
        <button type="button" disabled={sibuk} aria-busy={sibuk}
                onClick={() => jalankan(() => aksiSetujui(id, false))}
                className="cms-tombol cms-tombol--garis cms-tombol--kecil">
          {sibuk && <Pemuat />}
          Sembunyikan
        </button>
      ) : (
        <button type="button" disabled={sibuk} aria-busy={sibuk}
                onClick={() => jalankan(() => aksiSetujui(id, true))}
                className="cms-tombol cms-tombol--utama cms-tombol--kecil">
          {sibuk && <Pemuat />}
          Setujui
        </button>
      )}

      {bolehHapus && (
        pastikan ? (
          <span className="flex items-center gap-2">
            <button type="button" disabled={sibuk} aria-busy={sibuk}
                    onClick={() => jalankan(() => aksiHapus(id))}
                    className="cms-tombol cms-tombol--bahaya-isi cms-tombol--kecil">
              {sibuk && <Pemuat />}
              Ya, hapus
            </button>
            <button type="button" onClick={() => setPastikan(false)}
                    className="cms-mata px-1 underline-offset-4 hover:underline">
              Batal
            </button>
          </span>
        ) : (
          <button type="button" disabled={sibuk} aria-busy={sibuk} onClick={() => setPastikan(true)}
                  className="cms-tombol cms-tombol--bahaya cms-tombol--kecil">
            {sibuk && <Pemuat />}
            Hapus
          </button>
        )
      )}
    </div>
  );
}
