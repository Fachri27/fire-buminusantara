"use client";

import { useEffect, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type { StatusLaporan } from "@/lib/laporan-publik";
import { aksiStatus, aksiHapusLaporan } from "./aksi";
import { Pemuat } from "../pemuat";

/** Aksi yang sedang menunggu konfirmasi kedua di barisnya. */
type Tindakan = "approved" | "rejected" | "pending" | "hapus";

/**
 * Tombol keputusan untuk satu laporan.
 *
 * Bentuknya mengikuti AksiKomentar: server action yang memutuskan, komponen ini
 * hanya memanggil lalu menyegarkan halaman, dan setiap keputusan (verifikasi,
 * tolak, kembalikan, hapus) butuh dua tekan dengan pertanyaannya duduk di baris
 * laporan yang bersangkutan — bukan window.confirm yang menyita layar dan
 * menyembunyikan laporan mana yang sedang dibicarakan.
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
  const [pastikan, setPastikan] = useState<Tindakan | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!pastikan) return;
    const jam = setTimeout(() => setPastikan(null), 5000);
    return () => clearTimeout(jam);
  }, [pastikan]);

  const jalankan = async (kerja: () => Promise<{ ok: boolean; galat?: string }>, pergiKe?: string) => {
    mulai(async () => {
      const hasil = await kerja();
      if (!hasil.ok) {
        setGalat(hasil.galat ?? "Gagal memproses laporan.");
        return;
      }
      setGalat(null);
      if (pergiKe) router.push(pergiKe);
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
      {status !== "approved" && (
        <TombolPasti
          sibuk={sibuk}
          pastikan={pastikan}
          tindakan="approved"
          setPastikan={setPastikan}
          label="Verifikasi"
          ya="Ya, verifikasi"
          className="cms-tombol cms-tombol--utama cms-tombol--kecil"
          onPasti={() => jalankan(() => aksiStatus(id, "approved"))}
        />
      )}

      {status !== "rejected" && (
        <TombolPasti
          sibuk={sibuk}
          pastikan={pastikan}
          tindakan="rejected"
          setPastikan={setPastikan}
          label="Tolak"
          ya="Ya, tolak"
          className="cms-tombol cms-tombol--garis cms-tombol--kecil"
          onPasti={() => jalankan(() => aksiStatus(id, "rejected"))}
        />
      )}

      {/* Keputusan yang sudah diambil harus bisa dicabut: yang salah tekan
          tidak punya jalan lain selain mengembalikannya ke antrean. */}
      {status !== "pending" && (
        <TombolPasti
          sibuk={sibuk}
          pastikan={pastikan}
          tindakan="pending"
          setPastikan={setPastikan}
          label="Kembalikan"
          ya="Ya, kembalikan"
          className="cms-tombol cms-tombol--redup cms-tombol--kecil"
          onPasti={() => jalankan(() => aksiStatus(id, "pending"))}
        />
      )}

      {bolehHapus && (
        pastikan === "hapus" ? (
          <span className="flex items-center gap-2">
            <button type="button" disabled={sibuk} aria-busy={sibuk}
                    onClick={() => jalankan(() => aksiHapusLaporan(id), setelahHapus)}
                    className="cms-tombol cms-tombol--bahaya-isi cms-tombol--kecil">
              {sibuk && <Pemuat />}
              Ya, hapus
            </button>
            <button type="button" onClick={() => setPastikan(null)}
                    className="cms-mata px-1 underline-offset-4 hover:underline">
              Batal
            </button>
          </span>
        ) : (
          <button type="button" disabled={sibuk} onClick={() => setPastikan("hapus")}
                  className="cms-tombol cms-tombol--bahaya cms-tombol--kecil">
            Hapus
          </button>
        )
      )}
      </div>
      {galat && (
        <p role="alert" className="cms-mata text-red-700">{galat}</p>
      )}
    </div>
  );
}

/** Tombol keputusan dengan konfirmasi kedua, di barisnya sendiri — sama seperti
 *  tombol Hapus. Tekan sekali untuk meminta penegasan, tekan "Ya, …" untuk
 *  menjalankannya atau "Batal" untuk urung. Keputusan laporan tidak kalah
 *  genting dari menghapus: satu salah tekan langsung mengubah status, tanpa
 *  ada ruang untuk berpikir lagi. */
function TombolPasti({
  sibuk, pastikan, tindakan, setPastikan,
  label, ya, className, onPasti,
}: {
  sibuk: boolean;
  pastikan: Tindakan | null;
  tindakan: Tindakan;
  setPastikan: Dispatch<SetStateAction<Tindakan | null>>;
  label: string;
  ya: string;
  className: string;
  onPasti: () => void;
}) {
  if (pastikan !== tindakan) {
    return (
      <button type="button" disabled={sibuk} onClick={() => setPastikan(tindakan)} className={className}>
        {label}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <button type="button" disabled={sibuk} aria-busy={sibuk} onClick={onPasti} className={className}>
        {sibuk && <Pemuat />}
        {ya}
      </button>
      <button type="button" onClick={() => setPastikan(null)}
              className="cms-mata px-1 underline-offset-4 hover:underline">
        Batal
      </button>
    </span>
  );
}
