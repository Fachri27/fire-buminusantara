"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar";

export type DatePickerProps = {
  nama?: string;
  nilai?: string;
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  wajib?: boolean;
  className?: string;
  id?: string;
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

export function DatePicker({
  nama,
  nilai,
  value: controlledValue,
  onChange,
  placeholder = "Pilih tanggal",
  wajib,
  className = "",
  id,
}: DatePickerProps) {
  const [uncontrolledVal, setUncontrolledVal] = useState<string>(nilai ?? "");
  const isControlled = controlledValue !== undefined;
  const val = isControlled ? controlledValue : uncontrolledVal;
  const [open, setOpen] = useState(false);

  const selectedDate = parseIso(val);

  const handleSelect = (date: Date | undefined) => {
    const nextStr = date ? formatIso(date) : "";
    if (!isControlled) {
      setUncontrolledVal(nextStr);
    }
    onChange?.(nextStr);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {nama && <input type="hidden" id={id} name={nama} value={val} required={wajib} />}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          <div
            role="button"
            tabIndex={0}
            className={`cms-isian flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-[3px] border border-[var(--garis-tegas)] bg-[var(--papan)] px-3 py-2 text-left text-[13.5px] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--limau)] ${
              !selectedDate ? "text-[var(--lirih)]" : "text-neutral-900 font-medium"
            }`}
          >
            <span className="truncate">
              {selectedDate ? formatTampilan(selectedDate) : placeholder}
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="size-4 shrink-0 text-[var(--lirih)]"
            >
              <path
                fillRule="evenodd"
                d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </PopoverTrigger>

        <PopoverContent align="start" className="p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialMonth={selectedDate}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
