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
        className="flex w-full animate-pulse flex-col gap-3 p-3
                   panggung:grid panggung:h-[calc(100svh-4rem)] panggung:gap-2 panggung:p-2
                   panggung:grid-cols-[300px_minmax(0,1fr)_340px]
                   xl:grid-cols-[320px_minmax(0,1fr)_360px]"
      >
        {/* Rel kiri */}
        <div className="bg-pantau-konsol px-3 py-3.5 aliran:rounded-2xl aliran:ring-1 aliran:ring-white/10 panggung:rounded-xl">
          <div className="h-9 rounded-lg bg-[#141414]" />
          <div className="mt-4 mr-6 grid gap-2.5 px-3">
            <div className="h-4 w-32 rounded bg-white/[0.07]" />
            <div className="h-4 w-20 rounded bg-white/[0.07]" />
            <div className="grid gap-2 pl-1.5">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="h-3.5 w-36 rounded bg-white/[0.05]" />
              ))}
            </div>
            <div className="h-4 w-24 rounded bg-white/[0.07]" />
          </div>
        </div>

        {/* Tengah: judul, bingkai peta berasio desain, kaki — geometri sama
            dengan HalamanPeta supaya tak ada geseran saat isi tiba. */}
        <div className="flex min-h-0 flex-col px-1 aliran:order-first panggung:px-0 panggung:py-6">
          <div className="mx-2 mt-4 mb-3 h-[29px] w-2/3 max-w-[380px] rounded-lg bg-white/[0.08] panggung:mx-3.5 panggung:mt-0 panggung:h-[clamp(25px,1.9vw,38px)]" />
          <div className="min-h-0 panggung:flex panggung:flex-1 panggung:items-center panggung:justify-center panggung:[container-type:size]">
            <div className="h-[54svh] w-full rounded-2xl bg-pantau-sumur ring-1 ring-white/10 panggung:aspect-[1080/544] panggung:h-auto panggung:w-[min(100cqw,calc(100cqh*1080/544))]" />
          </div>
          <div className="mx-auto mt-4 h-4 w-3/4 max-w-[560px] rounded bg-white/[0.05]" />
        </div>

        {/* Rel kanan */}
        <div className="bg-pantau-konsol p-4 aliran:rounded-2xl aliran:ring-1 aliran:ring-white/10 panggung:rounded-xl panggung:py-5">
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
