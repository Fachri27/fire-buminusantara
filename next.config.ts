import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Batas upload video kejadian 100 MB (sama dengan CMS Laravel)
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;