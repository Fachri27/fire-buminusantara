import { createHmac } from "node:crypto";
import { prisma } from "./prisma.ts";
import kataKasar from "./kata-kasar.json" with { type: "json" };

/** Model polimorfik dipakai bersama halaman lain di Pasopati; nilainya harus
 *  sama persis dengan yang ditulis Laravel. */
const TIPE = "App\\Models\\Event";

export const POLA_KASAR = new RegExp(
  `\\b(?:${(kataKasar as string[])
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`,
  "giu"
);

export type Komentar = {
  id: number;
  nama: string;
  isi: string;
  waktu: string;
  /** Setiap balasan membawa sebutan, termasuk saat membalas komentar sendiri:
   *  balasan ditampilkan datar dalam satu utas, jadi sebutan inilah satu-satunya
   *  penanda komentar mana yang sedang dijawab. */
  sebutan: string | null;
  /** Penanda penulis yang stabil tapi tidak bisa dibalik (HMAC) — untuk fitur
   *  "Blokir" di aplikasi mobile, tanpa membocorkan email atau IP. */
  penulis: string;
  balasan?: Komentar[];
};

function hmacPenulis(kunci: string): string {
  return createHmac("sha256", `penulis:${process.env.SESSION_SECRET ?? ""}`).update(kunci).digest("hex").slice(0, 16);
}

/** Email pengganti di komentar akun yang sudah dihapus — lihat emailAkunDihapus(). */
const POLA_AKUN_DIHAPUS = /^penulis-([0-9a-f]{16})@akun-dihapus\.invalid$/;

/**
 * Kunci: akun → email → komentar itu sendiri. Komentar tanpa identitas (form
 * web "Anonim") TIDAK dikunci IP atau nama: satu IP CGNAT dan nama "Anonim"
 * dipakai banyak orang, jadi Blokir satu ikut menyembunyikan semuanya — dan
 * komentar anonim jadi bisa dikaitkan satu sama lain.
 */
function penandaPenulis(k: { id: bigint; user_id: bigint | null; email: string | null }): string {
  const dihapus = k.email?.match(POLA_AKUN_DIHAPUS);
  if (dihapus) return dihapus[1];
  return hmacPenulis(k.user_id ? `u:${k.user_id}` : k.email ? `e:${k.email.toLowerCase()}` : `k:${k.id}`);
}

/**
 * Pengganti email komentar saat akunnya dihapus: alamat .invalid yang membawa
 * penanda penulis lama akun itu. Nama & email asli hilang, tapi penandanya
 * tetap unik per akun dan tidak berubah — Blokir di aplikasi tetap berlaku,
 * dan akun-akun terhapus tidak berbagi satu penanda.
 */
export function emailAkunDihapus(userId: bigint): string {
  return `penulis-${hmacPenulis(`u:${userId}`)}@akun-dihapus.invalid`;
}

/** Sensor kata kasar: untuk kata <= 3 huruf sisakan 1 huruf (mis. t**);
 *  untuk kata > 3 huruf sisakan 2 huruf (mis. ba**). */
export function saring(teks: string): string {
  return teks.replace(POLA_KASAR, (cocok) => {
    const simpan = cocok.length <= 3 ? 1 : 2;
    return cocok.slice(0, simpan) + "*".repeat(Math.max(0, cocok.length - simpan));
  });
}

const RELATIF = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
const SATUAN: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000], ["month", 2592000], ["day", 86400],
  ["hour", 3600], ["minute", 60], ["second", 1],
];

/** Padanan diffForHumans() berbahasa Indonesia. */
function waktuRelatif(saat: Date | null): string {
  if (!saat) return "";
  const detik = Math.round((saat.getTime() - Date.now()) / 1000);
  for (const [satuan, besar] of SATUAN) {
    if (Math.abs(detik) >= besar || satuan === "second") {
      return RELATIF.format(Math.round(detik / besar), satuan);
    }
  }
  return "";
}

type Baris = {
  id: bigint; name: string | null; body: string;
  mention_name: string | null; parent_id: bigint | null; created_at: Date | null;
  user_id: bigint | null; email: string | null;
};

/** Baris komentar → bentuk yang dikirim ke klien (web & aplikasi). */
export function bentukKomentar(k: Baris): Komentar {
  return {
    id: Number(k.id),
    nama: k.name ?? "",
    isi: k.body,
    waktu: waktuRelatif(k.created_at),
    sebutan: k.mention_name,
    penulis: penandaPenulis(k),
  };
}

/**
 * Komentar tampil untuk satu laporan: hanya yang lolos moderasi.
 *
 * Akar diurutkan terbaru dulu, sedangkan balasan kronologis — terlama di atas,
 * supaya percakapannya terbaca berurutan.
 *
 * Balasan sedalam apa pun dikumpulkan DATAR di bawah akarnya, bukan bersarang
 * berlapis-lapis: rel pop-up ini sempit, dan @sebutan sudah cukup menerangkan
 * siapa membalas siapa.
 *
 * Yang diambil 500 komentar TERBARU: di laporan ramai yang terpotong komentar
 * lama, bukan komentar yang baru saja ditulis warga.
 */
export async function daftarKomentar(eventId: number): Promise<Komentar[]> {
  const [semua, tersembunyi] = await Promise.all([
    prisma.comments.findMany({
      where: { commentable_type: TIPE, commentable_id: eventId, is_approved: true },
      orderBy: { created_at: "desc" },
      take: 500,
      select: {
        id: true, name: true, body: true, mention_name: true, parent_id: true, created_at: true,
        user_id: true, email: true,
      },
    }) as Promise<Baris[]>,
    // Hanya kerangka utas: untuk menyambung balasan yang induknya disembunyikan.
    prisma.comments.findMany({
      where: { commentable_type: TIPE, commentable_id: eventId, is_approved: false },
      select: { id: true, parent_id: true },
    }),
  ]);
  return susunKomentar(semua, tersembunyi);
}

/**
 * Susun komentar tampil menjadi utas. Komentar yang disembunyikan (moderator,
 * atau dilaporkan warga) dilompati: balasan di bawahnya menempel ke leluhur
 * terdekat yang tampil, atau menjadi akar bila tidak ada. Tanpa ini satu
 * komentar yang disembunyikan ikut menghilangkan balasan sopan orang lain, dan
 * angka komentar di kartu umpan (semua is_approved) tidak cocok dengan daftar.
 */
export function susunKomentar(semua: Baris[], tersembunyi: { id: bigint; parent_id: bigint | null }[]): Komentar[] {
  const indukAsli = new Map<number, number>();
  for (const k of [...semua, ...tersembunyi]) indukAsli.set(Number(k.id), k.parent_id ? Number(k.parent_id) : 0);
  const tampil = new Set(semua.map((k) => Number(k.id)));

  const anak = new Map<number, Baris[]>();
  for (const k of semua) {
    let induk = indukAsli.get(Number(k.id)) ?? 0;
    // Batas langkah hanya pengaman; rantai induk tidak pernah melingkar.
    for (let n = 0; induk && !tampil.has(induk) && n < 100; n++) induk = indukAsli.get(induk) ?? 0;
    if (!tampil.has(induk)) induk = 0;
    (anak.get(induk) ?? anak.set(induk, []).get(induk)!).push(k);
  }

  const kumpulkan = (indukId: number): Baris[] => {
    const hasil: Baris[] = [];
    for (const balasan of anak.get(indukId) ?? []) {
      hasil.push(balasan, ...kumpulkan(Number(balasan.id)));
    }
    return hasil;
  };

  return (anak.get(0) ?? [])
    .slice()
    .sort((a, b) => (b.created_at?.getTime() ?? 0) - (a.created_at?.getTime() ?? 0))
    .map((akar) => ({
      ...bentukKomentar(akar),
      balasan: kumpulkan(Number(akar.id))
        .sort((a, b) => (a.created_at?.getTime() ?? 0) - (b.created_at?.getTime() ?? 0))
        .map(bentukKomentar),
    }));
}

/**
 * Simpan satu komentar. Induk dicari DENGAN SYARAT laporan yang sama: tanpa itu
 * sebuah balasan bisa ditempelkan ke komentar milik laporan lain lewat id yang
 * ditebak.
 */
export async function simpanKomentar(input: {
  eventId: number; nama: string; email: string | null; isi: string;
  balasKe: number | null; ip: string | null;
  /** Akun aplikasi mobile yang menulis; form web tidak punya akun. */
  userId?: bigint | null;
}) {
  return await prisma.$transaction(async (tx) => {
    let parentId: bigint | null = null;
    let mentionName: string | null = null;

    if (input.balasKe) {
      const induk = await tx.comments.findFirst({
        where: {
          id: input.balasKe,
          commentable_type: TIPE,
          commentable_id: input.eventId,
          is_approved: true,
        },
        select: { id: true, name: true },
      });

      if (!induk) {
        throw new Error("Komentar yang dibalas tidak ditemukan atau telah dihapus.");
      }

      parentId = induk.id;
      mentionName = induk.name ? saring(induk.name) : null;
    }

    return await tx.comments.create({
      data: {
        commentable_type: TIPE,
        commentable_id: input.eventId,
        // Nama tampil publik di samping isinya, jadi ikut disensor — termasuk
        // nama lama yang tersimpan sebelum nama akun disaring.
        name: saring(input.nama),
        // Alamat pengganti akun terhapus tidak boleh diketik orang lain: ia
        // menentukan penanda penulis (penandaPenulis).
        email: input.email && POLA_AKUN_DIHAPUS.test(input.email) ? null : input.email,
        user_id: input.userId ?? null,
        body: saring(input.isi),
        ip_address: input.ip,
        is_approved: true,
        parent_id: parentId,
        mention_name: mentionName,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  });
}
