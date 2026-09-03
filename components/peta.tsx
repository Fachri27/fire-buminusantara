"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  jumlahLaporan: Record<string, number>;
  onPilihWilayah: (nama: string, pulau: string | null, asal: { x: number; y: number }) => void;
};

export function Peta({ jumlahLaporan, onPilihWilayah }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [memuat, setMemuat] = useState(true);

  // Kirim data jumlah laporan setiap kali berubah atau saat iframe siap
  const kirimJumlah = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "SET_JUMLAH",
          jumlahLaporan,
        },
        "*",
      );
    } catch {
      // Abaikan jika belum siap
    }
  }, [jumlahLaporan]);

  useEffect(() => {
    kirimJumlah();
  }, [kirimJumlah]);

  useEffect(() => {
    const saatPesan = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "FORECASTING_READY") {
        setMemuat(false);
        kirimJumlah();
      } else if (data.type === "PILIH_WILAYAH") {
        const rect = iframeRef.current?.getBoundingClientRect();
        const asal = {
          x: (rect?.left ?? 0) + (data.asal?.x ?? 0),
          y: (rect?.top ?? 0) + (data.asal?.y ?? 0),
        };
        onPilihWilayah(data.nama, data.pulau ?? null, asal);
      } else if (data.type === "IFRAME_WHEEL") {
        const deltaY = (data.deltaY || 0) * 0.6;
        const lenis = (window as unknown as {
          lenis?: {
            scrollTo: (t: number, opts?: Record<string, unknown>) => void;
            scroll: number;
            targetScroll?: number;
            limit: number;
          };
        }).lenis;

        if (lenis && typeof lenis.scrollTo === "function") {
          const base = lenis.targetScroll ?? lenis.scroll;
          const target = Math.max(0, Math.min(lenis.limit, base + deltaY));
          lenis.scrollTo(target, { duration: 0.9, programmatic: false });
        } else {
          window.scrollBy({ top: deltaY, behavior: "smooth" });
        }
      }
    };

    window.addEventListener("message", saatPesan);
    return () => window.removeEventListener("message", saatPesan);
  }, [onPilihWilayah, kirimJumlah]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0f18]">
      <iframe
        ref={iframeRef}
        src="/api/forecasting?lat=0.200&lon=118.000&zoom=5"
        title="Peta Sebaran Kualitas Udara dan Angin"
        className="h-full w-full border-0"
        allow="geolocation"
        onLoad={() => {
          kirimJumlah();
          setTimeout(() => setMemuat(false), 800);
        }}
      />
      {memuat && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0a0f18]/60 backdrop-blur-sm transition-opacity duration-500">
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
