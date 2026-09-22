"use client";

import { useTheme } from "next-themes";
import { TEKS_NAV, type Bahasa } from "@/lib/bahasa";
import { useMounted } from "@/hooks/use-mounted";

type Props = {
  bahasa: Bahasa;
  gelap?: boolean;
  className?: string;
};

/** Ikon Matahari untuk beralih ke mode terang (atau indikator siang). */
function IkonMatahari({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

/** Ikon Bulan untuk beralih ke mode gelap (atau indikator malam). */
function IkonBulan({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/**
 * Tombol Sakelar Tema (Dark / Light).
 * Ditempatkan di samping penukar bahasa untuk aksesibilitas dan ergonomi cepat.
 */
export function SakelarTema({ bahasa, gelap = false, className = "" }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const teks = TEKS_NAV[bahasa];
  const isDark = mounted ? resolvedTheme === "dark" : gelap;

  const labelAksi = mounted
    ? isDark
      ? teks.temaTerang
      : teks.temaGelap
    : teks.gantiTema;

  const gantiTema = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={gantiTema}
      aria-label={labelAksi}
      title={labelAksi}
      className={`inline-flex items-center justify-center shrink-0 cursor-pointer rounded-full p-1.5 text-xs font-bold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-api ${
        gelap || isDark
          ? "bg-white/[0.05] text-white/80 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
          : "bg-black/[0.04] text-tinta/70 border border-black/[0.06] hover:bg-black/[0.08] hover:text-tinta"
      } ${className}`}
    >
      {/* Pertahankan dimensi agar tidak memicu Cumulative Layout Shift (CLS) */}
      <span className="size-4 sm:size-[18px] flex items-center justify-center">
        {mounted ? (
          isDark ? (
            <IkonMatahari className="size-3.5 sm:size-4 transition-transform duration-200 hover:rotate-45" />
          ) : (
            <IkonBulan className="size-3.5 sm:size-4 transition-transform duration-200 hover:-rotate-12" />
          )
        ) : (
          <span className="size-3.5 sm:size-4 opacity-0" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
