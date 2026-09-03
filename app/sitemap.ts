import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

// Base URL terpusat supaya sitemap selalu absolut — crawler menolak URL relatif.
const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://fire.nusantara.earth"
).replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Halaman statis: beranda bilingual berubah tiap ada laporan baru.
  const statis: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/id`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/en`, changeFrequency: "daily", priority: 1 },
    // Formulir lapor jarang berubah isinya, cukup diramban ulang mingguan.
    { url: `${BASE_URL}/id/lapor`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/en/lapor`, changeFrequency: "monthly", priority: 0.8 },
  ];

  try {
    // Hanya kolom yang dipakai sitemap — tanpa id BigInt agar lolos serialisasi.
    const events = await prisma.events.findMany({
      select: { slug: true, event_date: true, updated_at: true },
      orderBy: { event_date: "desc" },
    });

    const dinamis: MetadataRoute.Sitemap = [];
    for (const e of events) {
      // Slug null (draf lama) tidak punya permalink /fire/[slug], jadi dilewati.
      if (!e.slug) continue;
      // updated_at menandakan revisi konten; event_date jadi cadangan saat belum pernah disunting.
      const lastModified = e.updated_at ?? e.event_date;
      for (const locale of ["id", "en"] as const) {
        dinamis.push({
          url: `${BASE_URL}/${locale}/fire/${e.slug}`,
          lastModified,
          // Arsip kejadian tidak berubah tiap hari, mingguan sudah cukup.
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
    return [...statis, ...dinamis];
  } catch {
    // DB mati saat build tidak boleh menggagalkan deploy — sitemap statis tetap berguna.
    return statis;
  }
}
