import { catatGalat } from "./catat-galat.ts";

/**
 * Pemeriksaan eKYC otomatis (opsional) untuk verifikasi KTP — lihat
 * lib/verifikasi-ktp.ts.
 *
 * BELUM ADA PENYEDIA YANG DIPILIH (VIDA, Privy, Verihubs, …) dan belum ada
 * kunci, jadi modul ini sengaja tidak memanggil API apa pun: tanpa
 * EKYC_PROVIDER jawabannya selalu "tidak-tersedia" dan pengajuan masuk antrean
 * petugas di /admin/verifikasi, sama seperti "ragu" dan "gagal". Hanya "lolos"
 * yang langsung menyetujui (metode "ekyc").
 *
 * Memasang penyedia:
 *   1. Tulis adaptor `PenyediaEkyc` di bawah (satu fungsi: kirim NIK, nama,
 *      foto KTP, dan swafoto ke API-nya, terjemahkan jawabannya ke HasilEkyc).
 *      Jangan pernah menjawab "lolos" untuk jawaban yang tidak dipahami.
 *   2. Daftarkan di PENYEDIA dengan nama, mis. `vida: periksaVida`.
 *   3. Setel EKYC_PROVIDER=<nama> (+ kunci penyedia) di .env.
 *   4. Perbarui kebijakan privasi aplikasi: data KTP lalu dikirim ke pihak ketiga.
 */
export type HasilEkyc = "lolos" | "ragu" | "gagal" | "tidak-tersedia";

export type MasukanEkyc = {
  /** 16 angka, sudah lolos periksaNik. */
  nik: string;
  /** Nama akun — bukan nama di KTP; penyedia boleh mengabaikannya. */
  nama: string;
  ktp: { isi: Buffer; mime: string };
  selfie: { isi: Buffer; mime: string };
  /** Batal = jawaban terlalu lama; adaptor wajib meneruskannya ke fetch. */
  sinyal: AbortSignal;
};

export type PenyediaEkyc = (m: MasukanEkyc) => Promise<HasilEkyc>;

/**
 * ── TITIK SAMBUNG ADAPTOR eKYC ──────────────────────────────────────────────
 * Kosong dengan sengaja. Contoh bentuknya (JANGAN diaktifkan tanpa kontrak dan
 * dokumentasi API penyedia yang sesungguhnya):
 *
 *   async function periksaContoh(m: MasukanEkyc): Promise<HasilEkyc> {
 *     const r = await fetch(process.env.EKYC_URL!, { method: "POST", signal: m.sinyal, … });
 *     if (!r.ok) return "tidak-tersedia";
 *     const j = await r.json();
 *     return j.cocok === true && j.skor >= AMBANG ? "lolos" : j.cocok === false ? "gagal" : "ragu";
 *   }
 */
const PENYEDIA: Record<string, PenyediaEkyc> = {};

/** Batas tunggu jawaban penyedia: warga sedang menunggu di layar unggah. */
export const BATAS_TUNGGU_EKYC_MS = 20_000;

/**
 * Periksa satu pengajuan lewat penyedia eKYC yang dipasang (EKYC_PROVIDER).
 * Tidak pernah melempar: penyedia tak dikenal, galat jaringan, atau batas
 * waktu = "tidak-tersedia" (dicatat), dan pengajuannya ditinjau petugas.
 */
export async function periksaEkyc(
  m: Omit<MasukanEkyc, "sinyal">,
  daftar: Record<string, PenyediaEkyc> = PENYEDIA,
): Promise<HasilEkyc> {
  const nama = (process.env.EKYC_PROVIDER ?? "").trim().toLowerCase();
  if (!nama) return "tidak-tersedia";
  const penyedia = Object.hasOwn(daftar, nama) ? daftar[nama] : undefined;
  if (!penyedia) {
    void catatGalat("ekyc", new Error(`EKYC_PROVIDER "${nama}" tidak dikenal — adaptornya belum ditulis di lib/ekyc.ts`));
    return "tidak-tersedia";
  }
  try {
    const hasil = await penyedia({ ...m, sinyal: AbortSignal.timeout(BATAS_TUNGGU_EKYC_MS) });
    return hasil === "lolos" || hasil === "ragu" || hasil === "gagal" ? hasil : "tidak-tersedia";
  } catch (e) {
    void catatGalat("ekyc", e, `penyedia ${nama}`);
    return "tidak-tersedia";
  }
}
