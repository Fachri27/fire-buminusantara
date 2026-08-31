"use client";

import { useEffect } from "react";

const LEBAR = 1920;
const TINGGI = 1080;

/** Mode tata letak menurut CSS. */
export function modeTataLetak(): "panggung" | "aliran" {
  const nilai = getComputedStyle(document.documentElement)
    .getPropertyValue("--mode")
    .trim()
    .replace(/^["']|["']$/g, "");
  return nilai === "panggung" ? "panggung" : "aliran";
}

/**
 * Penskalaan kanvas panggung.
 *
 * Mode panggung memakai kanvas 1920x1080 supaya seluruh ukuran di CSS bisa
 * ditulis dalam piksel desain; kanvas itu lalu diperkecil agar pas di viewport.
 * Ambangnya datang dari CSS (--mode), tidak dihitung ulang di sini.
 */
export function gunakanPanggung() {
  useEffect(() => {
    const kanvas = document.querySelectorAll<HTMLElement>("[data-kanvas]");
    if (!kanvas.length) return;

    const skalakan = () => {
      const skala =
        modeTataLetak() === "panggung"
          ? Math.min(window.innerWidth / LEBAR, window.innerHeight / TINGGI)
          : 1;
      kanvas.forEach((el) => el.style.setProperty("--skala", String(skala)));
    };

    skalakan();
    window.addEventListener("resize", skalakan);
    return () => window.removeEventListener("resize", skalakan);
  }, []);
}
