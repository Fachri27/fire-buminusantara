import { createHash } from "node:crypto";
import { prisma } from "./prisma.ts";

/**
 * Suka (jempol) pengunjung pada kejadian umpan. Tanpa akun: satu suka per
 * perangkat per kejadian, perangkat = sha256(ip|user agent). IP & user agent
 * disimpan mentah untuk dipantau di /admin/suka.
 */

const BATAS_UA = 512;

export function penandaPengunjung(ip: string | null, ua: string | null): string {
  return createHash("sha256").update(`${ip ?? ""}|${ua ?? ""}`).digest("hex");
}

/**
 * INSERT IGNORE (skipDuplicates), bukan upsert: di MySQL upsert Prisma adalah
 * SELECT lalu INSERT, jadi dua ketukan serentak membuat yang kalah balapan kena
 * P2002 (unique) dan dijawab 500, padahal sukanya tersimpan.
 */
async function simpanSuka(eventId: number, visitor_hash: string, ip: string | null, ua: string | null) {
  await prisma.event_likes.createMany({
    data: [{
      event_id: eventId,
      visitor_hash,
      ip_address: ip,
      user_agent: ua?.slice(0, BATAS_UA) ?? null,
      created_at: new Date(),
    }],
    skipDuplicates: true,
  });
  umumkanHitung(eventId);
}

/** Suka — idempoten: suka kedua dari perangkat yang sama diabaikan. */
export async function sukai(eventId: number, ip: string | null, ua: string | null) {
  await simpanSuka(eventId, penandaPengunjung(ip, ua), ip, ua);
}

export async function batalSuka(eventId: number, ip: string | null, ua: string | null) {
  await prisma.event_likes.deleteMany({
    where: { event_id: eventId, visitor_hash: penandaPengunjung(ip, ua) },
  });
  umumkanHitung(eventId);
}

/**
 * Suka dari akun aplikasi mobile memakai tabel yang sama, satu suka per akun
 * per kejadian. Penandanya sha256 akun, bukan IP+UA: masukan `akun:<id>` tak
 * pernah bertabrakan dengan `<ip>|<ua>` milik pengunjung web.
 */
export function penandaAkun(userId: bigint | number): string {
  return createHash("sha256").update(`akun:${userId}`).digest("hex");
}

export async function sukaiAkun(eventId: number, userId: bigint, ip: string | null, ua: string | null) {
  await simpanSuka(eventId, penandaAkun(userId), ip, ua);
}

export async function batalSukaAkun(eventId: number, userId: bigint) {
  await prisma.event_likes.deleteMany({ where: { event_id: eventId, visitor_hash: penandaAkun(userId) } });
  umumkanHitung(eventId);
}

/** Id kejadian yang disukai akun ini, terbaru dulu. */
export async function kejadianDisukaiAkun(userId: bigint): Promise<number[]> {
  const baris = await prisma.event_likes.findMany({
    where: { visitor_hash: penandaAkun(userId) },
    orderBy: { id: "desc" },
    take: 1000,
    select: { event_id: true },
  });
  return baris.map((r) => Number(r.event_id));
}

export function jumlahSuka(eventId: number) {
  return prisma.event_likes.count({ where: { event_id: eventId } });
}

export type BarisSuka = {
  id: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date | null;
  event: { id: number; title_id: string };
};

/** Suka terbaru untuk CMS, disertai kejadiannya. */
export async function daftarSuka(halaman = 1, batas = 20): Promise<{ daftar: BarisSuka[]; total: number }> {
  const [total, baris] = await Promise.all([
    prisma.event_likes.count(),
    prisma.event_likes.findMany({
      orderBy: { id: "desc" },
      skip: (halaman - 1) * batas,
      take: batas,
      select: {
        id: true, ip_address: true, user_agent: true, created_at: true,
        events: { select: { id: true, title_id: true } },
      },
    }),
  ]);
  return {
    total,
    daftar: baris.map((r) => ({
      id: Number(r.id),
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      created_at: r.created_at,
      event: { id: Number(r.events.id), title_id: r.events.title_id },
    })),
  };
}

export type Hitung = { suka: number; komentar: number };

/** "3,1,x,3" (?id= di /api/hitung) → [3, 1]: id kejadian unik yang sah, paling banyak `maks`. */
export function daftarId(teks: string | null, maks: number): number[] {
  return [...new Set((teks ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, maks);
}

/** Jumlah suka & komentar tersetujui terkini untuk sekumpulan kejadian —
 *  tanpa cache, untuk angka hidup di kartu umpan. */
export async function hitungLangsung(ids: number[]): Promise<Record<number, Hitung>> {
  const [suka, komentar] = await Promise.all([
    prisma.event_likes.groupBy({ by: ["event_id"], where: { event_id: { in: ids } }, _count: true }),
    prisma.comments.groupBy({
      by: ["commentable_id"],
      where: { commentable_type: "App\\Models\\Event", is_approved: true, commentable_id: { in: ids } },
      _count: true,
    }),
  ]);
  const hasil: Record<number, Hitung> = {};
  for (const id of ids) hasil[id] = { suka: 0, komentar: 0 };
  for (const s of suka) hasil[Number(s.event_id)].suka = s._count;
  for (const k of komentar) if (k.commentable_id != null) hasil[Number(k.commentable_id)].komentar = k._count;
  return hasil;
}

/**
 * Loket angka hidup — pemicu aliran SSE /api/hitung/aliran (aplikasi mobile).
 *
 * Pola yang sama dengan lib/loket-tunggakan.ts: peristiwa dalam-proses, bukan
 * Redis, karena satu kontainer web melayani penulis suka/komentar sekaligus
 * alirannya; alirannya tetap mencek database berkala sebagai jaring pengaman.
 * Pengumuman beruntun digabung dan dihitung SEKALI untuk semua aliran — bukan
 * satu kueri per aplikasi yang tersambung. Di globalThis supaya HMR tidak
 * menyisakan loket yatim.
 */
type Loket = { target: EventTarget; antre: Set<number>; tunda: ReturnType<typeof setTimeout> | null; pelanggan: number };
const ruang = globalThis as typeof globalThis & { __loketHitung?: Loket };
const loket = (ruang.__loketHitung ??= { target: new EventTarget(), antre: new Set(), tunda: null, pelanggan: 0 });

const GABUNG_MS = 250;

/** Angka kejadian ini berubah. Tidak pernah melempar: suka/komentarnya sudah tersimpan. */
export function umumkanHitung(eventId: number) {
  if (loket.pelanggan === 0) return;
  loket.antre.add(eventId);
  loket.tunda ??= setTimeout(siarkanHitung, GABUNG_MS);
}

async function siarkanHitung() {
  const ids = [...loket.antre];
  loket.antre.clear();
  loket.tunda = null;
  try {
    loket.target.dispatchEvent(new CustomEvent("ubah", { detail: await hitungLangsung(ids) }));
  } catch {
    // Database sesaat tak terjangkau: jaring pengaman aliran menyusul.
  }
}

/** Berlangganan angka baru { [id]: Hitung }. Kembaliannya melepas langganan. */
export function berlanggananHitung(saatUbah: (angka: Record<number, Hitung>) => void): () => void {
  const f = (e: Event) => saatUbah((e as CustomEvent<Record<number, Hitung>>).detail);
  loket.target.addEventListener("ubah", f);
  loket.pelanggan++;
  return () => {
    loket.target.removeEventListener("ubah", f);
    loket.pelanggan--;
  };
}
