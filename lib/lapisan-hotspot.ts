import type * as maplibregl from "maplibre-gl";

/**
 * Lapisan tambahan titik anomali panas (hotspot) satu hari dari NASA FIRMS
 * (lib/hotspot-firms.ts, lewat /api/hotspot), ditumpangkan di atas peta dasar
 * yang sedang tampil. Satu data, tiga sakelar satelit ala legenda SiPongi KLHK
 * di panel Lapisan peta.tsx (bawaan menyala): NASA-TERRA/AQUA segi lima,
 * NASA-SNPP segi enam, NASA-NOAA20 bintang, diwarnai hijau/kuning/merah per
 * tingkat kepercayaan.
 *
 * Modul ini memasangnya di peta MapLibre lapisan Aerosol (PetaAsap). Padanan
 * untuk iframe Windy ada di app/api/forecasting/route.ts, pesan SET_HOTSPOT —
 * warna, bentuk & ukurannya disamakan dengan konstanta di sini.
 */

export type DataHotspot = {
  /** Tanggal WIB (YYYY-MM-DD) titik-titik ini — satu hari, lihat hariWib. */
  hari: string;
  /** Tanggal WIB yang punya data di server, urut naik. */
  hariTersedia: string[];
  /** Waktu akuisisi satelit terbaru hari itu (ISO, UTC), null bila tak ada titik. */
  diperbarui: string | null;
  /** Waktu server mengambil berkas dari FIRMS (ISO). */
  diambil: string;
  satelit: string[];
  /** false bila sebagian berkas satelit gagal diambil. */
  lengkap: boolean;
  /** true bila salinan lebih tua dari BATAS_BASI_MS — penyegaran cron gagal
   *  (FIRMS tak terjangkau) atau cron tak berjalan. */
  basi?: boolean;
  provinsi: string[];
  kabupaten: string[];
  /** [lng, lat, kepercayaan, FRP (MW), waktu (menit epoch UTC), indeks
   *  satelit, indeks provinsi, malam (0/1), indeks kabupaten (-1 = tak
   *  ada)]; baris susunTitikTampil menambah id tampil (kolom ke-10). */
  titik: number[][];
};

/** Tanggal WIB "YYYY-MM-DD" dari milidetik epoch — satu "hari" hotspot. */
export function hariWib(ms: number): string {
  return new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Riwayat peta = hari ini + enam hari WIB sebelumnya, untuk bilah waktu
 *  Aerosol & Angin (lib/zarr-reader.ts) DAN hotspot (lib/hotspot-firms.ts) —
 *  sepanjang berkas 7 hari FIRMS, jadi ketiganya mundur sejauh yang sama. */
export const HARI_RIWAYAT = 7;

/** Awal riwayat: 00.00 WIB hari pertamanya, ms epoch. */
export function awalRiwayat(ms = Date.now()): number {
  return Date.parse(`${hariWib(ms - (HARI_RIWAYAT - 1) * 24 * 3600 * 1000)}T00:00:00+07:00`);
}

/** Warna per tingkat kepercayaan (indeks 0 rendah, 1 sedang, 2 tinggi). */
export const WARNA_SIPONGI = ["#4caf50", "#fbc02d", "#f01e1e"] as const;
export const LABEL_KEPERCAYAAN = ["Rendah", "Sedang", "Tinggi"] as const;

/**
 * Satelit per indeks `s` di data — lib/hotspot-firms.ts membaca berkas
 * FIRMS dengan urutan yang sama. `sisi` = bentuk penanda lapisan SiPongi-nya:
 * 5 segi lima, 6 segi enam, 0 bintang. Urutan = sakelar panel & legenda.
 */
export const SATELIT_HOTSPOT = [
  { label: "NASA-TERRA/AQUA", sensor: "MODIS", sisi: 5 },
  { label: "NASA-SNPP", sensor: "VIIRS", sisi: 6 },
  { label: "NASA-NOAA20", sensor: "VIIRS", sisi: 0 },
] as const;

/**
 * Baris satelit yang sakelarnya menyala (`satelit[s]`). Kolom ke-10 = id baris
 * tampil = indeks titik di data: tetap sama walau sakelar lain diganti —
 * promoteId sumber peta, lihat pasangLapisanHotspot.
 */
export function susunTitikTampil(data: DataHotspot, satelit: readonly boolean[]): number[][] {
  const hasil: number[][] = [];
  for (let n = 0; n < data.titik.length; n++) {
    const t = data.titik[n];
    if (satelit[t[5]]) hasil.push([...t.slice(0, 9), n]);
  }
  return hasil;
}

/**
 * Jalur SVG bentuk penanda satelit `s`, berpusat di (c, c) berjari-jari r,
 * ujung menghadap ke atas. Satu sumber untuk legenda & pop-up (SVG) dan ikon
 * peta (Path2D). Bintang sedikit diperbesar supaya luasnya setara segi banyak.
 */
export function jalurBentukHotspot(s: number, c: number, r: number): string {
  const sisi = SATELIT_HOTSPOT[s]?.sisi ?? 5;
  const n = sisi || 10;
  const luar = sisi ? r : r * 1.12;
  const titik: string[] = [];
  for (let i = 0; i < n; i++) {
    const sudut = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const jari = !sisi && i % 2 ? luar * 0.45 : luar;
    titik.push(`${(c + jari * Math.cos(sudut)).toFixed(2)},${(c + jari * Math.sin(sudut)).toFixed(2)}`);
  }
  return `M${titik.join("L")}Z`;
}

const SUMBER = "hotspot";
const LAPIS_SIPONGI = "hotspot-sipongi";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "20 Okt, 13:50 WIB" — format waktu yang sama dengan bilah waktu PetaAsap. */
export function formatWib(ms: number): string {
  const d = new Date(ms + 7 * 3600 * 1000);
  const jj = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}, ${jj}:${mm} WIB`;
}

/** Jumlah titik per satelit lalu per tingkat kepercayaan: [s][rendah, sedang, tinggi]. */
export function hitungPerSatelit(data: DataHotspot): number[][] {
  const per = SATELIT_HOTSPOT.map(() => [0, 0, 0]);
  for (const t of data.titik) if (per[t[5]]) per[t[5]][t[2]]++;
  return per;
}

/** Satelit (indeks `s`) yang dihitung peringkat wilayah: VIIRS S-NPP & NOAA-20. */
export const SATELIT_PERINGKAT = [1, 2] as const;

/** Rincian jumlah: `perSatelit` urut SATELIT_PERINGKAT, `perKepercayaan`
 *  [rendah, sedang, tinggi], `malam` = deteksi lintasan malam. */
export type BarisPeringkat = { nama: string; jumlah: number; perSatelit: number[]; perKepercayaan: number[]; malam: number };

/** Peringkat provinsi & kabupaten menurut jumlah deteksi SATELIT_PERINGKAT.
 *  Kedua satelit selintasan ±50 menit, jadi satu api sering terhitung dua
 *  kali — angkanya deteksi, bukan banyaknya api. */
export function peringkatHotspot(data: DataHotspot): { provinsi: BarisPeringkat[]; kabupaten: BarisPeringkat[] } {
  const provinsi = new Map<string, BarisPeringkat>();
  const kabupaten = new Map<string, BarisPeringkat>();
  const tambah = (peta: Map<string, BarisPeringkat>, nama: string | undefined, j: number, t: number[]) => {
    if (nama === undefined) return;
    let b = peta.get(nama);
    if (!b) peta.set(nama, (b = { nama, jumlah: 0, perSatelit: SATELIT_PERINGKAT.map(() => 0), perKepercayaan: [0, 0, 0], malam: 0 }));
    b.jumlah++;
    b.perSatelit[j]++;
    b.perKepercayaan[t[2]]++;
    b.malam += t[7];
  };
  for (const t of data.titik) {
    const j = (SATELIT_PERINGKAT as readonly number[]).indexOf(t[5]);
    if (j < 0) continue;
    tambah(provinsi, data.provinsi[t[6]], j, t);
    tambah(kabupaten, data.kabupaten[t[8]], j, t);
  }
  const urut = (peta: Map<string, BarisPeringkat>) =>
    [...peta.values()].sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, "id"));
  return { provinsi: urut(provinsi), kabupaten: urut(kabupaten) };
}

function keGeoJson(data: DataHotspot | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: (data?.titik ?? []).map(([lng, lat, k, frp, waktu, s, p, malam, , id], i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      // id: kolom ke-10 susunTitikTampil; baris tanpa kolom itu memakai urutannya.
      properties: { k, frp, waktu, s, p, malam, id: id ?? i },
    })),
  };
}

/** Ukuran ikon penanda (px CSS) pada icon-size 1; digambar 2× untuk layar rapat. */
const UKURAN_IKON = 13;
const RASIO_IKON = 2;

/** Ikon satelit s × kepercayaan k: bentuk berwarna bergaris tepi gelap. */
function gambarIkon(s: number, k: number): ImageData | null {
  const sisi = UKURAN_IKON * RASIO_IKON;
  const kanvas = document.createElement("canvas");
  kanvas.width = kanvas.height = sisi;
  const ctx = kanvas.getContext("2d");
  if (!ctx) return null;
  const tepi = 1.1 * RASIO_IKON;
  const jalur = new Path2D(jalurBentukHotspot(s, sisi / 2, sisi / 2 - tepi));
  ctx.fillStyle = WARNA_SIPONGI[k];
  ctx.fill(jalur);
  ctx.lineJoin = "round";
  ctx.lineWidth = tepi;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.stroke(jalur);
  return ctx.getImageData(0, 0, sisi, sisi);
}

const idIkon = (s: number, k: number) => `hotspot-${s}-${k}`;

/** Pasang sumber + lapisan hotspot (kosong) di atas lapisan yang sudah ada. */
export function pasangLapisanHotspot(map: maplibregl.Map) {
  SATELIT_HOTSPOT.forEach((_, s) => {
    for (let k = 0; k < 3; k++) {
      if (map.hasImage(idIkon(s, k))) continue;
      const ikon = gambarIkon(s, k);
      if (ikon) map.addImage(idIkon(s, k), ikon, { pixelRatio: RASIO_IKON });
    }
  });
  if (map.getSource(SUMBER)) return;
  // promoteId wajib (MapLibre >= 6.11): kunci pencocokan simbol antar-ubin
  // (CrossTileSymbolIndex) lalu memuat id titik. Tanpa itu semua penanda
  // SiPongi — simbol tanpa teks — berbagi satu kunci, dan tiap ubin baru
  // (sakelar, zoom, bentang selayar) dicocokkan dengan ratusan sampai ribuan
  // titik di sekitarnya: puluhan juta perbandingan untuk ~19 ribu titik, di
  // main thread, sekaligus — peta macet berdetik-detik di laptop lemah.
  map.addSource(SUMBER, { type: "geojson", data: keGeoJson(null), promoteId: "id" });
  map.addLayer({
    id: LAPIS_SIPONGI,
    type: "symbol",
    source: SUMBER,
    layout: {
      "icon-image": ["concat", "hotspot-", ["to-string", ["get", "s"]], "-", ["to-string", ["get", "k"]]],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 6, 0.85, 9, 1.15, 12, 1.6],
      // Semua titik tetap tampil walau bertumpuk; kepercayaan tinggi paling atas.
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "symbol-sort-key": ["get", "k"],
    },
    // Opasitas konstan (bukan per kepercayaan): hanya nilai konstan yang bisa
    // ditransisikan MapLibre — dipakai pudar ganti hari, lihat setelDataHotspot.
    paint: { "icon-opacity": 1 },
  });
}

/** Lama pudar keluar & masuk (ms) saat hari hotspot berganti. */
const PUDAR_KELUAR = 180;
const PUDAR_MASUK = 420;
const tundaPudar = new WeakMap<maplibregl.Map, ReturnType<typeof setTimeout>>();

/**
 * Isi lapisan hotspot dengan baris susunTitikTampil; null = matikan (kosongkan).
 * `pudar` (hari berganti): titik lama memudar, data baru masuk, lalu muncul
 * pelan — transisi paint MapLibre atas opasitas konstan, murah walau puluhan
 * ribu titik. Pergantian beruntun (bilah waktu digeser) membatalkan yang lama.
 */
export function setelDataHotspot(map: maplibregl.Map, data: DataHotspot | null, pudar = false) {
  const sumber = map.getSource(SUMBER) as maplibregl.GeoJSONSource | undefined;
  if (!sumber) return;
  clearTimeout(tundaPudar.get(map));
  const lapis = map.getLayer(LAPIS_SIPONGI);
  if (!pudar || !lapis) {
    if (lapis) map.setPaintProperty(LAPIS_SIPONGI, "icon-opacity", 1);
    void sumber.setData(keGeoJson(data));
    return;
  }
  map.setPaintProperty(LAPIS_SIPONGI, "icon-opacity-transition", { duration: PUDAR_KELUAR, delay: 0 });
  map.setPaintProperty(LAPIS_SIPONGI, "icon-opacity", 0);
  // Sekali per peta: penunda yang masih jalan saat map.remove() menyentuh style yang sudah dibuang.
  if (!tundaPudar.has(map)) map.once("remove", () => clearTimeout(tundaPudar.get(map)));
  tundaPudar.set(
    map,
    setTimeout(() => {
      void sumber.setData(keGeoJson(data));
      map.setPaintProperty(LAPIS_SIPONGI, "icon-opacity-transition", { duration: PUDAR_MASUK, delay: 0 });
      map.setPaintProperty(LAPIS_SIPONGI, "icon-opacity", 1);
    }, PUDAR_KELUAR),
  );
}

/** Mulai zoom ini titik hotspot bisa diketuk di layar sentuh. Di zoom lebih
 *  jauh titiknya rapat menutupi provinsi, jadi ketukan selalu memilih
 *  provinsi; info titiknya didapat dengan memperbesar peta dulu. */
export const ZOOM_KETUK_HOTSPOT = 7;

/** Event pointer ini dari sentuhan/pena (tanpa hover), bukan mouse? */
export function dariSentuhan(ev: Event): boolean {
  const jenis = (ev as PointerEvent).pointerType;
  if (jenis) return jenis !== "mouse";
  return window.matchMedia("(hover: none)").matches;
}

/** Posisi Mercator 0..1 [x, y] tiap baris, dihitung sekali per larik titik. */
const cacheMercator = new WeakMap<number[][], Float64Array>();
function mercator(titik: number[][]): Float64Array {
  let merc = cacheMercator.get(titik);
  if (!merc) {
    merc = new Float64Array(titik.length * 2);
    titik.forEach((t, i) => {
      const sinLat = Math.sin((Math.max(-85, Math.min(85, t[1])) * Math.PI) / 180);
      merc![i * 2] = (t[0] + 180) / 360;
      merc![i * 2 + 1] = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
    });
    cacheMercator.set(titik, merc);
  }
  return merc;
}

/**
 * Titik hotspot dalam ±jari px dari (x, y) piksel kontainer peta; bila
 * beberapa, kepercayaan tertinggi lalu terdekat. Dihitung sendiri dari
 * proyeksi Mercator, bukan queryRenderedFeatures: untuk lapisan simbol
 * (penanda SiPongi) MapLibre mengembalikan fitur yang letaknya tak cocok
 * dengan layar. Peta Aerosol tanpa rotasi/kemiringan, jadi rumusnya cukup.
 * Mengembalikan properti titik untuk kartuHotspot.
 */
export function hotspotDiTitik(
  map: maplibregl.Map,
  data: DataHotspot,
  titik: { x: number; y: number },
  jari = 6,
): Record<string, number> | null {
  const baris = data.titik;
  if (!baris.length) return null;
  const merc = mercator(baris);
  const pusat = map.getCenter();
  const dunia = 512 * Math.pow(2, map.getZoom());
  const sinPusat = Math.sin((pusat.lat * Math.PI) / 180);
  // Posisi layar pusat dari proyeksi, bukan tengah kanvas: padding kiri kamera
  // (kolom peringkat, PetaAsap kolomKiri) menggeser pusat dari tengah kanvas.
  const pusatPx = map.project(pusat);
  const ox = pusatPx.x - ((pusat.lng + 180) / 360) * dunia;
  const oy = pusatPx.y - (0.5 - Math.log((1 + sinPusat) / (1 - sinPusat)) / (4 * Math.PI)) * dunia;
  let terbaik = -1;
  let kTerbaik = -1;
  let dTerbaik = Infinity;
  for (let i = 0; i < baris.length; i++) {
    const dx = merc[i * 2] * dunia + ox - titik.x;
    if (dx > jari || dx < -jari) continue;
    const dy = merc[i * 2 + 1] * dunia + oy - titik.y;
    if (dy > jari || dy < -jari) continue;
    const k = baris[i][2];
    const d = dx * dx + dy * dy;
    if (k > kTerbaik || (k === kTerbaik && d < dTerbaik)) {
      terbaik = i;
      kTerbaik = k;
      dTerbaik = d;
    }
  }
  if (terbaik < 0) return null;
  const [, , k, frp, waktu, s, p, malam] = baris[terbaik];
  return { k, frp, waktu, s, p, malam };
}

/**
 * Kartu info hotspot untuk tooltip gelap peta — tooltip yang sama dengan nama
 * provinsi, jadi klik/ketuk ke provinsi tak pernah terhalang pop-up. Nama
 * provinsinya di baris atas (gaya tooltip provinsi). Padanannya untuk iframe
 * Windy: kartuHotspot di app/api/forecasting/route.ts. Dirangkai lewat DOM,
 * bukan innerHTML.
 */
export function kartuHotspot(data: DataHotspot, props: Record<string, unknown>): HTMLElement {
  const k = Number(props.k);
  const s = Number(props.s);
  const akar = document.createElement("div");
  akar.style.minWidth = "190px";

  const provinsi = document.createElement("div");
  provinsi.style.cssText = "font-weight:700;color:#f59e0b;margin-bottom:2px;";
  provinsi.textContent = data.provinsi[Number(props.p)] ?? "-";

  const judul = document.createElement("div");
  judul.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px;";
  const ns = "http://www.w3.org/2000/svg";
  const ikon = document.createElementNS(ns, "svg");
  ikon.setAttribute("viewBox", "0 0 12 12");
  ikon.setAttribute("width", "11");
  ikon.setAttribute("height", "11");
  const bentuk = document.createElementNS(ns, "path");
  bentuk.setAttribute("d", jalurBentukHotspot(s, 6, 5));
  bentuk.setAttribute("fill", WARNA_SIPONGI[k] ?? WARNA_SIPONGI[0]);
  bentuk.setAttribute("stroke", "rgba(0, 0, 0, 0.6)");
  bentuk.setAttribute("stroke-linejoin", "round");
  ikon.append(bentuk);
  judul.append(ikon, `Hotspot · kepercayaan ${LABEL_KEPERCAYAAN[k]?.toLowerCase() ?? "-"}`);

  const rincian = document.createElement("div");
  rincian.style.cssText = "display:grid;grid-template-columns:auto 1fr;gap:1px 12px;margin-top:5px;font-size:11px;font-weight:500;";
  const satelit = SATELIT_HOTSPOT[s];
  const baris: [string, string][] = [
    ["Waktu", `${formatWib(Number(props.waktu) * 60000)}${Number(props.malam) ? " (malam)" : ""}`],
    ["Satelit", satelit ? `${satelit.label} (${satelit.sensor})` : "-"],
    ["FRP", `${Number(props.frp).toLocaleString("id-ID")} MW`],
  ];
  for (const [label, isi] of baris) {
    const l = document.createElement("span");
    l.style.color = "rgba(255, 255, 255, 0.6)";
    l.textContent = label;
    const v = document.createElement("span");
    v.style.textAlign = "right";
    v.textContent = isi;
    rincian.append(l, v);
  }
  akar.append(provinsi, judul, rincian);
  return akar;
}
