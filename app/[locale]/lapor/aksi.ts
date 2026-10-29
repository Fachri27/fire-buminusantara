"use server";

import { headers } from "next/headers";
import type { HasilLapor } from "@/lib/laporan-publik";
import { ipDari, turnstileSah } from "@/lib/turnstile";
import { buatTiket } from "@/lib/tiket-lapor";

/** Keadaan yang dibaca form lewat useActionState. `null` = belum ada kiriman. */
export type KeadaanLapor = HasilLapor | null;

/**
 * Tukar token Turnstile (umur 300 dtk) dengan tiket 30 menit SEBELUM unggahan
 * besar berangkat — lihat lib/tiket-lapor.ts. Permintaannya kecil, jadi token
 * diperiksa selagi masih segar. `null` = captcha gagal.
 *
 * Laporannya sendiri dikirim ke POST /api/lapor dengan tiket ini di header
 * `X-Tiket-Lapor` — bukan server action: Next menyangga seluruh badan server
 * action sebelum captcha dan batas laju sempat diperiksa.
 */
export async function mintaTiketLapor(token: string): Promise<string | null> {
  const ip = ipDari(new Request("http://lokal", { headers: await headers() }));
  return (await turnstileSah(token || null, ip, "lapor")) ? buatTiket() : null;
}
