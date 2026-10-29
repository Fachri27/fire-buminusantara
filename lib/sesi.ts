import { createHash, randomUUID } from "node:crypto";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { lewatBatas, sudahLewat } from "./batas-laju";

const NAMA_COOKIE = "fire_sesi";
const UMUR = 60 * 60 * 8; // 8 jam

function kunci() {
  const rahasia = process.env.SESSION_SECRET;
  if (!rahasia) throw new Error("SESSION_SECRET belum disetel di .env");
  return new TextEncoder().encode(rahasia);
}

/** `iat`: detik Unix saat token diterbitkan — hanya diisi bacaSesi(). */
export type Sesi = { id: number; nama: string; peran: string; iat?: number };

/**
 * Sesi CMS, disimpan sebagai JWT bertanda tangan di cookie httpOnly.
 *
 * Tidak memakai tabel sessions milik Laravel: formatnya khas Laravel
 * (terenkripsi dengan APP_KEY, diserialisasi PHP), dan ikut membacanya berarti
 * mengikat /fire pada rincian internal framework lain. Yang dipakai bersama
 * cukup tabel users — jadi akun dan kata sandinya tetap satu.
 */
export async function buatSesi(sesi: Sesi) {
  const akun = await prisma.users.findUnique({ where: { id: sesi.id }, select: { password: true } });
  const token = await new SignJWT({ ...sesi, sv: sidikSandi(akun?.password) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(`${UMUR}s`)
    .sign(kunci());

  (await cookies()).set(NAMA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UMUR,
  });
}

/** Sidik kata sandi di dalam token: setel ulang sandi = semua sesi lama
 *  akun itu gugur. Hash dari hash — tokennya tidak membawa potongan bcrypt. */
function sidikSandi(hash: string | null | undefined): string {
  return createHash("sha256").update(hash ?? "").digest("hex").slice(0, 16);
}

/**
 * Tanda tangan JWT saja tidak cukup: akun bisa dihapus, diturunkan perannya,
 * atau disetel ulang sandinya dari /admin/pengguna. Karena itu tiap
 * permintaan mencocokkan token ke baris users (satu baca PK, di-dedupe per
 * render oleh cache()) — perubahannya berlaku saat itu juga, bukan setelah
 * token 8 jam habis. Nama & peran diambil dari DB, bukan dari token.
 */
export const bacaSesi = cache(async (): Promise<Sesi | null> => {
  const token = (await cookies()).get(NAMA_COOKIE)?.value;
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, kunci()));
  } catch {
    return null; // kedaluwarsa atau tanda tangannya tidak cocok
  }
  const id = Number(payload.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  // Token tanpa jti (terbit sebelum ada daftar cabut) tidak bisa dicabut — tolak.
  if (typeof payload.jti !== "string" || (await sudahLewat(kunciCabut(payload.jti), 1))) return null;
  const akun = await prisma.users.findUnique({
    where: { id },
    select: { name: true, role: true, password: true },
  });
  if (!akun || !bolehKelola(akun.role) || payload.sv !== sidikSandi(akun.password)) return null;
  return { id, nama: akun.name, peran: akun.role, iat: payload.iat };
});

/**
 * Daftar cabut token yang sudah "Keluar": salinan cookie yang dicuri tidak
 * berlaku lagi sampai sisa umurnya habis. Memakai penghitung lib/batas-laju —
 * Redis dengan TTL, cadangan memori proses saat Redis mati (tidak fail-open).
 */
const kunciCabut = (jti: string) => `sesi-cabut:${jti}`;

export async function hapusSesi() {
  const toko = await cookies();
  const token = toko.get(NAMA_COOKIE)?.value;
  toko.delete({ name: NAMA_COOKIE, path: "/" });
  if (!token) return;
  try {
    const { payload } = await jwtVerify(token, kunci());
    const sisa = (payload.exp ?? 0) - Math.floor(Date.now() / 1000);
    if (payload.jti && sisa > 0) await lewatBatas(kunciCabut(payload.jti), 0, sisa);
  } catch {
    // kedaluwarsa atau palsu — memang sudah tidak berlaku
  }
}

/**
 * Menambah passkey hanya boleh tak lama setelah masuk (sandi atau passkey):
 * cookie sesi curian yang sudah berumur tidak bisa dipakai menanam passkey
 * milik penyerang.
 */
export const SEGAR_DETIK = 10 * 60;

export function sesiSegar(sesi: Sesi): boolean {
  return sesi.iat !== undefined && Date.now() / 1000 - sesi.iat < SEGAR_DETIK;
}

/** Peran yang boleh mengelola kejadian — sama dengan role:admin,editor di
 *  routes/web.php Laravel. */
export function bolehKelola(peran: string): boolean {
  return peran === "admin" || peran === "editor";
}

/**
 * Memastikan pengguna memiliki sesi yang sah dan peran yang berwenang (admin/editor).
 * Mengembalikan objek Sesi jika sah, atau null jika tidak berwenang.
 */
export async function pastikanBolehKelola(): Promise<Sesi | null> {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) return null;
  return sesi;
}

/**
 * Memastikan pengguna memiliki sesi yang sah dan peran yang berwenang (admin/editor).
 * Mengalihkan ke /admin/login jika belum masuk, atau ke /admin/kejadian jika peran tidak mencukupi peranKhusus.
 */
export async function wajibSesi(peranKhusus?: "admin"): Promise<Sesi> {
  const sesi = await bacaSesi();
  if (!sesi || !bolehKelola(sesi.peran)) redirect("/admin/login");
  if (peranKhusus && sesi.peran !== peranKhusus) redirect("/admin/kejadian");
  return sesi;
}

