import { revalidatePath } from "next/cache";
import { type BarisPengguna, penggunaDari, tokenDari } from "@/lib/akun-mobile";
import { lewatBatas, lewatBatasIp, sudahLewat, sudahLewatIp } from "@/lib/batas-laju";
import { bergiliran, buangBadan, tolakUkuran } from "@/lib/batas-laporan";
import { simpanLaporanPublik } from "@/lib/laporan-publik";
import { buatTiket, pakaiTiket } from "@/lib/tiket-lapor";
import { ipDari } from "@/lib/turnstile";

/**
 * Brand ISO-BMFF foto HEIF/AVIF (heic, mif1, avif, …). Pendeteksi jenis di
 * unggah.ts menganggap SEMUA berkas ber-box "ftyp" sebagai video MP4, jadi
 * foto ini akan tersimpan sebagai .mp4 rusak yang tak bisa dibuka petugas.
 */
const BRAND_FOTO_HEIF = /^(hei[cxms]|hev[cxms]|heif|mif[12]|msf1|avi[fos]|avc[is])$/;

async function fotoHeif(berkas: File): Promise<boolean> {
  const kepala = Buffer.from(await berkas.slice(0, 12).arrayBuffer());
  return kepala.toString("latin1", 4, 8) === "ftyp" && BRAND_FOTO_HEIF.test(kepala.toString("latin1", 8, 12));
}

/**
 * POST /api/mobile/laporan (multipart) — laporan warga dari aplikasi mobile.
 *
 * Padanan POST /api/lapor (form web), dengan sesi akun mobile. Field-nya sama
 * persis dengan form web, jadi FormData diteruskan apa adanya ke
 * simpanLaporanPublik().
 *
 * Gerbang anti-bot:
 *   - Dengan token akun dan tidak anonim → akun menggantikan captcha; laporan
 *     tercatat di "Laporanku".
 *   - Tamu atau anonim → wajib header `X-Tiket-Lapor` berisi tiket dari
 *     POST /api/mobile/tiket (Turnstile yang diselesaikan di dalam aplikasi).
 *     Bidang form `tiket` tidak lagi dibaca: memeriksanya berarti menyangga
 *     seluruh badan dulu. Laporan anonim tidak pernah dikaitkan ke akun, meski
 *     kirimannya membawa token.
 *
 * Semua yang bisa diputuskan dari header (ukuran, batas laju, sesi) diputuskan
 * SEBELUM badan disangga: route handler jalan begitu header tiba (kecuali
 * reverse proxy menyangga badannya dulu), sedangkan req.formData() menunggu —
 * dan menampung di memori — seluruh unggahan.
 *
 * Jangan pakai POLA_BOT dari rute suka web di sini: React Native di Android
 * mengirim user agent `okhttp/…`.
 */
export async function POST(req: Request) {
  // Kiriman tanpa Content-Length (chunked) dihitung ulang di simpanLaporanPublik.
  const kebesaran = tolakUkuran(req, false);
  if (kebesaran) return kebesaran;

  // Ember laju yang SAMA dengan form web: 5 laporan / 10 menit / IP. Di sini
  // hanya dibaca; jatahnya dipakai setelah laporan tersimpan, supaya unggahan
  // yang dibatalkan, putus sinyal, atau ditolak validasi tidak mengunci warga.
  // Ember "coba" yang longgar, dihitung di muka, menahan banjir kiriman gagal.
  // IP tak terbaca → ember bersama `lapor:tanpa-ip` (lihat emberIp).
  const ip = ipDari(req);
  if ((await sudahLewatIp("lapor", ip, 5)) || (await lewatBatasIp("lapor-coba", ip, 30, 600))) {
    return Response.json(
      { ok: false, galat: "Terlalu banyak laporan dari jaringan ini. Coba lagi dalam 10 menit." },
      { status: 429 },
    );
  }

  const pengguna = await penggunaDari(req);
  if (!pengguna && tokenDari(req)) {
    // Token dikirim tapi sesinya sudah tidak ada (dicabut, akun dihapus).
    // Aplikasi membaca bidang "captcha" + token sebagai sesi berakhir, lalu
    // kirim ulang lewat jalur tamu. Sisa badan dibuang dulu tanpa disangga:
    // jawaban yang dikirim selagi klien masih mengunggah membuat koneksinya
    // diputus, dan iOS lalu melihat galat jaringan, bukan jawaban ini.
    await buangBadan(req);
    return Response.json(
      { ok: false, galat: "Sesi akun sudah berakhir. Kirim lagi tanpa akun, atau masuk ulang.", bidang: "captcha" },
      { status: 401 },
    );
  }
  if (
    pengguna &&
    ((await sudahLewat(`lapor-akun:${pengguna.id}`, 5)) ||
      (await lewatBatas(`lapor-coba-akun:${pengguna.id}`, 20, 600)))
  ) {
    return Response.json(
      { ok: false, galat: "Terlalu banyak laporan dari akun ini. Coba lagi dalam 10 menit." },
      { status: 429 },
    );
  }

  // Tiket dari header, dipakai SEBELUM mengambil jatah unggahan: kalau baru
  // dibaca dari badan, klien tanpa captcha bisa menduduki ketiga jatah dan
  // setiap warga lain mendapat 503. Tanpa akun = wajib tiket. Dengan akun,
  // tiket tetap dipakai bila ada — kirimannya mungkin anonim (lihat terima).
  // Karena dipakai saat permintaan tiba, umur tiket (30 menit) tidak bisa
  // habis di tengah unggahan lambat.
  const tiketSah = await pakaiTiket(req.headers.get("x-tiket-lapor"));
  if (!pengguna && !tiketSah) {
    await buangBadan(req);
    return Response.json(
      { ok: false, galat: "Verifikasi captcha gagal. Coba lagi.", bidang: "captcha" },
      { status: 422 },
    );
  }

  return bergiliran(req, () => terima(req, ip, pengguna, tiketSah));
}

/** Badan kiriman, disangga utuh di memori — karena itu lewat bergiliran(). */
async function terima(req: Request, ip: string | null, pengguna: BarisPengguna | null, tiketSah: boolean) {
  let data: FormData;
  try {
    data = await req.formData();
  } catch {
    return Response.json({ ok: false, galat: "Kiriman tidak bisa dibaca server." }, { status: 400 });
  }

  const anonim = String(data.get("anonim") ?? "") !== "";
  const pelapor = pengguna && !anonim ? pengguna : null;
  // Akun yang memilih anonim tetap butuh captcha: laporannya tidak terikat ke akun.
  if (!pelapor && !tiketSah) {
    return Response.json(
      { ok: false, galat: "Verifikasi captcha gagal. Coba lagi.", bidang: "captcha" },
      { status: 422 },
    );
  }
  // Tiket sekali pakai dari server sendiri: simpanLaporanPublik tetap satu jalur.
  data.set("tiket", buatTiket());
  // Nama TIDAK diisi dari akun bila kosong: nama Google/Apple itu akan tayang
  // sebagai keterangan media di /api/umpan tanpa warga memilihnya.

  for (const b of data.getAll("berkas")) {
    if (b instanceof File && b.size > 0 && (await fotoHeif(b))) {
      return Response.json(
        { ok: false, galat: `${b.name}: foto HEIC/AVIF belum didukung. Kirim sebagai JPEG.`, bidang: "berkas" },
        { status: 422 },
      );
    }
  }

  const hasil = await simpanLaporanPublik(data, ip, { pelaporId: pelapor?.id ?? null });
  if (hasil.ok) {
    await lewatBatasIp("lapor", ip, 5, 600);
    if (pengguna) await lewatBatas(`lapor-akun:${pengguna.id}`, 5, 600);
    revalidatePath("/[locale]", "page");
    revalidatePath("/[locale]/lapor", "page");
    revalidatePath("/[locale]/karhutla", "page");
  }
  return Response.json(hasil, { status: hasil.ok ? 200 : 422 });
}
