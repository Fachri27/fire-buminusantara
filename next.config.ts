import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dipakai Docker (Dockerfile di root): `next build` menyalin server minimal
  // ke .next/standalone sehingga image produksi tidak perlu node_modules penuh.
  output: "standalone",

  // Batas upload video kejadian 100 MB (sama dengan CMS Laravel)
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;