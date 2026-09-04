import { Pool } from "pg";
import { provinsiDariTitik } from "./provinsi-titik";

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
 * Bertingkat, dengan prinsip: JANGAN menebak. Kasus nyata: titik 19–44 km
 * dari desa terdekat dilabeli "sekitar X" — nama desanya beda dengan lokasi
 * sebenarnya dan menyesatkan. Jadi tidak ada lagi lapis "desa terdekat":
 *  1. Tepat: nama daerah yang poligonnya menaungi titik (ST_Contains).
 *  2. Provinsi pasti: analisis Turf atas poligon bawaan (tanpa database,
 *     tanpa jaringan) — kasar tapi pasti. Menyelamatkan kasus DB mati total
 *     maupun titik di luar jangkauan desa mana pun di darat.
 *  3. Gagal semua → null. Pemanggil harus punya cadangan (mis. teks
 *     "lat, lng" + peringatan ke peninjau), jangan sampai reverse yang gagal
 *     menghalangi keputusan yang sudah diambil.
 *
 * `null` dikembalikan bila koordinat bukan angka, atau bila ketiga lapis
 * gagal (tengah laut: tak ada poligon desa, tak ada poligon provinsi yang
 * menaungi).
 */
export async function lokasiDariKoordinat(lat: number, lng: number): Promise<string | null> {
  const tabel = process.env.GEO_LOCATION_TABLE;
  const kolomNama = process.env.GEO_NAME_COLUMN;
  if (!tabel || !kolomNama) return provinsiDariTitik(lat, lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  try {
    const { rows } = await pool().query(
      `SELECT ${kutip(kolomNama)} AS nama
       FROM ${kutip(tabel)}
       WHERE ST_Contains(
               ST_Transform(geom, 4326),
               ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)
             )
       LIMIT 1`,
      [lng, lat],
    );
    const nama = rows[0]?.nama;
    if (typeof nama === "string" && nama.trim() !== "") return nama.trim();
  } catch {
    // Database geo tak terjangkau (atau skemanya berubah) — jatuh ke lapis
    // provinsi Turf di bawah yang tidak butuh database.
  }

  return provinsiDariTitik(lat, lng);
}

export type SaranTitik =
  | { ada: true; nama: string; negara: string | null; sumber: "desa" | "osm" }
  | { ada: false };

/** Batas waktu Nominatim: saran lokasi tak boleh menghambat kerja editor. */
const BATAS_OSM_MS = 8_000;

/**
 * Nama tempat tepat di sebuah titik — untuk saran "ikuti pin" di form CMS.
 *
 * Beda dengan lokasiDariKoordinat(): yang itu untuk PROMOSI (harus nama
 * daerah Indonesia yang provinsinya terbaca peta), sedangkan ini untuk
 * MENYARANKAN saat editor menaruh pin — jadi kejujuran didahulukan:
 *  1. Poligon desa Simontini menaungi → nama desanya (paling tepercaya).
 *  2. OpenStreetMap Nominatim → sedetail kampung/jalan (data yang tampil di
 *     tile peta CMS sendiri), APA PUN negaranya — justru penting: pin di
 *     perbatasan bisa jatuh di negara tetangga, dan itu harus KELIHATAN,
 *     bukan disembunyikan.
 * Kalau dua-duanya kosong → { ada: false }. Keputusan akhir tetap di tangan
 * editor (disarankan lewat tombol, bukan diisi otomatis).
 */
export async function saranDariTitik(lat: number, lng: number): Promise<SaranTitik> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ada: false };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { ada: false };

  // 1. Desa Simontini yang menaungi — tanpa radius: di luar poligon tidak
  // ada klaim "sekitar" di sini, itu urusan promosi.
  try {
    const tabel = process.env.GEO_LOCATION_TABLE;
    const kolomNama = process.env.GEO_NAME_COLUMN;
    if (tabel && kolomNama) {
      const { rows } = await pool().query(
        `SELECT ${kutip(kolomNama)} AS nama
         FROM ${kutip(tabel)}
         WHERE ST_Contains(
                 ST_Transform(geom, 4326),
                 ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)
               )
         LIMIT 1`,
        [lng, lat],
      );
      const nama = rows[0]?.nama;
      if (typeof nama === "string" && nama.trim() !== "") {
        return { ada: true, nama: nama.trim(), negara: "id", sumber: "desa" };
      }
    }
  } catch {
    /* lanjut ke OSM */
  }

  // 2. Nominatim OSM. Kebijakan pakainya: identifikasi aplikasi, laju wajar
  // (form CMS dipakai manusia dengan debounce, bukan batch), dan timeout
  // agar layanan luar yang lambat tidak menghambat editor.
  try {
    const param = new URLSearchParams({
      lat: String(lat), lon: String(lng),
      format: "jsonv2", zoom: "18", "accept-language": "id",
    });
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?${param}`, {
      headers: {
        "User-Agent": "Pasopati-Fire-CMS/1.0 (verifikasi lokasi karhutla)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(BATAS_OSM_MS),
    });
    if (!r.ok) return { ada: false };
    const data: unknown = await r.json();
    if (typeof data !== "object" || data === null) return { ada: false };
    const alamat = (data as { address?: Record<string, unknown> }).address;
    if (!alamat || typeof alamat !== "object") return { ada: false };

    const ambil = (...kunci: string[]): string | null => {
      for (const k of kunci) {
        const v = alamat[k];
        if (typeof v === "string" && v.trim() !== "") return v.trim();
      }
      return null;
    };
    const ujung = ambil("village", "town", "city", "municipality", "suburb", "hamlet", "road");
    if (!ujung) return { ada: false };
    const bagian = [ujung, ambil("county", "region"), ambil("state")].filter(
      (b): b is string => b !== null,
    );
    // Buang duplikat ("Siding, Siding" kalau OSM mengulang nama).
    const unik = bagian.filter((b, i) => b !== bagian[i - 1]);
    const kode = ambil("country_code");
    return { ada: true, nama: unik.join(", "), negara: kode, sumber: "osm" };
  } catch {
    return { ada: false };
  }
}
