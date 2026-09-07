/**
 * Seeder uji paginasi pop-up peta — LOKAL SAJA, jangan dijalankan di produksi.
 *
 * Menanam 15 kejadian berstatus published yang semuanya jatuh ke tab
 * "Jawa, Bali, & Nusa Tenggara" (lokasinya memakai nama provinsi Indonesia
 * yang dikenali inferPulau: Jawa Barat/Tengah/Timur, Banten, DKI Jakarta,
 * DI Yogyakarta). Lima belas > PER_HALAMAN (10), jadi navigasi halaman
 * di pop-up tampil dan bisa diklik: halaman 1 (10 butir) + halaman 2 (5 butir).
 *
 * Dipakai berpasangan dengan slug berawalan "uji-paginasi-jawa-", jadi aman
 * dijalankan ulang (upsert) dan mudah dibersihkan:
 *   npm run seed:uji-paginasi          # tanam / perbarui 15 kejadian
 *   npm run seed:uji-paginasi -- --hapus  # buang kembali 15 kejadian itu
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

const AWALAN = "uji-paginasi-jawa-";

// 15 titik tersebar di Jawa — koordinatnya di dalam Pulau Jawa supaya pin
// petanya jatuh di tempat yang masuk akal, bukan di laut / luar negeri.
const DAFTAR = [
  { n: "01", lokasi: "Pancoran Mas, Depok, Jawa Barat", lat: -6.3896, lng: 106.8303, tgl: "2026-09-06" },
  { n: "02", lokasi: "Bogor, Jawa Barat", lat: -6.5944, lng: 106.7892, tgl: "2026-09-06" },
  { n: "03", lokasi: "Bekasi, Jawa Barat", lat: -6.2383, lng: 106.9756, tgl: "2026-09-05" },
  { n: "04", lokasi: "Bandung, Jawa Barat", lat: -6.9175, lng: 107.6191, tgl: "2026-09-05" },
  { n: "05", lokasi: "Cirebon, Jawa Barat", lat: -6.7320, lng: 108.5523, tgl: "2026-09-04" },
  { n: "06", lokasi: "Serang, Banten", lat: -6.1167, lng: 106.1500, tgl: "2026-09-04" },
  { n: "07", lokasi: "Tangerang, Banten", lat: -6.1783, lng: 106.63, tgl: "2026-09-03" },
  { n: "08", lokasi: "Menteng, DKI Jakarta", lat: -6.1967, lng: 106.8294, tgl: "2026-09-03" },
  { n: "09", lokasi: "Semarang, Jawa Tengah", lat: -6.9667, lng: 110.4167, tgl: "2026-09-02" },
  { n: "10", lokasi: "Surakarta, Jawa Tengah", lat: -7.5755, lng: 110.8243, tgl: "2026-09-02" },
  // --- di bawah garis ini: hanya tampil di halaman 2 ---
  { n: "11", lokasi: "Magelang, Jawa Tengah", lat: -7.4706, lng: 110.2177, tgl: "2026-09-01" },
  { n: "12", lokasi: "Sleman, DI Yogyakarta", lat: -7.7167, lng: 110.3567, tgl: "2026-09-01" },
  { n: "13", lokasi: "Surabaya, Jawa Timur", lat: -7.2575, lng: 112.7521, tgl: "2026-08-31" },
  { n: "14", lokasi: "Malang, Jawa Timur", lat: -7.9666, lng: 112.6326, tgl: "2026-08-30" },
  { n: "15", lokasi: "Jember, Jawa Timur", lat: -8.1845, lng: 113.6681, tgl: "2026-08-29" },
];

async function main() {
  if (process.argv.includes("--hapus")) {
    const { count } = await prisma.events.deleteMany({
      where: { slug: { startsWith: AWALAN } },
    });
    console.log(`Membersihkan ${count} kejadian uji paginasi.`);
    return;
  }

  const sekarang = new Date();
  let count = 0;
  for (const d of DAFTAR) {
    const slug = `${AWALAN}${d.n}`;
    const judul = `Uji paginasi ${d.n} — ${d.lokasi}`;
    await prisma.events.upsert({
      where: { slug },
      update: {
        title_id: judul,
        title_en: judul,
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
        description_id: "Data uji paginasi pop-up peta — hapus dengan: npm run seed:uji-paginasi -- --hapus",
        description_en: "Map popup pagination fixture — remove with: npm run seed:uji-paginasi -- --hapus",
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
  console.log(`Berhasil menanam / memperbarui ${count} kejadian uji paginasi (tab Jawa).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
