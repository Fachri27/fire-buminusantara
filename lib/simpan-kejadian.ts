import { prisma } from "./prisma";
import { simpanBerkasGaleri, hapusBerkas } from "./unggah";
import { bacaBerkasMedia, type BerkasMedia } from "./media";
import { lokasiDariKoordinat } from "./geo";

export type HasilSimpan = { ok: true; id: number } | { ok: false; galat: string };

/** Slug dari judul, dijamin unik. Angka ditambahkan hanya kalau memang bentrok. */
export async function buatSlug(judul: string, kecualiId?: number): Promise<string> {
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
 * bolak-balik lewat form, sama seperti `keep_media[]` di CMS Laravel. Keterangan
 * tiap berkas mengikuti penanda yang sama: `media_desc_<indeks>` untuk yang
 * tersimpan, `media_desc_baru` berurutan untuk yang baru (urutan DOM-nya sama
 * dengan urutan berkas di `media_files`, keduanya mengikuti daftar di form).
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
    if (simpan.has(i)) {
      const ket = String(data.get(`media_desc_${i}`) ?? "").trim();
      // Keterangan kosong berarti sengaja dikosongkan — jangan pakai yang lama.
      media.push({ ...berkas, keterangan: ket || undefined });
    } else {
      // Posternya ikut: berkas yatim di bucket tidak merusak apa pun, tapi
      // tidak ada alasan membiarkannya menumpuk.
      await hapusBerkas(berkas.path);
      await hapusBerkas(berkas.poster);
    }
  }

  const kiriman = data.getAll("media_files");
  console.log("[Galeri] berkas diterima:", kiriman.length, kiriman.map((v) =>
    v instanceof File ? `${v.name} (${v.size}B, ${v.type})` : `bukan-File: ${typeof v}`));

  // Dipasangkan lewat indeks — bukan digeser saat berkas kosong dilewati —
  // supaya urutan keterangan selalu cocok dengan urutan kiriman berkasnya.
  const keteranganBaru = data.getAll("media_desc_baru").map((v) => String(v).trim());

  for (const [i, nilai] of kiriman.entries()) {
    const berkas = berkasTerisi(nilai);
    if (!berkas) {
      // Dulu dilewati diam-diam: berkas kosong/bukan-File tidak meninggalkan
      // jejak apa pun, sehingga "tersimpan tapi tanpa media" tak bisa dilacak.
      console.warn("[Galeri] entri dilewati (kosong atau bukan File)");
      continue;
    }
    const hasil = await simpanBerkasGaleri(berkas);
    if ("galat" in hasil) return { galat: `Media galeri: ${hasil.galat}` };
    media.push({ ...hasil, keterangan: keteranganBaru[i] || undefined });
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

export type HasilPromosi = { ok: true; id: number } | { ok: false; galat: string };

/** Input minimal dari sebuah laporan publik yang dinaikkan jadi kejadian. */
export type LaporanPromosi = {
  title: string;
  description: string | null;
  media: unknown;
  location_lat: unknown;
  location_lng: unknown;
  created_at: Date | null;
};

/**
 * Naikkan laporan terverifikasi menjadi baris `events` baru.
 *
 * Laporan publik tidak punya kolom yang wajib ada di `events` (tanggal,
 * teks lokasi, judul EN, slug), jadi dipetakan dengan akal sehat:
 *  - judul EN memakai judulnya (laporan tidak pernah bilingua).
 *  - tanggal memakai waktu laporan dibuat.
 *  - teks lokasi memakai nama daerah hasil reverse-geocode dari koordinat
 *    laporan; kalau geo tak terjangkau atau titiknya di luar semua daerah,
 *    jatuh ke format "lat, lng" (atau "Lokasi tidak diketahui"). Wilayah/admin
 *    dapat mengubahnya belakangan.
 *  - lampiran laporan dibawa apa adanya ke kolom media (format sama).
 */
export async function promosiKeKejadian(
  laporan: LaporanPromosi,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma,
): Promise<HasilPromosi> {
  const lat = laporan.location_lat === null ? 0 : Number(laporan.location_lat);
  const lng = laporan.location_lng === null ? 0 : Number(laporan.location_lng);
  const diketahui = laporan.location_lat !== null && laporan.location_lng !== null;

  let lokasi: string;
  if (!diketahui) {
    lokasi = "Lokasi tidak diketahui";
  } else {
    // Reverse geocode opsional & non-blokir: kegagalannya tidak boleh
    // menggagalkan kenaikan laporan, maka fallback ke koordinat mentah.
    lokasi =
      (await lokasiDariKoordinat(lat, lng)) ??
      `${(Math.round(lat * 1e6) / 1e6).toFixed(6)}, ${(Math.round(lng * 1e6) / 1e6).toFixed(6)}`;
  }

  const slug = await buatSlug(laporan.title);

  try {
    const baru = await tx.events.create({
      data: {
        title_id: laporan.title,
        title_en: laporan.title,
        description_id: laporan.description || null,
        description_en: null,
        slug,
        event_date: laporan.created_at ?? new Date(),
        location: lokasi,
        location_lat: lat,
        location_lng: lng,
        // Lampiran laporan sudah berseri JSON dengan format yang sama persis
        // dengan events.media — dibawa apa adanya, tanpa disalin/digambar ulang.
        media: laporan.media ?? undefined,
        image_en: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: { id: true },
    });
    return { ok: true, id: Number(baru.id) };
  } catch (e) {
    return { ok: false, galat: e instanceof Error ? e.message : "Gagal menaikkan laporan." };
  }
}
