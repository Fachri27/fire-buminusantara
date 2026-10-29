"use client";

import { useEffect, useSyncExternalStore } from "react";

/* Angka hidup suka & komentar kartu umpan. Umpan sendiri di-cache (~1 mnt di
   server, 60 dtk di peramban), jadi angkanya datang dari aliran SSE
   /api/hitung/aliran: satu koneksi untuk semua kartu yang terpasang, yang
   mengirim angka baru begitu ada suka/komentar — dari web maupun aplikasi
   mobile. Aliran ditutup selama tab tersembunyi; dibuka lagi saat tab terlihat
   dan pesan pertamanya membawa angka terbaru. Bila aliran ditolak (server
   penuh, server lama), angka dibaca sekali dari /api/hitung dan aliran dicoba
   lagi setelah COBA_LAGI_MS. */

export type Hitung = { suka: number; komentar: number };

const MAKS_ID = 60; // sama dengan batas /api/hitung
const MAKS_ID_ALIRAN = 200; // sama dengan batas /api/hitung/aliran
const COBA_LAGI_MS = 30_000;

const angka = new Map<number, Hitung>();
const pendengar = new Set<() => void>();
const terpasang = new Map<number, number>(); // id → jumlah kartu yang memakainya
let tundaan: number | null = null;
let aliran: EventSource | null = null;
let dalamAliran = new Set<number>();
let cobaLagi: number | null = null;

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

function terima(j: Record<string, Hitung>) {
  for (const [id, h] of Object.entries(j)) {
    const lama = angka.get(Number(id));
    if (!lama || lama.suka !== h.suka || lama.komentar !== h.komentar) angka.set(Number(id), h);
  }
  beri();
}

async function ambil(ids: number[]) {
  for (let i = 0; i < ids.length; i += MAKS_ID) {
    try {
      const r = await fetch(`/api/hitung?id=${ids.slice(i, i + MAKS_ID).join(",")}`, { cache: "no-store" });
      if (r.ok) terima((await r.json()) as Record<string, Hitung>);
    } catch {
      /* jaringan putus: angka terakhir dibiarkan */
    }
  }
}

function tutupAliran() {
  aliran?.close();
  aliran = null;
  if (cobaLagi !== null) {
    window.clearTimeout(cobaLagi);
    cobaLagi = null;
  }
}

function bukaAliran() {
  tutupAliran();
  const ids = [...terpasang.keys()].slice(0, MAKS_ID_ALIRAN);
  dalamAliran = new Set(ids);
  const es = new EventSource(`/api/hitung/aliran?id=${ids.join(",")}`);
  aliran = es;
  es.onmessage = (e) => {
    try {
      terima(JSON.parse(e.data) as Record<string, Hitung>);
    } catch {
      /* pesan rusak: tunggu pesan berikutnya */
    }
  };
  es.onerror = () => {
    // CONNECTING = peramban menyambung ulang sendiri. CLOSED = ditolak (503,
    // 404): peramban berhenti, jadi angka dibaca sekali lalu dicoba lagi nanti.
    if (es !== aliran || es.readyState !== EventSource.CLOSED) return;
    aliran = null;
    void ambil(ids);
    cobaLagi = window.setTimeout(() => {
      cobaLagi = null;
      aturAliran();
    }, COBA_LAGI_MS);
  };
}

function aturAliran() {
  if (document.visibilityState !== "visible" || terpasang.size === 0) return tutupAliran();
  if (cobaLagi !== null) return; // sedang menunggu setelah ditolak
  // Kartu yang dilepas tidak memutus aliran (angkanya tak terpakai, tak merugikan);
  // hanya kartu baru di luar aliran yang membuatnya dibuka ulang.
  if (aliran && [...terpasang.keys()].every((id) => dalamAliran.has(id))) return;
  bukaAliran();
}

function jadwalkan() {
  if (tundaan !== null) return;
  // Kartu terpasang berurutan dalam satu render — tunggu sebentar supaya
  // semuanya ikut satu koneksi.
  tundaan = window.setTimeout(() => {
    tundaan = null;
    aturAliran();
  }, 100);
}

function pasang(id: number) {
  if (terpasang.size === 0) document.addEventListener("visibilitychange", aturAliran);
  terpasang.set(id, (terpasang.get(id) ?? 0) + 1);
  jadwalkan();
  return () => {
    const n = (terpasang.get(id) ?? 1) - 1;
    if (n > 0) terpasang.set(id, n);
    else terpasang.delete(id);
    if (terpasang.size === 0) {
      document.removeEventListener("visibilitychange", aturAliran);
      tutupAliran();
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
