import type { MetadataRoute } from "next";
import { URL_SITUS } from "@/lib/situs";

// Basis sama dengan sitemap supaya robots menunjuk ke host kanonis yang benar.
const BASE_URL = URL_SITUS;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/admin/", "/api/"] },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
