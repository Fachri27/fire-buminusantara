import { galat, penggunaDari } from "@/lib/akun-mobile";
import { lewatBatas } from "@/lib/batas-laju";
import { TAYANG } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { batalSukaAkun, jumlahSuka, sukaiAkun } from "@/lib/suka";
import { ipDari } from "@/lib/turnstile";

/**
 * POST = suka, DELETE = batal, dari akun aplikasi mobile → { disukai, jumlah }.
 *
 * Akun menggantikan penangkal bot rute suka web (same-origin + POLA_BOT, yang
 * menolak user agent okhttp milik React Native): satu suka per akun per
 * kejadian, dijamin unique index event_likes. Laju tetap dibatasi per akun.
 */
async function tangani(req: Request, params: Promise<{ id: string }>, suka: boolean) {
  const p = await penggunaDari(req);
  if (!p) return galat("Masuk dulu untuk menyukai.", 401);

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return galat("Laporan tidak ditemukan.", 404);
  if (await lewatBatas(`suka-akun:${p.id}`, 120, 600)) return galat("Terlalu cepat. Coba lagi sebentar lagi.", 429);
  if (!(await prisma.events.findFirst({ where: { id, ...TAYANG }, select: { id: true } }))) {
    return galat("Laporan tidak ditemukan.", 404);
  }

  if (suka) await sukaiAkun(id, p.id, ipDari(req), req.headers.get("user-agent"));
  else await batalSukaAkun(id, p.id);
  return Response.json({ disukai: suka, jumlah: await jumlahSuka(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return tangani(req, params, true);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return tangani(req, params, false);
}
