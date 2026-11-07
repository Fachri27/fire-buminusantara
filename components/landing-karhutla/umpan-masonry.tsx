"use client";

import { useMemo } from "react";
import type { Laporan } from "./tipe";
import { rasioKerangka } from "./media-tunda";

/* Umpan masonry berkolom tetap — pola yang sama dengan MasonryKolom di index:
   kartu dibagi bergiliran (0,1,2,0,1,2…) ke sejumlah daftar terpisah, lalu
   daftar-daftar itu dijajar. Sengaja BUKAN CSS `columns`: di sana peramban
   yang memutuskan isi tiap kolom dan menghitung ulangnya setiap tinggi isi
   berubah — gambar yang baru termuat melempar kartu ke kolom lain. Di sini
   penempatan ditentukan indeks, jadi kekal: gambar yang telat hanya mendorong
   kartu di bawahnya dalam kolom yang sama.

   `kerangka` = banyak kartu kerangka di dasar TIAP kolom selagi halaman
   berikutnya dimuat. Kerangka ke-k di kolom i memakai POSISI kartu yang
   kelak jatuh ke sana (bagi bergiliran yang sama), dan kartu asli memakai
   posisinya sendiri untuk rasio kerangka medianya — jadi kerangka masonry
   ini digantikan kotak setinggi yang sama sampai gambarnya termuat. */
export function UmpanMasonry({ daftar, kolom, kartu, kerangka = 0 }: {
  daftar: Laporan[];
  kolom: number;
  /** posisi = indeks di seluruh daftar; baris = indeks di kolomnya (0 = baris pertama). */
  kartu: (l: Laporan, posisi: number, baris: number) => React.ReactNode;
  kerangka?: number;
}) {
  const n = Math.max(1, kolom);
  const keranjang = useMemo(() => {
    const isi: Array<Array<{ l: Laporan; posisi: number }>> = Array.from({ length: n }, () => []);
    daftar.forEach((l, posisi) => {
      isi[posisi % n].push({ l, posisi });
    });
    return isi;
  }, [daftar, n]);

  return (
    <div className="lk-masonry mt-5 flex items-start">
      {keranjang.map((isiKolom, i) => (
        <div key={i} className="lk-masonry-kolom flex min-w-0 flex-1 flex-col">
          {isiKolom.map(({ l, posisi }, baris) => kartu(l, posisi, baris))}
          {Array.from({ length: kerangka }, (_, k) => (
            <KartuKerangka
              key={`kerangka-${k}`}
              posisi={daftar.length + ((i - (daftar.length % n) + n) % n) + k * n}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function KartuKerangka({ posisi }: { posisi: number }) {
  return (
    <div aria-hidden="true" className="lk-kartu animate-pulse">
      <div className="h-3.5 w-1/3 rounded-full bg-black/[0.08] dark:bg-white/10" />
      <div className={`mt-2 h-4 rounded-full bg-black/[0.08] dark:bg-white/10 ${posisi % 2 ? "w-2/3" : "w-11/12"}`} />
      <div className={`mt-3 w-full rounded-lg bg-black/[0.06] dark:bg-white/[0.08] ${rasioKerangka(posisi)}`} />
    </div>
  );
}
