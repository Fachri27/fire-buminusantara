"use client";

import { useSyncExternalStore } from "react";

/**
 * Hook langganan Media Query yang aman untuk SSR dan bebas tearing
 * menggunakan useSyncExternalStore bawaan React 18/19.
 */
export function useMediaQuery(kueri: string, nilaiAwalServer = false): boolean {
  return useSyncExternalStore(
    (langganan) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia(kueri);
      mq.addEventListener("change", langganan);
      return () => mq.removeEventListener("change", langganan);
    },
    () => (typeof window !== "undefined" ? window.matchMedia(kueri).matches : nilaiAwalServer),
    () => nilaiAwalServer
  );
}

/** Langganan prefers-reduced-motion: reduce */
export function useKurangiGerak(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)", false);
}

/** Langganan breakpoint layar ponsel (<= 860px) */
export function usePonsel(): boolean {
  return useMediaQuery("(max-width: 860px)", false);
}
