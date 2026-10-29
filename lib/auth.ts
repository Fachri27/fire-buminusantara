import bcrypt from "bcryptjs";
import { prisma } from "./prisma.ts";
import type { Sesi } from "./sesi.ts";

/** Biaya bcrypt = bawaan Laravel (BCRYPT_ROUNDS 12), untuk hash baru dari CMS. */
export const BIAYA_BCRYPT = 12;

/**
 * Hash acuan untuk mencegah timing attack (user enumeration).
 * Waktu komputasi compare tetap sama apakah user/password ada atau tidak —
 * karena itu biayanya harus sama dengan hash asli (BIAYA_BCRYPT).
 */
export const DUMMY_HASH = "$2b$12$akDFxY8e5bgurmSrPLWzf.r0GvHS1cSuLmgFs.vh93w2qb9r3b2nW";

/** Bentuk email sederhana. Panjang dicek dulu, dan pola domainnya tidak
 *  ambigu (segmen tanpa titik dipisah titik) — tidak bisa backtracking. */
export function emailSah(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/**
 * Peran yang boleh mengelola CMS (admin atau editor).
 */
export function bolehKelola(peran: string): boolean {
  return peran === "admin" || peran === "editor";
}

/**
 * Masuk memakai akun Pasopati yang sudah ada.
 *
 * Kata sandinya bcrypt buatan Laravel, yang menulis awalan `$2y$`. Sebagian
 * pustaka bcrypt hanya mengenali `$2a$`/`$2b$` dan menolaknya, tetapi bcryptjs
 * membacanya apa adanya — sudah diuji terhadap hash gaya Laravel, jadi tidak
 * ada penukaran awalan di sini.
 */
export async function masuk(email: string, sandi: string): Promise<Sesi | null> {
  const user = await prisma.users.findUnique({
    where: { email },
    select: { id: true, name: true, role: true, password: true },
  });

  // Lindungi dari serangan pencacahan pengguna berbasis waktu (timing attack).
  // Akun Google murni juga tidak punya kata sandi.
  if (!user || !user.password) {
    await bcrypt.compare(sandi, DUMMY_HASH);
    return null;
  }

  if (!(await bcrypt.compare(sandi, user.password))) return null;

  // Peran diperiksa saat masuk, bukan cuma saat membuka halaman: tidak ada
  // gunanya memberi sesi kepada akun yang tidak boleh mengelola apa pun.
  if (!bolehKelola(user.role)) return null;

  return { id: Number(user.id), nama: user.name, peran: user.role };
}


/**
 * Pihak WebAuthn untuk permintaan ini. `daftar` berisi asal yang diizinkan,
 * dipisah koma (WEBAUTHN_ORIGIN). Host permintaan hanya memilih dari daftar
 * itu — host asing jatuh ke asal pertama, jadi tidak bisa dipalsukan.
 */
export function pihakWebAuthn(daftar: string, host: string | null | undefined): { asal: string; rpID: string } {
  const asalList = daftar.split(",").map((s) => s.trim()).filter(Boolean).map((s) => new URL(s).origin);
  const asal = asalList.find((a) => new URL(a).host === host) ?? asalList[0];
  return { asal, rpID: new URL(asal).hostname };
}
