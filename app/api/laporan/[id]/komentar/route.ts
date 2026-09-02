import { NextResponse } from "next/server";
import { daftarKomentar, simpanKomentar } from "@/lib/komentar";
import { ipDari, turnstileSah } from "@/lib/turnstile";
import { prisma } from "@/lib/prisma";

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

async function eventAda(id: number) {
  return Boolean(await prisma.events.findUnique({ where: { id }, select: { id: true } }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
  }
  if (!(await eventAda(id))) {
    return NextResponse.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ komentar: await daftarKomentar(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || !(await eventAda(id))) {
    return NextResponse.json({ message: "Laporan tidak ditemukan." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: "Permintaan tidak terbaca." }, { status: 400 });
  }

  const ip = ipDari(req);

  if (!(await turnstileSah(body.captcha ?? null, ip))) {
    return NextResponse.json({ message: "Verifikasi captcha gagal. Coba lagi." }, { status: 422 });
  }

  // `website` adalah umpan jebakan yang disembunyikan di form; hanya bot yang
  // mengisinya. Ditolak DIAM-DIAM dengan jawaban sukses, bukan dengan galat,
  // supaya tidak memberi petunjuk bahwa jebakannya terdeteksi.
  if (String(body.website ?? "").trim() !== "") {
    return NextResponse.json({ komentar: await daftarKomentar(id) }, { status: 201 });
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
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) galat.email = "Format email tidak valid.";
    else if (email.length > BATAS_NAMA) galat.email = `Email maksimal ${BATAS_NAMA} karakter.`;
  }
  if (!isi) galat.isi = "Komentar wajib diisi.";
  else if (isi.length > BATAS_ISI) galat.isi = `Komentar maksimal ${BATAS_ISI} karakter.`;

  if (Object.keys(galat).length) {
    return NextResponse.json(
      { message: Object.values(galat)[0], errors: galat },
      { status: 422 },
    );
  }

  const balasKe = Number.isInteger(Number(body.balas_ke)) && Number(body.balas_ke) > 0
    ? Number(body.balas_ke)
    : null;

  await simpanKomentar({ eventId: id, nama: namaSimpan, email: emailSimpan, isi, balasKe, ip });

  return NextResponse.json({ komentar: await daftarKomentar(id) }, { status: 201 });
}
