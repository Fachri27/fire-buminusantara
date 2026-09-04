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
  /** Thumbnail asli kejadian (sama dengan `poster`), null kalau tidak ada —
   *  tidak memakai foto dummy. Komponen menampilkan placeholder sendiri. */
  gambar: string | null;
  alt: string;
  video: string | null;
  /** Poster video: HANYA thumbnail asli kejadian ini, tanpa cadangan. Kalau
   *  memakai gambar bawaan, setiap video yang thumbnail-nya gagal dibuat tampil
   *  dengan foto yang sama dan terlihat seolah kartunya tertukar. */
  poster: string | null;
  lokasi: string | null;
  /** Koordinat kejadian — kolomnya NOT NULL di basis data, selalu ada. */
  lat: number;
  lng: number;
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

const tanggalId = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const PILIH = {
  id: true, slug: true, title_id: true, description_id: true, event_date: true, location: true,
  location_lat: true, location_lng: true,
  image_id: true, video: true, media: true, orientation: true,
} as const;

type Baris = {
  id: bigint; slug: string | null; title_id: string; description_id: string | null;
  event_date: Date; location: string; location_lat: unknown; location_lng: unknown;
  image_id: string | null; video: string | null;
  media: unknown;
  orientation: string;
};

function keBerita(e: Baris): Berita {
  const mediaList = itemMedia(e.media, e.image_id, e.video);
  // Thumbnail kejadian: gambar utama → foto galeri → poster video (urutan sama
  // dengan pratinjau admin). Fallback poster video menjaga kejadian yang hanya
  // bervideo tetap punya thumbnail untuk pratinjau bagikan (og:image) — tanpa
  // itu, tautannya dibagikan tanpa gambar sama sekali.
  const poster =
    urlMedia(e.image_id) ??
    (mediaList.find((m) => m.jenis === "gambar")?.url ?? null) ??
    mediaList.find((m) => m.poster)?.poster ??
    null;

  return {
    // BigInt tidak bisa lewat JSON.stringify, dan payload ini menyeberang ke
    // komponen klien — jadi dijadikan number di sini, sekali.
    id: Number(e.id),
    slug: e.slug,
    pulau: inferPulau(e.location),
    tanggal: tanggalId.format(e.event_date),
    judul: e.title_id,
    // Payload ini menyeberang ke komponen klien; tanpa foto asli, `gambar`
    // dibiarkan null — tidak ada foto dummy lagi. Yang memakainya (mis. kartu
    // dan pop-up) menampilkan placeholder sendiri.
    gambar: poster,
    alt: e.title_id,
    video: urlMedia(e.video),
    poster,
    lokasi: rapikanLokasi(e.location),
    // Decimal Prisma, bukan number — dijadikan number sekali di sini seperti id.
    lat: Number(e.location_lat),
    lng: Number(e.location_lng),
    deskripsi: e.description_id,
    media: mediaList,
    vertikal: e.orientation === "horizontal",
  };
}

/** Sepuluh kejadian terbaru untuk korsel dan pop-up peta. */
/**
 * Kejadian untuk korsel beranda, urutan CAMPURAN "terbaru + komentar terbanyak":
 * kartu pertama (yang disorot di TENGAH korsel) adalah kejadian PALING BARU,
 * lalu sisanya diurut dari yang KOMENTARNYA PALING BANYAK (seri → yang lebih
 * baru dulu). Jadi pengunjung langsung melihat laporan terbaru, sekaligus
 * laporan-laporan yang paling ramai dibahas.
 */
export async function ambilBerita(limit = 10): Promise<Berita[]> {
  const [semua, hitung] = await Promise.all([
    // event_date bisa seri (beberapa laporan setanggal) — id menaik dipakai
    // pemecah seri supaya "paling baru" benar-benar yang terakhir dibuat.
    prisma.events.findMany({ orderBy: [{ event_date: "desc" }, { id: "desc" }], select: PILIH }),
    // Komentar bersifat polimorfik (commentable_type/_id ala Laravel), bukan
    // relasi Prisma — jadi jumlahnya dihitung terpisah lewat groupBy.
    prisma.comments.groupBy({
      by: ["commentable_id"],
      where: { commentable_type: "App\\Models\\Event", is_approved: true, commentable_id: { not: null } },
      _count: true,
    }),
  ]);

  const jumlahKomentar = new Map<number, number>();
  for (const h of hitung) {
    if (h.commentable_id != null) jumlahKomentar.set(Number(h.commentable_id), h._count);
  }
  const komentar = (b: (typeof semua)[number]) => jumlahKomentar.get(Number(b.id)) ?? 0;

  // semua sudah desc menurut tanggal → elemen [0] adalah yang terbaru.
  const [terbaru, ...sisa] = semua;
  sisa.sort((a, b) => {
    const beda = komentar(b) - komentar(a); // komentar terbanyak dulu
    if (beda !== 0) return beda;
    const bedaTgl = b.event_date.getTime() - a.event_date.getTime(); // seri → terbaru dulu
    if (bedaTgl !== 0) return bedaTgl;
    return Number(b.id) - Number(a.id);
  });

  const urut = terbaru ? [terbaru, ...sisa] : sisa;
  return urut.slice(0, limit).map((b) => keBerita(b as Baris));
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
