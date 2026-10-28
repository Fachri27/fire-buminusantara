const BULAN = [
  "januari", "februari", "maret", "april", "mei", "juni",
  "juli", "agustus", "september", "oktober", "november", "desember",
];

// Payload /en ditulis Intl en-US ("August 13, 2026") — tanpa ini semua
// tanggal EN terbaca null, umpan EN hanya terurut menurut id dan saringan
// rentang tanggal tak menyaring apa pun.
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * "13 Agustus 2026" atau "August 13, 2026" -> milidetik.
 *
 * Tanggal di payload berita ditulis apa adanya untuk dibaca manusia, jadi
 * penerjemahannya dikerjakan di sini. Yang tak terbaca dikembalikan null dan
 * diperlakukan sebagai "selalu lolos saringan" — lebih baik ikut tampil
 * daripada hilang diam-diam karena format tanggalnya tak terduga.
 */
export function waktuTeks(teks: string | null): number | null {
  if (!teks) return null;
  const bagian = teks.trim().toLowerCase().replace(/,/g, "").split(/\s+/);
  if (bagian.length < 3) return null;
  // id-ID: hari bulan tahun; en-US: bulan hari tahun.
  const [teksHari, teksBulan] = /^\d/.test(bagian[0]) ? [bagian[0], bagian[1]] : [bagian[1], bagian[0]];
  const hari = parseInt(teksHari, 10);
  const bulan = Math.max(BULAN.indexOf(teksBulan), MONTHS.indexOf(teksBulan));
  const tahun = parseInt(bagian[2], 10);
  if (!hari || bulan < 0 || !tahun) return null;
  return Date.UTC(tahun, bulan, hari);
}

/** "2026-08-11" (nilai <input type="date">) -> milidetik. */
export function waktuIso(iso: string): number | null {
  if (!iso) return null;
  const b = iso.split("-");
  if (b.length !== 3) return null;
  const waktu = Date.UTC(+b[0], +b[1] - 1, +b[2]);
  return isNaN(waktu) ? null : waktu;
}
