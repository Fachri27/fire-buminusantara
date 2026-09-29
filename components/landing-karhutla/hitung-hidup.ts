"use client";

import { useEffect, useSyncExternalStore } from "react";

/* Angka hidup suka & komentar kartu umpan. Umpan sendiri di-cache (~1 mnt di
   server, 60 dtk di peramban), jadi angkanya dibaca ulang dari /api/hitung:
   satu permintaan gabungan untuk semua kartu yang sedang terpasang, diulang
   tiap SELANG_MS selama tab terlihat, dan segera saat tab kembali terlihat. */

export type Hitung = { suka: number; komentar: number };

const SELANG_MS = 15_000;
const MAKS_ID = 60; // sama dengan batas /api/hitung

const angka = new Map<number, Hitung>();
const pendengar = new Set<() => void>();
const terpasang = new Map<number, number>(); // id → jumlah kartu yang memakainya
let tundaan: number | null = null;
let detak: number | null = null;

function beri() {
  for (const f of pendengar) f();
}

export function aturHitung(id: number, ubah: Partial<Hitung>) {
  const lama = angka.get(id) ?? { suka: 0, komentar: 0 };
  angka.set(id, { ...lama, ...ubah });
  beri();
}

export function bacaHitung(id: number): Hitung | undefined {
  return angka.get(id);
}

async function ambil(ids: number[]) {
  for (let i = 0; i < ids.length; i += MAKS_ID) {
    try {
      const r = await fetch(`/api/hitung?id=${ids.slice(i, i + MAKS_ID).join(",")}`, { cache: "no-store" });
      if (!r.ok) continue;
      const j = (await r.json()) as Record<string, Hitung>;
      for (const [id, h] of Object.entries(j)) {
        const lama = angka.get(Number(id));
        if (!lama || lama.suka !== h.suka || lama.komentar !== h.komentar) angka.set(Number(id), h);
      }
      beri();
    } catch {
      /* jaringan putus: angka terakhir dibiarkan */
    }
  }
}

function segarkanSemua() {
  if (document.visibilityState === "visible" && terpasang.size > 0) void ambil([...terpasang.keys()]);
}

function jadwalkan() {
  if (tundaan !== null) return;
  // Kartu terpasang berurutan dalam satu render — tunggu sebentar supaya
  // semuanya ikut satu permintaan.
  tundaan = window.setTimeout(() => {
    tundaan = null;
    segarkanSemua();
  }, 100);
}

function pasang(id: number) {
  terpasang.set(id, (terpasang.get(id) ?? 0) + 1);
  jadwalkan();
  if (detak === null) {
    detak = window.setInterval(segarkanSemua, SELANG_MS);
    document.addEventListener("visibilitychange", segarkanSemua);
  }
  return () => {
    const n = (terpasang.get(id) ?? 1) - 1;
    if (n > 0) terpasang.set(id, n);
    else terpasang.delete(id);
    if (terpasang.size === 0 && detak !== null) {
      window.clearInterval(detak);
      detak = null;
      document.removeEventListener("visibilitychange", segarkanSemua);
    }
  };
}

function langgan(f: () => void) {
  pendengar.add(f);
  return () => pendengar.delete(f);
}

/** Angka hidup satu laporan — undefined sampai jawaban pertama tiba, pemanggil
 *  memakai angka umpan sebagai cadangannya. */
export function useHitungHidup(id: number): Hitung | undefined {
  useEffect(() => pasang(id), [id]);
  return useSyncExternalStore(langgan, () => angka.get(id), () => undefined);
}
