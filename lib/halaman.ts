/**
 * Nomor halaman yang ditampilkan pager (0-based); null = elipsis. Selalu
 * halaman pertama, terakhir, dan tetangga halaman `kini` — paling banyak 7
 * butir, muat di kolom samping 300px. Celah satu halaman diisi halamannya,
 * bukan elipsis.
 */
export function nomorHalaman(kini: number, jumlah: number): (number | null)[] {
  const pilih = [...new Set([0, kini - 1, kini, kini + 1, jumlah - 1])].filter((h) => h >= 0 && h < jumlah).sort((a, b) => a - b);
  const hasil: (number | null)[] = [];
  for (const h of pilih) {
    const sebelum = hasil.at(-1);
    if (typeof sebelum === "number" && h - sebelum === 2) hasil.push(sebelum + 1);
    else if (typeof sebelum === "number" && h - sebelum > 2) hasil.push(null);
    hasil.push(h);
  }
  return hasil;
}
