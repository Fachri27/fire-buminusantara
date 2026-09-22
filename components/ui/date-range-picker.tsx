"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar, type DateRange } from "./calendar";

export type DateRangePickerProps = {
  dari?: string;
  sampai?: string;
  onChange?: (range: { dari: string; sampai: string }) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  /** true = tombol + kalender gelap dasbor /peta. Bawaan false (putih). */
  gelap?: boolean;
  /** true = tombol pemicu selebar wadahnya dan setinggi kontrol bilah
   *  saringan (h-9), supaya sejajar dengan pilihan wilayah di sebelahnya. */
  penuh?: boolean;
};

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const NAMA_BULAN_PENDEK = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

function formatTampilan(d: Date): string {
  const tgl = d.getDate();
  const bln = NAMA_BULAN_PENDEK[d.getMonth()];
  const thn = d.getFullYear();
  return `${tgl} ${bln} ${thn}`;
}

function parseIso(str?: string): Date | undefined {
  if (!str) return undefined;
  const parts = str.split("-");
  if (parts.length !== 3) return undefined;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return undefined;
  return new Date(y, m, d);
}

export function DateRangePicker({
  dari = "",
  sampai = "",
  onChange,
  onClear,
  placeholder = "Pilih rentang tanggal",
  className = "",
  gelap = false,
  penuh = false,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const dateRange: DateRange = {
    from: parseIso(dari),
    to: parseIso(sampai),
  };

  const handleSelect = (range: DateRange | undefined) => {
    const nextDari = range?.from ? formatIso(range.from) : "";
    const nextSampai = range?.to ? formatIso(range.to) : "";
    onChange?.({ dari: nextDari, sampai: nextSampai });

    if (range?.from && range?.to) {
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.({ dari: "", sampai: "" });
    onClear?.();
  };

  /* Rentang diringkas dari kanan: bagian yang sama di kedua ujung (tahun,
     lalu bulan) cukup ditulis sekali. "3–12 Sep 2026" muat di kolom tanggal
     ponsel yang cuma 9rem; "3 Sep 2026 – 12 Sep 2026" terpotong elipsis. */
  const teksTampilan = () => {
    const { from: a, to: b } = dateRange;
    if (a && b) {
      if (a.getFullYear() !== b.getFullYear()) return `${formatTampilan(a)} – ${formatTampilan(b)}`;
      const thn = b.getFullYear();
      if (a.getMonth() !== b.getMonth()) {
        return `${a.getDate()} ${NAMA_BULAN_PENDEK[a.getMonth()]} – ${b.getDate()} ${NAMA_BULAN_PENDEK[b.getMonth()]} ${thn}`;
      }
      if (a.getDate() === b.getDate()) return formatTampilan(a);
      return `${a.getDate()}–${b.getDate()} ${NAMA_BULAN_PENDEK[b.getMonth()]} ${thn}`;
    }
    if (dateRange.from) {
      return `${dateRange.from.getDate()} ${NAMA_BULAN_PENDEK[dateRange.from.getMonth()]} – …`;
    }
    return placeholder;
  };

  const adaPilihan = Boolean(dari || sampai);

  return (
    <div className={`flex items-center gap-2 ${penuh ? "w-full min-w-0 " : ""}${className}`}>
      <Popover open={open} onOpenChange={setOpen} className={penuh ? "w-full" : ""}>
        <PopoverTrigger className={penuh ? "w-full" : ""}>
          <button
            type="button"
            className={`${penuh ? "h-9 w-full min-w-0 " : ""}${adaPilihan ? "pr-8 " : ""}flex cursor-pointer items-center gap-2 rounded-[8px] border px-2.5 py-1.5 text-[11px] sm:text-xs font-medium shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ${
              gelap
                ? "border-white/15 bg-pantau-malam text-white hover:border-white/30 focus-visible:outline-white/60"
                : "border-black/10 bg-white text-tinta hover:border-black/20 hover:bg-black/[0.02] focus-visible:outline-api dark:border-white/15 dark:bg-pantau-konsol dark:text-white dark:hover:border-white/30 dark:hover:bg-white/[0.04] dark:focus-visible:outline-white/60"
            }`}
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className={`size-3.5 shrink-0 ${gelap ? "text-white/50" : "text-black/50 dark:text-white/50"}`}
            >
              <path
                fillRule="evenodd"
                d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
                clipRule="evenodd"
              />
            </svg>
            <span
              className={`${penuh ? "truncate " : ""}whitespace-nowrap ${
                !adaPilihan
                  ? gelap
                    ? "text-white/70"
                    : "text-black/45 dark:text-white/70"
                  : gelap
                  ? "font-medium text-white"
                  : "font-medium text-tinta dark:text-white"
              }`}
            >
              {teksTampilan()}
            </span>
          </button>
        </PopoverTrigger>

        {/* Hapus duduk DI DALAM kolom, di atas pemicu — bukan tautan merah di
            sebelahnya yang menggeser tata letak begitu rentang terpilih. Ia
            saudara pemicu, bukan anaknya: tombol di dalam tombol tidak sah,
            dan klik di sini tak boleh ikut membuka kalender. */}
        {adaPilihan && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Hapus rentang tanggal"
            title="Hapus rentang tanggal"
            className={`absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-[#ff5a26] ${
              gelap
                ? "text-white/60 hover:bg-white/10 hover:text-white"
                : "text-black/45 hover:bg-black/[0.06] hover:text-tinta dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            }`}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor" className="size-3.5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        )}

        <PopoverContent align="start" className="rounded-xl p-3 shadow-[0_12px_32px_rgb(0_0_0/0.12)] dark:shadow-[0_12px_32px_rgb(0_0_0/0.5)]" gelap={gelap}>
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleSelect}
            initialMonth={dateRange.from}
            gelap={gelap}
          />
        </PopoverContent>
      </Popover>

    </div>
  );
}
