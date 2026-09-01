import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Klien Prisma tunggal.
 *
 * Sejak Prisma 7 koneksi tidak lagi dibaca dari schema.prisma melainkan lewat
 * driver adapter yang diberikan ke constructor.
 *
 * Instansnya disimpan di globalThis supaya hot reload Next.js tidak membuat
 * koneksi baru tiap kali berkas berubah — kalau tidak, pool MySQL habis setelah
 * beberapa kali simpan.
 */
function buat() {
  const url = new URL(process.env.DATABASE_URL ?? "");

  return new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      connectionLimit: 15,
    }),
  });
}

const global_ = globalThis as unknown as { prisma?: ReturnType<typeof buat> };

export const prisma = global_.prisma ?? buat();

if (process.env.NODE_ENV !== "production") global_.prisma = prisma;
