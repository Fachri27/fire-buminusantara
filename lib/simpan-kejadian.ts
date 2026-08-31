import { prisma } from "./prisma";
import { simpanBerkasGaleri, hapusBerkas } from "./unggah";
import { bacaBerkasMedia, type BerkasMedia } from "./media";

export type HasilSimpan = { ok: true; id: number } | { ok: false; galat: string };

/** Slug dari judul, dijamin unik. Angka ditambahkan hanya kalau memang bentrok. */
async function buatSlug(judul: string, kecualiId?: number): Promise<string> {
  const dasar = judul.toLowerCase().normalize("NFKD")
    .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 200) || "kejadian";

  for (let n = 0; n < 50; n++) {
    const calon = n === 0 ? dasar : `${dasar}-${n + 1}`;
    const ada = await prisma.events.findUnique({ where: { slug: calon }, select: { id: true } });
    if (!ada || (kecualiId && Number(ada.id) === kecualiId)) return calon;
  }
  return `${dasar}-${Date.now()}`;
}

function angka(nilai: FormDataEntryValue | null): number | null {
  const n = Number(String(nilai ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function berkasTerisi(nilai: FormDataEntryValue | null): File | null {
  return nilai instanceof File && nilai.size > 0 ? nilai : null;
}

/**
 * Susun galeri hasil form: yang lama dipertahankan hanya kalau kotak
 * "pertahankan"-nya masih tercentang, lalu berkas baru ditambahkan di
 * belakangnya. Berkas yang dilepas ikut dibuang dari penyimpanan.
 *
 * Indeks dipakai sebagai penanda — bukan path — supaya nama berkas tidak perlu
 * bolak-balik lewat form, sama seperti `keep_media[]` di CMS Laravel.
 */
async function susunGaleri(
  data: FormData,
  lama: BerkasMedia[],
): Promise<{ media: BerkasMedia[] } | { galat: string }> {
  const simpan = new Set(
    data.getAll("keep_media").map((v) => Number(String(v))).filter(Number.isInteger),
  );

  const media: BerkasMedia[] = [];
  for (const [i, berkas] of lama.entries()) {
    if (simpan.has(i)) media.push(berkas);
    else await hapusBerkas(berkas.path);
  }

  const kiriman = data.getAll("media_files");
  console.log("[Galeri] berkas diterima:", kiriman.length, kiriman.map((v) =>
    v instanceof File ? `${v.name} (${v.size}B, ${v.type})` : `bukan-File: ${typeof v}`));

  for (const nilai of kiriman) {
    const berkas = berkasTerisi(nilai);
    if (!berkas) {
      // Dulu dilewati diam-diam: berkas kosong/bukan-File tidak meninggalkan
      // jejak apa pun, sehingga "tersimpan tapi tanpa media" tak bisa dilacak.
      console.warn("[Galeri] entri dilewati (kosong atau bukan File)");
      continue;
    }
    const hasil = await simpanBerkasGaleri(berkas);
    if ("galat" in hasil) return { galat: `Media galeri: ${hasil.galat}` };
    media.push(hasil);
  }

  return { media };
}

/**
 * Simpan kejadian, untuk tambah maupun ubah.
 */
export async function simpanKejadian(data: FormData, id?: number): Promise<HasilSimpan> {
  const judulId = String(data.get("title_id") ?? "").trim();
  const judulEn = String(data.get("title_en") ?? "").trim();
  const deskripsiId = String(data.get("description_id") ?? "").trim();
  const deskripsiEn = String(data.get("description_en") ?? "").trim();
  const lokasi = String(data.get("location") ?? "").trim();
  const tanggal = String(data.get("event_date") ?? "").trim();
  const lat = angka(data.get("location_lat"));
  const lng = angka(data.get("location_lng"));
  const orientasi = String(data.get("orientation") ?? "landscape");

  if (!judulId || !judulEn) return { ok: false, galat: "Judul (ID) dan (EN) wajib diisi." };
  if (!lokasi) return { ok: false, galat: "Lokasi wajib diisi." };
  if (!tanggal) return { ok: false, galat: "Tanggal kejadian wajib diisi." };
  if (lat === null || lat < -90 || lat > 90) return { ok: false, galat: "Latitude harus antara -90 dan 90." };
  if (lng === null || lng < -180 || lng > 180) return { ok: false, galat: "Longitude harus antara -180 dan 180." };

  // Galeri lama dibaca dari basis data, bukan dari form: form hanya mengirim
  // indeks mana yang dipertahankan, jadi urutan acuannya harus sama dengan
  // yang dirender saat form dibuka.
  const lama = id
    ? bacaBerkasMedia(
        (await prisma.events.findUnique({ where: { id }, select: { media: true } }))?.media,
      )
    : [];

  const galeri = await susunGaleri(data, lama);
  if ("galat" in galeri) return { ok: false, galat: galeri.galat };

  const slugDiminta = String(data.get("slug") ?? "").trim();
  const slug = slugDiminta || (await buatSlug(judulId, id));

  const isi = {
    title_id: judulId,
    title_en: judulEn,
    description_id: deskripsiId || null,
    description_en: deskripsiEn || null,
    slug,
    event_date: new Date(tanggal),
    location: lokasi,
    location_lat: lat,
    location_lng: lng,
    orientation: orientasi === "horizontal" ? ("horizontal" as const) : ("landscape" as const),
    media: galeri.media,
    updated_at: new Date(),
  };

  try {
    if (id) {
      const ubah = await prisma.events.update({ where: { id }, data: isi, select: { id: true } });
      return { ok: true, id: Number(ubah.id) };
    }
    const baru = await prisma.events.create({
      data: { ...isi, image_en: null, created_at: new Date() },
      select: { id: true },
    });
    return { ok: true, id: Number(baru.id) };
  } catch (e) {
    return { ok: false, galat: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}
