import dataWilayah from "./daftar-wilayah.json" with { type: "json" };

export type Wilayah = {
  id: string;
  nama: string;
  provinsi: string;
  adm4: string;
  lat: number;
  lng: number;
  tipe: "provinsi" | "kabupaten" | "kota";
};

export const DAFTAR_WILAYAH: Wilayah[] = dataWilayah as Wilayah[];

/**
 * Mencari wilayah (provinsi, kabupaten, kota) berdasarkan kueri teks pengguna.
 * Mengurutkan hasil berdasarkan relevansi:
 * 1. Nama inti sama persis (misal "wonosobo" -> "Kabupaten Wonosobo")
 * 2. Nama inti diawali kueri (misal "band" -> "Kota Bandung", "Kabupaten Bandung")
 * 3. Nama lengkap diawali kueri
 * 4. Nama inti mengandung kueri
 * 5. Nama lengkap mengandung kueri
 * 6. Provinsi cocok persis / diawali kueri / mengandung kueri
 */
export function cariWilayah(kueri: string, batas: number = 8): Wilayah[] {
  const q = kueri.trim().toLowerCase();
  if (!q) return [];
  const qBersih = q.replace(/^(kab\.?|kota|kabupaten)\s+/i, "").trim();
  const adaPrefixKota = /^kota\s+/i.test(q);
  const adaPrefixKab = /^(kab\.?|kabupaten)\s+/i.test(q);

  const skor: Array<{ item: Wilayah; skor: number }> = [];

  for (const w of DAFTAR_WILAYAH) {
    const namaKecil = w.nama.toLowerCase();
    const namaInti = namaKecil.replace(/^(kab\.?|kota|kabupaten)\s+/i, "").trim();
    const provKecil = w.provinsi.toLowerCase();

    let prioritas = 999;
    if (namaKecil === q) {
      prioritas = 0;
    } else if (namaInti === q || namaInti === qBersih) {
      prioritas = 1;
    } else if (namaKecil.startsWith(q)) {
      prioritas = 2;
    } else if (namaInti.startsWith(qBersih)) {
      prioritas = 3;
    } else if (namaInti.includes(qBersih)) {
      prioritas = 4;
    } else if (namaKecil.includes(q)) {
      prioritas = 5;
    } else if (provKecil === q) {
      prioritas = 6;
    } else if (provKecil.startsWith(q)) {
      prioritas = 7;
    } else if (provKecil.includes(q)) {
      prioritas = 8;
    }

    if (prioritas < 999) {
      let penyesuaianTipe = w.tipe === "provinsi" ? 0.5 : 0;
      if (adaPrefixKota && w.tipe === "kota") {
        penyesuaianTipe -= 0.2;
      } else if (adaPrefixKab && w.tipe === "kabupaten") {
        penyesuaianTipe -= 0.2;
      }
      skor.push({ item: w, skor: prioritas + penyesuaianTipe });
    }
  }

  skor.sort((a, b) => a.skor - b.skor || a.item.nama.localeCompare(b.item.nama));
  return skor.slice(0, batas).map((s) => s.item);
}

/**
 * Mencari kota/kabupaten terdekat dari koordinat lat/lng (misal dari deteksi GPS).
 * Menggunakan pendekatan jarak Euclidean sederhana dengan koreksi kosinus lintang,
 * instan (<1ms) dan tanpa perlu koneksi jaringan.
 */
export function kotaTerdekat(lat: number, lng: number): Wilayah | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let terdekat: Wilayah | null = null;
  let jarakMin = Infinity;

  // Hanya periksa kabupaten dan kota (bukan provinsi) agar mendapat kode adm4 spesifik
  for (const w of DAFTAR_WILAYAH) {
    if (w.tipe === "provinsi") continue;
    const dLat = w.lat - lat;
    const dLng = (w.lng - lng) * Math.cos((lat * Math.PI) / 180);
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < jarakMin) {
      jarakMin = distSq;
      terdekat = w;
    }
  }

  return terdekat;
}
