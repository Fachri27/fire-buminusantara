"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pemuat } from "./pemuat";

/**
 * Tombol muat-ulang manual CMS.
 *
 * Angka tunggakan di menu memang sudah disegarkan otomatis tiap aksi
 * (updateTag + router.refresh), tapi cache Router dan jeda jaringan bisa
 * membuat daftar di layar tertinggal sepersekian detik — tombol ini memberi
 * jalan keluar yang eksplisit: memuat ulang Server Component halaman ini
 * (daftar + angka menu) tanpa reload dokumen penuh.
 */
export function Segarkan({ label = "Muat ulang", lebar = false }: { label?: string; lebar?: boolean }) {
  const router = useRouter();
  const [menunggu, mulai] = useTransition();

  return (
    <button
      type="button"
      disabled={menunggu}
      aria-busy={menunggu}
      onClick={() => mulai(() => router.refresh())}
      className={`cms-tombol cms-tombol--garis cms-tombol--kecil${lebar ? " w-full justify-center" : ""}`}
    >
      {menunggu && <Pemuat />}
      {label}
    </button>
  );
}
