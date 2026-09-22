"use client";

import { useSyncExternalStore } from "react";

const langgananKosong = () => () => {};

/**
 * Hook deteksi status terpasang di browser (client-side mounted)
 * yang aman untuk SSR, bebas cascading renders, dan sesuai dengan aturan
 * react-hooks/set-state-in-effect pada React 19.
 */
export function useTerpasang(): boolean {
  return useSyncExternalStore(
    langgananKosong,
    () => true,
    () => false
  );
}

export const useMounted = useTerpasang;
