"use client";

import { useEffect, useState } from "react";

/**
 * Tombol hapus dua tekan.
 *
 * Tekan pertama tidak mengirim apa pun — ia mengubah tombolnya sendiri menjadi
 * pertanyaan, di tempat yang sama, jadi keterangan apa yang akan hilang tetap
 * terbaca di sebelahnya. Kesiapannya pulih sendiri supaya tombol berbahaya
 * tidak menunggu tanpa batas dalam keadaan siap.
 */
export function TombolHapus() {
  const [pastikan, setPastikan] = useState(false);

  useEffect(() => {
    if (!pastikan) return;
    const jam = setTimeout(() => setPastikan(false), 6000);
    return () => clearTimeout(jam);
  }, [pastikan]);

  if (!pastikan) {
    return (
      <button type="button" onClick={() => setPastikan(true)} className="cms-tombol cms-tombol--bahaya">
        Hapus kejadian
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit"
              className="cms-tombol cms-tombol--bahaya-isi">
        Ya, hapus permanen
      </button>
      <button type="button" onClick={() => setPastikan(false)}
              className="cms-mata px-1 underline-offset-4 hover:underline">
        Batal
      </button>
    </div>
  );
}
