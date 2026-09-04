"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = (params?.locale === "en" ? "en" : "id") as "id" | "en";
  const [timestamp] = useState<string>(() => new Date().toISOString());

  useEffect(() => {
    // Audit telemetry error to console
    console.error("Telemetry error boundary caught exception:", error);
  }, [error]);

  const isEn = locale === "en";

  return (
    <div className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center bg-[#0d1117] px-4 py-12 text-[#e6edf3]">
      {/* Background Subtle Telemetry Grid Effect */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />

      {/* Telemetry Error Card */}
      <div className="relative w-full max-w-xl rounded-xl border border-[#30363d] bg-[#161b22]/95 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-md sm:p-8">
        {/* Telemetry Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30363d] pb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-xs font-semibold tracking-wider text-red-400 uppercase">
              {isEn ? "STATUS: STREAM_FAULT" : "STATUS: ANOMALI_TELEMETRI"}
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#8b949e]">
            {isEn ? "SYS_REF: EO-SAT // MODIS-VIIRS" : "SYS_REF: EO-SAT // MODIS-VIIRS"}
          </span>
        </div>

        {/* Title & Description */}
        <div className="mt-5">
          <p className="font-mono text-xs font-medium tracking-widest text-[#f85149] uppercase">
            {isEn ? "Earth Observation Telemetry" : "Telemetri Observasi Bumi"}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-[#f0f6fc] sm:text-2xl">
            {isEn ? "Telemetry Feed Disruption" : "Gangguan Aliran Telemetri"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#8b949e]">
            {isEn
              ? "The satellite observation pipeline encountered an unhandled exception while processing spatial telemetry or hotspot feeds. Stream paused to prevent client state corruption."
              : "Komponen observasi satelit mengalami kendala saat memproses telemetri spasial atau sebaran titik panas. Aliran data dihentikan untuk menjaga integritas antarmuka."}
          </p>
        </div>

        {/* Scientific Telemetry Readout Box */}
        <div className="mt-5 rounded-lg border border-[#30363d] bg-[#0d1117] p-4 font-mono text-xs">
          <div className="mb-2 flex items-center justify-between text-[11px] text-[#8b949e]">
            <span>DIAGNOSTIC TELEMETRY READOUT</span>
            <span className="text-[10px] text-red-400">FAULT_CODE 0x500</span>
          </div>

          <div className="space-y-1.5 text-[#c9d1d9]">
            <div className="flex justify-between gap-4">
              <span className="text-[#8b949e]">SUBSYSTEM:</span>
              <span className="font-medium text-[#79c0ff]">HOTSPOT_INGEST_STREAM</span>
            </div>
            {error?.digest && (
              <div className="flex justify-between gap-4">
                <span className="text-[#8b949e]">DIGEST_ID:</span>
                <span className="font-medium text-[#ff7b72]">{error.digest}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-[#8b949e]">TIMESTAMP:</span>
              <span className="text-[#e6edf3]">{timestamp || "PENDING..."}</span>
            </div>
            {error?.message && (
              <div className="mt-2 border-t border-[#21262d] pt-2">
                <span className="text-[#8b949e]">MESSAGE: </span>
                <span className="break-all text-[#8b949e]">{error.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#e60012] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c10518] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e60012]"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            {isEn ? "Retry Telemetry Feed" : "Pulihkan Aliran Telemetri"}
          </button>

          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#30363d] bg-[#21262d] px-5 py-2.5 text-sm font-semibold text-[#c9d1d9] transition hover:bg-[#30363d] hover:text-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            {isEn ? "Return to Dashboard" : "Kembali ke Beranda"}
          </Link>
        </div>
      </div>
    </div>
  );
}
