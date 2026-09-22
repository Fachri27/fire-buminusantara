"use client";

import React, { forwardRef, useState } from "react";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  size?: "sm" | "md";
  aksen?: "tautan" | "bara" | "api" | "emerald" | "fuchsia" | "default";
  className?: string;
  trackClassName?: string;
  thumbClassName?: string;
}

/**
 * Komponen Saklar / Toggle Switch yang aksesibel sesuai panduan Modern Web.
 * Menggunakan <input type="checkbox" role="switch"> tersembunyi secara visual
 * agar tetap terhubung dengan pohon aksesibilitas, label otomatis, navigasi
 * papan ketik (Spacebar), dan pengiriman formulir standar.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      checked: controlledChecked,
      defaultChecked = false,
      onCheckedChange,
      onChange,
      disabled = false,
      size = "md",
      aksen = "bara",
      className = "",
      trackClassName = "",
      thumbClassName = "",
      id,
      name,
      value = "1",
      ...props
    },
    ref
  ) => {
    const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
    const isControlled = controlledChecked !== undefined;
    const isChecked = isControlled ? controlledChecked : uncontrolledChecked;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const nextChecked = e.target.checked;
      if (!isControlled) {
        setUncontrolledChecked(nextChecked);
      }
      onCheckedChange?.(nextChecked);
      onChange?.(e);
    };

    // Dimensi berdasarkan ukuran
    const isSm = size === "sm";
    const trackSizeClass = isSm ? "w-7 h-4 p-[2px]" : "w-8 h-[18px] p-[2px]";
    const thumbSizeClass = isSm ? "size-3" : "size-3.5";
    const thumbTranslateClass = isSm
      ? isChecked
        ? "translate-x-[12px]"
        : "translate-x-0"
      : isChecked
      ? "translate-x-[14px]"
      : "translate-x-0";

    // Pilihan warna aksen aktif dan fokus
    let aksenAktifClass = "bg-[#ff5a26]";
    let aksenFokusClass = "peer-focus-visible:outline-[#ff5a26]";
    if (aksen === "tautan") {
      aksenAktifClass = "bg-[var(--r-tautan,#0095f6)]";
      aksenFokusClass = "peer-focus-visible:outline-[var(--r-tautan,#0095f6)]";
    } else if (aksen === "api") {
      aksenAktifClass = "bg-[var(--color-api,#e60012)]";
      aksenFokusClass = "peer-focus-visible:outline-[var(--color-api,#e60012)]";
    } else if (aksen === "emerald") {
      aksenAktifClass = "bg-emerald-500";
      aksenFokusClass = "peer-focus-visible:outline-emerald-500";
    } else if (aksen === "fuchsia") {
      aksenAktifClass = "bg-fuchsia-500";
      aksenFokusClass = "peer-focus-visible:outline-fuchsia-500";
    }

    return (
      <span
        className={`relative inline-flex items-center align-middle select-none shrink-0 ${
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
        } ${className}`}
      >
        {/* Input asli disembunyikan secara visual (visually-hidden) untuk a11y */}
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          id={id}
          name={name}
          value={value}
          checked={isChecked}
          disabled={disabled}
          onChange={handleChange}
          aria-checked={isChecked}
          className="sr-only peer"
          {...props}
        />

        {/* Jalur (Track) Saklar */}
        <span
          aria-hidden="true"
          className={`rincian__saklar-jalur relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out motion-reduce:transition-none ${trackSizeClass} ${
            isChecked
              ? `${aksenAktifClass} ring-1 ring-white/10 dark:ring-white/20`
              : "bg-neutral-300 hover:bg-neutral-400/80 ring-1 ring-black/10 dark:bg-white/20 dark:hover:bg-white/25 dark:ring-white/15"
          } peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${aksenFokusClass} ${trackClassName}`}
        >
          {/* Tombol Geser (Thumb) Saklar */}
          <span
            className={`rincian__saklar-tombol pointer-events-none inline-block rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] dark:bg-white dark:shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-transform duration-200 cubic-bezier(0.4,0,0.2,1) motion-reduce:transition-none ${thumbSizeClass} ${thumbTranslateClass} ${thumbClassName}`}
          />
        </span>
      </span>
    );
  }
);

Switch.displayName = "Switch";
