/**
 * Seeder uji deskripsi panjang — LOKAL SAJA, jangan dijalankan di produksi.
 *
 * Menanam 3 kejadian berstatus published dengan deskripsi Indonesia yang
 * panjang (300+ karakter) supaya potongan caption kartu "… selengkapnya"
 * tampil dan bisa diverifikasi: deskripsi pendek tidak memunculkan
 * embel-embel itu (ambang ~120 karakter).
 *
 * Dipakai berpasangan dengan slug berawalan "uji-deskripsi-", jadi aman
 * dijalankan ulang (upsert) dan mudah dibersihkan:
 *   npm run seed:uji-deskripsi            # tanam / perbarui 3 kejadian
 *   npm run seed:uji-deskripsi -- --hapus  # buang kembali 3 kejadian itu
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

const AWALAN = "uji-deskripsi-";

// Sengaja panjang: ~350 karakter supaya selalu melewati ambang
// "~120 karakter" dan terpotong di 3 baris di lebar rel maupun masonry.
const DESKRIPSI_PANJANG =
  "Asap tebal terpantau sejak pukul enam pagi dan semakin pekat menjelang siang, " +
  "terbawa angin ke arah permukiman sekitar dua kilometer dari titik api. Tim gabungan " +
  "BPBD, Manggala Agni, dan warga sudah mengepung sisi barat dengan sekat bakar, namun " +
  "titik panas baru muncul di sisi timur karena ranting kering yang beterbangan. " +
  "Warga diimbau memakai masker dan menutup ventilasi rumah sampai asap mereda.";

const DAFTAR = [
  { n: "01", lokasi: "Siak, Riau", lat: 0.7916, lng: 102.0527, tgl: "2026-09-14" },
  { n: "02", lokasi: "Mempawah, Kalimantan Barat", lat: 0.5022, lng: 108.9645, tgl: "2026-09-14" },
  { n: "03", lokasi: "Merauke, Papua", lat: -8.4667, lng: 140.3333, tgl: "2026-09-13" },
];

async function main() {
  if (process.argv.includes("--hapus")) {
    const { count } = await prisma.events.deleteMany({
      where: { slug: { startsWith: AWALAN } },
    });
    console.log(`Membersihkan ${count} kejadian uji deskripsi.`);
    return;
  }

  const sekarang = new Date();
  let count = 0;
  for (const d of DAFTAR) {
    const slug = `${AWALAN}${d.n}`;
    const judul = `Uji deskripsi ${d.n} — ${d.lokasi}`;
    await prisma.events.upsert({
      where: { slug },
      update: {
        title_id: judul,
        title_en: judul,
        description_id: DESKRIPSI_PANJANG,
        event_date: new Date(d.tgl),
        location: d.lokasi,
        location_lat: d.lat,
        location_lng: d.lng,
        status: "published",
        updated_at: sekarang,
      },
      create: {
        slug,
        title_id: judul,
        title_en: judul,
        description_id: DESKRIPSI_PANJANG,
        description_en: DESKRIPSI_PANJANG,
        event_date: new Date(d.tgl),
        location: d.lokasi,
        location_lat: d.lat,
        location_lng: d.lng,
        orientation: "landscape",
        status: "published",
        created_at: sekarang,
        updated_at: sekarang,
      },
    });
    count++;
  }
  console.log(`Berhasil menanam / memperbarui ${count} kejadian uji deskripsi panjang.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
