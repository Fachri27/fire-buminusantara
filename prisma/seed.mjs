// Benih data pengembangan. `prisma generate` harus sudah jalan, dan
// DATABASE_URL terpasang di .env (dotenv dipanggil manual — Prisma 7
// lewat driver adapter, bukan env di schema).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

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

const sekarang = new Date();

async function main() {
  const admin = await prisma.users.upsert({
    where: { email: "admin@pasopati.test" },
    update: {},
    create: {
      name: "Admin Pasopati",
      email: "admin@pasopati.test",
      role: "admin",
      password: await bcrypt.hash("admin123", 10),
      email_verified_at: sekarang,
      created_at: sekarang,
      updated_at: sekarang,
    },
  });

  const kejadian = [
    {
      title_id: "Kebakaran Rumah di Jalan Pasopati",
      title_en: "House Fire on Pasopati Street",
      slug: "kebakaran-rumah-jalan-pasopati",
      description_id: "Kebakaran menimpa sebuah rumah tinggal. Tim pemadam berhasil mengendalikan api dalam dua jam.",
      description_en: "A fire broke out in a residential house. The firefighters contained it within two hours.",
      event_date: new Date("2026-08-15"),
      location: "Bandung, Jawa Barat",
      location_lat: -6.914744,
      location_lng: 107.609810,
      orientation: "landscape",
      created_at: sekarang,
      updated_at: sekarang,
    },
    {
      title_id: "Kebakaran Ruko di Alun-Alun",
      title_en: "Shophouse Fire at the Town Square",
      slug: "kebakaran-ruko-alun-alun",
      description_id: "Empat unit ruko terdampak. Tidak ada korban jiwa; evakuasi berjalan lancar.",
      description_en: "Four shophouse units were affected. No casualties; evacuation went smoothly.",
      event_date: new Date("2026-08-22"),
      location: "Bandung, Jawa Barat",
      location_lat: -6.921971,
      location_lng: 107.607153,
      orientation: "horizontal",
      created_at: sekarang,
      updated_at: sekarang,
    },
  ];

  for (const k of kejadian) {
    await prisma.events.upsert({ where: { slug: k.slug }, update: {}, create: k });
  }

  const adaKomentar = await prisma.comments.count();
  if (adaKomentar === 0) {
    await prisma.comments.create({
      data: {
        commentable_type: "events",
        user_id: admin.id,
        body: "Terima kasih atas kerja keras tim pemadam!",
        is_approved: true,
        created_at: sekarang,
        updated_at: sekarang,
      },
    });
  }

  console.log("Benih selesai: 1 admin (admin@pasopati.test / admin123), 2 kejadian, 1 komentar.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());