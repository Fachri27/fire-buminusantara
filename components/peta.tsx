"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  jumlahLaporan: Record<string, number>;
  onPilihWilayah: (nama: string, pulau: string | null, asal: { x: number; y: number }) => void;
};

export function Peta({ jumlahLaporan, onPilihWilayah }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [memuat, setMemuat] = useState(true);
  const iframeReadyRef = useRef(false);
  const pendingJumlahRef = useRef(jumlahLaporan);
  const onPilihRef = useRef(onPilihWilayah);

  useEffect(() => {
    onPilihRef.current = onPilihWilayah;
  }, [onPilihWilayah]);

  // Kirim data ke iframe
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

  useEffect(() => {
    const saatPesan = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "FORECASTING_READY") {
        iframeReadyRef.current = true;
        setMemuat(false);
        // Kuras data jumlah laporan yang tertunda saat inisialisasi awal
        if (pendingJumlahRef.current) {
          kirimData({
            type: "SET_JUMLAH",
            jumlahLaporan: pendingJumlahRef.current,
          });
        }
      } else if (data.type === "PILIH_WILAYAH") {
        const rect = iframeRef.current?.getBoundingClientRect();
        const asal = {
          x: (rect?.left ?? 0) + (data.asal?.x ?? 0),
          y: (rect?.top ?? 0) + (data.asal?.y ?? 0),
        };
        onPilihRef.current(data.nama, data.pulau ?? null, asal);
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
  }, [kirimData]);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="relative h-full w-full overflow-hidden bg-[#0a0f18]"
    >
      <iframe
        ref={iframeRef}
        src="/api/forecasting?lat=0.200&lon=118.000&zoom=5"
        title="Peta Sebaran Kualitas Udara dan Angin"
        className="h-full w-full border-0"
        allow="geolocation"
        onContextMenu={(e) => e.preventDefault()}
        onLoad={() => {
          if (iframeReadyRef.current && pendingJumlahRef.current) {
            kirimData({ type: "SET_JUMLAH", jumlahLaporan: pendingJumlahRef.current });
          }
          setTimeout(() => setMemuat(false), 1500);
        }}
      />
      {memuat && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0a0f18]/85 transition-opacity duration-500">
          <div className="flex items-center gap-3 rounded-full bg-black/75 px-5 py-2.5 text-sm text-white/90 shadow-xl ring-1 ring-white/15">
            <svg
              className="h-4 w-4 animate-spin text-amber-500"
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
            <span>Memuat peta sebaran & forecasting…</span>
          </div>
        </div>
      )}
    </div>
  );
}
