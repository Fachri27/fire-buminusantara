import type { Bahasa } from "@/lib/bahasa";

/**
 * Kerangka pemuatan konsol pantau.
 *
 * Menahan geometri tiga kolom terkunci (rel kiri, judul + bingkai peta,
 * rel kanan) di bawah bilah navigasi — begitu IsiHalaman selesai, halaman
 * asli melepas kerangka ini tanpa menggeser tata letak apa pun. Sengaja bukan
 * komponen klien: tidak ada yang perlu dihitung di sini, dan begitu
 * IsiHalaman selesai React cukup melepas seluruh pohon ini.
 */
export function KerangkaPeta({ bahasa = "id" }: { bahasa?: Bahasa }) {
  return (
    <div role="status" aria-busy="true" className="bg-pantau-malam pt-16 panggung:h-[100svh] panggung:overflow-hidden">
      <p className="sr-only">
        {bahasa === "en" ? "Loading smoke spread map…" : "Memuat peta sebaran asap…"}
      </p>

      <div
        aria-hidden="true"
        className="mx-auto flex w-full max-w-[1720px] animate-pulse flex-col gap-3 p-3
                   panggung:grid panggung:h-[calc(100svh-4rem)] panggung:gap-0 panggung:p-0
                   panggung:grid-cols-[300px_minmax(0,1fr)_340px]
                   xl:grid-cols-[320px_minmax(0,1fr)_360px]"
      >
        {/* Rel kiri */}
        <div className="bg-pantau-konsol p-4 aliran:rounded-2xl aliran:ring-1 aliran:ring-white/10 panggung:border-r panggung:border-white/10 panggung:py-5">
          <div className="h-11 rounded-xl bg-white/[0.07]" />
          <div className="mt-5 h-3 w-24 rounded bg-white/[0.07]" />
          <div className="mt-2 grid gap-1.5">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-10 rounded-xl bg-white/[0.05]" />
            ))}
          </div>
        </div>

        {/* Tengah: bingkai peta berasio desain, di tengah kolom */}
        <div className="flex min-h-0 flex-col px-1 aliran:order-first panggung:justify-center panggung:px-2 panggung:py-5">
          <div className="h-[54svh] rounded-2xl bg-pantau-sumur ring-1 ring-white/10 panggung:aspect-[1080/544] panggung:h-auto panggung:max-h-full" />
        </div>

        {/* Rel kanan */}
        <div className="bg-pantau-konsol p-4 aliran:rounded-2xl aliran:ring-1 aliran:ring-white/10 panggung:border-l panggung:border-white/10 panggung:py-5">
          <div className="h-3 w-32 rounded bg-white/[0.07]" />
          <div className="mt-3 grid gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl ring-1 ring-white/10">
                <div className="aspect-[16/10] bg-white/[0.05]" />
                <div className="grid gap-2 p-3.5">
                  <div className="h-3 w-1/3 rounded bg-white/[0.07]" />
                  <div className="h-4 w-full rounded bg-white/[0.08]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
