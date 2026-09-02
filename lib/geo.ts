import { Pool } from "pg";

/**
 * Layer lokasi PostGIS Simontini.
 *
 * Database TERPISAH dari database Pasopati, dan hanya dibaca — jadi ia tidak
 * ikut Prisma, cukup pool `pg` sendiri.
 *
 * Kolom bujurnya bernama "longtitude" (salah eja) di tabel aslinya. Dibaca apa
 * adanya dari konfigurasi, bukan diperbaiki di sini: tabel itu milik pihak
 * lain, dan menebak ejaan yang "benar" justru membuat query gagal.
 */
const global_ = globalThis as unknown as { poolGeo?: Pool };

function pool(): Pool {
  if (!global_.poolGeo) {
    global_.poolGeo = new Pool({
      connectionString: process.env.GEO_DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 10_000,
    });
  }
  return global_.poolGeo;
}

export type Lokasi = { id: string; nama: string; lat: number; lng: number };

/** Kutip identifier Postgres; nama tabel & kolomnya campur huruf besar. */
function kutip(nama: string): string {
  return nama.split(".").map((b) => `"${b.replace(/"/g, '""')}"`).join(".");
}

export async function cariLokasi(kata: string, batas = 10, geser = 0): Promise<Lokasi[]> {
  const teks = kata.trim();
  if (teks.length < 2) return [];

  const tabel = process.env.GEO_LOCATION_TABLE;
  const kolomNama = process.env.GEO_NAME_COLUMN;
  const kolomLat = process.env.GEO_LAT_COLUMN;
  const kolomLng = process.env.GEO_LNG_COLUMN;
  if (!tabel || !kolomNama || !kolomLat || !kolomLng) return [];

  const kolomCari = (process.env.GEO_SEARCH_COLUMNS ?? kolomNama)
    .split(",").map((k) => k.trim()).filter(Boolean);

  // Nama kolom tidak bisa jadi parameter terikat, jadi dikutip; nilai
  // pencariannya SELALU terikat ($1) supaya tidak bisa disuntik.
  const syarat = kolomCari.map((k) => `${kutip(k)} ILIKE $1`).join(" OR ");

  const sql = `
    SELECT id::text AS id,
           ${kutip(kolomNama)} AS nama,
           ${kutip(kolomLat)}::float8 AS lat,
           ${kutip(kolomLng)}::float8 AS lng
    FROM ${kutip(tabel)}
    WHERE ${syarat}
    ORDER BY ${kutip(kolomNama)}
    LIMIT ${Math.max(1, Math.min(50, Math.trunc(batas)))}
    OFFSET ${Math.max(0, Math.trunc(geser))}
  `;

  try {
    const { rows } = await pool().query(sql, [`%${teks}%`]);
    return rows.map((r) => ({ id: r.id, nama: r.nama ?? "", lat: r.lat, lng: r.lng }));
  } catch {
    // Layanan luar; kalau tak terjangkau, form tetap bisa dipakai dengan
    // lokasi yang diketik manual.
    return [];
  }
}

/**
 * Reverse geocode: koordinat → nama daerah (level desa) yang menaunginya.
 *
 * Geometrinya di-transform ke EPSG:4326 supaya perbandingan tidak bergantung
 * pada SRID asli tabel Simontini — kita tidak mengendalikan SRID itu. Titik
 * dibuat dari (lng, lat) sesuai konvensi PostGIS ST_MakePoint(x=lon, y=lat).
 *
 * `null` dikembalikan bila koordinat bukan angka, tidak ada daerah yang
 * menaunginya, atau database geo tak terjangkau — pemanggil harus punya
 * cadangan (mis. teks "lat, lng"), jangan sampai reverse yang gagal
 * menghalangi keputusan yang sudah diambil.
 */
export async function lokasiDariKoordinat(lat: number, lng: number): Promise<string | null> {
  const tabel = process.env.GEO_LOCATION_TABLE;
  const kolomNama = process.env.GEO_NAME_COLUMN;
  if (!tabel || !kolomNama) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const sql = `
    SELECT ${kutip(kolomNama)} AS nama
    FROM ${kutip(tabel)}
    WHERE ST_Contains(
            ST_Transform(geom, 4326),
            ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)
          )
    LIMIT 1
  `;

  try {
    const { rows } = await pool().query(sql, [lng, lat]);
    const nama = rows[0]?.nama;
    return typeof nama === "string" && nama.trim() !== "" ? nama.trim() : null;
  } catch {
    return null;
  }
}
