"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties, type ReactNode, type KeyboardEvent as KeyboardEventReact, type PointerEvent as PointerEventReact } from "react";
import { createPortal, flushSync } from "react-dom";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const PetaAsap = dynamic(
  () => import("./peta-asap").then((mod) => mod.PetaAsap),
  {
    ssr: false,
    // Tanpa `loading`: PetaAsap punya overlay sinkronisasi sendiri ("Menyinkronkan
    // sebaran asap… %") begitu modulnya terpasang, jadi pop-up pemuatan terpisah
    // di sini hanya redundan — dua indikator berturut-turut untuk satu pemuatan.
    loading: () => null,
  }
);

import type { Berita } from "@/lib/events";
import { BATAS_NUSANTARA, selaNusantara } from "@/lib/kamera-nusantara";
// Hanya konstanta & tipe — modul ini mengimpor maplibre-gl sebatas tipe,
// jadi peta.tsx tetap tak ikut menarik maplibre-gl ke bundelnya.
import {
  hariWib,
  hitungPerSatelit,
  jalurBentukHotspot,
  SATELIT_HOTSPOT,
  susunTitikTampil,
  WARNA_SIPONGI,
  type DataHotspot,
} from "@/lib/lapisan-hotspot";
import type { LapisanAsap } from "./peta-asap";
import { PanelPeringkatHotspot, RelPeringkatHotspot } from "./panel-peringkat-hotspot";
import { formatHariPeta, LOCALE, TEKS_PETA } from "./teks-peta";
import type { Bahasa } from "@/lib/bahasa";
import { useKurangiGerak, useMediaQuery } from "@/hooks/use-media-query";

/** Bagian peta MapLibre lapisan Aerosol yang dibaca untuk menyamakan kamera
 *  Windy — diakses lewat window supaya peta.tsx tak mengimpor maplibre-gl. */
type PetaAerosol = {
  getContainer: () => HTMLElement;
  cameraForBounds: (
    batas: [[number, number], [number, number]],
    opsi: { padding: { top: number; bottom: number; left: number; right: number } },
  ) => { center: { lng: number; lat: number } | [number, number]; zoom?: number } | undefined;
};

/** Selisih bujur pusat iframe Windy ke pusat yang tampak: iframe melebar
 *  ke bawah kolom peringkat, `kolom` px tertutup panel (tutupKiri di Peta), jadi
 *  pusatnya kolom/2 px di barat pusat yang tampak. Zoom skala Leaflet (256 px). */
function geserBujurWindy(kolom: number, zoomWindy: number): number {
  return ((kolom / 2) * 360) / (256 * 2 ** zoomWindy);
}

/** Kamera Windy yang sama dengan kamera Nusantara lapisan Aerosol, atau null
 *  bila peta Aerosol belum siap. Zoom Windy (skala Leaflet) = zoom MapLibre + 1
 *  — lihat catatan tombol rumah di app/api/forecasting/route.ts. */
function kameraWindyNusantara(isPenuh: boolean | undefined, kolom: number): { lat: number; lon: number; zoom: number } | null {
  const peta = (window as unknown as { _maplibreMap?: PetaAerosol })._maplibreMap;
  if (!peta) return null;
  // Wadah MapLibre melebar ke bawah kolom peringkat; induknya (akar PetaAsap) = kotak yang tampak.
  const wadah = peta.getContainer();
  const kamera = peta.cameraForBounds(BATAS_NUSANTARA, { padding: selaNusantara(wadah.parentElement ?? wadah, isPenuh) });
  if (!kamera || kamera.zoom === undefined) return null;
  const [lon, lat] = Array.isArray(kamera.center) ? kamera.center : [kamera.center.lng, kamera.center.lat];
  return { lat, lon: lon - geserBujurWindy(kolom, kamera.zoom + 1), zoom: kamera.zoom + 1 };
}

/** Bagian peta Leaflet milik Windy di dalam iframe (satu origin dengan
 *  halaman) yang dipakai untuk membaca kameranya. */
type PetaWindy = {
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
};

/** Kamera lapisan Aerosol saat ini dalam skala zoom Windy (+1), atau null. */
function kameraAerosolKini(kolom: number): { lat: number; lon: number; zoom: number } | null {
  const peta = (window as unknown as {
    _maplibreMap?: { getCenter: () => { lat: number; lng: number }; getZoom: () => number };
  })._maplibreMap;
  if (!peta) return null;
  const c = peta.getCenter();
  const zoom = peta.getZoom() + 1;
  return { lat: c.lat, lon: c.lng - geserBujurWindy(kolom, zoom), zoom };
}

/** Mode lapisan peta — diangkat ke luar supaya konsol /peta bisa
 *  menyelaraskan aksen rel kiri (titik + badge) dengan tema lapisan aktif:
 *  asap = ungu berbahaya #49006A, windy = oren bara. */
export type ModePeta = "asap" | "windy";

/** Peta dasar di dropdown kiri atas. `latar` = gradien pil saat aktif. */
const LAPISAN: {
  mode: ModePeta;
  ikon: string;
  label: string;
  labelPendek: string;
  keterangan: string;
  latar: string;
  kelasAktif: string;
}[] = [
  {
    mode: "asap",
    ikon: "🔥",
    label: "Aerosol Karhutla",
    labelPendek: "Karhutla",
    keterangan: "Sebaran asap karhutla",
    latar: "linear-gradient(to right, #49006a 0%, #86198f 35%, #b90d84 65%, #f472b6 90%, #fce7f3 100%)",
    kelasAktif: "shadow-purple-950/50 ring-fuchsia-400/40",
  },
  {
    mode: "windy",
    ikon: "💨",
    label: "Angin dan Kualitas Udara",
    labelPendek: "Angin",
    keterangan: "Kualitas udara dan arah angin",
    latar: "linear-gradient(to right, #047857 0%, #059669 40%, #10b981 75%, #84cc16 100%)",
    kelasAktif: "shadow-emerald-950/50 ring-emerald-400/40",
  },
];

/** Lama luncur panel peringkat (ms) — lihat kolomPenuh di Peta. */
const LAMA_LUNCUR = 300;

/** Umur data hotspot di klien sebelum diminta ulang (server disegarkan cron tiap 30 menit). */
const UMUR_DATA_HOTSPOT = 30 * 60 * 1000;
/** Data hotspot yang diambil pada `waktuAmbil` (ms) sudah perlu diambil ulang. */
function hotspotBasi(waktuAmbil: number): boolean {
  return Date.now() - waktuAmbil > UMUR_DATA_HOTSPOT;
}

/** Warna slider bilah waktu lapisan Angin — hijau pil lapisannya (LAPISAN),
 *  menimpa magenta Aerosol pada .timeline-slider (gaya global PetaAsap). */
const JEJAK_SLIDER_ANGIN = {
  "--jejak-awal": "#059669",
  "--jejak-akhir": "#84cc16",
  "--jejak-cincin": "rgba(132, 204, 22, 0.4)",
} as CSSProperties;

/** Penanda lapisan SiPongi satelit s × kepercayaan k — sama dengan ikon di peta. */
function IkonHotspot({ s, k }: { s: number; k: number }) {
  return (
    <svg viewBox="0 0 12 12" width={10} height={10} className="shrink-0" aria-hidden="true">
      <path d={jalurBentukHotspot(s, 6, 5)} fill={WARNA_SIPONGI[k]} stroke="rgba(0, 0, 0, 0.6)" strokeLinejoin="round" />
    </svg>
  );
}

/** Satu baris sakelar di panel Lapisan peta. Panel tetap terbuka saat
 *  diklik supaya lapisannya langsung terlihat muncul/hilang di peta. */
function SakelarLapisan({ ikon, label, keterangan, aktif, onAlih }: { ikon: ReactNode; label: string; keterangan: string; aktif: boolean; onAlih: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktif}
      onClick={onAlih}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl p-1 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-api"
    >
      {ikon}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold leading-tight">{label}</span>
        <span className="block text-[10px] leading-snug text-tinta/55 dark:text-white/50">{keterangan}</span>
      </span>
      {/* Sakelar: bola dipusatkan flex (bukan top/left absolut) dan
          bayangannya merata — bayangan jatuh ke bawah membuat bola
          tampak tak di tengah trek. */}
      <span
        className={`flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${aktif ? "bg-api" : "bg-black/20 dark:bg-white/25"}`}
        aria-hidden="true"
      >
        <span
          className={`h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_2px_rgba(0,0,0,0.3)] transition-transform duration-150 motion-reduce:transition-none ${aktif ? "translate-x-3.5" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}

/** Satu bagian Panduan Peta (di dalam <dl>). */
function BagianPanduan({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] font-semibold text-tinta dark:text-white">{judul}</dt>
      <dd className="mt-0.5 text-[12px] leading-relaxed text-tinta/70 dark:text-white/70">{children}</dd>
    </div>
  );
}

const kelasTautan = "font-medium text-tinta underline underline-offset-2 dark:text-white";

type TabPanduan = "aerosol" | "angin" | "hotspot" | "peringkat";

/** Urutan topik Panduan Peta; teksnya di TEKS_PETA.panduan.topik. */
const TOPIK_PANDUAN = ["aerosol", "angin", "hotspot", "peringkat"] as const;

/** Skala AQI US EPA — warna baku EPA, juga dipakai legenda Windy; labelnya
 *  TEKS_PETA.panduan.angin.aqi dengan urutan sama. */
const SKALA_AQI = [
  { warna: "#00e400", rentang: "0–50" },
  { warna: "#ffff00", rentang: "51–100" },
  { warna: "#ff7e00", rentang: "101–150" },
  { warna: "#ff0000", rentang: "151–200" },
  { warna: "#8f3f97", rentang: "201–300" },
  { warna: "#7e0023", rentang: "301+" },
];

/** Kunci visual topik — sama dengan ikon baris panel Lapisan, jadi daftar
 *  topik sekaligus mengingatkan rupa lapisannya di peta. */
function KunciTopik({ kunci }: { kunci: TabPanduan }) {
  const kotak = "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-black/[0.06] dark:ring-white/10";
  if (kunci === "aerosol" || kunci === "angin") {
    return <span className={kotak} style={{ background: LAPISAN[kunci === "aerosol" ? 0 : 1].latar }} aria-hidden="true" />;
  }
  if (kunci === "hotspot") {
    return (
      <span className={`${kotak} gap-px bg-[#0b2440]`} aria-hidden="true">
        {SATELIT_HOTSPOT.map((_, s) => (
          <IkonHotspot key={s} s={s} k={2} />
        ))}
      </span>
    );
  }
  return (
    <span className={`${kotak} flex-col items-start gap-[3px] bg-[#0b2440] pl-[7px]`} aria-hidden="true">
      {[18, 13, 8].map((w) => (
        <span key={w} className="h-[3px] rounded-full bg-api-peta" style={{ width: w }} />
      ))}
    </span>
  );
}

/** Satu titik waktu lapisan Angin — dikirim iframe (LINIMASA_UDARA) dari
 *  metadata /api/udara, langkahnya sama dengan lapisan Aerosol. */
type LangkahUdara = { labelWib: string; adalahPrediksi: boolean; waktu: number | null };

type Props = {
  jumlahLaporan: Record<string, number>;
  onPilihWilayah: (nama: string, pulau: string | null, asal: { x: number; y: number }) => void;
  berita?: Berita[];
  onBukaRincian?: (b: Berita) => void;
  /** Diteruskan ke PetaAsap — konsol /peta mengaktifkannya karena bingkai
   *  tengahnya lebih sempit dari viewport. */
  legendaRingkas?: boolean;
  /** Diteruskan ke PetaAsap — kamera awal memuat seluruh Nusantara. */
  muatNusantara?: boolean;
  /** true = pil alih mode rapat ke tepi atas bingkai. Di peta fullscreen
   *  (beranda) pil butuh jarak top-20 agar lolos dari nav yang fixed; di
   *  dalam bingkai dasbor jarak itu membuatnya melayang di tengah peta. */
  tombolRapat?: boolean;
  /** Mode lapisan terkontrol — kalau diisi, pil hanya memanggil
   *  onModeChange dan tampilan ikut prop ini. Kalau kosong (beranda),
   *  komponen memakai state dalamnya sendiri seperti dulu. */
  mode?: ModePeta;
  onModeChange?: (m: ModePeta) => void;
  /** Diteruskan ke PetaAsap — roda tetikus memperbesar peta. */
  zoomRoda?: boolean;
  /** Diteruskan ke PetaAsap — logo pengganti untuk layar seluler. */
  logoSelulerSrc?: string | null;
  logoSelulerAlt?: string;
  /** Diteruskan ke PetaAsap — tombol bentang selayar di tumpukan kendali. */
  onExpand?: (() => void) | null;
  expandLabel?: string;
  /** Status mode peta selayar penuh */
  isPenuh?: boolean;
  /** Bahasa teks hotspot, peringkat, dan Panduan Peta (TEKS_PETA). */
  bahasa?: Bahasa;
};

export function Peta({ jumlahLaporan, onPilihWilayah, berita, onBukaRincian, legendaRingkas = false, tombolRapat = false, muatNusantara = false, mode: modeLuar, onModeChange, zoomRoda = false, logoSelulerSrc = null, logoSelulerAlt, onExpand = null, expandLabel, isPenuh = false, bahasa = "id" }: Props) {
  const t = TEKS_PETA[bahasa];
  const angka = (n: number) => n.toLocaleString(LOCALE[bahasa]);
  const [modeDalam, setModeDalam] = useState<ModePeta>("asap");
  // Terkendali kalau induk mengisi prop mode (+ onModeChange) — kalau tidak,
  // fallback ke state dalam supaya pemakaian lama (beranda) tak berubah.
  const terkendali = modeLuar !== undefined && onModeChange !== undefined;
  const mode = terkendali ? modeLuar : modeDalam;
  // Mode terkini untuk efek & pendengar yang tak ingin bergantung pada `mode`.
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const [hasOpenedWindy, setHasOpenedWindy] = useState(() => (modeLuar ?? "asap") === "windy");
  /* Hanya kamera awalnya yang disimpan sebagai state. Sisa parameter iframe
     dirangkai saat render, BUKAN dibekukan saat Windy pertama dibuka: bingkai
     yang sama bisa membentang jadi selayar (beranda), dan tombol bentang serta
     zoom roda ikut dipanggang ke URL ini. Dibekukan, iframe yang sudah terbuka
     akan membawa parameter bingkai lamanya — roda membajak guliran halaman di
     bingkai kecil, dan tombol bentang muncul di peta yang sudah selayar.
     Ganti src berarti iframe memuat ulang; itu memang sudah pasti terjadi,
     sebab memindahkan <iframe> di DOM selalu memuatnya ulang. */
  const { resolvedTheme } = useTheme();
  const [windyKamera, setWindyKamera] = useState("lat=0.200&lon=118.000&zoom=5");
  const windySrc = `/api/forecasting?${windyKamera}${zoomRoda ? "&konsol=1" : ""}${
    onExpand ? "&bentang=1" : ""
  }${legendaRingkas ? "&ringkas=1" : ""}${tombolRapat ? "&rapat=1" : ""}${
    resolvedTheme ? `&tema=${resolvedTheme}` : ""
  }`;
  const [sedangSyncAsap, setSedangSyncAsap] = useState(true);

  // Peta asap baru dipasang begitu layarnya mendekati pandangan. Begitu
  // terpasang, PetaAsap mengunduh bundle MapLibre lalu seluruh 61 frame
  // sebaran asap (~26 MB) — di atas (layar beranda masih terlihat) unduhan
  // itu merebut jalur LCP: kartu tengah menunggu 90+ detik. Di balik
  // IntersectionObserver, semuanya menunggu sampai pengunjung benar-benar
  // menggulir ke layar peta.
  //
  // Ambang 5%, BUKAN rootMargin bawah positif: section peta mulai tepat di
  // 100svh (tepat di bawah hero yang setinggi satu layar), jadi memperluas
  // akar observasi sebesar apa pun di bawah membuatnya berpotongan seketika
  // di scroll 0 — pertahanannya bolong. Ambang 5% berarti pemicunya saat
  // pengunjung sudah menggulir sampai peta benar-benar mulai terlihat.
  const [dekatPandangan, setDekatPandangan] = useState(false);
  const akarRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = akarRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setDekatPandangan(true);
      return;
    }
    const pengamat = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setDekatPandangan(true);
          pengamat.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, []);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [memuatWindy, setMemuatWindy] = useState(true);
  // Tinggi bilah legenda AQI selebar layar di dasar iframe (tampilan mobile/
  // tablet Windy); 0 di tampilan desktop. Lihat SELA_LEGENDA.
  const [selaLegendaWindy, setSelaLegendaWindy] = useState(0);
  const iframeReadyRef = useRef(false);
  // Kamera Aerosol yang harus diterapkan ke Windy begitu iframe siap.
  const kameraTertundaRef = useRef<{ lat: number; lon: number; zoom: number } | null>(null);
  const pendingJumlahRef = useRef(jumlahLaporan);
  const onPilihRef = useRef(onPilihWilayah);

  useEffect(() => {
    onPilihRef.current = onPilihWilayah;
  }, [onPilihWilayah]);

  // onExpand dibaca lewat ref supaya pendengar pesan iframe tidak perlu
  // dipasang ulang setiap induk membuat ulang closure-nya.
  const onExpandRef = useRef(onExpand);
  useEffect(() => {
    onExpandRef.current = onExpand;
  }, [onExpand]);


  // Kirim data ke iframe Windy
  const kirimData = useCallback((data: Record<string, unknown>) => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(data, "*");
    } catch {
      // Abaikan jika belum siap
    }
  }, []);

  /* Lapisan tambahan hotspot (lib/lapisan-hotspot.ts) — dinyalakan dari panel
     Lapisan dan ditumpangkan di peta dasar mana pun yang tampil: PetaAsap
     lewat prop, iframe Windy lewat pesan SET_HOTSPOT. Data diambil sekali di
     sini lalu dibagi ke keduanya. Tiga sakelar satelit (bawaan menyala, jadi
     datanya langsung diambil saat terpasang). */
  // Lapisan bawaan (sakelar teratas panel Lapisan): animasi per peta dasar,
  // batas provinsi & angka dipakai bersama. Windy menerimanya lewat SET_LAPISAN.
  const [lapisan, setLapisan] = useState<LapisanAsap & { angin: boolean }>({ aerosol: true, angin: true, poligon: true, angka: true });
  const lapisanRef = useRef(lapisan);
  useEffect(() => {
    lapisanRef.current = lapisan;
    if (iframeReadyRef.current) kirimData({ type: "SET_LAPISAN", ...lapisan });
  }, [lapisan, kirimData]);
  const [satelitAktif, setSatelitAktif] = useState<boolean[]>(() => SATELIT_HOTSPOT.map(() => true));
  const hotspotAktif = satelitAktif.some(Boolean);
  const [dataHotspot, setDataHotspot] = useState<DataHotspot | null>(null);
  // Hari langkah bilah waktu Aerosol (PetaAsap onWaktu). Sebelum ia melapor:
  // hari ini — bilah waktunya memang mulai dari "sekarang", jadi permintaan
  // pertama sudah hari yang benar dan tak diulang begitu laporannya tiba.
  // Disimpan sebagai hari, bukan ms: langkah 3-jam di hari yang sama tak
  // me-render ulang Peta.
  const [hariAsap, setHariAsap] = useState(() => hariWib(Date.now()));
  const [statusHotspot, setStatusHotspot] = useState<"diam" | "memuat" | "siap" | "galat">("memuat");
  const waktuAmbilHotspotRef = useRef(0);
  // Hari (WIB) yang diminta — hariTerpilih di bawah; null = hari terbaru.
  const hariHotspotRef = useRef<string | null>(null);
  // Jawaban per hari (kunci = hari diminta, juga hari jawabannya): bilah waktu
  // yang berputar kembali ke hari yang sama tak mengunduh & mengurai ulang
  // ~1 MB tiap putaran. Entri basi tak pernah dipakai lagi, jadi dibuang —
  // tab yang lama terbuka tak menimbun satu hari untuk tiap tanggal.
  const simpananHotspotRef = useRef(new Map<string, { data: DataHotspot; waktu: number }>());
  // Unduhan yang sedang berjalan, satu per hari. Tak dibatalkan saat bilah
  // waktu pindah hari: di jaringan lambat putar otomatis lebih cepat dari
  // unduhannya, jadi tiap unduhan dibiarkan selesai dan masuk simpanan.
  const unduhanHotspotRef = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const unduhan = unduhanHotspotRef.current;
    return () => {
      unduhan.forEach((p) => p.abort());
      unduhan.clear();
    };
  }, []);
  /** `paksa`: lewati simpanan — coba ulang saat galat/basi. */
  const ambilHotspot = useCallback((paksa = false) => {
    const kunci = hariHotspotRef.current ?? "";
    const simpan = simpananHotspotRef.current.get(kunci);
    if (simpan && !paksa && !hotspotBasi(simpan.waktu)) {
      waktuAmbilHotspotRef.current = simpan.waktu;
      setDataHotspot(simpan.data);
      setStatusHotspot("siap");
      return;
    }
    const unduhan = unduhanHotspotRef.current;
    if (unduhan.has(kunci)) return; // hasilnya tampil begitu tiba
    const pengendali = new AbortController();
    unduhan.set(kunci, pengendali);
    // ?v=3: data per hari + kolom kabupaten — lewati tembolok lama.
    fetch(`/api/hotspot?v=3${kunci ? `&hari=${kunci}` : ""}`, { signal: pengendali.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: DataHotspot) => {
        const simpanan = simpananHotspotRef.current;
        simpanan.forEach((v, k) => {
          if (hotspotBasi(v.waktu)) simpanan.delete(k);
        });
        const isi = { data: d, waktu: Date.now() };
        simpanan.set(kunci, isi).set(d.hari, isi);
        // Bilah waktu sudah pindah hari: cukup disimpan.
        const kini = hariHotspotRef.current ?? "";
        if (kini !== kunci && kini !== d.hari) return;
        waktuAmbilHotspotRef.current = isi.waktu;
        setDataHotspot(d);
        setStatusHotspot("siap");
      })
      .catch(() => {
        if (!pengendali.signal.aborted && (hariHotspotRef.current ?? "") === kunci) setStatusHotspot("galat");
      })
      .finally(() => {
        // Sesudah unmount (StrictMode/Activity) kuncinya bisa milik unduhan baru.
        if (unduhan.get(kunci) === pengendali) unduhan.delete(kunci);
      });
  }, []);
  /* Panel Peringkat Hotspot: kolom kiri peta (layar ≥ lg) atau lembar penuh
     menutupi peta (ponsel). Hanya di selayar — bingkai kecil landing & semat
     diperkecil, tabelnya tak terbaca. Bawaan terbuka di layar lebar. */
  const layarLebar = useMediaQuery("(min-width: 1024px)");
  const [alihPeringkat, setAlihPeringkat] = useState<boolean | null>(null);
  const peringkatBuka = !!isPenuh && (alihPeringkat ?? layarLebar);
  // Tujuan fokus saat panel dibentang/diciutkan — lihat onBuka & onTutup.
  const panelPeringkatRef = useRef<HTMLDivElement>(null);
  const tombolPeringkatRef = useRef<HTMLButtonElement>(null);
  /* Ciut/bentang mulus (≥ lg): panel MELUNCUR (transform, GPU) di atas peta;
     lebar kolom tata letak berganti SEKALI — di akhir luncur masuk, di awal
     luncur keluar — saat tepinya tertutup panel. Menganimasikan lebar kolom
     berarti peta MapLibre (kanvas WebGL + lapisan asap) dan hamparannya
     di-resize tiap frame: itulah yang patah-patah. */
  const kurangiGerak = useKurangiGerak();
  const [kolomPenuh, setKolomPenuh] = useState(peringkatBuka);
  if (!peringkatBuka && kolomPenuh) setKolomPenuh(false); // diciutkan: kolom menyempit seketika
  useEffect(() => {
    if (!peringkatBuka || kolomPenuh) return;
    const tunda = setTimeout(() => setKolomPenuh(true), kurangiGerak ? 0 : LAMA_LUNCUR);
    return () => clearTimeout(tunda);
  }, [peringkatBuka, kolomPenuh, kurangiGerak]);
  // Masuk/keluar selayar: kolom langsung di ukuran akhirnya (tanpa jeda luncur),
  // supaya fitBounds selayar PetaAsap sudah memakai padding kiri yang benar.
  const [penuhLalu, setPenuhLalu] = useState(isPenuh);
  if (penuhLalu !== isPenuh) {
    setPenuhLalu(isPenuh);
    setKolomPenuh(peringkatBuka);
  }
  const kolomLebar = peringkatBuka && kolomPenuh;
  /** Lebar kolom di kiri kotak peta (px) — PetaAsap melebarkan kanvasnya sejauh
   *  ini ke bawah kolom, jadi ciut/bentang tak pernah me-resize peta. */
  const lebarKolom = isPenuh && layarLebar ? (kolomLebar ? 300 : 44) : 0;
  /** Yang ditutup panel/bilahnya dari kiri peta pada keadaan AKHIRNYA — berganti
   *  saat tombol ditekan (lebarKolom baru menyusul di akhir luncur masuk). Kanvas
   *  & iframe selalu mulai di tepi kiri layar, jadi ini padding kiri kamera:
   *  kedua peta meluncur ke tengah ruang yang tampak bersama panel. */
  const tutupKiri = isPenuh && layarLebar ? (peringkatBuka ? 300 : 44) : 0;
  // Iframe Windy: logo atribusinya digeser keluar dari balik panel dan
  // petanya digeser ke tengah (SET_KOLOM); kameranya lewat geserBujurWindy.
  const tutupKiriRef = useRef(tutupKiri);
  useEffect(() => {
    tutupKiriRef.current = tutupKiri;
    if (iframeReadyRef.current) kirimData({ type: "SET_KOLOM", kiri: tutupKiri });
  }, [tutupKiri, kirimData]);
  // FIRMS tak terjangkau: coba lagi tiap menit selama lapisannya menyala —
  // pengunjung tak perlu mematikan lalu menyalakan sakelarnya. Bila server
  // melayani data tersimpan (basi), coba tiap 2 menit supaya data baru
  // langsung menggantikannya begitu FIRMS pulih.
  // Ada yang menampilkan data hotspot: lapisan satelit atau panel peringkat.
  const perluHotspot = hotspotAktif || peringkatBuka;
  useEffect(() => {
    if (!perluHotspot) return;
    const gagal = statusHotspot === "galat";
    const siap = statusHotspot === "siap";
    if (!gagal && !(siap && dataHotspot?.basi)) return;
    const penunda = setTimeout(() => {
      if (gagal) setStatusHotspot("memuat");
      ambilHotspot(true);
    }, gagal ? 60_000 : 120_000);
    return () => clearTimeout(penunda);
  }, [statusHotspot, perluHotspot, dataHotspot, ambilHotspot]);
  /** `s`: indeks SATELIT_HOTSPOT. */
  const alihLapisanHotspot = (s: number) => {
    const nyala = !satelitAktif[s];
    setSatelitAktif((aktif) => aktif.map((v, i) => (i === s ? nyala : v)));
    const basi = hotspotBasi(waktuAmbilHotspotRef.current);
    // !perluHotspot: menyalakan lapisan pertama memicu efek hari di bawah.
    if (!nyala || !perluHotspot || statusHotspot === "memuat" || (statusHotspot === "siap" && !basi)) return;
    setStatusHotspot("memuat");
    ambilHotspot();
  };
  // Baris yang digambar menurut sakelar yang menyala. Dimemo: kedua peta
  // mengisi ulang sumbernya (dan Windy menerima ulang puluhan ribu titik) tiap
  // nilainya berganti.
  const hotspotTampil = useMemo(() => {
    if (!dataHotspot || !satelitAktif.some(Boolean)) return null;
    return { ...dataHotspot, titik: susunTitikTampil(dataHotspot, satelitAktif) };
  }, [dataHotspot, satelitAktif]);
  const perSatelit = useMemo(() => (dataHotspot ? hitungPerSatelit(dataHotspot) : null), [dataHotspot]);
  // Label hari legenda, lencana & panel Lapisan: hari terbaru (`sejak`) = 24 jam terakhir.
  const labelHariHotspot = dataHotspot && (dataHotspot.sejak ? t.jam24 : formatHariPeta(dataHotspot.hari, bahasa));

  // Iframe Windy menerima [lng, lat, kepercayaan, satelit, FRP, waktu, malam,
  // indeks provinsi] + daftar provinsi (gambar & kartu info titik); disimpan
  // juga untuk dikirim ulang setiap iframe (ulang) siap. Hanya selama Windy
  // tampil: di balik Aerosol tiap ganti hari mengirim puluhan ribu titik yang
  // lalu diurut & diproyeksikan ulang percuma. Kembali ke Windy mengirimnya.
  const hotspotWindyRef = useRef<{ type: "SET_HOTSPOT"; titik: number[][] | null; provinsi: string[] }>({
    type: "SET_HOTSPOT",
    titik: null,
    provinsi: [],
  });
  useEffect(() => {
    if (mode !== "windy") return;
    hotspotWindyRef.current = {
      type: "SET_HOTSPOT",
      titik: hotspotTampil
        ? hotspotTampil.titik.map((t) => [t[0], t[1], t[2], t[5], t[3], t[4], t[7], t[6]])
        : null,
      provinsi: hotspotTampil?.provinsi ?? [],
    };
    if (iframeReadyRef.current) kirimData(hotspotWindyRef.current);
  }, [hotspotTampil, mode, kirimData]);

  /* Bilah waktu lapisan Angin — tampilannya di sini (rupa sama persis dengan
     bilah waktu Aerosol), mesinnya di iframe: progres pecahan, frame AQI +
     angin dari /api/udara yang dibaurkan di GPU (lihat "Lapisan udara" di
     app/api/forecasting/route.ts). PUTAR_UDARA / SET_PROGRES / GESER_UDARA
     keluar; LINIMASA_UDARA (daftar langkah) dan WAKTU_UDARA (progres, tiap
     frame selama berputar/digeser) masuk.
     Seperti bilah waktu Aerosol, posisi slider & label waktu ditulis langsung
     ke DOM (tampilkanWaktuWindy) — me-render ulang seluruh Peta tiap pesan
     membuat geraknya patah-patah. State statusWindy hanya berubah saat indeks
     langkah, status putar, atau persen unduhan berganti. */
  const [linimasaWindy, setLinimasaWindy] = useState<{
    langkah: LangkahUdara[];
    modelRunWib: string | null;
  } | null>(null);
  const [statusWindy, setStatusWindy] = useState({ memutar: false, menunggu: false, indeks: 0, persenUnduh: 0 });
  const [lajuWindy, setLajuWindy] = useState<1 | 2>(1);
  const lajuWindyRef = useRef<1 | 2>(1);
  // Bilah waktu Windy berputar sendiri (seperti Aerosol) setiap lapisannya
  // dibuka — kecuali pengunjung sendiri yang menjedanya.
  const dijedaPenggunaRef = useRef(false);
  // Progres terakhir (indeks pecahan) — juga diteruskan ke iframe yang dimuat
  // ulang (masuk/keluar selayar) supaya putarannya melanjutkan, bukan mengulang.
  const progresWindyRef = useRef(0);
  const langkahWindyRef = useRef<LangkahUdara[]>([]);
  const sliderWindyRef = useRef<HTMLInputElement | null>(null);
  const labelWindyRef = useRef<HTMLSpanElement | null>(null);
  // Selama slider digeser, laporan iframe tak menimpa posisi jempolnya.
  const geserWindyRef = useRef(false);
  const tampilkanWaktuWindy = useCallback((progres: number) => {
    const langkah = langkahWindyRef.current;
    const n = langkah.length;
    const slider = sliderWindyRef.current;
    if (slider && n > 1) {
      slider.value = progres.toFixed(2);
      slider.style.setProperty("--progress-percent", `${((Math.min(progres, n - 1) / (n - 1)) * 100).toFixed(1)}%`);
    }
    const label = labelWindyRef.current;
    const teks = n ? langkah[Math.floor(progres) % n]?.labelWib : undefined;
    if (label && teks && label.textContent !== teks) label.textContent = teks;
  }, []);

  // Panel "Lapisan peta" — lihat alihPanelAerosol di bawah.
  const [panelLapisan, setPanelLapisan] = useState<{
    kanan: number;
    bawah: number;
    asal: ModePeta;
    penuh: boolean;
  } | null>(null);
  const panelTampil = panelLapisan !== null && panelLapisan.asal === mode && panelLapisan.penuh === isPenuh;
  const tombolLapisanRef = useRef<HTMLButtonElement | null>(null);
  const panelLapisanRef = useRef<HTMLDivElement | null>(null);
  // Klik #btn-lapisan saat panel terbuka memicu blur jendela (panel tutup)
  // lalu pesan ALIH_LAPISAN — tanpa penanda ini panel langsung terbuka lagi.
  const ditutupBlurRef = useRef(0);

  // Aktifkan pemuatan iframe saat pertama kali beralih ke mode Windy
  const handlePilihMode = (m: ModePeta) => {
    if (terkendali) onModeChange?.(m);
    else setModeDalam(m);

    if (m === mode) {
      return;
    }

    if (m === "windy") {
      // Konsol / beranda: samakan kamera dan tingkat zoom persis dengan lapisan Aerosol
      const kamera = kameraAerosolKini(tutupKiriRef.current) ?? (muatNusantara ? kameraWindyNusantara(isPenuh, tutupKiriRef.current) : null);
      if (kamera) {
        kameraTertundaRef.current = kamera;
        if (iframeReadyRef.current) kirimData({ type: "SET_KAMERA", ...kamera });
      }

      if (!hasOpenedWindy && typeof window !== "undefined") {
        const isMobile = window.innerWidth < 640;
        setWindyKamera(
          kamera
            ? `lat=${kamera.lat.toFixed(3)}&lon=${kamera.lon.toFixed(3)}&zoom=${kamera.zoom.toFixed(2)}`
            : isMobile
              ? "lat=-1.000&lon=118.000&zoom=4.20"
              : "lat=0.200&lon=118.000&zoom=5.00"
        );
      }
      setHasOpenedWindy(true);
      // Kembali ke lapisan Angin dengan iframe yang sudah siap: putar lagi.
      // (Pembukaan pertama diputar saat FORECASTING_READY.)
      kirimData({ type: "WINDY_ACTIVE" });
      if (iframeReadyRef.current && !dijedaPenggunaRef.current) {
        kirimData({ type: "PUTAR_UDARA", putar: true, laju: lajuWindyRef.current });
      }
      kirimData({ type: "SET_JUMLAH", jumlahLaporan });
      if (berita && berita.length > 0) {
        kirimData({ type: "SET_EVENTS", events: berita });
      }
    } else if (m === "asap" && hasOpenedWindy) {
      // Animasi Angin tak perlu jalan di balik lapisan Aerosol: putar dijeda
      // (bukan oleh pengunjung — kembali ke Angin memutarnya lagi) dan loop
      // partikel di iframe berhenti total.
      kirimData({ type: "PUTAR_UDARA", putar: false });
      kirimData({ type: "WINDY_NONAKTIF" });
      try {
        const windy = (iframeRef.current?.contentWindow as unknown as {
          W?: { map?: { map?: PetaWindy & { _maplibreMap?: { getZoom: () => number } } } };
        } | null)?.W?.map?.map;
        const aerosol = (window as unknown as {
          _maplibreMap?: { jumpTo: (o: { center: [number, number]; zoom: number }) => void };
        })._maplibreMap;
        if (windy && aerosol) {
          const c = windy.getCenter();
          const z = typeof windy._maplibreMap?.getZoom === "function"
            ? windy._maplibreMap.getZoom()
            : windy.getZoom() - 1;
          aerosol.jumpTo({ center: [c.lng + geserBujurWindy(tutupKiriRef.current, z + 1), c.lat], zoom: z });
        }
      } catch {
        // Iframe belum siap atau tak terjangkau — biarkan kamera Aerosol apa adanya.
      }
    }
  };

  // Update antrean dan kirim hanya jika iframe sudah siap menerima
  useEffect(() => {
    pendingJumlahRef.current = jumlahLaporan;
    if (iframeReadyRef.current) {
      kirimData({
        type: "SET_JUMLAH",
        jumlahLaporan,
      });
    }
  }, [jumlahLaporan, kirimData]);

  // Sinkronisasi data berita/kejadian ke iframe Windy
  useEffect(() => {
    if (iframeReadyRef.current && berita && berita.length > 0) {
      kirimData({
        type: "SET_EVENTS",
        events: berita,
      });
    }
  }, [berita, kirimData]);

  useEffect(() => {
    const saatPesan = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "FORECASTING_READY") {
        iframeReadyRef.current = true;
        setMemuatWindy(false);
        if (resolvedTheme) {
          kirimData({ type: "SET_TEMA", tema: resolvedTheme });
        }
        const kamera =
          kameraTertundaRef.current ?? (isPenuh ? kameraWindyNusantara(true, tutupKiriRef.current) : kameraAerosolKini(tutupKiriRef.current));
        if (kamera) {
          kirimData({ type: "SET_KAMERA", ...kamera });
        }
        kirimData({ type: "SET_KOLOM", kiri: tutupKiriRef.current });
        // Kuras data jumlah laporan dan kejadian yang tertunda saat inisialisasi awal
        if (pendingJumlahRef.current) {
          kirimData({
            type: "SET_JUMLAH",
            jumlahLaporan: pendingJumlahRef.current,
          });
        }
        if (berita && berita.length > 0) {
          kirimData({
            type: "SET_EVENTS",
            events: berita,
          });
        }
        // Di balik Aerosol isi ref basi — efek hotspot mengirimnya saat Windy tampil.
        if (modeRef.current === "windy" && hotspotWindyRef.current.titik) {
          kirimData(hotspotWindyRef.current);
        }
        kirimData({ type: "SET_LAPISAN", ...lapisanRef.current });
        // Iframe dimuat ulang (masuk/keluar selayar): lanjutkan dari posisi
        // terakhir. Pembukaan pertama (linimasa belum pernah diterima) dibiarkan
        // iframe mulai dari langkah terdekat dengan sekarang, seperti Aerosol.
        if (langkahWindyRef.current.length > 0) kirimData({ type: "SET_PROGRES", progres: progresWindyRef.current });
        if (lajuWindyRef.current !== 1) kirimData({ type: "PUTAR_UDARA", laju: lajuWindyRef.current });
        // Putar otomatis begitu peta Windy siap (juga setelah iframe dimuat ulang).
        if (modeRef.current !== "windy") {
          kirimData({ type: "WINDY_NONAKTIF" });
        } else if (!dijedaPenggunaRef.current) {
          kirimData({ type: "PUTAR_UDARA", putar: true, laju: lajuWindyRef.current });
        }
      } else if (data.type === "PILIH_WILAYAH") {
        const rect = iframeRef.current?.getBoundingClientRect();
        const asal = {
          x: (rect?.left ?? 0) + (data.asal?.x ?? 0),
          y: (rect?.top ?? 0) + (data.asal?.y ?? 0),
        };
        onPilihRef.current(data.nama, data.pulau ?? null, asal);
      } else if (data.type === "BUKA_SELAYAR") {
        // Tombol bentang di dalam iframe Windy (route /api/forecasting
        // memasangnya bila query bentang=1): teruskan aksinya ke induk.
        onExpandRef.current?.();
      } else if (data.type === "LINIMASA_UDARA") {
        // Daftar langkah dari metadata /api/udara — sekali per siklus model.
        if (!Array.isArray(data.langkah)) return;
        const langkah: LangkahUdara[] = data.langkah.map((l: { labelWib?: unknown; adalahPrediksi?: unknown; waktu?: unknown }) => ({
          labelWib: typeof l?.labelWib === "string" ? l.labelWib : "",
          adalahPrediksi: Boolean(l?.adalahPrediksi),
          waktu: typeof l?.waktu === "number" && isFinite(l.waktu) ? l.waktu : null,
        }));
        langkahWindyRef.current = langkah;
        setLinimasaWindy({ langkah, modelRunWib: typeof data.modelRunWib === "string" ? data.modelRunWib : null });
        if (!geserWindyRef.current) tampilkanWaktuWindy(progresWindyRef.current);
      } else if (data.type === "WAKTU_UDARA") {
        // Tiap frame layar selama berputar/digeser — DOM ditulis langsung.
        if (typeof data.progres !== "number" || !isFinite(data.progres)) return;
        const n = langkahWindyRef.current.length;
        if (!geserWindyRef.current) {
          progresWindyRef.current = data.progres;
          tampilkanWaktuWindy(data.progres);
        }
        const baru = {
          memutar: Boolean(data.memutar),
          // Putar tertahan menunggu frame berikutnya diunduh (bukan macet).
          menunggu: Boolean(data.memutar && data.menunggu),
          indeks: n ? Math.floor(progresWindyRef.current) % n : 0,
          persenUnduh: data.total > 0 ? Math.round((Math.min(data.terunduh, data.total) / data.total) * 100) : 0,
        };
        // Objek lama dikembalikan bila statusnya sama → React tak me-render.
        setStatusWindy((p) =>
          p.memutar === baru.memutar && p.menunggu === baru.menunggu && p.indeks === baru.indeks && p.persenUnduh === baru.persenUnduh
            ? p
            : baru,
        );
      } else if (data.type === "ALIH_LAPISAN") {
        // Tombol Lapisan di kolom kendali iframe Windy. Kotaknya dalam
        // koordinat logis iframe; iframe mulai offsetLeft bentangnya (−lebar
        // kolom peringkat) dari kiri akar, atasnya sejajar akar.
        if (Date.now() - ditutupBlurRef.current < 400) return; // klik inilah yang menutupnya
        const akar = akarRef.current;
        const k = data.kotak;
        if (!akar || !k || !isFinite(k.left) || !isFinite(k.bottom)) return;
        const kiri = k.left + (bentangWindyRef.current?.offsetLeft ?? 0);
        // Alih menurut panel yang TAMPIL — state basi dari bingkai lain
        // (sebelum masuk/keluar selayar) tersembunyi, jadi dibuka ulang.
        setPanelLapisan((p) =>
          p && p.asal === "windy" && p.penuh === isPenuh
            ? null
            : { kanan: akar.offsetWidth - kiri + 8, bawah: akar.offsetHeight - k.bottom, asal: "windy", penuh: isPenuh },
        );
      } else if (data.type === "BUKA_RINCIAN_KEJADIAN") {
        const ketemu = berita?.find((b) => b.id === data.eventId || b.slug === data.slug);
        if (ketemu && onBukaRincian) {
          onBukaRincian(ketemu);
        }
      } else if (data.type === "SELA_LEGENDA") {
        setSelaLegendaWindy(typeof data.tinggi === "number" ? data.tinggi : 0);
      } else if (data.type === "IFRAME_WHEEL") {
        let rawDeltaY = data.deltaY || 0;
        if (data.deltaMode === 1) rawDeltaY *= 16.67;
        else if (data.deltaMode === 2) rawDeltaY *= window.innerHeight;
        const deltaY = rawDeltaY * 0.75;

        const lenis = (window as unknown as {
          lenis?: {
            scrollTo: (t: number, opts?: Record<string, unknown>) => void;
            scroll: number;
            targetScroll?: number;
            limit?: number;
          };
        }).lenis;

        if (lenis && typeof lenis.scrollTo === "function") {
          const max = lenis.limit ?? (document.documentElement.scrollHeight - window.innerHeight);
          const current = typeof lenis.targetScroll === "number" ? lenis.targetScroll : lenis.scroll;
          const target = Math.max(0, Math.min(max, current + deltaY));
          lenis.scrollTo(target, { programmatic: false });
        } else {
          window.scrollBy({ top: deltaY, behavior: "auto" });
        }
      }
    };

    window.addEventListener("message", saatPesan);
    return () => window.removeEventListener("message", saatPesan);
  }, [kirimData, berita, onBukaRincian, isPenuh, resolvedTheme, tampilkanWaktuWindy]);

  // Siarkan pergantian tema secara langsung ke iframe Windy
  useEffect(() => {
    if (iframeReadyRef.current && resolvedTheme) {
      kirimData({ type: "SET_TEMA", tema: resolvedTheme });
    }
  }, [resolvedTheme, kirimData]);

  /* Saat mode selayar dibuka ATAU ditutup, sesuaikan kamera Windy dinamis ke
     Nusantara. Sela selayar dan sela bingkai kecil berbeda jauh, jadi tanpa
     cabang tutup iframe tertinggal di kamera selayar yang jauh lebih rapat —
     bingkai kecil lalu memotong Sumatra dan Papua.

     Dikunci ke perubahan isPenuh saja; `mode` dibaca lewat ref. Kalau `mode`
     ikut jadi dependensi, tiap ganti tab kamera dipaksa balik ke framing
     Nusantara dan geseran/zoom pengunjung hilang — padahal handlePilihMode
     sudah menyamakan kamera antar-tab dari kamera Aerosol yang sedang tampil.
     (modeRef dideklarasikan di dekat `mode` — pendengar pesan iframe juga
     membacanya.) */
  useEffect(() => {
    if (modeRef.current !== "windy") return;
    if (!isPenuh && !muatNusantara) return;
    // Satu frame: wadah MapLibre adalah acuan selaNusantara, jadi ia harus
    // sudah memakai ukuran barunya sebelum kameranya dihitung.
    const frameId = requestAnimationFrame(() => {
      const kamera = kameraWindyNusantara(isPenuh, tutupKiriRef.current);
      if (!kamera) return;
      kameraTertundaRef.current = kamera;
      if (iframeReadyRef.current) kirimData({ type: "SET_KAMERA", ...kamera });
    });
    return () => cancelAnimationFrame(frameId);
  }, [isPenuh, muatNusantara, kirimData]);

  // Saat resize dalam mode selayar, sesuaikan kamera Windy dinamis
  useEffect(() => {
    if (!isPenuh || mode !== "windy") return;
    const penanganResize = () => {
      const kamera = kameraWindyNusantara(true, tutupKiriRef.current);
      if (kamera && iframeReadyRef.current) {
        kirimData({ type: "SET_KAMERA", ...kamera });
      }
    };
    window.addEventListener("resize", penanganResize);
    return () => window.removeEventListener("resize", penanganResize);
  }, [isPenuh, mode, kirimData]);

  /* Konsol /peta: saat rel dilipat bingkai berubah ukuran tiap frame. Kalau
     iframe Windy ikut di-resize tiap frame, petanya patah-patah dan zoomnya
     tetap — wilayah yang tampil melebar. Maka selama bingkai berubah, iframe
     dikunci di ukuran lama dan hanya diskalakan (transform, ringan; rasio
     bingkai tetap jadi tak gepeng). Begitu ukuran diam, iframe dilepas ke
     ukuran baru sekali, dan zoom Windy digeser log2(lebar baru/lama) supaya
     wilayahnya tetap sama persis. Yang diamati bentang iframe (lebar tetap
     saat kolom peringkat diciutkan/dibentang), bukan lapisnya: ciut/bentang
     tak pernah sampai ke sini. */
  const lapisWindyRef = useRef<HTMLDivElement | null>(null);
  const bentangWindyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const lapis = bentangWindyRef.current;
    if (!zoomRoda || !hasOpenedWindy || !lapis) return;
    let ukuran = { w: lapis.clientWidth, h: lapis.clientHeight };
    let penunda: ReturnType<typeof setTimeout> | undefined;
    const amati = new ResizeObserver(() => {
      const ifr = iframeRef.current;
      const w = lapis.clientWidth;
      const h = lapis.clientHeight;
      if (!ifr || !w || !h || !ukuran.w) return;
      ifr.style.width = `${ukuran.w}px`;
      ifr.style.height = `${ukuran.h}px`;
      ifr.style.transformOrigin = "0 0";
      ifr.style.transform = `scale(${w / ukuran.w})`;
      clearTimeout(penunda);
      penunda = setTimeout(() => {
        const wBaru = lapis.clientWidth;
        const hBaru = lapis.clientHeight;
        const seragam = Math.abs(wBaru / hBaru - ukuran.w / ukuran.h) < 0.02;
        const delta = Math.log2(wBaru / ukuran.w);
        const deltaKirim = seragam && Math.abs(delta) > 0.001 ? delta : 0;
        requestAnimationFrame(() => {
          // Lepas ukuran iframe lalu — dalam tugas yang sama, sebelum frame
          // dilukis — minta Windy me-resize kanvas, menggeser zoom, dan
          // menggambar ulang lewat panggilan langsung (iframe satu origin).
          // Event resize iframe baru jalan SETELAH parent melukis satu frame,
          // jadi mengandalkannya menampilkan kanvas basi sekejap (berkedip).
          ifr.style.width = "";
          ifr.style.height = "";
          ifr.style.transform = "";
          ifr.style.transformOrigin = "";
          let sinkron = false;
          try {
            const skala = (ifr.contentWindow as unknown as { __skalaKonsol?: (d: number) => void } | null)?.__skalaKonsol;
            if (typeof skala === "function") {
              skala(deltaKirim);
              sinkron = true;
            }
          } catch {
            // Tak terjangkau (beda origin) — pakai jalur pesan di bawah.
          }
          if (!sinkron && deltaKirim) kirimData({ type: "SKALA_ZOOM", delta: deltaKirim });
        });
        ukuran = { w: wBaru, h: hBaru };
      }, 160);
    });
    amati.observe(lapis);
    return () => {
      amati.disconnect();
      clearTimeout(penunda);
    };
  }, [zoomRoda, hasOpenedWindy, kirimData]);

  const [bukaInfoPerbedaan, setBukaInfoPerbedaan] = useState(false);
  const [tabPanduan, setTabPanduan] = useState<TabPanduan>("aerosol");

  /* Bagikan peta sematan (app/[locale]/embed). URL dirangkai saat tombol
     ditekan — butuh window.location untuk origin + bahasa aktif. */
  const [semat, setSemat] = useState<{ tautan: string; kode: string } | null>(null);
  const [tersalin, setTersalin] = useState<"tautan" | "kode" | null>(null);
  const bukaSemat = () => {
    const bahasa = /^\/en(\/|$)/.test(window.location.pathname) ? "en" : "id";
    const tautan = `${window.location.origin}/${bahasa}/embed`;
    setSemat({
      tautan,
      kode: `<iframe src="${tautan}" width="100%" height="720" style="border:0" loading="lazy" allowfullscreen title="Peta Sebaran Asap Karhutla"></iframe>`,
    });
    setTersalin(null);
  };
  const salin = (jenis: "tautan" | "kode", teks: string) => {
    navigator.clipboard.writeText(teks).then(() => setTersalin(jenis), () => {});
  };

  /* Panel "Lapisan peta" — dibuka dari tombol Lapisan di ujung kolom kendali
     kanan: tombolLapisan (slotKendali PetaAsap) di lapisan Aerosol, dan
     #btn-lapisan di iframe Windy (pesan ALIH_LAPISAN). Panelnya dirender di
     sini, dijangkarkan ke tombol: terbuka ke kiri, rata dasar tombol, tumbuh
     ke atas — di bingkai kecil landing (403px logis) bawahnya tak cukup.
     `penuh` & `asal` menyembunyikannya bila jangkarnya berpindah (masuk/keluar
     selayar, ganti peta dasar) tanpa perlu efek penutup. State-nya dideklarasikan
     di atas, dekat state hotspot — pendengar pesan iframe ikut memakainya. */
  const alihPanelAerosol = () => {
    if (panelTampil) {
      setPanelLapisan(null);
      return;
    }
    const akar = akarRef.current;
    const tombol = tombolLapisanRef.current;
    if (!akar || !tombol) return;
    // Koordinat layar → logis: bingkai landing diperkecil transform:scale.
    const ra = akar.getBoundingClientRect();
    const rt = tombol.getBoundingClientRect();
    const s = ra.width / akar.offsetWidth || 1;
    setPanelLapisan({ kanan: (ra.right - rt.left) / s + 8, bawah: (ra.bottom - rt.bottom) / s, asal: "asap", penuh: isPenuh });
  };
  useEffect(() => {
    if (!panelLapisan) return;
    const tutupLuar = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelLapisanRef.current?.contains(t) || tombolLapisanRef.current?.contains(t)) return;
      setPanelLapisan(null);
    };
    const tutupEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPanelLapisan(null);
      // Kembalikan fokus ke tombol Lapisan yang membukanya.
      if (modeRef.current === "asap") tombolLapisanRef.current?.focus();
      else iframeRef.current?.contentDocument?.getElementById("btn-lapisan")?.focus();
    };
    const tutupBlur = () => {
      ditutupBlurRef.current = Date.now();
      setPanelLapisan(null);
    };
    // Fase tangkap: kanvas MapLibre menangani pointerdown-nya sendiri.
    document.addEventListener("pointerdown", tutupLuar, true);
    document.addEventListener("keydown", tutupEsc);
    window.addEventListener("blur", tutupBlur);
    panelLapisanRef.current?.querySelector<HTMLElement>('[role="switch"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", tutupLuar, true);
      document.removeEventListener("keydown", tutupEsc);
      window.removeEventListener("blur", tutupBlur);
    };
  }, [panelLapisan]);

  /* Dropdown peta dasar (kiri atas). Tertutup saat klik di luar, Escape, atau
     saat jendela kehilangan fokus — klik di dalam iframe Windy tak memicu
     pointerdown di dokumen ini, tapi memindah fokus ke iframe. */
  const [bukaPilihan, setBukaPilihan] = useState(false);
  const pilihanRef = useRef<HTMLDivElement | null>(null);
  const pemicuPilihanRef = useRef<HTMLButtonElement | null>(null);
  const menuPilihanRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!bukaPilihan) return;
    const tutupLuar = (e: PointerEvent) => {
      if (!pilihanRef.current?.contains(e.target as Node)) setBukaPilihan(false);
    };
    const tutupEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setBukaPilihan(false);
      pemicuPilihanRef.current?.focus();
    };
    const tutup = () => setBukaPilihan(false);
    document.addEventListener("pointerdown", tutupLuar, true);
    document.addEventListener("keydown", tutupEsc);
    window.addEventListener("blur", tutup);
    // Fokus ke peta dasar aktif supaya panah atas/bawah langsung bisa dipakai.
    menuPilihanRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", tutupLuar, true);
      document.removeEventListener("keydown", tutupEsc);
      window.removeEventListener("blur", tutup);
    };
  }, [bukaPilihan]);
  const gerakFokusPilihan = (e: KeyboardEventReact<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const item = [...(menuPilihanRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const i = item.indexOf(document.activeElement as HTMLElement);
    item[(i + (e.key === "ArrowDown" ? 1 : -1) + item.length) % item.length]?.focus();
  };
  const lapisanAktif = LAPISAN.find((l) => l.mode === mode) ?? LAPISAN[0];

  /* Pil alih mode versi rapat untuk bingkai dasbor — sedikit lebih kecil
     dari versi fullscreen beranda. */
  const kelasPil = `flex cursor-pointer items-center gap-1 sm:gap-2 rounded-full font-semibold transition-all ${
    tombolRapat ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs"
  }`;

  const kelasInfo = `flex cursor-pointer items-center justify-center rounded-full bg-white/90 border border-black/[0.08] text-tinta shadow-sm hover:bg-white hover:text-tinta dark:bg-pantau-konsol/90 dark:border-white/10 dark:text-white dark:hover:bg-white/10 dark:hover:text-white dark:shadow-2xl dark:ring-1 dark:ring-white/20 backdrop-blur-md transition-all active:scale-95 ${
    tombolRapat ? "h-7 w-7" : "h-8 w-8 sm:h-9 sm:w-9"
  }`;

  /* Bilah waktu lapisan Angin — lihat linimasaWindy. Legenda hotspot di atas logo
     Windy naik ke atas bilah ini bila bilahnya melebar sampai sisi kiri
     (ponsel, bingkai sempit); di layar lega keduanya berdampingan. Tetap tampil
     walau sakelar Angin mati: hari hotspot & panel peringkat mengikutinya. */
  const adaLinimasaWindy = mode === "windy" && linimasaWindy !== null && linimasaWindy.langkah.length > 1;
  const langkahWindyKini = linimasaWindy?.langkah[statusWindy.indeks];
  // Hari data hotspot = hari (WIB) langkah bilah waktu peta dasar yang tampil.
  // Bilah waktu belum melapor → hari terbaru. Server mengganti hari tanpa data
  // (prakiraan, > 7 hari lalu) dengan hari tersedia terdekat.
  const waktuWindy = adaLinimasaWindy ? langkahWindyKini?.waktu : null;
  const hariTerpilih = mode === "asap" ? hariAsap : waktuWindy != null ? hariWib(waktuWindy) : null;
  // Tanpa lapisan hotspot & panel peringkat tak ada yang diunduh; menyalakan
  // salah satunya mengambil hari yang sedang tampil.
  useEffect(() => {
    hariHotspotRef.current = hariTerpilih;
    if (perluHotspot) ambilHotspot();
  }, [hariTerpilih, perluHotspot, ambilHotspot]);
  // Bilah waktu diam di satu hari & tab lama terbuka: tak ada pergantian hari
  // yang memicu efek di atas. Tanya ulang tiap UMUR_DATA_HOTSPOT selama tab
  // terlihat (selaras cron 30 menit); kembali ke tab → salinan basi diambil ulang.
  useEffect(() => {
    if (!perluHotspot) return;
    const tiap = setInterval(() => {
      if (!document.hidden) ambilHotspot(true);
    }, UMUR_DATA_HOTSPOT);
    const saatTerlihat = () => {
      if (!document.hidden) ambilHotspot();
    };
    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      clearInterval(tiap);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, [perluHotspot, ambilHotspot]);
  const prediksiWindy = Boolean(langkahWindyKini?.adalahPrediksi);
  const linimasaWindyRef = useRef<HTMLDivElement | null>(null);
  // null = jarak bawaan di atas logo Windy (kelas bottom-[88px] sm:bottom-[66px]).
  const [legendaWindyBawah, setLegendaWindyBawah] = useState<number | null>(null);
  useEffect(() => {
    const el = linimasaWindyRef.current;
    const lapis = lapisWindyRef.current;
    if (!adaLinimasaWindy || !el || !lapis) return;
    // Legenda: left-5 (20px) + w-60 (240px) + sela 8px. Bila bilah waktu
    // menjangkau area itu, legenda naik tepat 8px di atas bilahnya.
    const amati = new ResizeObserver(() => {
      setLegendaWindyBawah(el.offsetLeft < 268 ? lapis.clientHeight - el.offsetTop + 8 : null);
    });
    amati.observe(el);
    amati.observe(lapis);
    return () => amati.disconnect();
  }, [adaLinimasaWindy]);
  // Slider baru terpasang (pertama dibuka / kembali dari Aerosol): isi posisinya.
  useEffect(() => {
    if (adaLinimasaWindy) tampilkanWaktuWindy(progresWindyRef.current);
  }, [adaLinimasaWindy, tampilkanWaktuWindy]);
  // Lompat/geser dari bilah waktu — sama seperti Aerosol, putar tak dihentikan.
  const setelProgresWindy = (progres: number) => {
    progresWindyRef.current = progres;
    tampilkanWaktuWindy(progres);
    kirimData({ type: "SET_PROGRES", progres });
  };
  const lompatWindy = (arah: -1 | 1) => {
    const n = langkahWindyRef.current.length;
    if (n < 2) return;
    const kini = Math.floor(progresWindyRef.current);
    setelProgresWindy(arah === -1 ? Math.max(0, kini - 1) : (kini + 1) % n);
  };
  // Scrubbing ala handlePointerDown Aerosol: jempol langsung melompat ke titik
  // tekan, progres ditahan selama ditekan, putar berlanjut setelah dilepas.
  const mulaiGeserWindy = (e: PointerEventReact<HTMLInputElement>) => {
    geserWindyRef.current = true;
    const kotak = e.currentTarget.getBoundingClientRect();
    const n = langkahWindyRef.current.length;
    let progres: number | undefined;
    if (kotak.width > 0 && n > 1) {
      progres = Math.max(0, Math.min(1, (e.clientX - kotak.left) / kotak.width)) * (n - 1);
      progresWindyRef.current = progres;
      tampilkanWaktuWindy(progres);
    }
    kirimData({ type: "GESER_UDARA", geser: true, progres });
    const lepas = () => {
      geserWindyRef.current = false;
      kirimData({ type: "GESER_UDARA", geser: false });
      window.removeEventListener("pointerup", lepas);
      window.removeEventListener("pointercancel", lepas);
    };
    window.addEventListener("pointerup", lepas);
    window.addEventListener("pointercancel", lepas);
  };
  const alihPutarWindy = () => {
    const putar = !statusWindy.memutar;
    dijedaPenggunaRef.current = !putar;
    kirimData({ type: "PUTAR_UDARA", putar, laju: lajuWindy });
  };
  const alihLajuWindy = () => {
    const laju = lajuWindy === 1 ? 2 : 1;
    setLajuWindy(laju);
    lajuWindyRef.current = laju;
    kirimData({ type: "PUTAR_UDARA", laju });
  };

  /* Tombol Lapisan untuk ujung kolom kendali PetaAsap (slotKendali) — gaya &
     ukurannya sama dengan tombol navigasi di atasnya. Titik merah = lapisan
     hotspot sedang menyala. Padanannya di iframe Windy: #btn-lapisan. */
  const tombolLapisan = (
    <button
      ref={tombolLapisanRef}
      type="button"
      onClick={alihPanelAerosol}
      aria-haspopup="dialog"
      aria-expanded={panelTampil}
      aria-label="Lapisan peta"
      title="Lapisan peta"
      className={`relative cursor-pointer flex items-center justify-center rounded-xl bg-white/90 border border-black/[0.08] text-tinta shadow-sm hover:bg-white hover:text-tinta dark:bg-pantau-konsol/90 dark:border-white/10 dark:text-white dark:hover:bg-white/10 dark:hover:text-white dark:ring-1 dark:ring-white/15 backdrop-blur-md transition-transform active:scale-90 ${legendaRingkas ? "h-7 w-7" : "h-9 w-9"}`}
    >
      <svg viewBox="0 0 24 24" width={legendaRingkas ? 13 : 16} height={legendaRingkas ? 13 : 16} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2 2 7l10 5 10-5-10-5Z" />
        <path d="m2 17 10 5 10-5" />
        <path d="m2 12 10 5 10-5" />
      </svg>
      {hotspotAktif && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-white dark:ring-pantau-konsol"
          style={{ background: WARNA_SIPONGI[2] }}
          aria-hidden="true"
        />
      )}
    </button>
  );

  /* Legenda hotspot ringkas — di lapisan Aerosol jadi bagian kartu legenda
     Aerosol (slotLegenda PetaAsap, satu tempat), di lapisan Angin kartu
     sendiri di atas logo dalam iframe Windy. Hanya saat ada lapisan hotspot
     yang menyala dan peta selayar — di bingkai kecil beranda ruangnya terlalu
     sempit (titiknya tetap tampil). Sakelarnya ada di panel Lapisan, jadi
     status muat/gagal dikabarkan di sini. */
  const legendaHotspot = hotspotAktif && isPenuh ? (
    <div role="status" className="text-[10.5px]">
      <div className="flex items-center gap-1.5 font-medium text-tinta/60 dark:text-white/50">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusHotspot === "memuat" ? "animate-pulse" : ""}`}
          style={{ background: WARNA_SIPONGI[2] }}
          aria-hidden="true"
        />
        {t.hotspotFirms}{labelHariHotspot ? `, ${labelHariHotspot}` : ""}
      </div>
      {statusHotspot === "memuat" && !dataHotspot && <p className="mt-1 text-tinta/60 dark:text-white/55">{t.memuatSatelit}</p>}
      {statusHotspot === "galat" && <p className="mt-1 leading-snug text-amber-700 dark:text-amber-400">{t.firmsGagal}</p>}
      {dataHotspot && perSatelit && (
        <>
          {SATELIT_HOTSPOT.map((satelit, s) => satelitAktif[s] && (
            <div key={s} className="mt-1 flex items-center gap-1.5 tabular-nums">
              <span className="flex shrink-0 gap-px" aria-hidden="true">
                {[0, 1, 2].map((k) => (
                  <IkonHotspot key={k} s={s} k={k} />
                ))}
              </span>
              <span className="text-tinta/75 dark:text-white/70">{satelit.label.replace("NASA-", "")}</span>
              <span className="ml-auto font-semibold">{angka(perSatelit[s].reduce((a, b) => a + b, 0))}</span>
            </div>
          ))}
          {/* Warna = tingkat kepercayaan, sama untuk semua bentuk. */}
          <div className="mt-1 flex gap-2.5 text-[10px] text-tinta/55 dark:text-white/50">
            {t.kepercayaan.map((label, k) => (
              <span key={label} className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: WARNA_SIPONGI[k] }} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
          {dataHotspot.basi && <p className="mt-1 text-amber-700 dark:text-amber-400">{t.dataTersimpan}</p>}
        </>
      )}
    </div>
  ) : null;

  return (
    // isolate: z-index panel peringkat (480) & kendali peta (≤ 500) tak bersaing
    // dengan tetangga peta — pop-up provinsi landing (z-44/45, di overlay
    // selayar yang sama) harus tampil di atas seluruh peta, panel termasuk.
    <div className="relative isolate flex h-full w-full overflow-hidden bg-black">
      {isPenuh && (
        <>
          {/* Kolom tata letak (≥ lg) — 300px hanya saat panel terbentang penuh,
              selain itu bilah tipis RelPeringkatHotspot (tertutup panel saat meluncur). */}
          <div
            className={`hidden shrink-0 border-r border-black/10 dark:border-white/10 lg:block ${kolomLebar ? "lg:w-[300px]" : "lg:w-11"}`}
          >
            {!kolomLebar && (
              <RelPeringkatHotspot
                bahasa={bahasa}
                onBuka={() => {
                  // Bilah ini hilang begitu kolom membentang: fokus pindah ke panel
                  // (flushSync: panel harus sudah tak inert saat difokus).
                  flushSync(() => setAlihPeringkat(true));
                  panelPeringkatRef.current?.focus({ preventScroll: true });
                }}
              />
            )}
          </div>
          {/* Panel selalu terpasang (bentang tak membangun ulang daftarnya);
              tertutup = keluar ke kiri & inert. Ponsel: lembar menutupi peta,
              berhenti di atas laci konsol (--sela-bawah) seperti lapisan Windy. */}
          <div
            ref={panelPeringkatRef}
            id="panel-peringkat-hotspot"
            role="region"
            aria-label={t.peringkat}
            tabIndex={-1}
            inert={!peringkatBuka}
            style={{ transitionDuration: `${LAMA_LUNCUR}ms` }}
            className={`absolute inset-x-0 top-0 bottom-[var(--sela-bawah,0px)] z-[480] outline-none transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none lg:bottom-0 lg:right-auto lg:w-[300px] lg:border-r lg:border-black/10 lg:dark:border-white/10 ${
              peringkatBuka ? "translate-x-0" : "-translate-x-full"
            } ${peringkatBuka && !kolomLebar ? "lg:shadow-2xl" : ""}`}
          >
            <PanelPeringkatHotspot
              bahasa={bahasa}
              data={dataHotspot}
              status={statusHotspot}
              onTutup={() => {
                // Panel jadi inert: fokus kembali ke tombol peringkat di peta, tak jatuh ke <body>.
                tombolPeringkatRef.current?.focus({ preventScroll: true });
                setAlihPeringkat(false);
              }}
            />
          </div>
        </>
      )}
    {/* akarRef di kotak peta, bukan di kerangka: koordinat panel Lapisan dan
        pesan iframe Windy relatif ke peta, tak bergeser oleh kolom panel. */}
    <div
      ref={akarRef}
      onContextMenu={(e) => e.preventDefault()}
      // @container: hamparan PetaAsap & bilah waktu Windy menakar lebar kotak
      // peta, bukan viewport — kolom peringkat memakan 300px darinya.
      className="@container relative h-full min-w-0 flex-1 overflow-hidden bg-black"
    >
      {/* Tombol Alih Mode Layer Peta & Info Perbedaan */}
      <div className={`pointer-events-auto absolute left-4 z-[450] flex items-center gap-1.5 sm:gap-2 sm:left-6 ${tombolRapat ? "top-4" : "top-20"}`}>
        {/* Dropdown peta dasar — pemicunya pil lapisan aktif (gradien yang sama
            dengan pil alih mode sebelumnya). Lapisan tambahan (hotspot) ada di
            panel tombol Lapisan, kolom kendali kanan. */}
        <div ref={pilihanRef} className="relative">
          <div className="flex items-center rounded-full bg-white/90 border border-black/[0.08] text-tinta shadow-sm hover:bg-white dark:bg-pantau-konsol/90 dark:border-white/10 dark:text-white dark:hover:bg-white/10 dark:shadow-2xl dark:ring-1 dark:ring-white/20 p-1 backdrop-blur-md">
            <button
              ref={pemicuPilihanRef}
              type="button"
              onClick={() => setBukaPilihan((b) => !b)}
              aria-haspopup="menu"
              aria-expanded={bukaPilihan}
              aria-label={`Peta dasar: ${lapisanAktif.label}`}
              style={{ background: lapisanAktif.latar }}
              className={`${kelasPil} text-white shadow-md ring-1 ${lapisanAktif.kelasAktif} [text-shadow:_0_1px_2px_rgb(0_0_0_/_70%)]`}
            >
              <span className="text-xs sm:text-sm leading-none">{lapisanAktif.ikon}</span>
              <span>
                <span className="sm:hidden">{lapisanAktif.labelPendek}</span>
                <span className="hidden sm:inline">{lapisanAktif.label}</span>
              </span>
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`shrink-0 transition-transform duration-150 ${bukaPilihan ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>

          {bukaPilihan && (
            <div
              ref={menuPilihanRef}
              role="menu"
              aria-label="Pilih peta dasar"
              onKeyDown={gerakFokusPilihan}
              className="absolute left-0 top-full z-[460] mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-2xl bg-white/95 border border-black/[0.08] p-1.5 text-tinta shadow-xl dark:bg-pantau-konsol/95 dark:border-white/10 dark:text-white dark:shadow-2xl dark:ring-1 dark:ring-white/15 backdrop-blur-md"
            >
              {LAPISAN.map((l) => {
                const terpilih = l.mode === mode;
                return (
                  <button
                    key={l.mode}
                    type="button"
                    role="menuitemradio"
                    aria-checked={terpilih}
                    onClick={() => {
                      setBukaPilihan(false);
                      handlePilihMode(l.mode);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-api ${
                      terpilih ? "bg-black/[0.05] dark:bg-white/10" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm leading-none shadow-sm"
                      style={{ background: l.latar }}
                      aria-hidden="true"
                    >
                      {l.ikon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-tinta dark:text-white">{l.label}</span>
                      <span className="block text-[10.5px] leading-snug text-tinta/60 dark:text-white/55">{l.keterangan}</span>
                    </span>
                    {terpilih && (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-api" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tombol Buka Panduan Sains & Data */}
        <button
          type="button"
          onClick={() => {
            // Panduan dibuka di tab peta dasar yang sedang tampil.
            setTabPanduan(mode === "windy" ? "angin" : "aerosol");
            setBukaInfoPerbedaan(true);
          }}
          className={kelasInfo}
          aria-label={t.panduan.judul}
          title={t.panduan.judul}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>

        {/* Tombol Sematkan Peta */}
        <button
          type="button"
          onClick={bukaSemat}
          className={kelasInfo}
          aria-label="Sematkan peta"
          title="Sematkan peta"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>

        {/* Tombol Panel Peringkat Hotspot — hanya selayar, seperti panelnya. */}
        {isPenuh && (
          <button
            ref={tombolPeringkatRef}
            type="button"
            onClick={() => setAlihPeringkat(!peringkatBuka)}
            className={`${kelasInfo}${peringkatBuka ? " ring-2 ring-api-peta dark:ring-api-peta!" : ""}`}
            aria-label={t.peringkat}
            aria-expanded={peringkatBuka}
            aria-controls="panel-peringkat-hotspot"
            title={t.peringkat}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M8 6h13M8 12h9M8 18h5M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
        )}
      </div>

      {/* Lencana hari hotspot: muncul sebentar di tengah atas tiap hari
          berganti (key = hari memutar ulang animasinya), supaya pergantian
          hari saat bilah waktu berputar terasa. Pengurang gerak: tak tampil —
          tanggalnya tetap ada di legenda & panel peringkat. */}
      {dataHotspot && (hotspotAktif || peringkatBuka) && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[440] flex justify-center" aria-hidden="true">
          <div
            key={dataHotspot.hari}
            className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/95 px-3 py-1.5 text-[12px] text-tinta opacity-0 shadow-lg backdrop-blur-md motion-safe:animate-[hari-sorot_2400ms_ease-out_forwards] dark:border-white/10 dark:bg-pantau-konsol/95 dark:text-white"
          >
            <span className="h-2 w-2 rounded-full bg-api-peta" />
            <span className="text-tinta/60 dark:text-white/55">Hotspot</span>
            <span className="font-semibold tabular-nums">{labelHariHotspot}</span>
          </div>
        </div>
      )}

      {/* Panel Lapisan peta — lihat panelLapisan. Berisi lapisan tambahan
          yang ditumpangkan di peta dasar mana pun; peta dasarnya sendiri
          dipilih lewat dropdown kiri atas. */}
      {panelTampil && panelLapisan && (
        /* Rel tak kasatmata dari 8px di bawah tepi atas sampai dasar tombol:
           panel rata dasar tombol, tapi bila tak muat (kolom Windy lebih
           pendek tanpa tombol sinkron) `safe` menjatuhkannya ke awal rel —
           tak pernah terpotong tepi atas bingkai. */
        <div
          style={{ right: panelLapisan.kanan, bottom: panelLapisan.bawah }}
          className="pointer-events-none absolute top-2 z-[460] flex flex-col [justify-content:safe_flex-end]"
        >
        <div
          ref={panelLapisanRef}
          role="dialog"
          aria-label="Lapisan peta"
          className="pointer-events-auto w-64 max-w-[calc(100vw-5rem)] rounded-2xl bg-white/95 border border-black/[0.08] p-2.5 text-tinta shadow-xl backdrop-blur-md dark:bg-pantau-konsol/95 dark:border-white/10 dark:text-white dark:shadow-2xl dark:ring-1 dark:ring-white/15"
        >
          <p className="px-1 pb-1.5 text-xs font-semibold">Lapisan peta</p>

          {/* Lapisan bawaan — baris pertama animasi peta dasar yang tampil. */}
          <div className="mb-1.5 border-b border-black/[0.08] pb-1.5 dark:border-white/10">
            {[
              {
                kunci: mode === "asap" ? ("aerosol" as const) : ("angin" as const),
                label: lapisanAktif.label,
                keterangan: lapisanAktif.keterangan,
                ikon: <span className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-black/[0.06] dark:ring-white/10" style={{ background: lapisanAktif.latar }} aria-hidden="true" />,
              },
              {
                kunci: "poligon" as const,
                label: "Batas Provinsi",
                keterangan: "Garis batas wilayah",
                ikon: (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0b2440] ring-1 ring-black/[0.06] dark:ring-white/10" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinejoin="round">
                      <path d="M4 8 10 4l9 3 1 8-6 5-9-3z" />
                    </svg>
                  </span>
                ),
              },
              {
                kunci: "angka" as const,
                label: "Jumlah Laporan",
                keterangan: "Angka laporan per provinsi",
                ikon: (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0b2440] text-xs font-bold tabular-nums text-white ring-1 ring-black/[0.06] dark:ring-white/10" aria-hidden="true">
                    12
                  </span>
                ),
              },
            ].map((l) => (
              <SakelarLapisan
                key={l.kunci}
                ikon={l.ikon}
                label={l.label}
                keterangan={l.keterangan}
                aktif={lapisan[l.kunci]}
                onAlih={() => setLapisan((s) => ({ ...s, [l.kunci]: !s[l.kunci] }))}
              />
            ))}
          </div>

          {/* Lapisan tambahan — sakelar, bukan pilihan: panel tetap terbuka
              supaya titiknya langsung terlihat muncul/hilang di peta. */}
          <p className="px-1 pb-1 text-[10px] text-tinta/55 dark:text-white/50">
            {t.hotspotFirms}, {labelHariHotspot ?? t.perHari}{statusHotspot === "memuat" && hotspotAktif ? `, ${t.memuat}` : ""}
          </p>
          {SATELIT_HOTSPOT.map((satelit, s) => ({
              kunci: s,
              label: satelit.label,
              sensor: satelit.sensor,
              aktif: satelitAktif[s],
              jumlah: perSatelit?.[s]?.reduce((a, b) => a + b, 0),
              // Penanda satelit ini dalam tiga warna kepercayaan.
              ikon: (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center gap-px rounded-lg bg-[#0b2440] ring-1 ring-black/[0.06] dark:ring-white/10" aria-hidden="true">
                  {[0, 1, 2].map((k) => (
                    <IkonHotspot key={k} s={s} k={k} />
                  ))}
                </span>
              ),
            })).map((lapis) => (
            <SakelarLapisan
              key={lapis.label}
              ikon={lapis.ikon}
              label={lapis.label}
              aktif={lapis.aktif}
              onAlih={() => alihLapisanHotspot(lapis.kunci)}
              keterangan={`${lapis.sensor}${statusHotspot === "siap" && lapis.jumlah !== undefined ? ` · ${angka(lapis.jumlah)} ${t.titik}` : ""}${statusHotspot === "galat" ? ` · ${t.firmsGagalSingkat}` : ""}`}
            />
          ))}
        </div>
        </div>
      )}

      {/* Modal Dialog: Sematkan Peta — pola portal yang sama dengan Panduan. */}
      {semat && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-black/60 dark:bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setSemat(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sematkan peta"
            className="relative w-full max-w-lg flex cursor-default flex-col rounded-2xl border border-black/[0.08] bg-white text-tinta dark:border-white/10 dark:bg-pantau-konsol dark:text-white p-4 sm:p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/[0.08] dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-tinta/60 dark:bg-white/60" />
                <h3 className="text-sm font-semibold tracking-wide text-tinta dark:text-white">Sematkan Peta</h3>
              </div>
              <button
                type="button"
                onClick={() => setSemat(null)}
                className="rounded-lg cursor-pointer p-1.5 text-tinta/50 hover:bg-black/[0.06] hover:text-tinta dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                aria-label="Tutup"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-tinta/65 dark:text-white/65">
              Tempelkan kode di bawah ke halaman situs Anda, atau bagikan tautannya langsung.
            </p>

            {([
              ["kode", "Kode sematan (HTML)", semat.kode],
              ["tautan", "Tautan", semat.tautan],
            ] as const).map(([jenis, label, isi]) => (
              <div key={jenis} className="mt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-tinta/45 dark:text-white/40 block">{label}</span>
                <div className="mt-1 flex items-stretch gap-2">
                  <textarea
                    readOnly
                    value={isi}
                    rows={jenis === "kode" ? 4 : 1}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 resize-none rounded-lg border border-black/[0.08] bg-black/[0.03] px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-tinta dark:border-white/10 dark:bg-white/[0.04] dark:text-white/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40"
                  />
                  <button
                    type="button"
                    onClick={() => salin(jenis, isi)}
                    className="shrink-0 cursor-pointer rounded-lg border border-black/[0.08] bg-black/[0.04] px-3 text-xs font-medium text-tinta/80 hover:bg-black/[0.08] hover:text-tinta dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                  >
                    {tersalin === jenis ? "Tersalin ✓" : "Salin"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}

      {/* Modal Dialog: Panduan Peta — di-portal ke body: bingkai peta konsol
          memakai `isolate`, dan fixed di dalamnya akan tertahan di bawah laci
          ponsel serta bilah navigasi. */}
      {bukaInfoPerbedaan && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-black/60 dark:bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setBukaInfoPerbedaan(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-panduan-peta"
            className="relative flex w-full max-w-2xl max-h-[calc(100svh-2rem)] cursor-default flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white text-tinta shadow-2xl dark:border-white/10 dark:bg-pantau-konsol dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.08] px-5 py-3 dark:border-white/10">
              <h3 id="judul-panduan-peta" className="text-sm font-semibold">{t.panduan.judul}</h3>
              <button
                type="button"
                onClick={() => setBukaInfoPerbedaan(false)}
                className="rounded-lg cursor-pointer p-1.5 text-tinta/50 hover:bg-black/[0.06] hover:text-tinta dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                aria-label={t.panduan.tutup}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              {/* Daftar topik: kolom kiri di layar lebar, baris bergulir di ponsel. */}
              <div
                role="tablist"
                aria-label={t.panduan.topikLabel}
                className="flex shrink-0 gap-1 overflow-x-auto border-b border-black/[0.08] p-2 dark:border-white/10 sm:w-56 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:bg-black/[0.02] dark:sm:bg-white/[0.02]"
              >
                {TOPIK_PANDUAN.map((kunci) => {
                  const aktif = kunci === tabPanduan;
                  const topik = t.panduan.topik[kunci];
                  return (
                    <button
                      key={kunci}
                      type="button"
                      role="tab"
                      id={`tab-panduan-${kunci}`}
                      aria-selected={aktif}
                      aria-controls="isi-panduan"
                      onClick={() => setTabPanduan(kunci)}
                      className={`flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl p-1.5 pr-3 text-left transition-colors ${
                        aktif ? "bg-white shadow-sm ring-1 ring-black/[0.08] dark:bg-white/10 dark:ring-white/10" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      <KunciTopik kunci={kunci} />
                      <span className="min-w-0">
                        <span className={`block whitespace-nowrap text-[12px] font-semibold ${aktif ? "" : "text-tinta/70 dark:text-white/70"}`}>{topik.label}</span>
                        <span className="hidden text-[10.5px] text-tinta/50 dark:text-white/45 sm:block">{topik.ringkas}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Tinggi tetap di layar lebar supaya modal tak melompat saat ganti topik. */}
              <div
                id="isi-panduan"
                role="tabpanel"
                aria-labelledby={`tab-panduan-${tabPanduan}`}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:h-[27rem]"
              >
                <h4 className="text-[15px] font-semibold">{t.panduan.topik[tabPanduan].label}</h4>
                <p className="mt-1 text-[13px] leading-relaxed text-tinta/75 dark:text-white/75">
                  {t.panduan.topik[tabPanduan].pembuka}
                </p>
                <dl className="mt-4 space-y-3.5">
                  {tabPanduan === "aerosol" && (
                    <>
                      <BagianPanduan judul={t.panduan.bagian.data}>{t.panduan.aerosol.data}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.caraBaca}>{t.panduan.aerosol.caraBaca}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.rentang}>{t.panduan.aerosol.rentang}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.lapisan}>{t.panduan.aerosol.lapisan}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.sumber}>
                        Contains modified{" "}
                        <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noopener noreferrer" className={kelasTautan}>
                          Copernicus Atmosphere Monitoring Service
                        </a>{" "}
                        information 2026. {t.panduan.aerosol.sumberLanjut}
                      </BagianPanduan>
                    </>
                  )}
                  {tabPanduan === "angin" && (
                    <>
                      <BagianPanduan judul={t.panduan.bagian.data}>{t.panduan.angin.data}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.skalaAqi}>
                        <span className="mt-1 grid gap-1">
                          {SKALA_AQI.map((tingkat, i) => (
                            <span key={tingkat.warna} className="flex items-center gap-2">
                              <span className="h-2.5 w-5 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: tingkat.warna }} aria-hidden="true" />
                              <span className="flex-1">{t.panduan.angin.aqi[i]}</span>
                              <span className="tabular-nums text-tinta/55 dark:text-white/50">{tingkat.rentang}</span>
                            </span>
                          ))}
                        </span>
                      </BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.rentang}>{t.panduan.angin.rentang}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.lapisan}>{t.panduan.angin.lapisan}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.sumber}>
                        Contains modified{" "}
                        <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noopener noreferrer" className={kelasTautan}>
                          Copernicus Atmosphere Monitoring Service
                        </a>{" "}
                        information 2026. {t.panduan.angin.petaDasar}{" "}
                        <a href="https://www.windy.com" target="_blank" rel="noopener noreferrer" className={kelasTautan}>
                          Windy.com
                        </a>
                        .
                      </BagianPanduan>
                    </>
                  )}
                  {tabPanduan === "hotspot" && (
                    <>
                      <BagianPanduan judul={t.panduan.bagian.satelit}>
                        <span className="mt-1 grid gap-1">
                          {t.panduan.hotspot.satelit.map((teks, s) => (
                            <span key={s} className="flex items-center gap-2">
                              <IkonHotspot s={s} k={2} />
                              {teks}
                            </span>
                          ))}
                        </span>
                      </BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.warna}>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {t.panduan.hotspot.kepercayaan.map((label, k) => (
                            <span key={label} className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ background: WARNA_SIPONGI[k] }} aria-hidden="true" />
                              {label}
                            </span>
                          ))}
                        </span>
                        <span className="mt-1 block">{t.panduan.hotspot.warna}</span>
                      </BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.rentang}>{t.panduan.hotspot.rentang}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.detailTitik}>{t.panduan.hotspot.detail}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.catatan}>{t.panduan.hotspot.catatan}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.sumber}>
                        <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noopener noreferrer" className={kelasTautan}>
                          NASA FIRMS
                        </a>{" "}
                        {t.panduan.hotspot.sumberLanjut}
                      </BagianPanduan>
                    </>
                  )}
                  {tabPanduan === "peringkat" && (
                    <>
                      <BagianPanduan judul={t.panduan.bagian.dihitung}>{t.panduan.peringkat.dihitung}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.caraBaca}>{t.panduan.peringkat.caraBaca}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.membuka}>{t.panduan.peringkat.membuka}</BagianPanduan>
                      <BagianPanduan judul={t.panduan.bagian.batas}>{t.panduan.peringkat.batas}</BagianPanduan>
                    </>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Tampilan Layer 1: Native Leaflet CAMS Wildfire Smoke */}
      <div
        className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${
          mode === "asap"
            ? sedangSyncAsap
              ? "opacity-100 pointer-events-auto z-[30]"
              : "opacity-100 pointer-events-auto z-[1]"
            : "opacity-0 pointer-events-none -z-10"
        }`}
      >
        {/* PetaAsap sengaja menunggu dekatPandangan — lihat komentar di atas.
            Sebelum itu kotak ini hanya latar gelap: seluruh UI lapisan (tombol
            mode, panduan) tetap ada, hanya canvas + unduhan framenya yang
            ditunda. */}
        {dekatPandangan && (
          <PetaAsap
            jumlahLaporan={jumlahLaporan}
            onPilihWilayah={onPilihWilayah}
            berita={berita}
            onBukaRincian={onBukaRincian}
            // Tanpa lapisan.aerosol: bilah waktu tetap berputar saat asapnya disembunyikan.
            aktif={mode === "asap"}
            lapisan={lapisan}
            onSyncChange={setSedangSyncAsap}
            legendaRingkas={legendaRingkas}
            muatNusantara={muatNusantara}
            zoomRoda={zoomRoda}
            logoSelulerSrc={logoSelulerSrc}
            logoSelulerAlt={logoSelulerAlt}
            onExpand={onExpand}
            expandLabel={expandLabel}
            isPenuh={isPenuh}
            hotspot={hotspotTampil}
            onWaktu={(ms) => setHariAsap(hariWib(ms))}
            kolomKiri={lebarKolom}
            tutupKiri={tutupKiri}
            slotLegenda={mode === "asap" ? legendaHotspot : null}
            slotKendali={tombolLapisan}
          />
        )}
      </div>

      {/* Tampilan Layer 2: Windy Air Quality & Wind Flow */}
      <div
        ref={lapisWindyRef}
        // Berhenti di atas laci konsol ponsel (--sela-bawah; 0 di panggung)
        // supaya bilah skala & logo Windy tak tertutup laci.
        className={`peta-windy absolute inset-x-0 top-0 bottom-[var(--sela-bawah,0px)] w-full transition-opacity duration-300 ${
          mode === "windy" ? "opacity-100 pointer-events-auto z-[2]" : "opacity-0 pointer-events-none -z-10"
        }`}
      >
        {hasOpenedWindy && (
          /* Rata kanan, melebar lebarKolom ke bawah kolom peringkat (terpotong
             overflow kotak peta): lebarnya tetap saat kolom diciutkan/dibentang,
             jadi iframe tak di-resize — sama dengan kanvas PetaAsap (kolomKiri). */
          <div ref={bentangWindyRef} className="absolute inset-y-0 right-0" style={{ width: `calc(100% + ${lebarKolom}px)` }}>
            <iframe
              ref={iframeRef}
              src={windySrc}
              title="Peta Sebaran Angin dan Kualitas Udara"
              className="h-full w-full border-0"
              allow="geolocation"
              onContextMenu={(e) => e.preventDefault()}
              onLoad={() => {
                if (iframeReadyRef.current && pendingJumlahRef.current) {
                  kirimData({ type: "SET_JUMLAH", jumlahLaporan: pendingJumlahRef.current });
                }
                // load bisa tiba sesudah FORECASTING_READY — jangan hidupkan
                // animasi iframe yang sedang tersembunyi di balik Aerosol.
                kirimData({ type: modeRef.current === "windy" ? "WINDY_ACTIVE" : "WINDY_NONAKTIF" });
                setTimeout(() => setMemuatWindy(false), 1500);
              }}
            />
          </div>
        )}
        {mode === "windy" && memuatWindy && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-black/85 transition-opacity duration-500">
            <div className="flex items-center gap-3 rounded-full bg-white/95 border border-black/[0.08] text-tinta shadow-lg dark:bg-black/75 dark:border-0 dark:ring-1 dark:ring-white/15 dark:text-white/90 px-5 py-2.5 text-sm">
              <svg
                className="h-4 w-4 animate-spin text-api"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Memuat peta angin dan kualitas udara Windy…</span>
            </div>
          </div>
        )}
        {/* Legenda hotspot di atas logo Copernicus dalam iframe Windy — puncak
            logo itu 58px dari dasar iframe (x 20px), 80px di layar < 640px. */}
        {mode === "windy" && legendaHotspot && (
          <div
            className={`pointer-events-none absolute left-5 z-[5] ${adaLinimasaWindy && legendaWindyBawah !== null ? "" : "bottom-[88px] sm:bottom-[66px]"}`}
            style={adaLinimasaWindy && legendaWindyBawah !== null ? { bottom: legendaWindyBawah } : undefined}
          >
            <div className="w-52 rounded-xl border border-black/[0.08] bg-white/90 px-2.5 py-2 text-tinta shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-pantau-konsol/90 dark:text-white dark:ring-1 dark:ring-white/15">
              {legendaHotspot}
            </div>
          </div>
        )}

        {/* Bilah waktu lapisan Angin — markup & kelas sama persis dengan bilah
            waktu PetaAsap; slidernya memakai .timeline-slider dari <style jsx
            global> PetaAsap (selalu terpasang sebelum Windy bisa dibuka).
            Bedanya hanya letak: di atas bilah warna AQI dan logo Windy yang
            menempati dasar iframe (66px dari dasar; 88px di layar < 640px).
            Di layar lega bilah turun ke dasar (satuan rem supaya Tailwind
            mengurutkannya sesudah sm:), tergantung tampilan Windy:
            - desktop (selaLegendaWindy 0): legenda AQI kotak 320px di kanan-
              bawah, jadi bilah 520px di tengah baru lepas darinya mulai
              1216px (76rem) — turun serendah Aerosol: 16px, sejajar logo &
              legenda itu.
            - mobile/tablet: bilah legenda AQI selebar layar menempati dasar
              iframe; mulai 1100px (68,75rem) bilah sudah lepas dari logo
              (x 20–277px), jadi duduk 8px di atas bilah legenda itu. */}
        {adaLinimasaWindy && linimasaWindy && (
          <div
            ref={linimasaWindyRef}
            className={`pointer-events-auto absolute bottom-[88px] sm:bottom-[66px] z-[6] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-black/[0.08] bg-white/95 text-tinta shadow-xl dark:border-white/[0.1] dark:bg-pantau-konsol/90 dark:text-white dark:shadow-2xl backdrop-blur-xl ${
              legendaRingkas
                ? "inset-x-3 sm:inset-x-0 sm:mx-auto sm:w-[330px] sm:max-w-[calc(100%-1.5rem)] p-1.5 sm:px-2.5 sm:py-1.5"
                : `inset-x-3 sm:inset-x-0 sm:mx-auto w-auto sm:w-[520px] p-2 sm:px-4 sm:py-3 ${
                    selaLegendaWindy > 0 ? "@min-[68.75rem]:bottom-[var(--dasar-linimasa)]" : "@min-[76rem]:bottom-4"
                  }`
            }`}
            style={selaLegendaWindy > 0 ? ({ "--dasar-linimasa": `${selaLegendaWindy + 8}px` } as CSSProperties) : undefined}
          >
            <div className={`flex flex-col ${legendaRingkas ? "gap-1" : "gap-1.5 sm:gap-2"}`}>
              {/* Baris Atas: Tombol Putar, Navigasi, Info Waktu & Status */}
              <div className="flex items-center justify-between gap-1 sm:gap-2.5">
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={alihPutarWindy}
                    className={`cursor-pointer flex items-center justify-center rounded-full bg-gradient-to-r from-[#047857] to-[#10b981] text-white shadow-md shadow-emerald-950/60 ring-1 ring-emerald-400/40 hover:brightness-110 active:scale-95 transition-all ${
                      legendaRingkas ? "h-6 w-6 min-w-[24px]" : "h-7 w-7 min-w-[28px] sm:h-8 sm:w-8 sm:min-w-[32px]"
                    }`}
                    aria-label={statusWindy.memutar ? "Jeda animasi angin dan kualitas udara" : "Putar animasi angin dan kualitas udara"}
                  >
                    {statusWindy.memutar ? (
                      <svg viewBox="0 0 24 24" width={legendaRingkas ? "11" : "13"} height={legendaRingkas ? "11" : "13"} fill="currentColor" className="pointer-events-none">
                        <rect x="6" y="5" width="4" height="14" rx="1.5" />
                        <rect x="14" y="5" width="4" height="14" rx="1.5" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width={legendaRingkas ? "11" : "13"} height={legendaRingkas ? "11" : "13"} fill="currentColor" className="ml-0.5 pointer-events-none">
                        <polygon points="6 4 20 12 6 20" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {([-1, 1] as const).map((arah) => (
                    <button
                      key={arah}
                      type="button"
                      onClick={() => lompatWindy(arah)}
                      aria-label={arah === -1 ? "Titik waktu sebelumnya" : "Titik waktu berikutnya"}
                      title={arah === -1 ? "Waktu sebelumnya" : "Waktu berikutnya"}
                      className={`cursor-pointer flex items-center justify-center rounded-lg text-neutral-600 hover:text-tinta hover:bg-black/[0.06] dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.08] active:scale-95 transition-all ${
                        legendaRingkas ? "h-6 w-6 min-w-[24px]" : "h-7 w-7 min-w-[28px] sm:h-8 sm:w-8 sm:min-w-[32px]"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" width={legendaRingkas ? "13" : "15"} height={legendaRingkas ? "13" : "15"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none">
                        <path d={arah === -1 ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
                      </svg>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={alihLajuWindy}
                    title="Kecepatan putar"
                    className={`cursor-pointer flex items-center justify-center rounded-md font-mono font-medium text-neutral-700 hover:text-neutral-900 bg-black/[0.04] hover:bg-black/[0.08] border border-black/[0.08] dark:text-zinc-400 dark:hover:text-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] dark:border-white/[0.08] transition-all ${
                      legendaRingkas ? "h-6 min-w-[24px] px-1 text-[10px]" : "h-7 min-w-[28px] px-1.5 text-[11px] sm:h-8 sm:min-w-[32px] sm:px-2"
                    }`}
                  >
                    {lajuWindy}×
                  </button>
                </div>

                {/* Label Waktu Aktif & Status */}
                <div className="flex flex-col items-end justify-center min-w-0">
                  <div className="flex items-center gap-1.5 text-right min-w-0 justify-end">
                    {statusWindy.persenUnduh < 100 && !legendaRingkas && (
                      <span className="hidden sm:inline-block rounded bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-neutral-600 border border-black/[0.08] dark:bg-white/[0.06] dark:text-zinc-400 dark:border-white/[0.06]">
                        {statusWindy.persenUnduh}%
                      </span>
                    )}
                    {statusWindy.menunggu && (
                      <svg
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="none"
                        className="shrink-0 animate-spin text-neutral-500 dark:text-zinc-400"
                        role="img"
                        aria-label="Memuat data waktu berikutnya"
                      >
                        <title>Memuat data waktu berikutnya…</title>
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    )}
                    {/* Isinya ditulis tampilkanWaktuWindy (DOM langsung). */}
                    <span
                      ref={labelWindyRef}
                      className={`font-semibold tracking-tight text-tinta dark:text-white tabular-nums truncate ${legendaRingkas ? "text-[11px]" : "text-xs sm:text-sm"}`}
                    />

                    <span
                      title={
                        prediksiWindy
                          ? linimasaWindy.modelRunWib
                            ? `Prakiraan model ECMWF CAMS diinisialisasi dari siklus model ${linimasaWindy.modelRunWib}`
                            : "Prakiraan model ECMWF CAMS"
                          : "Analisis model CAMS (kondisi teramati)"
                      }
                      className={`inline-flex items-center gap-1 rounded-full border shrink-0 transition-colors ${
                        legendaRingkas ? "px-1.5 py-0.2 text-[8.5px]" : "px-1.5 sm:px-2 py-0.5 text-[10px]"
                      } ${
                        prediksiWindy
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${prediksiWindy ? "bg-amber-500 animate-pulse dark:bg-amber-400" : "bg-sky-500 dark:bg-sky-400"}`} />
                      <span>{prediksiWindy ? "Prediksi" : "Analisis"}</span>
                    </span>
                  </div>
                  <div className={`text-[9.5px] leading-tight text-neutral-500 dark:text-zinc-400/90 font-mono tracking-tight mt-0.5 truncate max-w-[210px] sm:max-w-[320px] ${legendaRingkas ? "hidden" : "hidden sm:block"}`}>
                    {prediksiWindy ? (
                      <span className="flex items-center gap-1 justify-end">
                        <span className="text-amber-600 dark:text-amber-400/80 font-sans font-medium text-[9px]">Basis Model:</span>
                        <span className="text-neutral-700 dark:text-zinc-300">{linimasaWindy.modelRunWib || "ECMWF CAMS"}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-500 dark:text-zinc-500 font-sans text-[9px]">Analisis model CAMS</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Baris Bawah: Slider Linimasa */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className={`font-medium text-neutral-500 dark:text-zinc-400/80 tabular-nums select-none shrink-0 ${legendaRingkas ? "text-[9px] min-w-[26px]" : "text-[10px] min-w-[32px] sm:min-w-[34px]"}`}>
                  {linimasaWindy.langkah[0]?.labelWib.split(",")[0]}
                </span>
                <div className="relative flex-1 flex items-center">
                  {/* Tak terkendali React: posisinya ditulis tampilkanWaktuWindy. */}
                  <input
                    ref={sliderWindyRef}
                    type="range"
                    min={0}
                    max={linimasaWindy.langkah.length - 1}
                    step={0.01}
                    defaultValue={0}
                    onPointerDown={mulaiGeserWindy}
                    onChange={(e) => setelProgresWindy(Number(e.target.value))}
                    aria-label="Geser linimasa waktu angin dan kualitas udara"
                    className="timeline-slider cursor-pointer"
                    style={JEJAK_SLIDER_ANGIN}
                  />
                </div>
                <span className={`font-medium text-neutral-500 dark:text-zinc-400/80 tabular-nums select-none shrink-0 text-right ${legendaRingkas ? "text-[9px] min-w-[26px]" : "text-[10px] min-w-[32px] sm:min-w-[34px]"}`}>
                  {linimasaWindy.langkah[linimasaWindy.langkah.length - 1]?.labelWib.split(",")[0]}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
