"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

type Props = {
  jumlahLaporan: Record<string, number>;
  onPilihWilayah: (nama: string, pulau: string | null, asal: { x: number; y: number }) => void;
  berita?: Berita[];
  onBukaRincian?: (b: Berita) => void;
};

export function Peta({ jumlahLaporan, onPilihWilayah, berita, onBukaRincian }: Props) {
  const [mode, setMode] = useState<"asap" | "windy">("asap");
  const [hasOpenedWindy, setHasOpenedWindy] = useState(false);
  const [windySrc, setWindySrc] = useState<string>("/api/forecasting?lat=0.200&lon=118.000&zoom=5");
  const [sedangSyncAsap, setSedangSyncAsap] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [memuatWindy, setMemuatWindy] = useState(true);
  const iframeReadyRef = useRef(false);
  const pendingJumlahRef = useRef(jumlahLaporan);
  const onPilihRef = useRef(onPilihWilayah);

  useEffect(() => {
    onPilihRef.current = onPilihWilayah;
  }, [onPilihWilayah]);


  // Aktifkan pemuatan iframe saat pertama kali beralih ke mode Windy
  const handlePilihMode = (m: "asap" | "windy") => {
    setMode(m);
    if (m === "windy") {
      if (!hasOpenedWindy && typeof window !== "undefined") {
        const isMobile = window.innerWidth < 640;
        setWindySrc(
          isMobile
            ? "/api/forecasting?lat=-1.000&lon=118.000&zoom=3.8"
            : "/api/forecasting?lat=0.200&lon=118.000&zoom=5"
        );
      }
      setHasOpenedWindy(true);
      kirimData({ type: "WINDY_ACTIVE" });
      kirimData({ type: "SET_JUMLAH", jumlahLaporan });
      if (berita && berita.length > 0) {
        kirimData({ type: "SET_EVENTS", events: berita });
      }
    }
  };

  // Kirim data ke iframe Windy
  const kirimData = useCallback((data: Record<string, unknown>) => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(data, "*");
    } catch {
      // Abaikan jika belum siap
    }
  }, []);

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
  }, [kirimData, berita, onBukaRincian]);

  const [bukaInfoPerbedaan, setBukaInfoPerbedaan] = useState(false);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="relative h-full w-full overflow-hidden bg-[#0a0f18]"
    >
      {/* Tombol Alih Mode Layer Peta & Info Perbedaan */}
      <div className="pointer-events-auto absolute left-4 top-20 z-[450] flex items-center gap-1.5 sm:gap-2 sm:left-6">
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
            className={`flex items-center gap-1 sm:gap-2 rounded-full px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs font-semibold transition-all ${
              mode === "asap"
                ? "text-white shadow-md shadow-purple-950/50 ring-1 ring-fuchsia-400/40 [text-shadow:_0_1px_2px_rgb(0_0_0_/_70%)]"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="text-xs sm:text-sm leading-none">🔥</span>
            <span><span className="hidden sm:inline">Sebaran </span>Asap</span>
            {sedangSyncAsap && mode === "asap" && (
              <span
                className="relative flex h-2 w-2 ml-0.5"
                title="Menyinkronkan data sebaran asap"
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
            )}
            <span className="hidden opacity-90 md:inline font-normal text-[11px]">(Copernicus CAMS)</span>
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
            className={`flex items-center gap-1 sm:gap-2 rounded-full px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs font-semibold transition-all ${
              mode === "windy"
                ? "text-white shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400/40 [text-shadow:_0_1px_2px_rgb(0_0_0_/_70%)]"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="text-xs sm:text-sm leading-none">💨</span>
            <span><span className="hidden sm:inline">Kualitas </span>Udara</span>
            <span className="hidden opacity-90 md:inline font-normal text-[11px]">(Windy AQI)</span>
          </button>
        </div>

        {/* Tombol Buka Panduan Sains & Data */}
        <button
          type="button"
          onClick={() => setBukaInfoPerbedaan(true)}
          className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/85 text-white/80 shadow-2xl ring-1 ring-white/20 backdrop-blur-md transition-all hover:bg-black hover:text-white hover:ring-white/40 active:scale-95"
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

      {/* Modal Dialog: Panduan Peta */}
      {bukaInfoPerbedaan && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setBukaInfoPerbedaan(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[calc(100svh-2rem)] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]/95 p-4 sm:p-5 shadow-2xl text-white backdrop-blur-md"
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
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Tutup panduan"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* List Indikator Data */}
            <div className="mt-3.5 grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2 text-xs">
              {/* Kolom 1: Sebaran Asap */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-medium text-white text-xs">Sebaran Asap</span>
                    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-white/60">
                      Copernicus CAMS
                    </span>
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
                  </div>
                </div>
              </div>

              {/* Kolom 2: Kualitas Udara */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-medium text-white text-xs">Kualitas Udara & Angin</span>
                    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-white/60">
                      Windy & ECMWF
                    </span>
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
        </div>
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
        <PetaAsap
          jumlahLaporan={jumlahLaporan}
          onPilihWilayah={onPilihWilayah}
          berita={berita}
          onBukaRincian={onBukaRincian}
          aktif={mode === "asap"}
          onSyncChange={setSedangSyncAsap}
        />
      </div>

      {/* Tampilan Layer 2: Windy Air Quality & Wind Flow */}
      <div
        className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${
          mode === "windy" ? "opacity-100 pointer-events-auto z-[2]" : "opacity-0 pointer-events-none -z-10"
        }`}
      >
        {hasOpenedWindy && (
          <iframe
            ref={iframeRef}
            src={windySrc}
            title="Peta Sebaran Kualitas Udara dan Angin"
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
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0a0f18]/85 transition-opacity duration-500">
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
              <span>Memuat peta kualitas udara Windy…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
