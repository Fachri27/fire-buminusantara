"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

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

/** Bagian peta MapLibre lapisan Aerosol yang dibaca untuk menyamakan kamera
 *  Windy — diakses lewat window supaya peta.tsx tak mengimpor maplibre-gl. */
type PetaAerosol = {
  getContainer: () => HTMLElement;
  cameraForBounds: (
    batas: [[number, number], [number, number]],
    opsi: { padding: { top: number; bottom: number; left: number; right: number } },
  ) => { center: { lng: number; lat: number } | [number, number]; zoom?: number } | undefined;
};

/** Kamera Windy yang sama dengan kamera Nusantara lapisan Aerosol, atau null
 *  bila peta Aerosol belum siap. Zoom Windy (skala Leaflet) = zoom MapLibre + 1
 *  — lihat catatan tombol rumah di app/api/forecasting/route.ts. */
function kameraWindyNusantara(isPenuh?: boolean): { lat: number; lon: number; zoom: number } | null {
  const peta = (window as unknown as { _maplibreMap?: PetaAerosol })._maplibreMap;
  if (!peta) return null;
  const kamera = peta.cameraForBounds(BATAS_NUSANTARA, { padding: selaNusantara(peta.getContainer(), isPenuh) });
  if (!kamera || kamera.zoom === undefined) return null;
  const [lon, lat] = Array.isArray(kamera.center) ? kamera.center : [kamera.center.lng, kamera.center.lat];
  return { lat, lon, zoom: kamera.zoom + 1 };
}

/** Bagian peta Leaflet milik Windy di dalam iframe (satu origin dengan
 *  halaman) yang dipakai untuk membaca kameranya. */
type PetaWindy = {
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
};

/** Kamera lapisan Aerosol saat ini dalam skala zoom Windy (+1), atau null. */
function kameraAerosolKini(): { lat: number; lon: number; zoom: number } | null {
  const peta = (window as unknown as {
    _maplibreMap?: { getCenter: () => { lat: number; lng: number }; getZoom: () => number };
  })._maplibreMap;
  if (!peta) return null;
  const c = peta.getCenter();
  return { lat: c.lat, lon: c.lng, zoom: peta.getZoom() + 1 };
}

/** Mode lapisan peta — diangkat ke luar supaya konsol /peta bisa
 *  menyelaraskan aksen rel kiri (titik + badge) dengan tema lapisan aktif:
 *  asap = ungu berbahaya #49006A, windy = oren bara. */
export type ModePeta = "asap" | "windy";

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
};

export function Peta({ jumlahLaporan, onPilihWilayah, berita, onBukaRincian, legendaRingkas = false, tombolRapat = false, muatNusantara = false, mode: modeLuar, onModeChange, zoomRoda = false, logoSelulerSrc = null, logoSelulerAlt, onExpand = null, expandLabel, isPenuh = false }: Props) {
  const [modeDalam, setModeDalam] = useState<ModePeta>("asap");
  // Terkendali kalau induk mengisi prop mode (+ onModeChange) — kalau tidak,
  // fallback ke state dalam supaya pemakaian lama (beranda) tak berubah.
  const terkendali = modeLuar !== undefined && onModeChange !== undefined;
  const mode = terkendali ? modeLuar : modeDalam;
  const [hasOpenedWindy, setHasOpenedWindy] = useState(() => (modeLuar ?? "asap") === "windy");
  /* Hanya kamera awalnya yang disimpan sebagai state. Sisa parameter iframe
     dirangkai saat render, BUKAN dibekukan saat Windy pertama dibuka: bingkai
     yang sama bisa membentang jadi selayar (beranda), dan tombol bentang serta
     zoom roda ikut dipanggang ke URL ini. Dibekukan, iframe yang sudah terbuka
     akan membawa parameter bingkai lamanya — roda membajak guliran halaman di
     bingkai kecil, dan tombol bentang muncul di peta yang sudah selayar.
     Ganti src berarti iframe memuat ulang; itu memang sudah pasti terjadi,
     sebab memindahkan <iframe> di DOM selalu memuatnya ulang. */
  const [windyKamera, setWindyKamera] = useState("lat=0.200&lon=118.000&zoom=5");
  const windySrc = `/api/forecasting?${windyKamera}${zoomRoda ? "&konsol=1" : ""}${
    onExpand ? "&bentang=1" : ""
  }${legendaRingkas ? "&ringkas=1" : ""}${tombolRapat ? "&rapat=1" : ""}`;
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

  // Aktifkan pemuatan iframe saat pertama kali beralih ke mode Windy
  const handlePilihMode = (m: ModePeta) => {
    if (terkendali) onModeChange?.(m);
    else setModeDalam(m);

    if (m === mode) {
      return;
    }

    if (m === "windy") {
      // Konsol / beranda: samakan kamera dan tingkat zoom persis dengan lapisan Aerosol
      const kamera = kameraAerosolKini() ?? (muatNusantara ? kameraWindyNusantara(isPenuh) : null);
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
      kirimData({ type: "WINDY_ACTIVE" });
      kirimData({ type: "SET_JUMLAH", jumlahLaporan });
      if (berita && berita.length > 0) {
        kirimData({ type: "SET_EVENTS", events: berita });
      }
    } else if (m === "asap" && hasOpenedWindy) {
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
          aerosol.jumpTo({ center: [c.lng, c.lat], zoom: z });
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
        const kamera = kameraTertundaRef.current ?? (isPenuh ? kameraWindyNusantara(true) : kameraAerosolKini());
        if (kamera) {
          kirimData({ type: "SET_KAMERA", ...kamera });
        }
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
      } else if (data.type === "BUKA_RINCIAN_KEJADIAN") {
        const ketemu = berita?.find((b) => b.id === data.eventId || b.slug === data.slug);
        if (ketemu && onBukaRincian) {
          onBukaRincian(ketemu);
        }
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
  }, [kirimData, berita, onBukaRincian, isPenuh]);

  /* Saat mode selayar dibuka ATAU ditutup, sesuaikan kamera Windy dinamis ke
     Nusantara. Sela selayar dan sela bingkai kecil berbeda jauh, jadi tanpa
     cabang tutup iframe tertinggal di kamera selayar yang jauh lebih rapat —
     bingkai kecil lalu memotong Sumatra dan Papua.

     Dikunci ke perubahan isPenuh saja; `mode` dibaca lewat ref. Kalau `mode`
     ikut jadi dependensi, tiap ganti tab kamera dipaksa balik ke framing
     Nusantara dan geseran/zoom pengunjung hilang — padahal handlePilihMode
     sudah menyamakan kamera antar-tab dari kamera Aerosol yang sedang tampil. */
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    if (modeRef.current !== "windy") return;
    if (!isPenuh && !muatNusantara) return;
    // Satu frame: wadah MapLibre adalah acuan selaNusantara, jadi ia harus
    // sudah memakai ukuran barunya sebelum kameranya dihitung.
    const frameId = requestAnimationFrame(() => {
      const kamera = kameraWindyNusantara(isPenuh);
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
      const kamera = kameraWindyNusantara(true);
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
     wilayahnya tetap sama persis. */
  const lapisWindyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const lapis = lapisWindyRef.current;
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

  /* Pil alih mode versi rapat untuk bingkai dasbor — sedikit lebih kecil
     dari versi fullscreen beranda. */
  const kelasPil = `flex cursor-pointer items-center gap-1 sm:gap-2 rounded-full font-semibold transition-all ${
    tombolRapat ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs"
  }`;
  const kelasInfo = `flex cursor-pointer items-center justify-center rounded-full bg-black/85 text-white/80 shadow-2xl ring-1 ring-white/20 backdrop-blur-md transition-all hover:bg-black hover:text-white hover:ring-white/40 active:scale-95 ${
    tombolRapat ? "h-7 w-7" : "h-8 w-8 sm:h-9 sm:w-9"
  }`;

  return (
    <div
      ref={akarRef}
      onContextMenu={(e) => e.preventDefault()}
      className="relative h-full w-full overflow-hidden bg-black"
    >
      {/* Tombol Alih Mode Layer Peta & Info Perbedaan */}
      <div className={`pointer-events-auto absolute left-4 z-[450] flex items-center gap-1.5 sm:gap-2 sm:left-6 ${tombolRapat ? "top-4" : "top-20"}`}>
        <div className="flex items-center gap-1 rounded-full bg-black/85 p-1 shadow-2xl ring-1 ring-white/20 backdrop-blur-md">
          <button
            type="button"
            onClick={() => handlePilihMode("asap")}
            style={
              mode === "asap"
                ? {
                    background:
                      "linear-gradient(to right, #49006a 0%, #86198f 35%, #b90d84 65%, #f472b6 90%, #fce7f3 100%)",
                  }
                : undefined
            }
            className={`${kelasPil} ${
              mode === "asap"
                ? "text-white shadow-md shadow-purple-950/50 ring-1 ring-fuchsia-400/40 [text-shadow:_0_1px_2px_rgb(0_0_0_/_70%)]"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="text-xs sm:text-sm leading-none">🔥</span>
            <span><span className="hidden sm:inline">Aerosol </span>Karhutla</span>
          </button>
          <button
            type="button"
            onClick={() => handlePilihMode("windy")}
            style={
              mode === "windy"
                ? {
                    background:
                      "linear-gradient(to right, #047857 0%, #059669 40%, #10b981 75%, #84cc16 100%)",
                  }
                : undefined
            }
            className={`${kelasPil} ${
              mode === "windy"
                ? "text-white shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400/40 [text-shadow:_0_1px_2px_rgb(0_0_0_/_70%)]"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="text-xs sm:text-sm leading-none">💨</span>
            <span>Angin<span className="hidden sm:inline"> dan Kualitas Udara</span></span>
          </button>
        </div>

        {/* Tombol Buka Panduan Sains & Data */}
        <button
          type="button"
          onClick={() => setBukaInfoPerbedaan(true)}
          className={kelasInfo}
          aria-label="Panduan Peta"
          title="Panduan Peta"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      </div>

      {/* Modal Dialog: Panduan Peta — di-portal ke body: bingkai peta konsol
          memakai `isolate`, dan fixed di dalamnya akan tertahan di bawah laci
          ponsel serta bilah navigasi. */}
      {bukaInfoPerbedaan && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setBukaInfoPerbedaan(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[calc(100svh-2rem)] flex cursor-default flex-col overflow-hidden rounded-2xl border border-white/10 bg-pantau-konsol p-4 sm:p-5 shadow-2xl text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white/60" />
                <h3 className="text-sm font-semibold tracking-wide text-white">
                  Panduan Data
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBukaInfoPerbedaan(false)}
                className="rounded-lg cursor-pointer p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Tutup panduan"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* List Indikator Data */}
            <div className="mt-3.5 grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2 text-xs">
              {/* Kolom 1: Aerosol Karhutla */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-medium text-white text-xs">Aerosol Karhutla</span>
                  </div>
                  <div className="mt-2.5 space-y-2.5 text-white/75">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block">Data</span>
                      <p className="mt-0.5 text-[11px] leading-relaxed">
                        <strong className="text-white font-medium">OMAOD 550nm</strong> (Organic Matter AOD) dari CAMS global, mengukur kepekatan partikel asap biomassa.
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block">Cakupan Waktu</span>
                      <p className="mt-0.5 text-[11px] leading-relaxed">
                        Riwayat 7 hari ke belakang hingga proyeksi gerak asap 3 hari ke depan (tiap 3 jam).
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block">Atribusi & Lisensi</span>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-white/65">
                        Contains modified <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noopener noreferrer" className="text-white font-medium underline underline-offset-2">Copernicus Atmosphere Monitoring Service</a> information 2026.
                      </p>
                      <p className="mt-1 text-[9.5px] leading-normal text-white/45 italic">
                        Baik Komisi Eropa maupun ECMWF tidak bertanggung jawab atas penggunaan data atau informasi yang disajikan.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kolom 2: Angin dan Kualitas Udara */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-medium text-white text-xs">Angin dan Kualitas Udara</span>
                  </div>
                  <div className="mt-2.5 space-y-2.5 text-white/75">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block">Data</span>
                      <p className="mt-0.5 text-[11px] leading-relaxed">
                        Indeks Kualitas Udara (<strong className="text-white font-medium">AQI</strong>) berbasis model atmosfer <strong className="text-white font-medium">Copernicus CAMS</strong>, dipadukan hembusan angin model <strong className="text-white font-medium">ECMWF IFS</strong>.
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block">Cakupan Waktu</span>
                      <p className="mt-0.5 text-[11px] leading-relaxed">
                        Near real-time (menggunakan data aktual yang paling mendekati waktu saat ini).
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 block">Atribusi & Penyedia</span>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-white/65">
                        Disajikan melalui <a href="https://www.windy.com" target="_blank" rel="noopener noreferrer" className="text-white font-medium underline underline-offset-2">Windy.com</a> dengan integrasi model Copernicus CAMS & ECMWF IFS.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setBukaInfoPerbedaan(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                Tutup
              </button>
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
            aktif={mode === "asap"}
            onSyncChange={setSedangSyncAsap}
            legendaRingkas={legendaRingkas}
            muatNusantara={muatNusantara}
            zoomRoda={zoomRoda}
            logoSelulerSrc={logoSelulerSrc}
            logoSelulerAlt={logoSelulerAlt}
            onExpand={onExpand}
            expandLabel={expandLabel}
            isPenuh={isPenuh}
          />
        )}
      </div>

      {/* Tampilan Layer 2: Windy Air Quality & Wind Flow */}
      <div
        ref={lapisWindyRef}
        // Berhenti di atas laci konsol ponsel (--sela-bawah; 0 di panggung)
        // supaya bilah skala & logo Windy tak tertutup laci.
        className={`absolute inset-x-0 top-0 bottom-[var(--sela-bawah,0px)] w-full transition-opacity duration-300 ${
          mode === "windy" ? "opacity-100 pointer-events-auto z-[2]" : "opacity-0 pointer-events-none -z-10"
        }`}
      >
        {hasOpenedWindy && (
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
              kirimData({ type: "WINDY_ACTIVE" });
              setTimeout(() => setMemuatWindy(false), 1500);
            }}
          />
        )}
        {mode === "windy" && memuatWindy && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/85 transition-opacity duration-500">
            <div className="flex items-center gap-3 rounded-full bg-black/75 px-5 py-2.5 text-sm text-white/90 shadow-xl ring-1 ring-white/15">
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
      </div>
    </div>
  );
}
