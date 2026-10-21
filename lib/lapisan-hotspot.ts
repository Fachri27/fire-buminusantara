import type * as maplibregl from "maplibre-gl";

/**
 * Lapisan tambahan titik anomali panas (hotspot) 24 jam terakhir dari NASA
 * FIRMS (app/api/hotspot/route.ts), ditumpangkan di atas peta dasar yang
 * sedang tampil. Satu data, empat sakelar di panel Lapisan peta.tsx:
 *
 * - "Titik Hotspot" (bawaan mati): bulatan kuning/oranye/merah per tingkat
 *   kepercayaan dari satelit VIIRS (S-NPP, NOAA-20, NOAA-21).
 * - Tiga lapisan satelit ala legenda SiPongi KLHK (bawaan menyala):
 *   NASA-TERRA/AQUA segi lima, NASA-SNPP segi enam, NASA-NOAA20 bintang,
 *   diwarnai hijau/kuning/merah per tingkat kepercayaan.
 *
 * Sebuah titik bisa tampil di dua lapisan sekaligus (mis. titik SNPP di Titik
 * Hotspot dan di NASA-SNPP); susunTitikTampil menandai tiap baris dengan
 * gayanya.
 *
 * Modul ini memasangnya di peta MapLibre lapisan Aerosol (PetaAsap). Padanan
 * untuk iframe Windy ada di app/api/forecasting/route.ts, pesan SET_HOTSPOT —
 * warna, bentuk & ukurannya disamakan dengan konstanta di sini.
 */

export type DataHotspot = {
  /** Waktu akuisisi satelit terbaru (ISO, UTC), null bila tak ada titik. */
  diperbarui: string | null;
  /** Waktu server mengambil berkas dari FIRMS (ISO). */
  diambil: string;
  satelit: string[];
  /** false bila sebagian berkas satelit gagal diambil. */
  lengkap: boolean;
  /** true bila FIRMS tak terjangkau dan yang dilayani data terakhir. */
  basi?: boolean;
  /** true bila data ini sudah lewat umurnya dan server sedang menyegarkannya
   *  di latar — minta lagi sebentar kemudian. */
  menyegarkan?: boolean;
  provinsi: string[];
  /** [lng, lat, kepercayaan, FRP (MW), waktu (menit epoch UTC), indeks
   *  satelit, indeks provinsi, malam (0/1)] */
  titik: number[][];
};

/** Warna per tingkat kepercayaan (indeks 0 rendah, 1 sedang, 2 tinggi):
 *  lapisan Titik Hotspot dan lapisan satelit SiPongi. */
export const WARNA_TITIK_HOTSPOT = ["#facc15", "#f97316", "#ef4444"] as const;
export const WARNA_SIPONGI = ["#4caf50", "#fbc02d", "#f01e1e"] as const;
export const LABEL_KEPERCAYAAN = ["Rendah", "Sedang", "Tinggi"] as const;

/**
 * Satelit per indeks `s` di data — app/api/hotspot/route.ts membaca berkas
 * FIRMS dengan urutan yang sama. `sisi` = bentuk penanda lapisan SiPongi-nya:
 * 5 segi lima, 6 segi enam, 0 bintang. NOAA-21 tak punya lapisan SiPongi —
 * titiknya hanya tampil di lapisan Titik Hotspot.
 */
export const SATELIT_HOTSPOT = [
  { label: "NASA-TERRA/AQUA", sensor: "MODIS", sisi: 5 },
  { label: "NASA-SNPP", sensor: "VIIRS", sisi: 6 },
  { label: "NASA-NOAA20", sensor: "VIIRS", sisi: 0 },
  { label: "NASA-NOAA21", sensor: "VIIRS", sisi: 5 },
] as const;
/** Satelit (indeks `s`) yang punya lapisan SiPongi sendiri — urutan panel & legenda. */
export const SATELIT_SIPONGI = [0, 1, 2] as const;

/** Sakelar yang menyala: Titik Hotspot dan lapisan SiPongi per SATELIT_SIPONGI. */
export type LapisanHotspot = { titik: boolean; satelit: readonly boolean[] };
/** Gaya baris tampil (kolom ke-9): bulatan Titik Hotspot atau penanda SiPongi. */
export const GAYA_TITIK = 0;
export const GAYA_SIPONGI = 1;

/**
 * Baris yang digambar menurut sakelar yang menyala: titik VIIRS untuk Titik
 * Hotspot, titik tiap satelit SiPongi yang menyala untuk lapisannya — satu
 * titik bisa muncul dua kali dengan gaya berbeda. Kolom ke-9 = gaya.
 */
export function susunTitikTampil(data: DataHotspot, lapisan: LapisanHotspot): number[][] {
  const hasil: number[][] = [];
  for (const t of data.titik) {
    const s = t[5];
    if (lapisan.titik && SATELIT_HOTSPOT[s]?.sensor === "VIIRS") hasil.push([...t.slice(0, 8), GAYA_TITIK]);
    const i = (SATELIT_SIPONGI as readonly number[]).indexOf(s);
    if (i >= 0 && lapisan.satelit[i]) hasil.push([...t.slice(0, 8), GAYA_SIPONGI]);
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
const LAPIS_TITIK = "hotspot-titik";
const LAPIS_PENDAR = "hotspot-pendar";
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

function keGeoJson(data: DataHotspot | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: (data?.titik ?? []).map(([lng, lat, k, frp, waktu, s, p, malam, g = GAYA_SIPONGI]) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { k, frp, waktu, s, p, malam, g },
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
  SATELIT_SIPONGI.forEach((s) => {
    for (let k = 0; k < 3; k++) {
      if (map.hasImage(idIkon(s, k))) continue;
      const ikon = gambarIkon(s, k);
      if (ikon) map.addImage(idIkon(s, k), ikon, { pixelRatio: RASIO_IKON });
    }
  });
  if (map.getSource(SUMBER)) return;
  map.addSource(SUMBER, { type: "geojson", data: keGeoJson(null) });
  // Pendar di bawah bulatan Titik Hotspot berkepercayaan tinggi — kesan bara,
  // murah karena jumlahnya hanya sebagian kecil dari seluruh titik.
  map.addLayer({
    id: LAPIS_PENDAR,
    type: "circle",
    source: SUMBER,
    filter: ["all", ["==", ["get", "g"], GAYA_TITIK], ["==", ["get", "k"], 2]],
    paint: {
      "circle-color": WARNA_TITIK_HOTSPOT[2],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 6, 8, 16, 12, 28],
      "circle-blur": 1,
      "circle-opacity": 0.45,
    },
  });
  map.addLayer({
    id: LAPIS_TITIK,
    type: "circle",
    source: SUMBER,
    filter: ["==", ["get", "g"], GAYA_TITIK],
    // Kepercayaan tinggi digambar paling atas.
    layout: { "circle-sort-key": ["get", "k"] },
    paint: {
      "circle-color": ["match", ["get", "k"], 2, WARNA_TITIK_HOTSPOT[2], 1, WARNA_TITIK_HOTSPOT[1], WARNA_TITIK_HOTSPOT[0]],
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        3, ["match", ["get", "k"], 2, 2.6, 1, 2.1, 1.6],
        7, ["match", ["get", "k"], 2, 4.5, 1, 3.6, 2.8],
        12, ["match", ["get", "k"], 2, 9, 1, 7.5, 6],
      ],
      "circle-opacity": ["match", ["get", "k"], 0, 0.75, 0.95],
      "circle-stroke-color": "rgba(0, 0, 0, 0.55)",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4, 0, 7, 0.8],
    },
  });
  map.addLayer({
    id: LAPIS_SIPONGI,
    type: "symbol",
    source: SUMBER,
    filter: ["==", ["get", "g"], GAYA_SIPONGI],
    layout: {
      "icon-image": ["concat", "hotspot-", ["to-string", ["get", "s"]], "-", ["to-string", ["get", "k"]]],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 6, 0.85, 9, 1.15, 12, 1.6],
      // Semua titik tetap tampil walau bertumpuk; kepercayaan tinggi paling atas.
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "symbol-sort-key": ["get", "k"],
    },
    paint: { "icon-opacity": ["match", ["get", "k"], 0, 0.85, 1] },
  });
}

/** Isi lapisan hotspot dengan baris susunTitikTampil; null = matikan (kosongkan). */
export function setelDataHotspot(map: maplibregl.Map, data: DataHotspot | null) {
  const sumber = map.getSource(SUMBER) as maplibregl.GeoJSONSource | undefined;
  void sumber?.setData(keGeoJson(data));
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
  const kanvas = map.getCanvas();
  const pusat = map.getCenter();
  const dunia = 512 * Math.pow(2, map.getZoom());
  const sinPusat = Math.sin((pusat.lat * Math.PI) / 180);
  const ox = kanvas.clientWidth / 2 - ((pusat.lng + 180) / 360) * dunia;
  const oy = kanvas.clientHeight / 2 - (0.5 - Math.log((1 + sinPusat) / (1 - sinPusat)) / (4 * Math.PI)) * dunia;
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
  const [, , k, frp, waktu, s, p, malam, g = GAYA_SIPONGI] = baris[terbaik];
  return { k, frp, waktu, s, p, malam, g };
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
  const bulatan = Number(props.g) === GAYA_TITIK;
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
  bentuk.setAttribute("d", bulatan ? "M1,6a5,5 0 1,0 10,0a5,5 0 1,0 -10,0" : jalurBentukHotspot(s, 6, 5));
  bentuk.setAttribute("fill", (bulatan ? WARNA_TITIK_HOTSPOT : WARNA_SIPONGI)[k] ?? WARNA_SIPONGI[0]);
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
