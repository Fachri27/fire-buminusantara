"use client";

import { useActionState } from "react";
import { Isian } from "../isian";
import { KUNCI_SOROTAN, LABEL_SOROTAN, type KunciSorotan } from "@/lib/statistik-sorotan-teks";
import { aksiSimpanSorotan } from "./aksi";

type Keadaan = { ok: true } | { ok: false; galat: string; bidang?: KunciSorotan } | null;

/** Format Indonesia untuk nilai awal ("5000" → "5.000"). */
function formatAwal(n: number): string {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function FormSorotan({ awal }: { awal: Record<KunciSorotan, number> }) {
  const [keadaan, aksi, mengirim] = useActionState<Keadaan, FormData>(
    async (_sebelumnya: Keadaan, data: FormData) => aksiSimpanSorotan(data),
    null,
  );

  return (
    <form action={aksi} className="grid max-w-xl gap-5">
      {keadaan && !keadaan.ok && (
        <p role="alert" className="rounded-md border border-[var(--api)]/30 bg-[var(--api)]/[0.07] px-4 py-3 text-[13.5px] text-[var(--bara)]">
          {keadaan.galat}
        </p>
      )}
      {keadaan?.ok && (
        <p role="status" className="rounded-md border border-[var(--hijau)]/25 bg-[var(--hijau)]/[0.07] px-4 py-3 text-[13.5px]">
          Tersimpan — angka di landing karhutla ikut segar.
        </p>
      )}
      {KUNCI_SOROTAN.map((kunci) => (
        <Isian
          key={kunci}
          label={LABEL_SOROTAN[kunci].id}
          nama={kunci}
          nilai={formatAwal(awal[kunci])}
          wajib
          mono
          penunjuk="cth. 5.000"
          bantuan={LABEL_SOROTAN[kunci].en}
        />
      ))}
      <div>
        <button
          type="submit"
          disabled={mengirim}
          aria-busy={mengirim}
          className="inline-flex items-center rounded-md bg-[var(--api)] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {mengirim ? "Menyimpan…" : "Simpan angka"}
        </button>
      </div>
    </form>
  );
}
