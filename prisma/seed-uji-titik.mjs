/**
 * Seeder uji titik media — LOKAL SAJA, jangan dijalankan di produksi.
 *
 * Menanam SATU kejadian published yang galerinya berisi banyak gambar, supaya
 * baris titik penunjuk di kartu korsel (components/slider-kartu.tsx) bisa
 * dilihat pada jumlah media yang tidak wajar. Form laporan publik dibatasi
 * BATAS_BERKAS = 6, tapi media dari CMS tidak dibatasi — jadi kasus inilah yang
 * perlu dipastikan tidak merusak tata letak di ponsel.
 *
 * Gambarnya TIDAK diunggah baru: skrip memakai ulang path yang sudah ada di
 * MinIO lokal (dari kejadian & laporan yang sudah tersimpan), lalu mengulanginya
 * bila perlu sampai jumlah yang diminta tercapai. Tidak ada berkas yang dibuat
 * maupun dihapus.
 *
 *   node prisma/seed-uji-titik.mjs            # tanam dengan 12 media
 *   node prisma/seed-uji-titik.mjs 20         # tanam dengan 20 media
 *   node prisma/seed-uji-titik.mjs --hapus    # buang lagi
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const url = new URL(process.env.DATABASE_URL);
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 5,
  }),
});

const SLUG = "uji-titik-media";

/** Kumpulkan path gambar yang sudah ada — tidak mengunggah apa pun. */
async function pathGambarYangAda() {
  const [kejadian, laporan] = await Promise.all([
    prisma.events.findMany({ select: { media: true } }),
    prisma.public_reports.findMany({ select: { media: true } }),
  ]);

  const path = [];
  for (const baris of [...kejadian, ...laporan]) {
    if (!Array.isArray(baris.media)) continue;
    for (const m of baris.media) {
      if (m?.type === "image" && typeof m.path === "string") path.push(m.path);
    }
  }
  return [...new Set(path)];
}

async function main() {
  if (process.argv.includes("--hapus")) {
    const { count } = await prisma.events.deleteMany({ where: { slug: SLUG } });
    console.log(`Membersihkan ${count} kejadian uji titik.`);
    return;
  }

  const diminta = Number(process.argv.find((a) => /^\d+$/.test(a))) || 12;
  const tersedia = await pathGambarYangAda();
  if (!tersedia.length) {
    console.error("Tidak ada gambar di basis data lokal — jalankan seeder media dulu.");
    process.exitCode = 1;
    return;
  }

  // Ulangi daftar yang ada sampai jumlah yang diminta tercapai; titik penunjuk
  // yang sedang diuji hanya peduli JUMLAH media, bukan isinya.
  const media = Array.from({ length: diminta }, (_, i) => ({
    path: tersedia[i % tersedia.length],
    type: "image",
    keterangan: `Media uji ${i + 1}`,
  }));

  const isi = {
    title_id: `Uji titik media — ${diminta} gambar`,
    title_en: `Media dot test — ${diminta} images`,
    description_id:
      "Data uji baris titik penunjuk di kartu korsel. Hapus dengan: node prisma/seed-uji-titik.mjs --hapus",
    description_en: "Test data for the carousel card dot indicator.",
    event_date: new Date("2026-09-07"),
    location: "Pontianak, Kalimantan Barat",
    location_lat: -0.0226,
    location_lng: 109.3312,
    orientation: "landscape",
    status: "published",
    media,
    updated_at: new Date(),
  };

  const hasil = await prisma.events.upsert({
    where: { slug: SLUG },
    create: { ...isi, slug: SLUG, created_at: new Date() },
    update: isi,
  });

  console.log(`Kejadian #${hasil.id} (${SLUG}) ditanam dengan ${media.length} media.`);
  console.log(`Dari ${tersedia.length} gambar unik yang sudah ada di MinIO lokal.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
