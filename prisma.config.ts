// Prisma CLI tidak memuat .env sendiri seperti Next.js, jadi dotenv dipanggil
// di sini — tanpa ini `prisma generate` berhenti dengan
// "Cannot resolve environment variable: DATABASE_URL".
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
  },
});
