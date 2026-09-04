"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aksiTayang } from "./aksi";
import { Pemuat } from "../pemuat";

/**
 * Alih draft ↔ publish langsung dari daftar, tanpa membuka form.
 *
 * Satu tekan, tanpa konfirmasi kedua — beda dengan tombol hapus. Menurunkan
 * kejadian ke draft tidak membuang apa pun: isinya utuh, hanya berhenti tampil
 * di situs publik, dan menekan sekali lagi mengembalikannya. Konfirmasi untuk
 * tindakan yang bisa dibatalkan semudah itu cuma menambah gesekan.
 *
 * Labelnya menyebut AKIBATNYA, bukan keadaan sekarang: "Publish" pada baris
 * draft, "Jadikan draft" pada yang tayang. Keadaan sekarang sudah dibaca dari
 * cap "Draft" di sebelah judulnya, jadi tombol yang mengulanginya justru
 * membuat orang ragu apakah ini penanda atau tombol.
 */
export function TombolTayang({ id, status }: { id: number; status: string }) {
  const [sibuk, mulai] = useTransition();
  const [galat, setGalat] = useState(false);
  const router = useRouter();

  const draft = status === "draft";
  const tujuan = draft ? "published" : "draft";

  return (
    <button
      type="button"
      disabled={sibuk}
      aria-busy={sibuk}
      title={draft
        ? "Tayangkan di situs publik"
        : "Sembunyikan dari situs publik — isinya tetap tersimpan"}
      onClick={() =>
        mulai(async () => {
          setGalat(false);
          try {
            await aksiTayang(id, tujuan);
            router.refresh();
          } catch {
            setGalat(true);
          }
        })
      }
      className={`cms-tombol cms-tombol--kecil shrink-0 ${
        draft ? "cms-tombol--utama" : "cms-tombol--garis"
      }`}
    >
      {sibuk && <Pemuat />}
      {galat ? "Gagal, ulangi" : draft ? "Publish" : "Jadikan draft"}
    </button>
  );
}
