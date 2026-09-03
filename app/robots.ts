import type { MetadataRoute } from "next";

// Basis sama dengan sitemap supaya robots menunjuk ke host kanonis yang benar.
const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://fire.nusantara.earth"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    // Situs informasi publik — semua crawler boleh mengindeks semuanya.
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
