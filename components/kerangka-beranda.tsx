import type { Bahasa } from "@/lib/bahasa";

/**
 * Kerangka pemuatan beranda — pengganti fallback <Suspense>.
 *
 * Tanpa ini fallbacknya null: selama kueri berjalan halaman hanya memuat Nav,
 * lalu seluruh isinya muncul sekaligus — tata letak "melompat" dan posisi
 * guliran terkunci di atas. Kerangka ini memasang dua layar dengan tinggi yang
 * sama dengan aslinya (hero 100svh + peta 100svh) supaya tinggi dokumen sudah
 * benar sejak HTML pertama tiba, dan menyalin geometri kartu dari token yang
 * sama dengan korsel, jadi isinya bertukar tanpa menggeser apa pun.
 *
 * Sengaja bukan komponen klien: tidak ada yang perlu dihitung di sini, dan
 * begitu IsiHalaman selesai React cukup melepas seluruh pohon ini.
 *
 * Tata letak aliran ditulis dengan utilitas Tailwind di sini. Proporsi mode
 * panggung (kanvas desain 1920×1080) diberikan blok .kerangka-beranda__* di
 * globals.css: penskalaan transform isi asli dipasang gunakanPanggung() yang
 * baru menyala setelah kerangka diganti, jadi kerangkanya membangun kanvas
 * 16:9 yang sama murni lewat CSS dan menempatkan koordinat desain sebagai
 * pecahannya — kartu, statistik, dan peta pun berukuran proporsional dengan
 * isi asli di desktop/iPad sejak layar pertama digambar.
 */
export function KerangkaBeranda({ bahasa = "id" }: { bahasa?: Bahasa }) {
  return (
    <div role="status" className="kerangka-beranda">
      <p className="sr-only">
        {bahasa === "en" ? "Loading fire monitoring…" : "Memuat pantauan karhutla…"}
      </p>

      <div aria-hidden="true">
        {/* ── Layar 1 — hero. Kelas section disalin dari Korsel (tanpa varian
            panggung) supaya foto latar, lapisan, dan tingginya identik; foto
            yang sama berarti sudah di tembolok saat kartu asli datang. */}
        <section className="kerangka-beranda__hero sticky top-0 z-[1] flex min-h-[100svh]
                            flex-col justify-center overflow-hidden
                            px-[var(--pias)] pt-[calc(4rem+clamp(18px,5vw,56px))]
                            pb-[clamp(20px,5vw,56px)] pendek:static pendek:z-auto pendek:min-h-0">
          <img src="/assets/img/bg-karhutla.jpg" alt="" fetchPriority="high"
               className="absolute inset-0 h-full w-full object-cover" />

          <div className="kerangka-beranda__kanvas relative mx-auto w-full max-w-[940px]">
            {/* Rak: jendela + tiga slot dengan token kartu yang sama dengan
                pantauan-kosong.css, jadi ukurannya ikut berganti di tiap mode. */}
            <div className="kerangka-beranda__jendela relative w-full overflow-hidden pt-[10px] pb-[18px]">
              <div className="kerangka-beranda__rak relative flex h-[var(--kartu-tinggi)] items-stretch
                              justify-center gap-[var(--kartu-sela)]">
                <SlotSamping />

                {/* Kartu tengah: kaca putih varian lanskap — bilah judul,
                    bilah tanggal, lalu kotak media yang berdenyut. */}
                <article className="kerangka-beranda__kartu relative z-[1] flex w-[var(--kartu-lebar)]
                                    shrink-0 flex-col rounded-[12px] bg-white/[0.88] p-[var(--kartu-pias)]
                                    text-center shadow-[10px_12px_28px_rgb(0_0_0/0.32)] ring-1
                                    ring-white/60 backdrop-blur-[7px]">
                  <div className="mx-auto h-[calc(var(--ukuran-label)*1.15)] w-3/4 animate-pulse
                                  rounded-full bg-black/10" />
                  <div className="mx-auto mt-4 h-[calc(var(--ukuran-tanggal)*1.2)] w-1/3 animate-pulse
                                  rounded-full bg-black/10" />
                  <div className="flex-1" />
                  <div className="kerangka-beranda__media mt-[var(--gambar-jarak)] aspect-[3/2] h-auto
                                  max-h-[var(--gambar-tinggi-maks)] w-[var(--gambar-lebar)] shrink-0
                                  self-center animate-pulse rounded-[10px]
                                  bg-[linear-gradient(150deg,#eef1f4,#d7dee4)]
                                  ring-1 ring-black/[0.08] shadow-[0_8px_20px_rgb(0_0_0/0.2)]" />
                </article>

                <SlotSamping />
              </div>
            </div>

            {/* Strip statistik: lima kartu putih dengan tiga baris isian. */}
            <div className="kerangka-beranda__statistik relative mt-[clamp(14px,3.6vw,20px)]">
              <div className="kerangka-beranda__statistik-label mb-[6px]
                              h-[calc(var(--ukuran-eyebrow)*1.2)] w-32 animate-pulse
                              rounded-full bg-[rgb(26_25_25/0.72)]" />
              <div className="kerangka-beranda__jalur-statistik tanpa-bilah-gulir flex
                              gap-[var(--sela)] overflow-hidden">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="kerangka-beranda__kartu-statistik w-[var(--statistik-lebar)]
                                          shrink-0 animate-pulse bg-white p-[var(--statistik-pias)] text-left">
                    <div className="h-[calc(var(--ukuran-tanggal)*1.2)] w-2/3 rounded-full bg-black/10" />
                    <div className="mt-[calc(var(--statistik-jarak-label)/2)] h-[calc(var(--ukuran-label)*1.2)]
                                    w-11/12 rounded-full bg-black/15" />
                    <div className="mt-2 h-[calc(var(--ukuran-nilai)*1.1)] w-1/2 rounded-full bg-black/10" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Layar 2 — peta. Lapisan latarnya disalin dari section aslinya
            supaya peralihan hero→peta terlihat sama; kanvas dan panelnya
            diganti bidang denyut berukuran mirip. */}
        <section className="kerangka-beranda__layar-peta tepi-lunak relative z-[2] flex h-[100svh] min-h-[100svh]
                            w-full flex-col justify-center overflow-hidden">
          <div className="kabur-tepi pointer-events-none" />
          <div className="absolute inset-0 h-full w-full animate-pulse bg-[#0a0f18]/85" />

          {/* Kolom pencarian mengambang (khusus mobile, desktop tersembunyi) */}
          <div className="pointer-events-none absolute inset-x-0 top-[clamp(64px,11vh,92px)] z-[20] flex justify-center px-4 md:hidden panggung:hidden">
            <div className="w-full max-w-[580px]">
              <div className="h-[calc(clamp(12px,3.4vw,16px)*2+var(--ukuran-nama)*1.2)]
                              rounded-[16px] bg-[#fdf3f2] shadow-[0_3px_16px_rgb(0_0_0/0.16)]" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Slot samping: kaca tipis dengan peredupan kartu non-aktif korsel. */
function SlotSamping() {
  return (
    <div className="kerangka-beranda__slot w-[var(--kartu-lebar)] shrink-0 rounded-[12px]
                    bg-white/90 opacity-45 shadow-[6px_6px_14px_rgb(0_0_0/0.22)] ring-1
                    ring-white/60" />
  );
}
