/**
 * Badan JSON kecil dari klien publik (komentar, laporkan, tiket, siaran, profil).
 *
 * req.json() menyangga badan sebesar apa pun sebelum di-parse — satu kiriman
 * ratusan MB cukup untuk menghabiskan memori proses. Di sini Content-Length
 * wajib ada dan ≤ batas (ditolak sebelum satu byte pun dibaca), lalu badannya
 * tetap dibaca dengan atap keras karena header bisa berbohong (chunked).
 */
export const BATAS_BADAN = 16 * 1024;

// `galat` dibaca aplikasi mobile (lib/akun-mobile galat()), `message` dibaca form web.
const terlaluBesar = () =>
  Response.json({ galat: "Kiriman terlalu besar.", message: "Kiriman terlalu besar." }, { status: 413 });

/** JSON objek dari badan permintaan; null bila kosong/rusak; Response 413 bila terlalu besar. */
export async function bacaJson(req: Request, batas = BATAS_BADAN): Promise<Record<string, unknown> | null | Response> {
  const panjang = req.headers.get("content-length");
  if (panjang === null || !(Number(panjang) <= batas)) return terlaluBesar();
  if (!req.body) return null;

  const pembaca = req.body.getReader();
  const potongan: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await pembaca.read();
      if (done) break;
      total += value.byteLength;
      if (total > batas) {
        void pembaca.cancel().catch(() => {});
        return terlaluBesar();
      }
      potongan.push(value);
    }
    const isi: unknown = JSON.parse(Buffer.concat(potongan).toString("utf8"));
    return isi && typeof isi === "object" ? (isi as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
