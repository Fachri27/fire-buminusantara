import { revalidateTag } from "next/cache";
import { galat, penggunaDari } from "@/lib/akun-mobile";
import { lewatBatas } from "@/lib/batas-laju";
import { TAYANG } from "@/lib/events";
import { bentukKomentar, simpanKomentar } from "@/lib/komentar";
import { prisma } from "@/lib/prisma";
import { ipDari } from "@/lib/turnstile";

const BATAS_ISI = 2000;

/**
 * POST /api/mobile/laporan/{id}/komentar { isi, balas_ke? } → 201 { komentar }
 *
 * Komentar dari akun aplikasi. Akun menggantikan Turnstile & nama/email form
 * web; sensor kata kasar (saring) tetap berlaku karena lewat simpanKomentar.
 * Daftar komentarnya tetap dibaca aplikasi dari GET /api/laporan/{id}/komentar.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await penggunaDari(req);
  if (!p) return galat("Masuk dulu untuk berkomentar.", 401);

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return galat("Laporan tidak ditemukan.", 404);
  if (!(await prisma.events.findFirst({ where: { id, ...TAYANG }, select: { id: true } }))) {
    return galat("Laporan tidak ditemukan.", 404);
  }

  const isi = await req.json().catch(() => null);
  const teks = String(isi?.isi ?? "").trim();
  if (!teks) return galat("Komentar wajib diisi.", 422);
  if (teks.length > BATAS_ISI) return galat(`Komentar maksimal ${BATAS_ISI} karakter.`, 422);

  // Jeda 3 detik seperti form web, ditambah plafon per akun.
  if ((await lewatBatas(`komentar-jeda:${p.id}`, 1, 3)) || (await lewatBatas(`komentar-akun:${p.id}`, 30, 600))) {
    return galat("Mohon tunggu beberapa detik sebelum mengirim komentar lagi.", 429);
  }

  const balasKe = Number.isInteger(Number(isi?.balas_ke)) && Number(isi.balas_ke) > 0 ? Number(isi.balas_ke) : null;
  let baris;
  try {
    baris = await simpanKomentar({ eventId: id, nama: p.name, email: p.email, isi: teks, balasKe, ip: ipDari(req), userId: p.id });
  } catch (e) {
    // simpanKomentar hanya melempar pesan ramah (induk balasan tidak ada); sisanya galat server.
    const pesan = e instanceof Error && e.message.startsWith("Komentar yang dibalas") ? e.message : null;
    return galat(pesan ?? "Komentar gagal disimpan. Coba lagi.", pesan ? 422 : 500);
  }

  revalidateTag("komentar", "max");
  return Response.json({ komentar: bentukKomentar(baris) }, { status: 201 });
}
