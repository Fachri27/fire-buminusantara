import { prisma } from "./prisma";
import { bacaBerkasMedia, urlMedia, type BerkasMedia, type Orientasi } from "./media";
import { simpanBerkasGaleri, hapusBerkas, gpsDariBerkas, exifDariPath, type ExifFoto } from "./unggah";
import { turnstileSah } from "./turnstile";
import { BATAS_BERKAS, BATAS_TOTAL_BYTE } from "./batas-laporan";
import { promosiKeKejadian } from "./simpan-kejadian";

/** Status verifikasi, sama persis dengan enum di basis data. */
export type StatusLaporan = "pending" | "approved" | "rejected";

export const STATUS: StatusLaporan[] = ["pending", "approved", "rejected"];

/** Nama status untuk dibaca petugas CMS. */
export const NAMA_STATUS: Record<StatusLaporan, string> = {
  pending: "Menunggu",
  approved: "Terverifikasi",
  rejected: "Ditolak",
};

export function adaStatus(nilai: string): nilai is StatusLaporan {
  return (STATUS as string[]).includes(nilai);
}

export { BATAS_BERKAS, BATAS_TOTAL_BYTE };

const BATAS_JUDUL = 255;
const BATAS_DESKRIPSI = 5000;
const BATAS_NAMA_PELAPOR = 100;

/** Satu lampiran yang siap ditampilkan di CMS. */
export type Lampiran = {
  jenis: "gambar" | "video";
  url: string;
  poster?: string;
  keterangan?: string;
  /** Orientasi yang dipilih peninjau saat memverifikasi (kosong = belum). */
  orientasi?: Orientasi;
  /** GPS & waktu pengambilan dari EXIF foto. Hanya diisi di halaman detail
   *  (ambilLaporan), bukan di daftar — membacanya perlu menarik byte gambarnya. */
  exif?: ExifFoto;
};

/** Satu baris laporan pada halaman verifikasi. */
export type LaporanPublik = {
  id: number;
  judul: string;
  deskripsi: string;
  lampiran: Lampiran[];
  /** null = pelapor memilih anonim. */
  namaPelapor: string | null;
  lat: number | null;
  lng: number | null;
  status: StatusLaporan;
  ip: string | null;
  dibuat: Date | null;
  ditinjau: Date | null;
  peninjau: string | null;
};

export type HasilLapor =
  | { ok: true }
  | { ok: false; galat: string; bidang?: "judul" | "deskripsi" | "berkas" | "koordinat" | "captcha" };

/** Lampiran tersimpan → bentuk siap render. Entri yang URL-nya tidak terbentuk
 *  dibuang: di CMS ia hanya akan jadi kotak gambar rusak. */
function lampiranDari(media: unknown): Lampiran[] {
  const hasil: Lampiran[] = [];
  for (const berkas of bacaBerkasMedia(media)) {
    const url = urlMedia(berkas.path);
    if (url) {
      const poster = berkas.poster ? urlMedia(berkas.poster) ?? undefined : undefined;
      hasil.push({
        jenis: berkas.type === "video" ? "video" : "gambar",
        url,
        poster,
        keterangan: berkas.keterangan,
        orientasi: berkas.orientasi,
      });
    }
  }
  return hasil;
}

/** Koordinat opsional, tapi tidak setengah-setengah: satu tanpa yang lain
 *  bukan lokasi, dan menyimpannya begitu hanya menipu peninjau. */
function koordinat(
  latMentah: string,
  lngMentah: string,
): { lat: number; lng: number } | null | { galat: string } {
  const adaLat = latMentah.trim() !== "";
  const adaLng = lngMentah.trim() !== "";
  if (!adaLat && !adaLng) return null;
  if (adaLat !== adaLng) return { galat: "Latitude dan longitude harus diisi berdua." };

  const lat = Number(latMentah);
  const lng = Number(lngMentah);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { galat: "Latitude harus angka antara -90 dan 90." };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { galat: "Longitude harus angka antara -180 dan 180." };
  }
  return { lat, lng };
}

/**
 * Terima satu laporan dari pengunjung.
 *
 * CATATAN METADATA — berkas gambar disimpan APA ADANYA, byte demi byte:
 * `simpanBerkasGaleri()` meneruskan hasil `arrayBuffer()` langsung ke MinIO
 * tanpa dekode ulang, jadi EXIF (waktu pengambilan, koordinat GPS, model
 * kamera) ikut utuh sampai ke bucket. Jangan sisipkan pengubah ukuran,
 * kompresor, atau apa pun yang menggambar ulang berkasnya di jalur ini —
 * begitu gambarnya di-encode ulang, metadata itu hilang dan tidak bisa
 * dipulihkan. Alasannya bukan kerapian: bagi laporan karhutla, EXIF-lah bukti
 * kapan dan di mana fotonya diambil.
 */
export async function simpanLaporanPublik(
  data: FormData,
  ip: string | null,
): Promise<HasilLapor> {
  // Captcha diperiksa PALING DULU, sebelum satu berkas pun ditulis: kalau
  // tidak, bot tetap bisa menghabiskan bucket meski laporannya ditolak.
  if (!(await turnstileSah(String(data.get("captcha") ?? "") || null, ip))) {
    return { ok: false, galat: "Verifikasi captcha gagal. Coba lagi.", bidang: "captcha" };
  }

  // Umpan jebakan yang disembunyikan di form; hanya bot yang mengisinya.
  // Dijawab sukses tanpa menyimpan apa pun — memberi tahu bahwa jebakannya
  // terdeteksi sama saja dengan mengajari cara melewatinya.
  if (String(data.get("website") ?? "").trim() !== "") return { ok: true };

  const judul = String(data.get("judul") ?? "").trim();
  const deskripsi = String(data.get("deskripsi") ?? "").trim();
  const anonim = String(data.get("anonim") ?? "") !== "";
  const namaPelapor = anonim ? "" : String(data.get("nama") ?? "").trim();

  if (!judul) return { ok: false, galat: "Judul laporan wajib diisi.", bidang: "judul" };
  if (judul.length > BATAS_JUDUL) {
    return { ok: false, galat: `Judul maksimal ${BATAS_JUDUL} karakter.`, bidang: "judul" };
  }
  if (!deskripsi) {
    return { ok: false, galat: "Ceritakan kejadiannya sedikit.", bidang: "deskripsi" };
  }
  if (deskripsi.length > BATAS_DESKRIPSI) {
    return {
      ok: false,
      galat: `Deskripsi maksimal ${BATAS_DESKRIPSI} karakter.`,
      bidang: "deskripsi",
    };
  }

  const titik = koordinat(
    String(data.get("lat") ?? ""),
    String(data.get("lng") ?? ""),
  );
  if (titik && "galat" in titik) return { ok: false, galat: titik.galat, bidang: "koordinat" };

  const berkas = data
    .getAll("berkas")
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (berkas.length > BATAS_BERKAS) {
    return {
      ok: false,
      galat: `Maksimal ${BATAS_BERKAS} berkas per laporan.`,
      bidang: "berkas",
    };
  }

  // Lokasi manual selalu lebih dihargai: koordinat dari EXIF hanya dipakai
  // sebagai cadangan kalau pelapor tidak mengisi lat/lng sama sekali. Diambil
  // dari gambar pertama yang punya metadata GPS.
  let titikLaporan = titik ?? null;
  if (!titikLaporan && berkas.length > 0) {
    for (const b of berkas) {
      const gps = await gpsDariBerkas(b);
      if (gps) {
        titikLaporan = gps;
        break;
      }
    }
  }

  const keteranganMedia = namaPelapor || "anonim";

  const media: BerkasMedia[] = [];
  for (const b of berkas) {
    const hasil = await simpanBerkasGaleri(b);
    if ("galat" in hasil) {
      // Berkas yang sudah terlanjur naik dibuang lagi: laporan ini tidak jadi
      // tersimpan, jadi tidak ada yang menunjuk ke sana selamanya.
      for (const sudah of media) {
        await hapusBerkas(sudah.path);
        await hapusBerkas(sudah.poster);
      }
      return { ok: false, galat: `${b.name}: ${hasil.galat}`, bidang: "berkas" };
    }
    media.push({ ...hasil, keterangan: keteranganMedia });
  }

  const sekarang = new Date();

  try {
    await prisma.public_reports.create({
      data: {
        title: judul,
        description: deskripsi,
        media,
        reporter_name: namaPelapor.slice(0, BATAS_NAMA_PELAPOR) || null,
        location_lat: titikLaporan ? titikLaporan.lat : null,
        location_lng: titikLaporan ? titikLaporan.lng : null,
        status: "pending",
        ip_address: ip,
        created_at: sekarang,
        updated_at: sekarang,
      },
    });
  } catch (e) {
    for (const sudah of media) {
      await hapusBerkas(sudah.path);
      await hapusBerkas(sudah.poster);
    }
    return {
      ok: false,
      galat: e instanceof Error ? e.message : "Laporan gagal disimpan. Coba lagi.",
    };
  }

  return { ok: true };
}

export type HasilDaftarLaporan = { daftar: LaporanPublik[]; total: number };

/** Kolom yang dibaca daftar maupun halaman detail. Satu daftar dipakai bersama:
 *  kalau keduanya memilih sendiri-sendiri, halaman detail cepat atau lambat
 *  ketinggalan satu kolom yang sudah tampil di daftar. */
const PILIH = {
  id: true, title: true, description: true, media: true,
  reporter_name: true, location_lat: true, location_lng: true,
  status: true, ip_address: true, created_at: true, reviewed_at: true,
  peninjau: { select: { name: true } },
} as const;

type BarisLaporan = {
  id: bigint; title: string; description: string; media: unknown;
  reporter_name: string | null;
  location_lat: unknown; location_lng: unknown;
  status: StatusLaporan; ip_address: string | null;
  created_at: Date | null; reviewed_at: Date | null;
  peninjau: { name: string } | null;
};

function keLaporan(r: BarisLaporan): LaporanPublik {
  return {
    id: Number(r.id),
    judul: r.title,
    deskripsi: r.description,
    lampiran: lampiranDari(r.media),
    namaPelapor: r.reporter_name,
    // Decimal Prisma, bukan number — dilewatkan Number() sekali di sini supaya
    // komponen tidak perlu tahu bentuk aslinya.
    lat: r.location_lat === null ? null : Number(r.location_lat),
    lng: r.location_lng === null ? null : Number(r.location_lng),
    status: r.status,
    ip: r.ip_address,
    dibuat: r.created_at,
    ditinjau: r.reviewed_at,
    peninjau: r.peninjau?.name ?? null,
  };
}

/** Laporan untuk halaman verifikasi. Terbaru dulu — antrean dikerjakan dari
 *  yang paling hangat, karena kebakaran kemarin sudah tidak menolong siapa pun. */
export async function daftarLaporan(
  status: StatusLaporan | undefined,
  halaman = 1,
  perHalaman = 15,
): Promise<HasilDaftarLaporan> {
  const where = status ? { status } : {};

  const [total, baris] = await Promise.all([
    prisma.public_reports.count({ where }),
    prisma.public_reports.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (halaman - 1) * perHalaman,
      take: perHalaman,
      select: PILIH,
    }),
  ]);

  return { total, daftar: baris.map((r) => keLaporan(r as BarisLaporan)) };
}

/** Satu laporan untuk halaman detail. */
export async function ambilLaporan(id: number): Promise<LaporanPublik | null> {
  const baris = await prisma.public_reports.findUnique({ where: { id }, select: PILIH });
  if (!baris) return null;

  const laporan = keLaporan(baris as BarisLaporan);

  // Perkaya lampiran dengan metadata (GPS dari foto & video, waktu dari foto).
  // Dikerjakan hanya di sini, bukan di daftar: tiap berkas perlu ditarik
  // byte-nya dari penyimpanan. Dicocokkan lewat url — lampiranDari() melewati
  // entri yang url-nya tak terbentuk, jadi indeksnya belum tentu sejajar dengan
  // media mentahnya.
  const exifPerUrl = new Map<string, ExifFoto>();
  await Promise.all(
    bacaBerkasMedia(baris.media).map(async (b) => {
      const url = urlMedia(b.path);
      if (!url) return;
      const exif = await exifDariPath(b.path);
      if (exif) exifPerUrl.set(url, exif);
    }),
  );

  if (exifPerUrl.size > 0) {
    laporan.lampiran = laporan.lampiran.map((l) => {
      const exif = exifPerUrl.get(l.url);
      return exif ? { ...l, exif } : l;
    });
  }

  return laporan;
}

/** Tetangga sebuah laporan dalam antrean yang sedang disaring — dipakai tombol
 *  "berikutnya" di halaman detail, supaya peninjau bisa mengosongkan antrean
 *  tanpa bolak-balik ke daftar setiap kali memutuskan satu laporan. */
export async function laporanBerikutnya(
  id: number,
  status: StatusLaporan | undefined,
): Promise<number | null> {
  const ini = await prisma.public_reports.findUnique({
    where: { id },
    select: { created_at: true },
  });
  if (!ini?.created_at) return null;

  const berikut = await prisma.public_reports.findFirst({
    where: {
      ...(status ? { status } : {}),
      created_at: { lt: ini.created_at },
      id: { not: id },
    },
    orderBy: { created_at: "desc" },
    select: { id: true },
  });

  return berikut ? Number(berikut.id) : null;
}

/** Berapa laporan yang masih menunggu — angka di menu CMS. */
export async function hitungMenunggu(): Promise<number> {
  return prisma.public_reports.count({ where: { status: "pending" } });
}

/** Putuskan satu laporan. Siapa yang memutuskan ikut dicatat: keputusan
 *  moderasi harus bisa ditanyakan kembali kepada orangnya. */
export type HasilAturStatus =
  | { ok: true; idKejadian: number | null }
  | { ok: false; galat: string };

export async function aturStatusLaporan(
  id: number,
  status: StatusLaporan,
  olehId: number,
): Promise<HasilAturStatus> {
  // Menolak atau mengembalikan ke antrean hanya mengubah statusnya — tidak
  // ada kejadian yang dibuat.
  if (status !== "approved") {
    await prisma.public_reports.update({
      where: { id },
      data: {
        status,
        // Dikembalikan ke antrean = belum ada yang memutuskan; jejak peninjau
        // sebelumnya ikut dihapus supaya barisnya tidak mengaku sudah ditinjau.
        reviewed_by: status === "pending" ? null : olehId,
        reviewed_at: status === "pending" ? null : new Date(),
        updated_at: new Date(),
      },
    });
    return { ok: true, idKejadian: null };
  }

  // Persetujuan = laporan naik jadi kejadian yang tampil di publik. Keduanya
  // dibungkus satu transaksi: kalau events gagal dibuat, laporan tidak boleh
  // terlanjur dianggap "terverifikasi".
  try {
    return await prisma.$transaction(async (tx) => {
      const laporan = await tx.public_reports.findUnique({
        where: { id },
        select: {
          title: true, description: true, media: true,
          location_lat: true, location_lng: true, created_at: true,
        },
      });
      if (!laporan) return { ok: false as const, galat: "Laporan tidak ditemukan." };

      const promosi = await promosiKeKejadian(
        {
          title: laporan.title,
          description: laporan.description,
          media: laporan.media,
          location_lat: laporan.location_lat,
          location_lng: laporan.location_lng,
          created_at: laporan.created_at,
        },
        tx,
      );
      if (!promosi.ok) return promosi;

      await tx.public_reports.update({
        where: { id },
        data: {
          status: "approved",
          reviewed_by: olehId,
          reviewed_at: new Date(),
          updated_at: new Date(),
        },
      });

      return { ok: true as const, idKejadian: promosi.id };
    });
  } catch (e) {
    return {
      ok: false,
      galat: e instanceof Error ? e.message : "Gagal memverifikasi laporan.",
    };
  }
}

/** Buang laporan beserta lampirannya. Berkasnya ikut dihapus dari penyimpanan
 *  — laporan yang dibuang biasanya spam, dan spam tidak perlu menyisakan
 *  video 80 MB di bucket. */
export async function hapusLaporan(id: number) {
  const baris = await prisma.public_reports.findUnique({
    where: { id },
    select: { media: true },
  });
  if (!baris) return;

  for (const berkas of bacaBerkasMedia(baris.media)) await hapusBerkas(berkas.path);
  await prisma.public_reports.delete({ where: { id } });
}

/** Simpan pilihan orientasi (potret/lanskap) satu lampiran saat diverifikasi.
 *
 *  `media` adalah larik JSON — kita cari entri yang URL-nya cocok, ubah
 *  `orientasi`-nya, lalu tulis kembali. Bidang lain (path, type, poster,
 *  keterangan, EXIF nanti) dibiarkan utuh; entri yang tak dikenal diabaikan.
 */
export async function aturOrientasiLaporan(
  id: number,
  url: string,
  orientasi: Orientasi,
): Promise<{ ok: boolean; galat?: string }> {
  const baris = await prisma.public_reports.findUnique({
    where: { id },
    select: { media: true },
  });
  if (!baris) return { ok: false, galat: "Laporan tidak ditemukan." };

  const media = Array.isArray(baris.media) ? [...baris.media] : [];
  let berubah = false;
  for (const item of media) {
    if (!item || typeof item !== "object") continue;
    const berkas = item as Record<string, unknown>;
    if (typeof berkas.path !== "string") continue;
    if (urlMedia(berkas.path) !== url) continue;
    berkas.orientasi = orientasi;
    berubah = true;
  }
  if (!berubah) return { ok: false, galat: "Lampiran tidak ditemukan." };

  await prisma.public_reports.update({
    where: { id },
    data: { media, updated_at: new Date() },
  });
  return { ok: true };
}
