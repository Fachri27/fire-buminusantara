import { redisGet, redisSet } from "./redis.ts";
import { provinsiDariTitik } from "./provinsi-titik.ts";
import { kabupatenDariTitik, provinsiDariKabupaten } from "./kabupaten-titik.ts";
import { BATAS_NUSANTARA } from "./kamera-nusantara.ts";
import { SATELIT_HOTSPOT, awalRiwayat, hariWib, type DataHotspot } from "./lapisan-hotspot.ts";

/**
 * Titik hotspot (anomali panas) 7 hari terakhir, dikelompokkan per hari WIB
 * (hari ini = 24 jam terakhir, seperti SiPongi), untuk lapisan hotspot peta
 * dan peringkat wilayahnya (lib/lapisan-hotspot.ts) — peta mengikuti hari
 * yang dipilih bilah waktu, yang mundur sampai seminggu. Pola yang sama
 * dengan sebaran asap:
 * cron warm-asap (tiap 30 menit) memanggil segarkanHotspot() yang mengambil
 * FIRMS dan menulis Redis; rute /api/hotspot hanya membaca lewat
 * bacaHotspot(). Pengunjung tidak menunggu FIRMS, dan saat FIRMS mati salinan
 * Redis terakhir tetap dilayani.
 *
 * Sumber: hanya NASA FIRMS — berkas CSV publik per wilayah (South East Asia),
 * satelit yang sama dengan SiPongi KLHK — MODIS 1 km (Terra & Aqua) dan VIIRS
 * 375 m (S-NPP, NOAA-20). Berkas wilayah ini tidak
 * butuh MAP_KEY (API area FIRMS butuh), dan diperbarui FIRMS beberapa kali
 * sehari mengikuti lintasan satelit. Titik disaring ke 34 provinsi lewat
 * provinsiDariTitik (yang meleset di pesisir/pulau kecil: provinsiDariKabupaten):
 * titik di laut (suar gas lepas pantai) dan negara tetangga terbuang, dan
 * tiap titik membawa nama provinsi dan kabupatennya.
 *
 * Musim kemarau bisa >20 ribu titik/hari, jadi data berupa larik ringkas,
 * bukan GeoJSON (~1 MB vs ~3,6 MB sebelum gzip); klien yang merangkainya.
 * Tiap hari disimpan di kunci Redis sendiri — rute hanya membaca hari yang
 * diminta, bukan seluruh minggu.
 * Relatif (bukan "@/...") supaya modul ini bisa diuji lewat node:test mentah.
 */

/** Server utama FIRMS lalu cadangannya — NASA mengarahkan ke firms2 saat pemeliharaan. */
const SERVER_FIRMS = ["https://firms.modaps.eosdis.nasa.gov", "https://firms2.modaps.eosdis.nasa.gov"];
/** Urutan = indeks satelit di SATELIT_HOTSPOT (bentuk penanda & legenda). */
const BERKAS = [
  "/data/active_fire/modis-c6.1/csv/MODIS_C6_1_SouthEast_Asia_7d.csv",
  "/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_7d.csv",
  "/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_7d.csv",
].map((jalur, s) => ({ nama: SATELIT_HOTSPOT[s].label, jalur }));

/** Satu tenggat (ms) untuk seluruh unduhan satu penyegaran — server cadangan
 *  hanya memakai sisanya. Cek HEAD 5 dtk + unduhan 40 dtk + urai beberapa
 *  dtk tetap di bawah batas 60 dtk cron warm-asap. Berkas 7 hari 1–7 MB per
 *  satelit (Okt 2026), bisa beberapa kali lipat di puncak kemarau. */
const TENGGAT_UNDUH = 40_000;
/** Cron menyegarkan tiap 30 menit (docker-compose.prod.yml): lebih tua dari
 *  ini = dua putaran terlewat (60 menit + sela 10 menit). */
export const BATAS_BASI_MS = 70 * 60 * 1000;
/** Salinan memori dipercaya selama ini sebelum Redis dibaca ulang — rute dan
 *  cron bisa memegang salinan modul yang berbeda; Redis yang jadi acuan. */
const UMUR_MEMORI = 60 * 1000;

/** Indeks hari tersedia; tiap hari di kunciHari. "v5": per hari WIB dari
 *  berkas 7 hari (v4 = 24 jam dalam satu kunci). `sejak` (hari ini bergulir)
 *  tak menaikkan versi: salinan tanpanya tetap hari kalender yang utuh. */
const KUNCI_REDIS = "firms:hotspot:v5";
const kunciHari = (hari: string) => `${KUNCI_REDIS}:${hari}`;
const TTL_REDIS_DETIK = 3 * 24 * 3600;

/** Tingkat kepercayaan VIIRS → 0 rendah, 1 sedang, 2 tinggi. */
const KEPERCAYAAN: Record<string, number> = { low: 0, l: 0, nominal: 1, n: 1, high: 2, h: 2 };

/** Kepercayaan sebagai 0/1/2. MODIS memberi angka 0–100: rendah < 30,
 *  sedang 30–79, tinggi ≥ 80 (pembagian FIRMS, juga dipakai SiPongi). */
function kelasKepercayaan(nilai: string | undefined): number | undefined {
  const teks = nilai?.trim().toLowerCase() ?? "";
  if (/^\d+$/.test(teks)) {
    const angka = Number(teks);
    return angka >= 80 ? 2 : angka >= 30 ? 1 : 0;
  }
  return KEPERCAYAAN[teks];
}

/** Penampung hasil uraian berkas-berkas FIRMS. */
/** `batas`: menit epoch; deteksi lebih tua dibuang. */
type Penampung = {
  provinsi: string[];
  indeksProvinsi: Map<string, number>;
  kabupaten: string[];
  indeksKabupaten: Map<string, number>;
  /** [provinsi, kabupaten] per koordinat "lng,lat" — jadi wilayahLalu berikutnya. */
  wilayah: Map<string, [string | null, string | null]>;
  titik: number[][];
  batas: number;
};

/** Wilayah titik penguraian lalu: berkas 7 hari ~6/7 sama dengan jam sebelumnya,
 *  dan uji poligonnya ~3 dtk memblokir di puncak kemarau. Diganti tiap penguraian,
 *  jadi tak pernah lebih besar dari satu penyegaran. */
let wilayahLalu: Penampung["wilayah"] = new Map();
/** Penampung penguraian terakhir modul ini — jalur "tak berubah" menurunkan ulang harinya dari sini. */
let penampungLalu: Penampung | null = null;

function penampungBaru(): Penampung {
  // Batas = awal riwayat peta (00.00 WIB, enam hari sebelum hari ini) —
  // sama dengan bilah waktu. Hari sebelumnya pasti terpotong jendela 7 hari
  // FIRMS (lintasan malamnya sudah di luar jendela), jadi ikut terbuang.
  return {
    provinsi: [],
    indeksProvinsi: new Map(),
    kabupaten: [],
    indeksKabupaten: new Map(),
    wilayah: new Map(),
    titik: [],
    batas: awalRiwayat() / 60000,
  };
}

/** Indeks `nama` di `daftar`, ditambahkan bila belum ada. */
function indeksNama(daftar: string[], indeks: Map<string, number>, nama: string): number {
  let i = indeks.get(nama);
  if (i === undefined) {
    i = daftar.length;
    daftar.push(nama);
    indeks.set(nama, i);
  }
  return i;
}

/** Simpan satu deteksi bila jatuh di daratan salah satu provinsi. */
function tambahTitik(
  w: Penampung,
  lng: number,
  lat: number,
  kepercayaan: number | undefined,
  frp: number,
  waktu: number,
  satelit: number,
  malam: boolean,
) {
  const [[barat, selatan], [timur, utara]] = BATAS_NUSANTARA;
  // Pra-saring kotak Nusantara: dua pertiga titik Asia Tenggara gugur di
  // sini sebelum uji poligon provinsi yang lebih mahal.
  if (!(lng >= barat && lng <= timur && lat >= selatan && lat <= utara)) return;
  if (kepercayaan === undefined || !Number.isFinite(waktu) || waktu < w.batas) return;
  const kunci = `${lng},${lat}`;
  let wilayah = wilayahLalu.get(kunci);
  if (!wilayah) {
    const kabupaten = kabupatenDariTitik(lat, lng);
    // Poligon provinsi lebih kasar: titik pesisir/pulau kecil yang meleset darinya diberi provinsi kabupatennya.
    wilayah = [provinsiDariTitik(lat, lng) ?? (kabupaten && provinsiDariKabupaten(kabupaten)), kabupaten];
  }
  w.wilayah.set(kunci, wilayah);
  const [nama, kabupaten] = wilayah;
  if (!nama) return;
  w.titik.push([
    Math.round(lng * 1e4) / 1e4,
    Math.round(lat * 1e4) / 1e4,
    kepercayaan,
    Math.round(frp * 10) / 10 || 0,
    waktu,
    satelit,
    indeksNama(w.provinsi, w.indeksProvinsi, nama),
    malam ? 1 : 0,
    kabupaten === null ? -1 : indeksNama(w.kabupaten, w.indeksKabupaten, kabupaten),
  ]);
}

/** FIRMS terjangkau? HEAD singkat ke kedua server, cukup salah satu menjawab
 *  (status apa pun). Saat FIRMS mati koneksinya menggantung sampai batas waktu,
 *  jadi tanpa ini tiap berkas menunggu BATAS_JAWAB di kedua server dulu. */
async function firmsTerjangkau(): Promise<boolean> {
  try {
    await Promise.any(
      SERVER_FIRMS.map((server) =>
        fetch(`${server}/`, { method: "HEAD", signal: AbortSignal.timeout(5_000), cache: "no-store" }),
      ),
    );
    return true;
  } catch {
    return false;
  }
}

/** Batas menunggu kepala jawaban satu server (ms). Server yang menerima koneksi
 *  tapi diam gugur di sini, jadi server cadangan masih kebagian tenggat; isi
 *  berkasnya boleh memakai sisa tenggat penuh. */
const BATAS_JAWAB = 10_000;

/** Kolom CSV FIRMS yang dibaca urai(). */
const KOLOM = { lat: "latitude", lng: "longitude", kepercayaan: "confidence", frp: "frp", tanggal: "acq_date", jam: "acq_time", siangMalam: "daynight" };

/** Indeks tiap KOLOM di baris kepala CSV, atau null bila ada yang tak ada —
 *  bukan CSV FIRMS (halaman galat berstatus 200) atau formatnya berubah. */
function indeksKolom(kepala: string): Record<keyof typeof KOLOM, number> | null {
  const kolom = kepala.trim().split(",");
  const i = Object.fromEntries(Object.entries(KOLOM).map(([k, nama]) => [k, kolom.indexOf(nama)]));
  return Object.values(i).some((v) => v < 0) ? null : (i as Record<keyof typeof KOLOM, number>);
}

/** `tenggat`: ms epoch untuk seluruh unduhan. Isi yang bukan CSV FIRMS dianggap
 *  gagal: server berikutnya dicoba, lalu CSV terakhir yang sah (ambilFirms) —
 *  tak pernah menggantikannya. */
async function ambilCsv(jalur: string, tenggat: number): Promise<string | null> {
  for (const server of SERVER_FIRMS) {
    const sisa = tenggat - Date.now();
    if (sisa <= 0) break;
    const diam = new AbortController();
    const penunda = setTimeout(() => diam.abort(), Math.min(sisa, BATAS_JAWAB));
    // Bukan AbortSignal.any: tipe edge-runtime Next kadang menang dan tak mengenalnya.
    const habis = setTimeout(() => diam.abort(), sisa);
    try {
      const res = await fetch(server + jalur, { signal: diam.signal, cache: "no-store" });
      clearTimeout(penunda);
      if (!res.ok) continue;
      const teks = await res.text();
      const akhirKepala = teks.indexOf("\n");
      if (indeksKolom(akhirKepala < 0 ? teks : teks.slice(0, akhirKepala))) return teks;
    } catch {
      // Coba server berikutnya.
    } finally {
      clearTimeout(penunda);
      clearTimeout(habis);
    }
  }
  return null;
}

/** Baris CSV API yang belum ada di CSV wilayah (sama bila latitude, longitude,
 *  acq_date, acq_time sama), disusun ulang mengikuti kolom kepala CSV wilayah. */
function gabungCsv(wilayah: string, api: string): string {
  const [kepala, ...barisWilayah] = wilayah.split("\n");
  const [kepalaApi, ...barisApi] = api.split("\n");
  const kolom = kepala.trim().split(",");
  const kolomApi = kepalaApi.trim().split(",");
  // Number() dan padStart: "-6.20"/"-6.2" dan "105"/"0105" dihitung sama.
  const penanda = (daftar: string[]) => {
    const [lat, lng, tanggal, jam] = ["latitude", "longitude", "acq_date", "acq_time"].map((n) => daftar.indexOf(n));
    return (c: string[]) => `${Number(c[lat])},${Number(c[lng])},${c[tanggal]?.trim()},${c[jam]?.trim().padStart(4, "0")}`;
  };
  const [penandaWilayah, penandaApi] = [penanda(kolom), penanda(kolomApi)];
  const ada = new Set(barisWilayah.map((b) => penandaWilayah(b.split(","))));
  const urutan = kolom.map((nama) => kolomApi.indexOf(nama));
  const tambahan: string[] = [];
  for (const b of barisApi) {
    const c = b.split(",");
    const p = penandaApi(c);
    if (c.length < kolomApi.length || ada.has(p)) continue;
    ada.add(p);
    tambahan.push(urutan.map((i) => c[i]?.trim() ?? "").join(","));
  }
  if (!tambahan.length) return wilayah;
  return `${wilayah.endsWith("\n") ? wilayah : `${wilayah}\n`}${tambahan.join("\n")}\n`;
}

/** MODIS: berkas wilayah, ditambah API area FIRMS bila FIRMS_MAP_KEY disetel —
 *  berkas wilayah tertinggal ~10 jam dari SiPongi (Okt 2026). API hanya
 *  pelengkap: gagal = berkas wilayah saja, tetap "lengkap". Kunci ada di jalur
 *  URL, jadi jalur itu tak boleh masuk log/galat — ambilCsv tak pernah mencatatnya. */
async function ambilModis(jalur: string, tenggat: number): Promise<string | null> {
  const kunci = process.env.FIRMS_MAP_KEY;
  if (!kunci) return ambilCsv(jalur, tenggat);
  const [wilayah, api] = await Promise.all([
    ambilCsv(jalur, tenggat),
    // DAY_RANGE 2 = hari ini & kemarin UTC (batas API 1–5): cukup menutup ketertinggalan berkas wilayah.
    ambilCsv(`/api/area/csv/${kunci}/MODIS_NRT/${BATAS_NUSANTARA.flat().join(",")}/2`, tenggat),
  ]);
  return wilayah && api ? gabungCsv(wilayah, api) : wilayah;
}

/** Urai satu berkas CSV FIRMS ke penampung. */
function urai(csv: string, satelit: number, w: Penampung) {
  const baris = csv.split("\n");
  const i = indeksKolom(baris[0]);
  // Format berkas berubah — lebih baik kosong daripada salah baca kolom.
  if (!i) return;
  const lebar = baris[0].trim().split(",").length;
  for (let b = 1; b < baris.length; b++) {
    const c = baris[b].split(",");
    if (c.length < lebar) continue;
    const jam = c[i.jam].trim().padStart(4, "0");
    tambahTitik(
      w,
      Number(c[i.lng]),
      Number(c[i.lat]),
      kelasKepercayaan(c[i.kepercayaan]),
      Number(c[i.frp]),
      Date.parse(`${c[i.tanggal]}T${jam.slice(0, 2)}:${jam.slice(2)}:00Z`) / 60000,
      satelit,
      c[i.siangMalam]?.trim() === "N",
    );
  }
}

/** Hari WIB yang tersimpan, urut naik. `diambil` = pemeriksaan FIRMS terakhir
 *  yang berhasil (dasar "basi"); `versi` = kapan harinya terakhir diturunkan —
 *  sama dengan `diambil` di data tiap hari yang tertulis bersamanya. */
type IndeksHotspot = { diambil: string; versi: string; lengkap: boolean; hari: string[] };

/** Titik dikelompokkan per hari WIB sejak awal riwayat — kecuali hari ini:
 *  24 jam terakhir (`sejak`), jadi ikut memuat lintasan malam kemarin. */
function hasil(w: Penampung, lengkap: boolean): { indeks: IndeksHotspot; hari: Map<string, DataHotspot> } {
  const ms = Date.now();
  const hariIni = hariWib(ms);
  const sejak = ms / 60000 - 24 * 60;
  // Penampung bisa dari sebelum 00.00 WIB (jalur "tak berubah"): awal riwayat dihitung ulang.
  const awal = awalRiwayat(ms) / 60000;
  const kelompok = new Map<string, number[][]>();
  const tambah = (h: string, t: number[]) => {
    const isi = kelompok.get(h);
    if (isi) isi.push(t);
    else kelompok.set(h, [t]);
  };
  for (const t of w.titik) {
    if (t[4] >= sejak) tambah(hariIni, t);
    const h = hariWib(t[4] * 60000);
    if (h < hariIni && t[4] >= awal) tambah(h, t);
  }
  const kini = new Date(ms).toISOString();
  const indeks = { diambil: kini, versi: kini, lengkap, hari: [...kelompok.keys()].sort() };
  const hari = new Map<string, DataHotspot>();
  for (const h of indeks.hari) {
    const titik = kelompok.get(h)!;
    const terbaru = titik.reduce((m, t) => Math.max(m, t[4]), 0);
    hari.set(h, {
      hari: h,
      sejak: h === hariIni ? new Date(sejak * 60000).toISOString() : undefined,
      hariTersedia: indeks.hari,
      diperbarui: new Date(terbaru * 60000).toISOString(),
      diambil: indeks.versi,
      satelit: BERKAS.map((b) => b.nama),
      lengkap,
      provinsi: w.provinsi,
      kabupaten: w.kabupaten,
      titik,
    });
  }
  return { indeks, hari };
}

/** CSV terakhir yang berhasil per satelit (memori, lalu Redis bila server baru
 *  menyala). Satelit yang gagal diambil memakai salinan ini — tanpanya satu
 *  berkas yang time-out menghapus seluruh titik satelit itu dari peta DAN dari
 *  salinan Redis sampai penyegaran berikutnya berhasil. */
const csvTerakhir: (string | null)[] = BERKAS.map(() => null);
const kunciCsv = (s: number) => `firms:csv:v2:${s}`; // v2: berkas 7 hari

/** `lengkap` false bila ada satelit yang gagal diambil. */
async function ambilFirms(): Promise<ReturnType<typeof hasil>> {
  if (!(await firmsTerjangkau())) throw new Error("FIRMS tak terjangkau");
  const tenggat = Date.now() + TENGGAT_UNDUH;
  const baru = await Promise.all(BERKAS.map((b, s) => (s === 0 ? ambilModis(b.jalur, tenggat) : ambilCsv(b.jalur, tenggat))));
  if (baru.every((t) => t === null)) throw new Error("FIRMS tak terjangkau");
  // FIRMS tak menghormati If-Modified-Since, jadi unduhan tak terhindarkan —
  // tapi berkas yang sama persis tak perlu diurai ulang. Harinya tetap
  // diturunkan ulang: jendela 24 jam hari ini maju tiap penyegaran.
  if (penampungLalu && baru.every((csv, s) => csv === null || csv === csvTerakhir[s])) {
    return hasil(penampungLalu, baru.every((t) => t !== null));
  }
  const semua = await Promise.all(baru.map(async (csv, s) => csv ?? (csvTerakhir[s] ??= await redisGet(kunciCsv(s)))));
  const w = penampungBaru();
  semua.forEach((csv, s) => {
    if (csv) urai(csv, s, w);
  });
  // Berkas tanpa satu pun titik Nusantara (header saja):
  // gagal, supaya salinan lama tetap dilayani alih-alih diganti kosong — dan
  // berkas itu tak diingat, jadi kiriman sama berikutnya tak lolos sebagai "tak berubah".
  if (!w.titik.length) throw new Error("FIRMS tanpa titik Nusantara");
  wilayahLalu = w.wilayah;
  penampungLalu = w;
  // Berkas yang lolos diingat; salinan Redis (multi-MB) hanya ditulis bila isinya berubah.
  baru.forEach((csv, s) => {
    if (csv === null || csv === csvTerakhir[s]) return;
    csvTerakhir[s] = csv;
    void redisSet(kunciCsv(s), csv, TTL_REDIS_DETIK);
  });
  // Tetap "tak lengkap" bila ada satelit dari salinan.
  return hasil(w, baru.every((t) => t !== null));
}

let indeksMemori: { data: IndeksHotspot; dibaca: number } | null = null;
/** Salinan per hari; sah selama `diambil`-nya tak lebih tua dari indeks. */
const hariMemori = new Map<string, DataHotspot>();
let sedangAmbil: Promise<IndeksHotspot> | null = null;

/** Ambil FIRMS (satu pengambilan bersama) lalu simpan ke memori & Redis.
 *  Dipanggil cron warm-asap; gagal = salinan Redis lama tetap utuh. */
export function segarkanHotspot(): Promise<IndeksHotspot> {
  sedangAmbil ??= ambilFirms()
    .then(async ({ indeks, hari }) => {
      hariMemori.clear();
      for (const [h, data] of hari) hariMemori.set(h, data);
      indeksMemori = { data: indeks, dibaca: Date.now() };
      // Hari dulu, indeks terakhir — dan hanya bila semua hari tertulis: indeks
      // di Redis tak pernah menunjuk hari yang hilang atau basi. Hari yang gagal
      // tertulis lagi penyegaran berikutnya (semua hari diturunkan ulang tiap
      // kali). Hari yang keluar jendela habis sendiri oleh TTL.
      const tertulis = await Promise.all([...hari].map(([h, data]) => redisSet(kunciHari(h), JSON.stringify(data), TTL_REDIS_DETIK)));
      if (tertulis.every(Boolean)) await redisSet(KUNCI_REDIS, JSON.stringify(indeks), TTL_REDIS_DETIK);
      return indeks;
    })
    .finally(() => {
      sedangAmbil = null;
    });
  return sedangAmbil;
}

/** Indeks terakhir: memori (≤ UMUR_MEMORI), lalu Redis; Redis tak terjangkau
 *  → memori terakhir. */
async function bacaIndeks(): Promise<IndeksHotspot | null> {
  if (indeksMemori && Date.now() - indeksMemori.dibaca < UMUR_MEMORI) return indeksMemori.data;
  const teks = await redisGet(KUNCI_REDIS);
  if (teks) {
    try {
      const data = JSON.parse(teks) as IndeksHotspot;
      // String ISO sebanding leksikografis — jangan timpa salinan yang lebih baru.
      if (!indeksMemori || data.diambil >= indeksMemori.data.diambil) indeksMemori = { data, dibaca: Date.now() };
    } catch {
      // Salinan rusak — pakai yang ada di memori.
    }
  }
  if (indeksMemori) indeksMemori.dibaca = Date.now();
  return indeksMemori?.data ?? null;
}

/**
 * Salinan satu hari WIB tanpa menyentuh FIRMS. `diminta` di luar data
 * (prakiraan, lebih tua dari jendela, atau hari tanpa deteksi) → hari tersedia
 * terakhir yang tidak sesudahnya, atau hari tertua; null → hari terbaru. Hari
 * yang salinannya tak terbaca (kuncinya hilang/rusak) diganti hari berikutnya
 * di urutan yang sama. Hari yang dikembalikan tertulis di `hari`. null =
 * belum pernah ada salinan.
 */
export async function bacaHotspot(diminta: string | null = null): Promise<DataHotspot | null> {
  const indeks = await bacaIndeks();
  if (!indeks?.hari.length) return null;
  // Salinan pembaca (mis. rute) hanya menambah hari — buang yang keluar jendela.
  for (const h of hariMemori.keys()) if (!indeks.hari.includes(h)) hariMemori.delete(h);
  const batas = diminta ?? indeks.hari.at(-1)!;
  const urutan = [...indeks.hari.filter((h) => h <= batas).reverse(), ...indeks.hari.filter((h) => h > batas)];
  // Indeks lama (sebelum ada `versi`): diambil = versi.
  const versi = indeks.versi ?? indeks.diambil;
  // Data hari membawa waktu periksa & status lengkap terbaru dari indeks.
  const segar = (data: DataHotspot) => ({ ...data, diambil: indeks.diambil, lengkap: indeks.lengkap });
  for (const hari of urutan) {
    const simpan = hariMemori.get(hari);
    if (simpan && simpan.diambil >= versi) return segar(simpan);
    const teks = await redisGet(kunciHari(hari));
    if (teks) {
      try {
        const data = JSON.parse(teks) as DataHotspot;
        // Memori dibaca ulang: penyegaran bersamaan bisa menulis yang lebih baru selama menunggu Redis.
        const kini = hariMemori.get(hari);
        if (!kini || data.diambil >= kini.diambil) hariMemori.set(hari, data);
      } catch {
        // Salinan rusak — pakai yang ada di memori.
      }
    }
    const data = hariMemori.get(hari);
    if (data) return segar(data);
  }
  return null;
}
