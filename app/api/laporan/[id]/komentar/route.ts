import { revalidateTag } from "next/cache";
import { bacaJson } from "@/lib/batas-badan";
import { catatGalat } from "@/lib/catat-galat";
import { daftarKomentar, POLA_EMAIL, simpanKomentar } from "@/lib/komentar";
import { ipDari, turnstileSah } from "@/lib/turnstile";
import { prisma } from "@/lib/prisma";
import { TAYANG } from "@/lib/events";

/**
 * Komentar pada satu laporan karhutla.
 *
 * Di Laravel ini controller tersendiri karena pop-up digerakkan Alpine dan
 * berpindah laporan tanpa memuat ulang halaman, sehingga komponen Livewire
 * tidak bisa dipakai. Di sini alasannya hilang — tapi bentuk JSON-nya
 * dipertahankan supaya tabel comments tetap satu kumpulan dengan komentar di
 * halaman Pasopati lain, yang masih menulis ke sana.
 */

const BATAS_ISI = 2000;
const BATAS_NAMA = 100;
const JEDA_KOMENTAR_MS = 3000;

// Rate limiter in-memory untuk membatasi pengiriman komentar per alamat IP (cooldown 3 detik)
const batasWaktuKomentar = new Map<string, number>();

function batasiLajuKomentar(ip: string): boolean {
  const sekarang = Date.now();
  if (batasWaktuKomentar.size > 1000) {
    for (const [kunciIp, waktu] of batasWaktuKomentar.entries()) {
      if (sekarang - waktu > JEDA_KOMENTAR_MS) {
        batasWaktuKomentar.delete(kunciIp);
      }
    }
  }

  const waktuTerakhir = batasWaktuKomentar.get(ip);
  if (waktuTerakhir && sekarang - waktuTerakhir < JEDA_KOMENTAR_MS) {
    return false;
  }
  batasWaktuKomentar.set(ip, sekarang);
  return true;
}

async function eventAda(id: number) {
  // Kejadian draft belum tayang — tidak boleh menerima komentar publik.
  return Boolean(await prisma.events.findFirst({ where: { id, ...TAYANG }, select: { id: true } }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
  }
  if (!(await eventAda(id))) {
    return Response.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
  }
  return Response.json({ komentar: await daftarKomentar(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || !(await eventAda(id))) {
    return Response.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
  }

  const body = await bacaJson(req);
  if (body instanceof Response) return body;
  if (!body) {
    return Response.json({ message: "Permintaan tidak terbaca." }, { status: 400 });
  }

  const ip = ipDari(req);

  // Aksi "komentar" diset widget di hooks/gunakan-komentar.ts: token dari widget lain tidak berlaku di sini.
  if (!(await turnstileSah(typeof body.captcha === "string" ? body.captcha : null, ip, "komentar"))) {
    return Response.json({ message: "Verifikasi captcha gagal. Coba lagi." }, { status: 422 });
  }

  // `website` adalah umpan jebakan yang disembunyikan di form; hanya bot yang
  // mengisinya. Ditolak DIAM-DIAM dengan jawaban sukses, bukan dengan galat,
  // supaya tidak memberi petunjuk bahwa jebakannya terdeteksi.
  if (String(body.website ?? "").trim() !== "") {
    return Response.json({ komentar: await daftarKomentar(id) }, { status: 201 });
  }

  const nama = String(body.nama ?? "").trim();
  const email = String(body.email ?? "").trim();
  const isi = String(body.isi ?? "").trim();
  // Anonim meniru form laporan: identitas tidak diminta, nama tampil sebagai
  // "Anonim" di daftar. Email tetap disimpan null — kolomnya memang nullable.
  const anonim = Boolean(body.anonim);
  const namaSimpan = anonim ? "Anonim" : nama;
  const emailSimpan = anonim ? null : email;

  const galat: Record<string, string> = {};
  if (!anonim) {
    if (!nama) galat.nama = "Nama wajib diisi.";
    else if (nama.length > BATAS_NAMA) galat.nama = `Nama maksimal ${BATAS_NAMA} karakter.`;
    if (!email) galat.email = "Email wajib diisi.";
    // Panjang dulu: pola email tidak boleh dijalankan pada masukan sepanjang apa pun.
    else if (email.length > BATAS_NAMA) galat.email = `Email maksimal ${BATAS_NAMA} karakter.`;
    else if (!POLA_EMAIL.test(email)) galat.email = "Format email tidak valid.";
  }
  if (!isi) galat.isi = "Komentar wajib diisi.";
  else if (isi.length > BATAS_ISI) galat.isi = `Komentar maksimal ${BATAS_ISI} karakter.`;

  if (Object.keys(galat).length) {
    return Response.json(
      { message: Object.values(galat)[0], errors: galat },
      { status: 422 },
    );
  }

  const balasKe = Number.isInteger(Number(body.balas_ke)) && Number(body.balas_ke) > 0
    ? Number(body.balas_ke)
    : null;

  // Batasi spam / request konkuren agresif dari IP yang sama (cooldown 3 detik)
  if (ip && !batasiLajuKomentar(ip)) {
    return Response.json(
      { message: "Mohon tunggu beberapa detik sebelum mengirim komentar lagi." },
      { status: 429 },
    );
  }

  try {
    await simpanKomentar({ eventId: id, nama: namaSimpan, email: emailSimpan, isi, balasKe, ip });
  } catch (err: unknown) {
    // simpanKomentar hanya melempar satu pesan ramah (induk balasan tidak ada);
    // sisanya galat server (rincian Prisma) — dicatat, tidak diteruskan ke pengunjung.
    if (err instanceof Error && err.message.startsWith("Komentar yang dibalas")) {
      return Response.json({ message: err.message }, { status: 422 });
    }
    void catatGalat("komentar-web", err);
    return Response.json({ message: "Gagal menyimpan komentar. Coba lagi." }, { status: 500 });
  }

  // Komentar publik langsung tersetujui — segarkan jumlah komentar di umpan (ambilUmpan).
  revalidateTag("komentar", "max");
  return Response.json({ komentar: await daftarKomentar(id) }, { status: 201 });
}
