"use server";

import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { wajibSesi } from "@/lib/sesi";
import { catatGalat } from "@/lib/catat-galat";
import { umumkanTunggakan } from "@/lib/loket-tunggakan";
import { aturPersetujuan } from "@/lib/moderasi-komentar";

import type { HasilAksi } from "../use-aksi";

const JENIS = ["komentar", "laporan", "siaran"] as const;
type Jenis = (typeof JENIS)[number];

/** Sama dengan batas target di POST /api/mobile/laporkan. */
const jenisSah = (jenis: unknown): jenis is Jenis => JENIS.includes(jenis as Jenis);
const targetSah = (target: unknown): target is string =>
  typeof target === "string" && target.length > 0 && target.length <= 100;
// P2025: komentarnya sudah tidak ada (dihapus editor lain).
const sudahHilang = (e: unknown) => (e as { code?: unknown } | null)?.code === "P2025";

/** Semua laporan 'baru' untuk satu konten → 'ditinjau': keluar dari antrean
 *  dan tidak lagi dihitung untuk sembunyi otomatis. */
function tandai(jenis: Jenis, target: string) {
  return prisma.content_reports.updateMany({
    where: { jenis, target_id: target, status: "baru" },
    data: { status: "ditinjau" },
  });
}

/** Tandai ditinjau tanpa mengubah kontennya (laporannya tidak berdasar, atau
 *  sudah ditindak di halaman lain). */
export async function aksiTandaiDitinjau(jenis: string, target: string): Promise<HasilAksi> {
  await wajibSesi();
  if (!jenisSah(jenis) || !targetSah(target)) return { ok: false, galat: "Laporan tidak sah." };
  try {
    await tandai(jenis, target);
  } catch (e) {
    catatGalat("Tinjau laporan konten GAGAL", e, `${jenis}:${target}`);
    return { ok: false, galat: "Gagal menyimpan. Coba lagi." };
  }
  return { ok: true };
}

/**
 * Sembunyikan / pulihkan komentar yang dilaporkan, lalu tandai laporannya
 * ditinjau. aturPersetujuan juga memperbarui updated_at — laporan yang masuk
 * sebelum keputusan ini tidak ikut menyembunyikannya lagi.
 */
export async function aksiKomentarDilaporkan(target: string, tampil: boolean): Promise<HasilAksi> {
  await wajibSesi();
  if (!targetSah(target) || !/^\d{1,15}$/.test(target)) return { ok: false, galat: "Komentar tidak sah." };
  try {
    await aturPersetujuan(Number(target), tampil === true);
    await tandai("komentar", target);
  } catch (e) {
    if (sudahHilang(e)) return { ok: false, galat: "Komentar ini sudah dihapus. Tandai laporannya ditinjau saja." };
    catatGalat("Moderasi komentar dilaporkan GAGAL", e, `id=${target}`);
    return { ok: false, galat: "Gagal menyimpan. Coba lagi." };
  }
  // Sama dengan aksi di /admin/komentar: lencana tunggakan & umpan publik.
  try {
    updateTag("tunggakan");
    updateTag("komentar");
  } catch {}
  umumkanTunggakan();
  return { ok: true };
}
