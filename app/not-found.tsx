import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Halaman Tidak Ditemukan | Fire",
  description: "Halaman yang Anda cari tidak dapat ditemukan.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf8f5] px-6 text-center text-[#1a1919]">
      <p className="text-sm font-semibold tracking-widest text-[#d9381e] uppercase">
        Galat 404
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        Halaman Tidak Ditemukan
      </h1>
      <p className="mt-4 max-w-md text-sm text-[#1a1919]/70 sm:text-base">
        Halaman atau laporan karhutla yang Anda tuju mungkin sudah dipindahkan, dihapus, atau tautan yang Anda masukkan keliru.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/id"
          className="rounded-full bg-[#d9381e] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          Kembali ke Beranda
        </Link>
        <Link
          href="/en"
          className="rounded-full border border-black/15 bg-white px-6 py-2.5 text-sm font-semibold text-[#1a1919] transition hover:bg-black/5"
        >
          English Version
        </Link>
      </div>
    </div>
  );
}
