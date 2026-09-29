"use client";

import { useActionState } from "react";
import { Isian, IsianPanjang } from "../isian";
import type { Sorotan } from "@/lib/statistik-sorotan";
import { aksiSimpanSorotan } from "./aksi";

type Keadaan = { ok: true } | { ok: false; galat: string; bidang?: string } | null;

const BAHASA_FORM = [
  { kode: "id", nama: "Indonesia" },
  { kode: "en", nama: "English" },
] as const;

export function FormSorotan({ awal }: { awal: Sorotan }) {
  const [keadaan, aksi, mengirim] = useActionState<Keadaan, FormData>(
    async (_sebelumnya: Keadaan, data: FormData) => aksiSimpanSorotan(data),
    null,
  );

  return (
    <form action={aksi} className="grid max-w-3xl gap-6">
      {keadaan && !keadaan.ok && (
        <p role="alert" className="rounded-md border border-[var(--api)]/30 bg-[var(--api)]/[0.07] px-4 py-3 text-[13.5px] text-[var(--bara)]">
          {keadaan.galat}
        </p>
      )}
      {keadaan?.ok && (
        <p role="status" className="rounded-md border border-[var(--hijau)]/25 bg-[var(--hijau)]/[0.07] px-4 py-3 text-[13.5px]">
          Tersimpan — strip statistik di landing karhutla ikut segar.
        </p>
      )}
      {awal.id.map((_, i) => (
        <fieldset key={i} className="grid gap-4 rounded-md border border-black/10 p-4 dark:border-white/10">
          <legend className="cms-mata px-1">Kartu {i + 1}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {BAHASA_FORM.map(({ kode, nama }) => (
              <div key={kode} className="grid content-start gap-3">
                <Isian
                  label={`Angka — ${nama}`}
                  nama={`nilai_${kode}_${i}`}
                  nilai={awal[kode][i].nilai}
                  wajib
                  panjangMaks={40}
                  penunjuk={kode === "id" ? "cth. Rp 123,1 triliun" : "e.g. Rp 123.1 trillion"}
                />
                <IsianPanjang
                  label={`Keterangan — ${nama}`}
                  nama={`keterangan_${kode}_${i}`}
                  nilai={awal[kode][i].keterangan}
                  wajib
                  baris={3}
                  panjangMaks={300}
                />
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      <div>
        <button
          type="submit"
          disabled={mengirim}
          aria-busy={mengirim}
          className="inline-flex items-center rounded-md bg-[var(--api)] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {mengirim ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </form>
  );
}
