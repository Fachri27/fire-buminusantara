import { catatGalat } from "./catat-galat.ts";
import { redisGet, redisIncr } from "./redis.ts";

/**
 * Batas laju sederhana per kunci (IP, email): `batas` kali per `jendelaDetik`.
 *
 * Redis bila ada (bertahan lintas restart); kalau tidak, Map di memori proses.
 * ponytail: cadangan memori hanya benar untuk satu instance (box prod sekarang
 * satu container) dan hilang saat restart — pasang REDIS_URL bila web
 * diskalakan ke beberapa container.
 */
const memori = new Map<string, { n: number; habis: number }>();

export async function lewatBatas(kunci: string, batas: number, jendelaDetik: number): Promise<boolean> {
  const n = (await redisIncr(`laju:${kunci}`, jendelaDetik)) ?? hitungMemori(kunci, jendelaDetik);
  return n > batas;
}

/**
 * Seperti lewatBatas, tapi hanya MEMBACA jatah tanpa memakainya: true = kunci
 * ini sudah memakai `batas` kali di jendelanya, jadi pemakaian berikutnya pasti
 * ditolak. Untuk menolak dini sebelum pekerjaan mahal (unggahan besar), lalu
 * jatahnya baru dipakai lewatBatas bila pekerjaan itu berhasil.
 */
export async function sudahLewat(kunci: string, batas: number): Promise<boolean> {
  // Kunci tidak ada di Redis (atau Redis mati) → periksa cadangan memori; saat
  // Redis hidup, memori memang kosong untuk kunci ini, jadi hasilnya 0.
  const tersimpan = await redisGet(`laju:${kunci}`);
  return (tersimpan !== null ? Number(tersimpan) : bacaMemori(kunci)) >= batas;
}

/**
 * Batas per IP yang tidak lolos saat IP tak terbaca (ipDari() → null:
 * TRUSTED_PROXY_HOPS kosong/0, atau X-Forwarded-For lebih pendek dari jumlah
 * hop). Pengirim seperti itu berbagi satu ember `<awalan>:tanpa-ip` yang
 * batasnya KALI_TANPA_IP lipat: satu salah konfigurasi tidak langsung mengunci
 * semua warga, tapi juga tidak membuka pintu tanpa batas.
 */
export const KALI_TANPA_IP = 10;

export function emberIp(awalan: string, ip: string | null, batas: number): { kunci: string; batas: number } {
  return ip ? { kunci: `${awalan}:${ip}`, batas } : { kunci: `${awalan}:tanpa-ip`, batas: batas * KALI_TANPA_IP };
}

/** lewatBatas untuk ember per IP — lihat emberIp. */
export async function lewatBatasIp(awalan: string, ip: string | null, batas: number, jendelaDetik: number): Promise<boolean> {
  if (!ip) peringatkanTanpaIp(awalan);
  const ember = emberIp(awalan, ip, batas);
  return lewatBatas(ember.kunci, ember.batas, jendelaDetik);
}

/** sudahLewat untuk ember per IP — lihat emberIp. */
export async function sudahLewatIp(awalan: string, ip: string | null, batas: number): Promise<boolean> {
  if (!ip) peringatkanTanpaIp(awalan);
  const ember = emberIp(awalan, ip, batas);
  return sudahLewat(ember.kunci, ember.batas);
}

/**
 * Jeda di bawah satu detik per kunci (ketukan beruntun) — lewatBatas hanya
 * berjendela detik. true = masih dalam jeda, tolak.
 * shortcut: in-memory per proses, pindah ke Redis bila web diskalakan ke beberapa container.
 */
const ketukan = new Map<string, number>();

export function dalamJeda(kunci: string, jedaMs: number): boolean {
  const kini = Date.now();
  // Hanya entri kedaluwarsa yang dibuang: clear() ikut menghapus jeda yang masih
  // berjalan, dan bot yang mengganti user agent bisa memicunya kapan saja.
  if (ketukan.size > 5000) for (const [k, t] of ketukan) if (kini - t >= jedaMs) ketukan.delete(k);
  const t = ketukan.get(kunci);
  if (t !== undefined && kini - t < jedaMs) return true;
  ketukan.set(kunci, kini);
  return false;
}

/** Di produksi IP tak terbaca hampir pasti salah konfigurasi proxy — dikabarkan
 *  lewat catatGalat, tapi paling sering sekali per jam, bukan per permintaan. */
const JEDA_PERINGATAN_MS = 60 * 60_000;
let peringatanTerakhir = -Infinity;

function peringatkanTanpaIp(awalan: string): void {
  if (process.env.NODE_ENV !== "production") return;
  const kini = Date.now();
  if (kini - peringatanTerakhir < JEDA_PERINGATAN_MS) return;
  peringatanTerakhir = kini;
  // Tidak ditunggu: alarm (webhook ≤ 5 detik) tidak boleh menahan permintaan,
  // dan catatGalat tidak pernah melempar.
  void catatGalat(
    "ip-tak-terbaca",
    new Error("IP pengirim tak terbaca — periksa TRUSTED_PROXY_HOPS dan X-Forwarded-For dari reverse proxy"),
    `ember ${awalan}:tanpa-ip (batas ${KALI_TANPA_IP}× per IP) dipakai bersama semua pengirim`,
  );
}

function bacaMemori(kunci: string): number {
  const ada = memori.get(kunci);
  return ada && ada.habis > Date.now() ? ada.n : 0;
}

function hitungMemori(kunci: string, jendelaDetik: number): number {
  const kini = Date.now();
  const ada = memori.get(kunci);
  if (!ada || ada.habis <= kini) {
    // Bersihkan entri kedaluwarsa sesekali supaya Map tidak tumbuh tanpa batas.
    if (memori.size > 10_000) for (const [k, v] of memori) if (v.habis <= kini) memori.delete(k);
    memori.set(kunci, { n: 1, habis: kini + jendelaDetik * 1000 });
    return 1;
  }
  ada.n += 1;
  return ada.n;
}
