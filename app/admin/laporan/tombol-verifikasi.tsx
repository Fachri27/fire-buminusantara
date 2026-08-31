"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StatusLaporan } from "@/lib/laporan-publik";
import { aksiStatus, aksiHapusLaporan } from "./aksi";

/**
 * Tombol keputusan untuk satu laporan.
 *
 * Bentuknya mengikuti AksiKomentar: server action yang memutuskan, komponen ini
 * hanya memanggil lalu menyegarkan halaman, dan menghapus butuh dua tekan
 * dengan pertanyaannya duduk di baris laporan yang bersangkutan — bukan
 * window.confirm yang menyita layar dan menyembunyikan laporan mana yang
 * sedang dibicarakan.
 */
export function TombolVerifikasi({
  id, status, bolehHapus, setelahHapus,
}: {
  id: number;
  status: StatusLaporan;
  bolehHapus: boolean;
  /** Ke mana pergi setelah laporan dibuang. Diisi halaman detail: barisnya
   *  sudah tidak ada, jadi menyegarkan halaman yang sama hanya menghasilkan
   *  404. Di daftar, dibiarkan kosong — menyegarkan di tempat sudah benar. */
  setelahHapus?: string;
}) {
  const [sibuk, mulai] = useTransition();
  const [pastikan, setPastikan] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!pastikan) return;
    const jam = setTimeout(() => setPastikan(false), 5000);
    return () => clearTimeout(jam);
  }, [pastikan]);

  const jalankan = (kerja: () => Promise<void>, pergiKe?: string) =>
    mulai(async () => {
      await kerja();
      if (pergiKe) router.push(pergiKe);
      else router.refresh();
    });

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {status !== "approved" && (
        <button type="button" disabled={sibuk}
                onClick={() => jalankan(() => aksiStatus(id, "approved"))}
                className="cms-tombol cms-tombol--utama cms-tombol--kecil">
          Verifikasi
        </button>
      )}

      {status !== "rejected" && (
        <button type="button" disabled={sibuk}
                onClick={() => jalankan(() => aksiStatus(id, "rejected"))}
                className="cms-tombol cms-tombol--garis cms-tombol--kecil">
          Tolak
        </button>
      )}

      {/* Keputusan yang sudah diambil harus bisa dicabut: yang salah tekan
          tidak punya jalan lain selain mengembalikannya ke antrean. */}
      {status !== "pending" && (
        <button type="button" disabled={sibuk}
                onClick={() => jalankan(() => aksiStatus(id, "pending"))}
                className="cms-tombol cms-tombol--sunyi cms-tombol--kecil">
          Kembalikan
        </button>
      )}

      {bolehHapus && (
        pastikan ? (
          <span className="flex items-center gap-2">
            <button type="button" disabled={sibuk}
                    onClick={() => jalankan(() => aksiHapusLaporan(id), setelahHapus)}
                    className="cms-tombol cms-tombol--bahaya-isi cms-tombol--kecil">
              Ya, hapus
            </button>
            <button type="button" onClick={() => setPastikan(false)}
                    className="cms-mata px-1 underline-offset-4 hover:underline">
              Batal
            </button>
          </span>
        ) : (
          <button type="button" disabled={sibuk} onClick={() => setPastikan(true)}
                  className="cms-tombol cms-tombol--bahaya cms-tombol--kecil">
            Hapus
          </button>
        )
      )}
    </div>
  );
}
