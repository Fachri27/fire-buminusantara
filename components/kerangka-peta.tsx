import type { Bahasa } from "@/lib/bahasa";

/**
 * Kerangka pemuatan konsol pantau.
 *
 * Menahan geometri konsol di bawah bilah navigasi — di panggung tiga kolom
 * terkunci (rel kiri, judul + bingkai peta, rel kanan), di aliran peta penuh
 * dengan laci yang mengintip dari bawah — begitu IsiHalaman selesai, halaman
 * asli melepas kerangka ini tanpa menggeser tata letak apa pun. Sengaja bukan
 * komponen klien: tidak ada yang perlu dihitung di sini, dan begitu
 * IsiHalaman selesai React cukup melepas seluruh pohon ini.
 */
export function KerangkaPeta({ bahasa = "id" }: { bahasa?: Bahasa }) {
  return (
    <div role="status" aria-busy="true" className="h-[100svh] overflow-hidden bg-pantau-malam pt-16">
      <p className="sr-only">
        {bahasa === "en" ? "Loading smoke spread map…" : "Memuat peta sebaran asap…"}
      </p>

      <div
        aria-hidden="true"
        className="relative flex h-[calc(100svh-4rem)] w-full animate-pulse flex-col
                   panggung:grid panggung:gap-2 panggung:p-2
                   panggung:grid-cols-[300px_minmax(0,1fr)_340px]
                   xl:grid-cols-[320px_minmax(0,1fr)_360px]"
      >
        {/* Rel kiri — hanya panggung */}
        <div className="bg-pantau-konsol px-3 py-3.5 aliran:hidden panggung:rounded-xl">
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

        {/* Tengah: di panggung judul, bingkai berasio desain, kaki; di aliran
            peta penuh dengan laci mengintip — geometri sama dengan HalamanPeta. */}
        <div className="relative flex min-h-0 flex-col aliran:flex-1 panggung:py-6">
          <div className="mx-3.5 mb-3 hidden w-2/3 max-w-[380px] rounded-lg bg-white/[0.08] panggung:block panggung:h-[clamp(25px,1.9vw,38px)]" />
          <div className="min-h-0 aliran:h-full panggung:flex panggung:flex-1 panggung:items-center panggung:justify-center panggung:[container-type:size]">
            <div className="h-full w-full bg-pantau-sumur panggung:aspect-[1080/544] panggung:h-auto panggung:w-[min(100cqw,calc(100cqh*1080/544))] panggung:rounded-2xl panggung:ring-1 panggung:ring-white/10" />
          </div>
          <div className="mx-auto mt-4 hidden h-4 w-3/4 max-w-[560px] rounded bg-white/[0.05] panggung:block" />

          {/* Laci mengintip (TINGGI_INTIP = 272px) — hanya aliran */}
          <div className="absolute inset-x-0 bottom-0 h-[272px] rounded-t-2xl bg-pantau-konsol px-4 pt-3 ring-1 ring-white/10 sm:mx-auto sm:max-w-xl panggung:hidden">
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
            <div className="mt-3 h-11 rounded-lg bg-[#141414]" />
            <div className="mt-3 flex gap-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="w-[calc((100%-1rem)/2)] shrink-0">
                  <div className="h-[104px] rounded-lg bg-white/[0.06]" />
                  <div className="mt-2 h-2.5 w-1/2 rounded bg-white/[0.06]" />
                  <div className="mt-1.5 h-3 w-full rounded bg-white/[0.08]" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rel kanan — hanya panggung */}
        <div className="bg-pantau-konsol p-4 aliran:hidden panggung:rounded-xl panggung:py-5">
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
