import type * as maplibregl from "maplibre-gl";

/**
 * Lapisan tambahan "Titik Hotspot" — titik anomali panas VIIRS 24 jam terakhir
 * dari NASA FIRMS (app/api/hotspot/route.ts), ditumpangkan di atas peta dasar
 * yang sedang tampil dan dinyalakan/dimatikan dari menu lapisan peta.tsx.
 *
 * Modul ini memasangnya di peta MapLibre lapisan Aerosol (PetaAsap). Padanan
 * untuk iframe Windy (Leaflet) ada di app/api/forecasting/route.ts, pesan
 * SET_HOTSPOT — warna & ukurannya disamakan dengan konstanta di sini.
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
  provinsi: string[];
  /** [lng, lat, kepercayaan, FRP (MW), waktu (menit epoch UTC), indeks
   *  satelit, indeks provinsi, malam (0/1)] */
  titik: number[][];
};

/** Warna per tingkat kepercayaan — indeks 0 rendah, 1 sedang, 2 tinggi. */
export const WARNA_HOTSPOT = ["#facc15", "#f97316", "#ef4444"] as const;
export const LABEL_KEPERCAYAAN = ["Rendah", "Sedang", "Tinggi"] as const;

const SUMBER = "hotspot";
const LAPIS_TITIK = "hotspot-titik";
const LAPIS_PENDAR = "hotspot-pendar";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "20 Okt, 13:50 WIB" — format waktu yang sama dengan bilah waktu PetaAsap. */
export function formatWib(ms: number): string {
  const d = new Date(ms + 7 * 3600 * 1000);
  const jj = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}, ${jj}:${mm} WIB`;
}

/** Jumlah titik per tingkat kepercayaan [rendah, sedang, tinggi]. */
export function hitungKepercayaan(data: DataHotspot): [number, number, number] {
  const per: [number, number, number] = [0, 0, 0];
  for (const t of data.titik) per[t[2]]++;
  return per;
}

function keGeoJson(data: DataHotspot | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: (data?.titik ?? []).map(([lng, lat, k, frp, waktu, s, p, malam]) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { k, frp, waktu, s, p, malam },
    })),
  };
}

/** Pasang sumber + lapisan hotspot (kosong) di atas lapisan yang sudah ada. */
export function pasangLapisanHotspot(map: maplibregl.Map) {
  if (map.getSource(SUMBER)) return;
  map.addSource(SUMBER, { type: "geojson", data: keGeoJson(null) });
  // Pendar di bawah titik berkepercayaan tinggi — kesan bara, murah karena
  // jumlahnya hanya sebagian kecil dari seluruh titik.
  map.addLayer({
    id: LAPIS_PENDAR,
    type: "circle",
    source: SUMBER,
    filter: ["==", ["get", "k"], 2],
    paint: {
      "circle-color": WARNA_HOTSPOT[2],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 6, 8, 16, 12, 28],
      "circle-blur": 1,
      "circle-opacity": 0.45,
    },
  });
  map.addLayer({
    id: LAPIS_TITIK,
    type: "circle",
    source: SUMBER,
    // Kepercayaan tinggi digambar paling atas.
    layout: { "circle-sort-key": ["get", "k"] },
    paint: {
      "circle-color": ["match", ["get", "k"], 2, WARNA_HOTSPOT[2], 1, WARNA_HOTSPOT[1], WARNA_HOTSPOT[0]],
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
}

/** Isi lapisan hotspot; null = matikan (kosongkan). */
export function setelDataHotspot(map: maplibregl.Map, data: DataHotspot | null) {
  const sumber = map.getSource(SUMBER) as maplibregl.GeoJSONSource | undefined;
  void sumber?.setData(keGeoJson(data));
}

/** Titik hotspot di bawah klik — kotak ±8px karena titiknya kecil dan sulit
 *  diketuk; bila beberapa, ambil yang kepercayaannya paling tinggi. */
export function hotspotDiTitik(map: maplibregl.Map, titik: { x: number; y: number }) {
  if (!map.getLayer(LAPIS_TITIK)) return null;
  const { x, y } = titik;
  const fitur = map.queryRenderedFeatures([[x - 8, y - 8], [x + 8, y + 8]], { layers: [LAPIS_TITIK] });
  if (!fitur.length) return null;
  return fitur.reduce((a, b) => (Number(b.properties.k) > Number(a.properties.k) ? b : a));
}

/** Kelas pop-up hotspot — kartu membulat, di atas gaya bawaan MapLibre. */
export const KELAS_POPUP_HOTSPOT =
  "[&_.maplibregl-popup-content]:rounded-xl [&_.maplibregl-popup-content]:px-3 [&_.maplibregl-popup-content]:py-2.5 [&_.maplibregl-popup-content]:shadow-xl";

/** Isi pop-up dirangkai lewat DOM — setHTML MapLibre tidak menyaring HTML. */
export function isiPopupHotspot(data: DataHotspot, props: Record<string, unknown>): HTMLElement {
  const k = Number(props.k);
  const akar = document.createElement("div");
  akar.className = "min-w-44 text-[11px] leading-relaxed text-neutral-700";

  const judul = document.createElement("div");
  judul.className = "mb-1 flex items-center gap-1.5 text-xs font-semibold text-neutral-900";
  const bulatan = document.createElement("span");
  bulatan.className = "inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/20";
  bulatan.style.background = WARNA_HOTSPOT[k] ?? WARNA_HOTSPOT[0];
  judul.append(bulatan, `Hotspot · kepercayaan ${LABEL_KEPERCAYAAN[k]?.toLowerCase() ?? "-"}`);
  akar.append(judul);

  const baris: [string, string][] = [
    ["Provinsi", data.provinsi[Number(props.p)] ?? "-"],
    ["Waktu", `${formatWib(Number(props.waktu) * 60000)}${Number(props.malam) ? " (malam)" : ""}`],
    ["Satelit", `${data.satelit[Number(props.s)] ?? "-"} (VIIRS)`],
    ["FRP", `${Number(props.frp).toLocaleString("id-ID")} MW`],
  ];
  for (const [label, isi] of baris) {
    const b = document.createElement("div");
    b.className = "flex justify-between gap-3";
    const l = document.createElement("span");
    l.className = "text-neutral-500";
    l.textContent = label;
    const v = document.createElement("span");
    v.className = "text-right font-medium text-neutral-900";
    v.textContent = isi;
    b.append(l, v);
    akar.append(b);
  }
  return akar;
}
