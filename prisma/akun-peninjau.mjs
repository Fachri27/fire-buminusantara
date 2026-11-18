// Akun warga untuk peninjau Google Play / App Store: masuk dengan email & kata
// sandi, dan sudah dianggap lolos verifikasi KTP supaya peninjau bisa mencoba
// siaran langsung. Peninjau toko tidak punya KTP, jadi verifikasinya
// diberikan langsung di sini (ktp_verified_at) — tanpa NIK, tanpa foto, tanpa
// baris mobile_ktp_verifications. Jangan dipakai untuk akun warga sungguhan.
//
//   node prisma/akun-peninjau.mjs <email> ["Nama Tampil"]           # buat akun baru
//   node prisma/akun-peninjau.mjs <email> ["Nama Tampil"] --reset   # akun sudah ada: kata sandi baru
//
// Kata sandi dibuat acak dan dicetak SEKALI ke terminal — salin ke Play Console
// (App content → App access). Email yang sudah terdaftar ditolak tanpa --reset,
// supaya akun warga lain tidak terambil alih karena salah ketik. Akun staf CMS
// selalu ditolak (aplikasi juga menolak akun staf masuk dengan kata sandi).
//
// Butuh DATABASE_URL lingkungan tujuan (produksi: jalankan di dalam container,
// mis. `docker exec -it <container> node prisma/akun-peninjau.mjs …`). dotenv
// opsional seperti backfill-poster: di container env sudah terpasang dan paketnya
// tidak ikut standalone.
try {
  await import("dotenv/config");
} catch {
  /* env sudah ada di process.env */
}
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

/** Sama dengan BIAYA_BCRYPT di lib/auth.ts (tidak diimpor: modul itu membuka koneksi Prisma). */
const BIAYA_BCRYPT = 12;

const argumen = process.argv.slice(2);
const RESET = argumen.includes("--reset");
const [emailMentah, namaMentah] = argumen.filter((a) => !a.startsWith("--"));
// Sama dengan rapikanEmail di lib/akun-mobile.ts: masuk dari aplikasi membandingkan huruf kecil.
const email = String(emailMentah ?? "").trim().toLowerCase();
const nama = String(namaMentah ?? "Peninjau Laporin").trim().slice(0, 100);

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Pakai: node prisma/akun-peninjau.mjs <email> ["Nama Tampil"] [--reset]');
  process.exit(1);
}

// 16 karakter tanpa huruf yang mirip (0/O, 1/l/I): peninjau mengetiknya ulang dari formulir.
const HURUF = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const sandi = Array.from(randomBytes(16), (b) => HURUF[b % HURUF.length]).join("");

const url = new URL(process.env.DATABASE_URL);
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 2,
  }),
});
const sekarang = new Date();

try {
  const ada = await prisma.users.findUnique({ where: { email }, select: { id: true, role: true } });
  if (ada && ada.role !== "commenter") {
    console.error(`${email} adalah akun staf CMS (${ada.role}). Pakai email lain untuk peninjau.`);
    process.exitCode = 1;
  } else if (ada && !RESET) {
    console.error(`${email} sudah terdaftar. Tambahkan --reset bila memang akun peninjau yang kata sandinya mau diganti.`);
    process.exitCode = 1;
  } else {
    const data = {
      name: nama,
      password: await bcrypt.hash(sandi, BIAYA_BCRYPT),
      email_verified_at: sekarang,
      ktp_verified_at: sekarang,
      updated_at: sekarang,
    };
    const akun = ada
      ? await prisma.users.update({ where: { id: ada.id }, data, select: { id: true } })
      : await prisma.users.create({
          data: { ...data, email, role: "commenter", created_at: sekarang },
          select: { id: true },
        });
    if (ada) {
      // Kata sandi lama tidak boleh menyisakan sesi yang masih masuk.
      await prisma.mobile_sessions.deleteMany({ where: { user_id: akun.id } });
    }
    console.log(`Akun peninjau ${ada ? "diperbarui" : "dibuat"} (id ${akun.id}), KTP dianggap terverifikasi.`);
    console.log(`  Email      : ${email}`);
    console.log(`  Kata sandi : ${sandi}`);
    console.log("Kata sandi ini tidak disimpan di mana pun selain sebagai hash — salin sekarang.");
  }
} finally {
  await prisma.$disconnect();
}
