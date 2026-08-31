import { prisma } from "./prisma";
import { inferPulau, inferProvinsi, rapikanLokasi, PROVINSI_PETA_NAMA } from "./wilayah";
import { urlMedia, itemMedia, type ItemMedia } from "./media";

/** Bentuk satu kartu berita, sama persis dengan payload FireController lama. */
export type Berita = {
  id: number;
  slug: string | null;
  pulau: string | null;
  tanggal: string;
  judul: string;
  gambar: string;
  alt: string;
  video: string | null;
  /** Poster video: HANYA thumbnail asli kejadian ini, tanpa cadangan. Kalau
   *  memakai gambar bawaan, setiap video yang thumbnail-nya gagal dibuat tampil
   *  dengan foto yang sama dan terlihat seolah kartunya tertukar. */
  poster: string | null;
  lokasi: string | null;
  /** Deskripsi laporan (description_id), ditampilkan di pop-up rincian. */
  deskripsi: string | null;
  /** Galeri media untuk slider kartu dan pop-up. Selalu terisi selama kejadian
   *  punya media apa pun — `gambar`/`video` di atas dipertahankan supaya
   *  pemakai lama payload ini (mis. daftar di pop-up peta) tidak perlu ikut
   *  berubah. */
  media: ItemMedia[];
  /** true = foto memenuhi bingkai kartu, judul menumpang putih di atasnya. */
  vertikal: boolean;
};

const GAMBAR_BAWAAN = "/assets/img/berita-jawa.jpg";

const tanggalId = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const PILIH = {
  id: true, slug: true, title_id: true, description_id: true, event_date: true, location: true,
  image_id: true, video: true, media: true, orientation: true,
} as const;

type Baris = {
  id: bigint; slug: string | null; title_id: string; description_id: string | null;
  event_date: Date; location: string; image_id: string | null; video: string | null;
  media: unknown;
  orientation: string;
};

function keBerita(e: Baris): Berita {
  const mediaList = itemMedia(e.media, e.image_id, e.video);
  const poster = urlMedia(e.image_id) ?? (mediaList.find((m) => m.jenis === "gambar")?.url ?? null);

  return {
    // BigInt tidak bisa lewat JSON.stringify, dan payload ini menyeberang ke
    // komponen klien — jadi dijadikan number di sini, sekali.
    id: Number(e.id),
    slug: e.slug,
    pulau: inferPulau(e.location),
    tanggal: tanggalId.format(e.event_date),
    judul: e.title_id,
    gambar: poster ?? GAMBAR_BAWAAN,
    alt: e.title_id,
    video: urlMedia(e.video),
    poster,
    lokasi: rapikanLokasi(e.location),
    deskripsi: e.description_id,
    media: mediaList,
    vertikal: e.orientation === "horizontal",
  };
}

/** Sepuluh kejadian terbaru untuk korsel dan pop-up peta. */
export async function ambilBerita(limit = 10): Promise<Berita[]> {
  const baris = await prisma.events.findMany({
    orderBy: { event_date: "desc" },
    take: limit,
    select: PILIH,
  });
  return baris.map((b) => keBerita(b as Baris));
}

/** Satu kejadian lewat permalink /fire/<slug>. */
export async function ambilBeritaSlug(slug: string): Promise<Berita | null> {
  const baris = await prisma.events.findUnique({ where: { slug }, select: PILIH });
  return baris ? keBerita(baris as Baris) : null;
}

/**
 * Jumlah laporan per provinsi untuk angka di tengah tiap poligon peta.
 *
 * Ke-34 provinsi selalu ada; yang belum terliput bernilai 0 supaya peta
 * menggambar "0" alih-alih memperlakukannya sebagai wilayah tanpa data.
 *
 * Dihitung dari SELURUH kejadian, bukan dari sepuluh terbaru di atas — kalau
 * memakai koleksi itu, angka provinsi menyusut sendiri begitu laporan ke-11
 * masuk.
 */
export async function hitungLaporanProvinsi(): Promise<Record<string, number>> {
  const jumlah: Record<string, number> = Object.fromEntries(
    PROVINSI_PETA_NAMA.map((n) => [n, 0]),
  );

  const baris = await prisma.events.findMany({ select: { location: true } });
  for (const { location } of baris) {
    const provinsi = inferProvinsi(location);
    // Lokasi yang tidak menyebut provinsi mana pun sengaja tidak dihitung —
    // lebih baik tidak terhitung daripada masuk kolom yang salah.
    if (provinsi) jumlah[provinsi]++;
  }

  return jumlah;
}
