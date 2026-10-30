"use client";

import type { Berita } from "@/lib/events";
import { useSuka } from "@/components/landing-karhutla/aksi-kartu";
import { IkonJempol, IkonKomentar } from "@/components/landing-karhutla/ikon";

const ANGKA = new Intl.NumberFormat("id-ID", { notation: "compact" });

/** Angka suka & komentar satu laporan di kartu pop-up wilayah — hanya tampil,
 *  sebab kartunya sendiri sebuah tombol (membuka rincian, tempat menyukai dan
 *  berkomentar). Jempol menyala bila perangkat ini sudah menyukainya. Ukuran
 *  teks dari `kelas`, ikon ikut. */
export function HitungLaporan({ b, kelas }: { b: Berita; kelas: string }) {
  const { disukai, suka, komentar } = useSuka(b.id, b.jumlahSuka, b.jumlahKomentar);
  return (
    <span className={`flex shrink-0 items-center gap-3 font-medium tabular-nums text-black/55 dark:text-white/55 ${kelas}`}>
      <span className={`flex items-center gap-1 ${disukai ? "text-[#ff5a26]" : ""}`}>
        <IkonJempol aktif={disukai} className="size-[1.2em]" />
        {ANGKA.format(suka)}<span className="sr-only"> suka</span>
      </span>
      <span className="flex items-center gap-1">
        <IkonKomentar className="size-[1.2em]" />
        {ANGKA.format(komentar)}<span className="sr-only"> komentar</span>
      </span>
    </span>
  );
}
