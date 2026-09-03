import type { MetadataRoute } from "next";

// Basis sama dengan sitemap supaya robots menunjuk ke host kanonis yang benar.
const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://fire.nusantara.earth"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/admin/", "/api/"] },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
