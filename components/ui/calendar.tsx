"use client";

import { useState } from "react";

export type DateRange = {
  from?: Date;
  to?: Date;
};

type CalendarSingleProps = {
  mode: "single";
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  className?: string;
  initialMonth?: Date;
  gelap?: boolean;
};

type CalendarRangeProps = {
  mode: "range";
  selected?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
  className?: string;
  initialMonth?: Date;
  gelap?: boolean;
};

export type CalendarProps = CalendarSingleProps | CalendarRangeProps;

const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function isSameDay(d1?: Date, d2?: Date) {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isBeforeDay(d1: Date, d2: Date) {
  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
  return t1 < t2;
}

function isAfterDay(d1: Date, d2: Date) {
  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
  return t1 > t2;
}

export function Calendar(props: CalendarProps) {
  const { mode, className = "", initialMonth, gelap = false } = props;

  const defaultMonth = () => {
    if (initialMonth) return initialMonth;
    if (mode === "single" && props.selected) return props.selected;
    if (mode === "range" && props.selected?.from) return props.selected.from;
    return new Date();
  };

  const [tampilBulan, setTampilBulan] = useState<Date>(defaultMonth);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const tahun = tampilBulan.getFullYear();
  const bulan = tampilBulan.getMonth();

  const prevMonth = () => {
    setTampilBulan(new Date(tahun, bulan - 1, 1));
  };

  const nextMonth = () => {
    setTampilBulan(new Date(tahun, bulan + 1, 1));
  };

  // Buat grid hari untuk bulan yang sedang ditampilkan
  const firstDayIndex = new Date(tahun, bulan, 1).getDay(); // 0 = Minggu
  const daysInCurrentMonth = new Date(tahun, bulan + 1, 0).getDate();
  const daysInPrevMonth = new Date(tahun, bulan, 0).getDate();

  const hariArray: { date: Date; isCurrentMonth: boolean }[] = [];

  // Hari-hari bulan sebelumnya
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    hariArray.push({
      date: new Date(tahun, bulan - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }

  // Hari-hari bulan ini
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    hariArray.push({
      date: new Date(tahun, bulan, i),
      isCurrentMonth: true,
    });
  }

  // Lengkapi sisa baris minggu (total 35 atau 42 slot)
  const remaining = (7 - (hariArray.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    hariArray.push({
      date: new Date(tahun, bulan + 1, i),
      isCurrentMonth: false,
    });
  }

  const today = new Date();

  const handleDayClick = (date: Date) => {
    if (mode === "single") {
      if (isSameDay(props.selected, date)) {
        props.onSelect?.(undefined);
      } else {
        props.onSelect?.(date);
      }
    } else {
      const selected = props.selected;
      if (!selected?.from || (selected.from && selected.to)) {
        // Mulai range baru
        props.onSelect?.({ from: date, to: undefined });
      } else if (selected.from && !selected.to) {
        if (isBeforeDay(date, selected.from)) {
          // Klik tanggal sebelum 'from', jadikan 'from' baru
          props.onSelect?.({ from: date, to: undefined });
        } else {
          // Selesaikan range
          props.onSelect?.({ from: selected.from, to: date });
        }
      }
    }
  };

  /* Satu bahasa rupa untuk kedua mode: ujung pilihan berupa lingkaran penuh
     bertinta, rentang di antaranya pita tipis yang menyambung, dan "hari ini"
     cukup titik kecil di bawah angkanya — cincin kotak dulu terbaca seperti
     pilihan kedua. */
  const tombolHari = "relative flex size-9 cursor-pointer items-center justify-center rounded-full text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ff5a26]";
  const ujung = "bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-900";
  const biasa = (bulanIni: boolean) =>
    bulanIni
      ? "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-white/10"
      : "text-neutral-300 hover:bg-neutral-50 dark:text-neutral-600 dark:hover:bg-white/5";
  const titikHariIni = (terpilih: boolean) => (
    <span aria-hidden="true"
          className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${
            terpilih ? "bg-white dark:bg-neutral-900" : "bg-[#ff5a26]"
          }`} />
  );
  const pita = "bg-[var(--pita)]";

  return (
    <div className={`w-[252px] select-none text-neutral-900 dark:text-white ${gelap ? "dark" : ""} ${className}`}>
      {/* Header navigasi bulan & tahun */}
      <div className="flex items-center justify-between pb-2">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Bulan sebelumnya"
          className="flex size-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <span aria-live="polite" className="text-[14px] font-semibold text-neutral-900 dark:text-white">
          {NAMA_BULAN[bulan]} <span className="font-normal text-neutral-500 dark:text-neutral-400">{tahun}</span>
        </span>

        <button
          type="button"
          onClick={nextMonth}
          aria-label="Bulan berikutnya"
          className="flex size-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Baris nama hari */}
      <div className="grid grid-cols-7 pb-1 text-center">
        {NAMA_HARI.map((h) => (
          <span key={h} className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
            {h}
          </span>
        ))}
      </div>

      {/* Grid tanggal */}
      <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHoverDate(null)}>
        {hariArray.map(({ date, isCurrentMonth }, idx) => {
          const isToday = isSameDay(date, today);

          if (mode === "single") {
            const isSelected = isSameDay(props.selected, date);

            return (
              <div key={idx} className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => handleDayClick(date)}
                  aria-pressed={isSelected}
                  className={`${tombolHari} ${isSelected ? ujung : biasa(isCurrentMonth)}`}
                >
                  {date.getDate()}
                  {isToday && titikHariIni(isSelected)}
                </button>
              </div>
            );
          }

          // Mode Range — pratinjau mengikuti penunjuk selama ujung akhir belum dipilih.
          const selected = props.selected;
          const pratinjauAkhir =
            !selected?.to && hoverDate && selected?.from && isAfterDay(hoverDate, selected.from) ? hoverDate : undefined;
          const effectiveTo = selected?.to ?? pratinjauAkhir;

          const isFrom = isSameDay(selected?.from, date);
          const isTo = isSameDay(effectiveTo, date);
          const isEnd = isFrom || isTo;

          const inRange = Boolean(
            selected?.from && effectiveTo && isAfterDay(date, selected.from) && isBeforeDay(date, effectiveTo),
          );
          const adaRentang = Boolean(selected?.from && effectiveTo && !isSameDay(selected.from, effectiveTo));

          // Pita menyambung dari tengah lingkaran ujung ke tetangganya.
          const latar = inRange
            ? pita
            : adaRentang && isFrom
            ? "bg-[linear-gradient(to_right,transparent_50%,var(--pita)_50%)]"
            : adaRentang && isTo
            ? "bg-[linear-gradient(to_left,transparent_50%,var(--pita)_50%)]"
            : "";

          return (
            <div
              key={idx}
              className={`flex items-center justify-center [--pita:#f5f5f5] dark:[--pita:rgb(255_255_255/0.08)] ${latar}`}
              onMouseEnter={() => {
                if (selected?.from && !selected?.to) {
                  setHoverDate(date);
                }
              }}
            >
              <button
                type="button"
                onClick={() => handleDayClick(date)}
                aria-pressed={isEnd}
                className={`${tombolHari} ${
                  isEnd
                    ? `${ujung} ${pratinjauAkhir && isTo ? "opacity-70" : ""}`
                    : inRange
                    ? "text-neutral-900 hover:bg-neutral-200 dark:text-white dark:hover:bg-white/15"
                    : biasa(isCurrentMonth)
                }`}
              >
                {date.getDate()}
                {isToday && titikHariIni(isEnd)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
