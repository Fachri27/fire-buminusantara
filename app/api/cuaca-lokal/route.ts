import { NextResponse } from "next/server";
import { ipDari } from "@/lib/turnstile";
import { namaProvinsiLokal, inferProvinsi, PROVINSI_PETA_NAMA } from "@/lib/wilayah";
import { provinsiDariTitik } from "@/lib/provinsi-titik";
import { PUSAT_WILAYAH } from "@/lib/pusat-wilayah";
import { cariWilayah, kotaTerdekat } from "@/lib/daftar-wilayah";

/**
 * Cuaca lokal pengunjung untuk panel kiri landing karhutla.
 *
 * Alur: IP pengunjung (dibaca lewat ipDari — hormat TRUSTED_PROXY_HOPS,
 * jadi tak bisa dipalsukan via X-Forwarded-For) → kota + koordinat via
 * ipwho.is (gratis, tanpa kunci) → nama kota (BigDataCloud, gratis tanpa
 * kunci) + suhu live. IP TIDAK diteruskan ke layanan cuaca — hanya
 * koordinatnya.
 *
 * Sumber suhu TUNGGAL: BMKG (api.bmkg.go.id, prakiraan per 3 jam tingkat
 *  desa/adm4, gratis tanpa kunci, batas 60/menit/IP) — model nasional, disetel
 *  untuk Indonesia; suhunya yang dirasa warga cocok dengan angka ini.
 *  Butuh kode adm4 — dicari dari koordinat lewat layanan peta BIG
 *  (BATAS_DESAKEL_AR, field KDEPUM) saat request. Tanpa cadangan model global.
 *
 * Cache dalam-memori 10 menit per titik (lat/lng dibulatkan 2 desimal):
 * refresh halaman tidak menembak BMKG/BIG berulang — panel langsung terisi.
 *
 * Publik tanpa sesi (dipanggil komponen klien saat mount). Semua layanan
 * luar dibatasi waktu. Cache Components: rute ini sudah dinamis secara bawaan
 * (membaca header IP tiap request), jadi tanpa `export const dynamic` — yang
 * justru dilarang di mode ini.
 */

/** Cadangan bila IP tak terbaca (dev lokal, proxy 0 hop): Monas. */
const CADANGAN = { lat: -6.1754, lng: 106.8272, label: "DKI Jakarta" };

/**
 * Kode desa adm4 Kemendagri ibu kota tiap provinsi — SEMUANYA terverifikasi
 * langsung ke api.bmkg.go.id (respons memuat kotkab yang benar).
 *
 * Dipakai karena layanan pencari adm4-dari-koordinat (BIG) tak terjangkau
 * dari jaringan server (HTTPS-nya menggantung), sementara API BMKG hanya
 * menerima adm4 setingkat desa. Suhu ibu kota mewakili provinsinya untuk
 * keperluan widget — presisi setingkat desa tidak dibutuhkan di sini.
 */
const ADM4_IBU_KOTA: Record<string, string> = {
  Aceh: "11.71.01.2001",
  Bali: "51.71.01.1001",
  Banten: "36.73.01.1001",
  Bengkulu: "17.71.01.1001",
  "DI Yogyakarta": "34.71.01.1001",
  "DKI Jakarta": "31.71.01.1001",
  Gorontalo: "75.71.01.1001",
  Jambi: "15.71.01.1001",
  "Jawa Barat": "32.73.01.1001",
  "Jawa Tengah": "33.74.01.1001",
  "Jawa Timur": "35.78.01.1001",
  "Kalimantan Barat": "61.71.02.1001",
  "Kalimantan Selatan": "63.71.01.1001",
  "Kalimantan Tengah": "62.71.01.1001",
  "Kalimantan Timur": "64.72.01.1001",
  "Kalimantan Utara": "65.71.02.1001",
  "Kepulauan Bangka Belitung": "19.71.02.1001",
  "Kepulauan Riau": "21.72.01.1001",
  Lampung: "18.71.03.1001",
  Maluku: "81.71.03.2001",
  "Maluku Utara": "82.71.01.1001",
  "Nusa Tenggara Barat": "52.71.02.1001",
  "Nusa Tenggara Timur": "53.71.01.1001",
  Papua: "91.71.01.1001",
  "Papua Barat": "92.02.03.2001",
  Riau: "14.71.02.1001",
  "Sulawesi Barat": "76.02.02.1001",
  "Sulawesi Selatan": "73.71.01.1001",
  "Sulawesi Tengah": "72.71.03.1001",
  "Sulawesi Tenggara": "74.71.06.1001",
  "Sulawesi Utara": "71.71.01.1001",
  "Sumatera Barat": "13.71.01.1001",
  "Sumatera Selatan": "16.71.01.1001",
  "Sumatera Utara": "12.71.01.1001",
};

type HasilIp = { kota: string | null; provinsi: string | null; lat: number | null; lng: number | null };

async function lokasiDariIp(ip: string | null): Promise<HasilIp> {
  const kosong: HasilIp = { kota: null, provinsi: null, lat: null, lng: null };
  if (!ip) return kosong;
  // Lokal / privat tak ada di basis data geo-IP — langsung cadangan. 172.16/12
  // itu sekelas penuh (16-31), bukan cuma awalan "172.16.".
  if (
    ip === "::1" || ip === "::ffff:127.0.0.1" || ip.startsWith("127.") || ip.startsWith("10.") ||
    ip.startsWith("192.168.") || ip.startsWith("169.254.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  ) return kosong;
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return kosong;
    const j = (await r.json()) as {
      success?: boolean; city?: unknown; region?: unknown; latitude?: unknown; longitude?: unknown;
    };
    if (j.success === false) return kosong;
    const lat = typeof j.latitude === "number" ? j.latitude : null;
    const lng = typeof j.longitude === "number" ? j.longitude : null;
    return {
      kota: typeof j.city === "string" && j.city.trim() !== "" ? j.city.trim() : null,
      provinsi: typeof j.region === "string" && j.region.trim() !== "" ? j.region.trim() : null,
      lat: lat !== null && Number.isFinite(lat) ? lat : null,
      lng: lng !== null && Number.isFinite(lng) ? lng : null,
    };
  } catch {
    return kosong;
  }
}

/** Nama kota dalam ejaan lokal (id) dari koordinat; null bila gagal. */
async function kotaLokal(lat: number, lng: number, bahasa: string): Promise<string | null> {
  try {
    const param = new URLSearchParams({
      latitude: String(lat), longitude: String(lng), localityLanguage: bahasa === "en" ? "en" : "id",
    });
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${param}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { city?: unknown; locality?: unknown; principalSubdivision?: unknown };
    for (const k of [j.city, j.locality, j.principalSubdivision]) {
      if (typeof k === "string" && k.trim() !== "") return k.trim();
    }
    return null;
  } catch {
    return null;
  }
}

type Cuaca = { suhu: number | null; kode: number | null; siang: boolean };

/** Kode cuaca WMO dari angka model BMKG (0-4 cerah, 60-63 hujan dsb). */
function wmoDariBmkg(angka: unknown): number | null {
  if (typeof angka !== "number" || !Number.isFinite(angka)) return null;
  if (angka === 0 || angka === 1 || angka === 4) return 1;
  if (angka === 2 || angka === 3) return 2;
  if (angka === 10) return 45;
  if (angka === 60 || angka === 61) return 61;
  if (angka === 63) return 63;
  if (angka === 95 || angka === 97) return 95;
  return 2;
}

/**
 * Dulu: kode adm4 dari koordinat lewat layanan peta BIG. Dihapus — HTTPS
 * geoservices.big.go.id menggantung dari jaringan server (HTTP-nya 301 ke
 * HTTPS yang tak pernah menjawab), jadi rantai ini tak pernah berhasil.
 * Penggantinya tabel ADM4_IBU_KOTA di atas: IP hanya menentukan provinsi.
 */

/**
 * Suhu BMKG dari kelurahan pengunjung + kode cuaca WMO.
 *
 * Aturannya meniru widget BMKG sendiri: yang tampil nilai blok 3-jaman yang
 * SEDANG BERJALAN (lantai, bukan terdekat). Contoh: pukul 17:16 widget
 * menampilkan slot 15:00 (29°C), bukan slot 18:00 (28°C). Karena API hanya
 * memberi slot ke depan (respons jam 23:25 sudah mulai besok 00:00), slot
 * lampau hari ini disimpan di cache (6 jam) — selama server hidup, blok
 * berjalan selalu ketemu dan angkanya sama dengan widget BMKG. Tanpa jejak
 * (serverless dingin tepat di jendela tengah malam): slot terdekat.
 *
 * Batas BMKG 60/menit/IP — satu request halaman = satu request BMKG, aman.
 */
type Slot = { ms: number; t: number; weather: unknown };
const SLOT_TTL = 6 * 60 * 60_000;
const slotKas = new Map<string, { kedaluwarsa: number; slot: Slot[] }>();

async function cuacaBmkg(adm4: string | null): Promise<Cuaca | null> {
  const kosong: Cuaca = { suhu: null, kode: null, siang: true };
  if (!adm4) return null;
  try {
    const r = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(adm4)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      data?: { cuaca?: { local_datetime?: unknown; t?: unknown; weather?: unknown }[][] }[];
    };
    const daftar = j.data?.[0]?.cuaca?.flat() ?? [];
    // "Kini" sebagai instan absolut (Date.now) — SENGAJA bukan rumus lama
    // (Date.now() + (7*60 + getTimezoneOffset())*60000): rumus itu hanya benar
    // bila zona waktu server UTC (seperti Vercel); di laptop WIB ia maju
    // 7 jam sehingga deploy dan lokal memilih slot BMKG yang berbeda untuk
    // adm4 yang sama (26° vs 27°). Perbandingan slot memakai instan absolut
    // (zona waktu tak relevan); hanya label siang/malam yang butuh jam WIB
    // = getUTCHours(kini + 7 jam).
    const kini = Date.now();
    const baru: Slot[] = [];
    for (const s of daftar) {
      if (typeof s?.local_datetime !== "string" || typeof s?.t !== "number" || !Number.isFinite(s.t)) continue;
      const ms = new Date(s.local_datetime.replace(" ", "T") + "+07:00").getTime();
      if (!Number.isFinite(ms)) continue;
      baru.push({ ms, t: s.t, weather: s.weather });
    }
    if (baru.length === 0) return kosong;
    // Gabung dengan slot lama (buang yang >12 jam basi, buang duplikat),
    // lalu pilih yang terbaru yang tidak melewati kini — blok berjalan.
    const lama = slotKas.get(adm4);
    const gabung = new Map<number, Slot>();
    if (lama && lama.kedaluwarsa > Date.now()) {
      for (const s of lama.slot) {
        if (kini - s.ms < 12 * 60 * 60_000) gabung.set(s.ms, s);
      }
    }
    for (const s of baru) gabung.set(s.ms, s);
    const semua = [...gabung.values()].sort((a, b) => a.ms - b.ms);
    slotKas.set(adm4, { kedaluwarsa: Date.now() + SLOT_TTL, slot: semua });
    // Blok berjalan (lantai): yang terbaru yang tidak melewati kini.
    let terbaik: Slot | null = null;
    for (const s of semua) {
      if (s.ms <= kini) terbaik = s;
      else break;
    }
    // Belum ada slot lampau (server baru hidup): slot terdekat.
    if (!terbaik) {
      let selisihTerkecil = Infinity;
      for (const s of semua) {
        const selisih = Math.abs(s.ms - kini);
        if (selisih < selisihTerkecil) {
          selisihTerkecil = selisih;
          terbaik = s;
        }
      }
    }
    if (!terbaik) return kosong;
    const jam = new Date(kini + 7 * 60 * 60_000).getUTCHours();
    return { suhu: terbaik.t, kode: wmoDariBmkg(terbaik.weather), siang: jam >= 6 && jam < 18 };
  } catch {
    return null;
  }
}

/** Fallback model cuaca global Open-Meteo bila BMKG gagal / di luar cakupan */
async function cuacaOpenMeteo(lat: number, lng: number): Promise<Cuaca | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,is_day`;
    const r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      current?: { temperature_2m?: unknown; weather_code?: unknown; is_day?: unknown };
    };
    const cur = j.current;
    if (!cur) return null;
    const suhu =
      typeof cur.temperature_2m === "number" && Number.isFinite(cur.temperature_2m)
        ? Math.round(cur.temperature_2m)
        : null;
    const kode = typeof cur.weather_code === "number" && Number.isFinite(cur.weather_code) ? cur.weather_code : null;
    const siang = cur.is_day === 1;
    return { suhu, kode, siang };
  } catch {
    return null;
  }
}

/** Pencarian lokasi menggunakan OpenStreetMap Nominatim */
async function cariOsm(q: string): Promise<{ nama: string; provinsi: string; lat: number; lng: number } | null> {
  const teks = q.trim();
  if (!teks) return null;

  // 1. Cek langsung 34 provinsi
  const provLangsung =
    inferProvinsi(teks) ??
    PROVINSI_PETA_NAMA.find((p) => p.toLowerCase() === teks.toLowerCase()) ??
    PROVINSI_PETA_NAMA.find((p) => p.toLowerCase().includes(teks.toLowerCase()));
  if (provLangsung && PUSAT_WILAYAH[provLangsung]) {
    const titik = PUSAT_WILAYAH[provLangsung].titik;
    return { nama: provLangsung, provinsi: provLangsung, lat: titik[1], lng: titik[0] };
  }

  // 2. OpenStreetMap Nominatim Search
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(teks)}&format=json&addressdetails=1&limit=1&countrycodes=id`;
    const r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
      headers: {
        Accept: "application/json",
        "User-Agent": "PasopatiKarhutla/1.0",
      },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as Array<{
      name?: string;
      lat?: string;
      lon?: string;
      address?: {
        city?: string;
        town?: string;
        municipality?: string;
        county?: string;
        state?: string;
      };
    }>;
    const item = j?.[0];
    if (!item || !item.lat || !item.lon) return null;
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const nama = item.address?.city ?? item.address?.town ?? item.address?.municipality ?? item.name ?? teks;
    const stateRaw = item.address?.state;
    const provinsi = stateRaw ? namaProvinsiLokal(stateRaw) : (provinsiDariTitik(lat, lng) ?? CADANGAN.label);

    return { nama, provinsi, lat, lng };
  } catch {
    return null;
  }
}

/** Reverse geocoding koordinat GPS menggunakan OpenStreetMap Nominatim */
async function reverseOsm(lat: number, lng: number): Promise<{ nama: string; provinsi: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
      headers: {
        Accept: "application/json",
        "User-Agent": "PasopatiKarhutla/1.0",
      },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      name?: string;
      address?: {
        city?: string;
        town?: string;
        municipality?: string;
        county?: string;
        state?: string;
        suburb?: string;
        village?: string;
      };
    };
    const nama =
      j.address?.city ??
      j.address?.town ??
      j.address?.municipality ??
      j.address?.county ??
      j.address?.suburb ??
      j.address?.village ??
      j.name ??
      "";
    const stateRaw = j.address?.state;
    const provinsi = stateRaw ? namaProvinsiLokal(stateRaw) : (provinsiDariTitik(lat, lng) ?? CADANGAN.label);
    return { nama: nama.trim(), provinsi };
  } catch {
    return null;
  }
}

/** Pencarian saran lokasi ala Select2 menggunakan basis data resmi BMKG/Kemendagri + fallback OSM */
export type ItemSaranLokasi = {
  id: string;
  nama: string;
  provinsi: string;
  lat: number;
  lng: number;
  adm4?: string;
  tipe?: string;
};

const kasSaran = new Map<string, { kedaluwarsa: number; hasil: ItemSaranLokasi[] }>();

async function cariSaranLokasi(q: string): Promise<ItemSaranLokasi[]> {
  const teks = q.trim();
  if (!teks) return [];

  const kunciKas = teks.toLowerCase();
  const hit = kasSaran.get(kunciKas);
  if (hit && hit.kedaluwarsa > Date.now()) {
    return hit.hasil;
  }

  // 1. Cari dari basis data Kemendagri / BMKG resmi (548 entri provinsi, kabupaten, kota)
  const hasilWilayah = cariWilayah(teks, 8);
  if (hasilWilayah.length > 0) {
    const hasil: ItemSaranLokasi[] = hasilWilayah.map((w) => ({
      id: w.id,
      nama: w.nama,
      provinsi: w.provinsi,
      lat: w.lat,
      lng: w.lng,
      adm4: w.adm4,
      tipe: w.tipe,
    }));
    kasSaran.set(kunciKas, { kedaluwarsa: Date.now() + 15 * 60_000, hasil });
    return hasil;
  }

  const hasil: ItemSaranLokasi[] = [];
  const terlihat = new Set<string>();

  // 2. OpenStreetMap Nominatim untuk lokasi luar negeri atau pencarian non-administratif
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(teks)}&format=json&addressdetails=1&limit=6&countrycodes=id`;
    const r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: "application/json",
        "User-Agent": "PasopatiKarhutla/1.0",
      },
    });
    if (r.ok) {
      const items = (await r.json()) as Array<{
        place_id?: number | string;
        lat?: string;
        lon?: string;
        name?: string;
        address?: {
          city?: string;
          town?: string;
          municipality?: string;
          county?: string;
          state?: string;
          suburb?: string;
          village?: string;
        };
      }>;
      for (const item of items) {
        if (!item.lat || !item.lon) continue;
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const nama =
          item.address?.city ??
          item.address?.town ??
          item.address?.municipality ??
          item.address?.county ??
          item.address?.suburb ??
          item.name ??
          teks;
        const stateRaw = item.address?.state;
        const provinsi = stateRaw ? namaProvinsiLokal(stateRaw) : (provinsiDariTitik(lat, lng) ?? CADANGAN.label);
        const kunci = `${nama.toLowerCase()}|${provinsi.toLowerCase()}`;
        if (!terlihat.has(kunci)) {
          terlihat.add(kunci);
          const terdekat = kotaTerdekat(lat, lng);
          hasil.push({
            id: String(item.place_id ?? `${lat},${lng}`),
            nama,
            provinsi,
            lat,
            lng,
            adm4: terdekat?.adm4,
            tipe: terdekat?.tipe,
          });
        }
        if (hasil.length >= 8) break;
      }
    }
  } catch {
    // jika osm gagal, kembalikan hasil yang ada
  }

  kasSaran.set(kunciKas, { kedaluwarsa: Date.now() + 5 * 60_000, hasil });
  return hasil;
}

/* Cache 10 menit per titik — refresh tidak mengulang rantai BIG+BMKG. */
const KAS_TTL = 10 * 60_000;
const kas = new Map<string, { kedaluwarsa: number; badan: Record<string, unknown> }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bahasa = url.searchParams.get("bahasa") === "en" ? "en" : "id";

  const qSaran = url.searchParams.get("saran");
  if (qSaran !== null) {
    const saran = await cariSaranLokasi(qSaran);
    return NextResponse.json(saran, {
      headers: { "Cache-Control": "public, max-age=120, s-maxage=120" },
    });
  }

  const qLat = url.searchParams.get("lat");
  const qLng = url.searchParams.get("lng");
  const q = url.searchParams.get("q");
  const qNama = url.searchParams.get("nama");
  const qProv = url.searchParams.get("provinsi");
  const qAdm4 = url.searchParams.get("adm4");

  let lat: number | null = null;
  let lng: number | null = null;
  let namaLokasi: string | null = null;
  let provinsi: string | null = null;
  let adm4Kandidat: string | null = qAdm4 && qAdm4.trim() ? qAdm4.trim() : null;

  if (qLat !== null && qLng !== null) {
    const pLat = parseFloat(qLat);
    const pLng = parseFloat(qLng);
    if (Number.isFinite(pLat) && Number.isFinite(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
      lat = pLat;
      lng = pLng;
      const terdekat = kotaTerdekat(lat, lng);
      if (qNama && qNama.trim()) {
        namaLokasi = qNama.trim();
        provinsi = qProv
          ? namaProvinsiLokal(qProv)
          : (terdekat?.provinsi ?? (provinsiDariTitik(lat, lng) ?? CADANGAN.label));
      } else if (terdekat) {
        namaLokasi = terdekat.nama;
        provinsi = terdekat.provinsi;
        if (!adm4Kandidat) adm4Kandidat = terdekat.adm4;
      } else {
        const osm = await reverseOsm(lat, lng);
        if (osm && osm.nama) {
          namaLokasi = osm.nama;
          provinsi = osm.provinsi;
        } else {
          namaLokasi = await kotaLokal(lat, lng, bahasa);
          provinsi = provinsiDariTitik(lat, lng);
        }
      }
      if (!adm4Kandidat && terdekat) {
        adm4Kandidat = terdekat.adm4;
      }
    }
  } else if (q && q.trim()) {
    // 1. Cek dari master Kemendagri / BMKG
    const hasilWilayah = cariWilayah(q, 1);
    if (hasilWilayah.length > 0) {
      const target = hasilWilayah[0];
      lat = target.lat;
      lng = target.lng;
      namaLokasi = target.nama;
      provinsi = target.provinsi;
      adm4Kandidat = target.adm4;
    } else {
      const osm = await cariOsm(q);
      if (osm) {
        lat = osm.lat;
        lng = osm.lng;
        namaLokasi = osm.nama;
        provinsi = osm.provinsi;
        const terdekat = kotaTerdekat(lat, lng);
        if (terdekat) adm4Kandidat = terdekat.adm4;
      }
    }
  }

  // Fallback ke pembacaan IP bila tidak ada koordinat/pencarian
  let dariIp: HasilIp | null = null;
  if (!provinsi) {
    const ip = ipDari(req);
    dariIp = await lokasiDariIp(ip);
    lat = lat ?? dariIp.lat ?? CADANGAN.lat;
    lng = lng ?? dariIp.lng ?? CADANGAN.lng;
    const terdekat = kotaTerdekat(lat, lng);
    provinsi = dariIp.provinsi
      ? namaProvinsiLokal(dariIp.provinsi)
      : (terdekat?.provinsi ?? (provinsiDariTitik(lat, lng) ?? CADANGAN.label));
    if (!namaLokasi) {
      namaLokasi = (await kotaLokal(lat, lng, bahasa)) ?? dariIp.kota ?? terdekat?.nama ?? provinsi;
    }
    if (!adm4Kandidat && terdekat) {
      adm4Kandidat = terdekat.adm4;
    }
  }

  const provKanonik = namaProvinsiLokal(provinsi ?? CADANGAN.label);
  const adm4 = adm4Kandidat ?? ADM4_IBU_KOTA[provKanonik] ?? ADM4_IBU_KOTA["DKI Jakarta"];

  // Cache response 10 menit
  const kunci = `${namaLokasi ?? ""},${adm4},${bahasa}`;
  const hit = kas.get(kunci);
  if (hit && hit.kedaluwarsa > Date.now()) {
    return NextResponse.json(hit.badan, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }

  // Cuaca dari BMKG
  const bmkg = await cuacaBmkg(adm4);
  let cuaca: Cuaca = bmkg ?? { suhu: null, kode: null, siang: true };
  let sumber: "bmkg" | "model" | null = bmkg && bmkg.suhu !== null ? "bmkg" : null;

  // Fallback Open-Meteo bila BMKG tidak tersedia
  if (cuaca.suhu === null && lat !== null && lng !== null) {
    const model = await cuacaOpenMeteo(lat, lng);
    if (model && model.suhu !== null) {
      cuaca = model;
      sumber = "model";
    }
  }

  const nama = namaLokasi ?? provKanonik;
  const badan = { nama, suhu: cuaca.suhu, kodeCuaca: cuaca.kode, siang: cuaca.siang, sumber };
  kas.set(kunci, { kedaluwarsa: Date.now() + KAS_TTL, badan });
  return NextResponse.json(badan, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
