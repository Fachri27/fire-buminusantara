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
};

type CalendarRangeProps = {
  mode: "range";
  selected?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
  className?: string;
  initialMonth?: Date;
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
  const { mode, className = "", initialMonth } = props;

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

  return (
    <div className={`w-[260px] select-none text-neutral-900 ${className}`}>
      {/* Header navigasi bulan & tahun */}
      <div className="flex items-center justify-between pb-3">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Bulan sebelumnya"
          className="flex size-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <span className="text-xs font-bold tracking-tight">
          {NAMA_BULAN[bulan]} {tahun}
        </span>

        <button
          type="button"
          onClick={nextMonth}
          aria-label="Bulan berikutnya"
          className="flex size-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Baris nama hari */}
      <div className="grid grid-cols-7 text-center pb-1">
        {NAMA_HARI.map((h, i) => (
          <span
            key={h}
            className={`text-[10px] font-medium ${i === 0 ? "text-red-500" : "text-neutral-400"}`}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Grid tanggal */}
      <div className="grid grid-cols-7 gap-y-0.5 pt-1">
        {hariArray.map(({ date, isCurrentMonth }, idx) => {
          const isToday = isSameDay(date, today);

          if (mode === "single") {
            const isSelected = isSameDay(props.selected, date);

            return (
              <div key={idx} className="flex items-center justify-center p-0.5">
                <button
                  type="button"
                  onClick={() => handleDayClick(date)}
                  className={`size-8 rounded-md text-xs transition-all flex items-center justify-center relative ${
                    isSelected
                      ? "bg-neutral-900 text-white font-semibold shadow-xs"
                      : isCurrentMonth
                      ? "text-neutral-900 hover:bg-neutral-100 font-medium"
                      : "text-neutral-300 hover:bg-neutral-50"
                  } ${isToday && !isSelected ? "ring-1 ring-neutral-400 font-bold" : ""}`}
                >
                  {date.getDate()}
                </button>
              </div>
            );
          }

          // Mode Range
          const selected = props.selected;
          const isFrom = isSameDay(selected?.from, date);
          const isTo = isSameDay(selected?.to, date);

          const effectiveTo = selected?.to ?? (hoverDate && selected?.from && isAfterDay(hoverDate, selected.from) ? hoverDate : undefined);

          const inRange =
            selected?.from &&
            effectiveTo &&
            isAfterDay(date, selected.from) &&
            isBeforeDay(date, effectiveTo);

          const isRangeStart = isFrom && Boolean(effectiveTo);
          const isRangeEnd = (isTo || (Boolean(hoverDate) && !selected?.to && isSameDay(hoverDate ?? undefined, date))) && Boolean(selected?.from);

          return (
            <div
              key={idx}
              className={`flex items-center justify-center p-0 ${
                inRange ? "bg-neutral-100" : ""
              } ${isRangeStart ? "bg-gradient-to-r from-transparent to-neutral-100" : ""} ${
                isRangeEnd ? "bg-gradient-to-l from-transparent to-neutral-100" : ""
              }`}
              onMouseEnter={() => {
                if (selected?.from && !selected?.to) {
                  setHoverDate(date);
                }
              }}
            >
              <button
                type="button"
                onClick={() => handleDayClick(date)}
                className={`size-8 text-xs transition-all flex items-center justify-center relative ${
                  isFrom || isTo
                    ? "bg-neutral-900 text-white font-semibold shadow-xs rounded-md"
                    : inRange
                    ? "bg-neutral-100 text-neutral-900 font-medium rounded-none hover:bg-neutral-200"
                    : isCurrentMonth
                    ? "text-neutral-900 hover:bg-neutral-100 font-medium rounded-md"
                    : "text-neutral-300 hover:bg-neutral-50 rounded-md"
                } ${isToday && !isFrom && !isTo ? "ring-1 ring-neutral-300 font-bold" : ""}`}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
