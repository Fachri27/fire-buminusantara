"use client";

import { useSyncExternalStore } from "react";

/* Seluler atau bukan — cerminan varian aliran/panggung di JS. Snapshot server
   sengaja panggung (kedua rel dirender) supaya markup SSR lengkap; klien
   seluler melepas rel kiri setelah hidrasi. Pola yang sama dengan
   gunakanKolomMasonry di index. */
export function useAliran(): boolean {
  return useSyncExternalStore(
    (ubah) => {
      const mq = window.matchMedia("not all and (min-width: 1024px) and (min-height: 560px)");
      mq.addEventListener("change", ubah);
      return () => mq.removeEventListener("change", ubah);
    },
    () => window.matchMedia("not all and (min-width: 1024px) and (min-height: 560px)").matches,
    () => false,
  );
}