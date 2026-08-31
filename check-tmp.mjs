import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
const url = new URL(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter: new PrismaMariaDb({
  host: url.hostname, port: Number(url.port || 3306),
  user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""), connectionLimit: 5 }) });
try {
  const r = await prisma.events.findMany({ take: 3 });
  console.log("OK rows:", r.length);
} catch (e) {
  console.log("CODE:", e.code, "| MSG:", e.message);
}
