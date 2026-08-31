/** Dua bahasa situs publik. Urutannya penting: yang pertama adalah bawaan
 *  saat proxy mengalihkan pengunjung tanpa prefiks. */
export const BAHASA = ["id", "en"] as const;
export type Bahasa = (typeof BAHASA)[number];

/** Penjaga tipe seperti di panduan internasionalisasi Next.js —
 *  menyempitkan string dari URL jadi Bahasa, dan sekaligus 404 untuk
 *  segmen yang bukan bahasa yang dikenal. */
export function adaBahasa(nilai: string): nilai is Bahasa {
  return (BAHASA as readonly string[]).includes(nilai);
}

/** Semua teks bilah navigasi per bahasa. Isi halaman menyusul —
 *  saat terjemahannya ada, kumpulan ini yang dilebarkan. */
export const TEKS_NAV = {
  id: {
    navigasi: "Navigasi utama",
    awal: "Ke awal halaman",
    bagian: {
      beranda: "Beranda",
      peta: "Peta Sebaran",
    } as Record<string, string>,
    ganti: "Ganti bahasa",
  },
  en: {
    navigasi: "Main navigation",
    awal: "Back to top",
    bagian: {
      beranda: "Home",
      peta: "Spread Map",
    } as Record<string, string>,
    ganti: "Switch language",
  },
} as const satisfies Record<Bahasa, unknown>;