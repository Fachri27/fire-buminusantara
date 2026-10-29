import type { HasilAksi } from "../use-aksi";

/** Satu baris GET /api/admin/siaran (lib/siaran.ts → daftarSiaran). */
export type Siaran = {
  ruang: string; judul: string; nama: string; mulai: number;
  lat: number | null; lng: number | null; akurasi: number | null;
  publik: boolean; penonton: number;
  /** Akun berbeda yang melaporkan siaran ini (laporan belum ditinjau). */
  laporan?: number;
};

/** Sama dengan AMBANG_LAPORAN di lib/siaran.ts: sebanyak ini akun melapor →
 *  siaran publik turun dari beranda warga sampai laporannya ditinjau. */
export const AMBANG_TURUN = 3;

/** Nama ruang yang sah — sama dengan POLA_RUANG di lib/siaran.ts. */
export const POLA_RUANG = /^siaran-[a-z0-9-]+$/;

/**
 * Peran pengirim di ruang siaran, dari identity — BUKAN dari nama: nama bebas
 * diisi pelapor/warga ("Petugas BPBD" pun lolos), identity diterbitkan server.
 */
export function peranDari(identity: string): "Petugas" | "Pelapor" | null {
  if (identity.startsWith("petugas-")) return "Petugas";
  if (identity.startsWith("pelapor-")) return "Pelapor";
  return null;
}

/** DELETE /api/admin/siaran?ruang=… — ruangnya dibuang untuk semua orang
 *  (pelapor & penonton terputus). Rutenya memeriksa sesi CMS sendiri. */
export async function akhiriSiaran(ruang: string): Promise<HasilAksi> {
  const r = await fetch(`/api/admin/siaran?ruang=${encodeURIComponent(ruang)}`, { method: "DELETE" });
  if (r.ok) return { ok: true };
  const isi = (await r.json().catch(() => null)) as { galat?: string } | null;
  return { ok: false, galat: isi?.galat ?? `Siaran gagal diakhiri (HTTP ${r.status}).` };
}
