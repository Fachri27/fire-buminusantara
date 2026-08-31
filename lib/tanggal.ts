const BULAN = [
  "januari", "februari", "maret", "april", "mei", "juni",
  "juli", "agustus", "september", "oktober", "november", "desember",
];

/**
 * "13 Agustus 2026" -> milidetik.
 *
 * Tanggal di payload berita ditulis apa adanya untuk dibaca manusia, jadi
 * penerjemahannya dikerjakan di sini. Yang tak terbaca dikembalikan null dan
 * diperlakukan sebagai "selalu lolos saringan" — lebih baik ikut tampil
 * daripada hilang diam-diam karena format tanggalnya tak terduga.
 */
export function waktuTeks(teks: string | null): number | null {
  if (!teks) return null;
  const bagian = teks.trim().toLowerCase().split(/\s+/);
  if (bagian.length < 3) return null;
  const hari = parseInt(bagian[0], 10);
  const bulan = BULAN.indexOf(bagian[1]);
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

/** Tab pulau pada pop-up berita. `isi` adalah nilai `pulau` pada payload
 *  berita yang ikut tab itu — Bali & Nusa Tenggara dibaca bersama Jawa,
 *  sesuai pengelompokan desain. */
export const PULAU_TAB = [
  { kunci: "Sumatra", label: "Sumatera", isi: ["Sumatra"] },
  { kunci: "Jawa", label: "Jawa, Bali, & Nusa Tenggara", isi: ["Jawa", "Bali-Nusa"] },
  { kunci: "Kalimantan", label: "Kalimantan", isi: ["Kalimantan"] },
  { kunci: "Sulawesi", label: "Sulawesi", isi: ["Sulawesi"] },
  { kunci: "Maluku", label: "Maluku", isi: ["Maluku"] },
  { kunci: "Papua", label: "Papua", isi: ["Papua"] },
] as const;

/** Tab mana yang sebaiknya terbuka untuk sebuah pulau. */
export function tabDariPulau(pulau: string | null): string | null {
  if (!pulau) return null;
  return PULAU_TAB.find((t) => (t.isi as readonly string[]).includes(pulau))?.kunci ?? null;
}
