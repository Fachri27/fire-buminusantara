import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { prisma } from "@/lib/prisma";
import { urlMedia } from "@/lib/media";

// Base URL terpusat supaya sitemap selalu absolut — crawler menolak URL relatif.
const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://fire.nusantara.earth"
).replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("hours");

  // Halaman statis: beranda bilingual lengkap dengan hreflang alternates
  const statis: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/id`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
      alternates: {
        languages: {
          id: `${BASE_URL}/id`,
          en: `${BASE_URL}/en`,
          "x-default": `${BASE_URL}/id`,
        },
      },
    },
    {
      url: `${BASE_URL}/en`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
      alternates: {
        languages: {
          id: `${BASE_URL}/id`,
          en: `${BASE_URL}/en`,
          "x-default": `${BASE_URL}/id`,
        },
      },
    },
  ];

  try {
    // Hanya kolom yang dipakai sitemap — tanpa id BigInt agar lolos serialisasi
    const events = await prisma.events.findMany({
      where: { slug: { not: null } },
      select: { slug: true, image_id: true, event_date: true, updated_at: true },
      orderBy: { event_date: "desc" },
    });

    const dinamis: MetadataRoute.Sitemap = [];
    for (const e of events) {
      if (!e.slug) continue;
      const lastModified = e.updated_at ?? e.event_date;
      const gambarPath = urlMedia(e.image_id);
      const gambarAbsolut = gambarPath
        ? gambarPath.startsWith("http")
          ? gambarPath
          : `${BASE_URL}${gambarPath}`
        : undefined;

      for (const locale of ["id", "en"] as const) {
        dinamis.push({
          url: `${BASE_URL}/${locale}/fire/${e.slug}`,
          lastModified,
          changeFrequency: "weekly",
          priority: 0.8,
          alternates: {
            languages: {
              id: `${BASE_URL}/id/fire/${e.slug}`,
              en: `${BASE_URL}/en/fire/${e.slug}`,
              "x-default": `${BASE_URL}/id/fire/${e.slug}`,
            },
          },
          images: gambarAbsolut ? [gambarAbsolut] : undefined,
        });
      }
    }
    return [...statis, ...dinamis];
  } catch (error) {
    console.error("Gagal membuat sitemap dinamis dari database:", error);
    return statis;
  }
}
