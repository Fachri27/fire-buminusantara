"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Berita } from "@/lib/events";
import type { KabupatenTerluas } from "@/lib/wms";
import { BAHASA, TEKS_PETA, type Bahasa } from "@/lib/bahasa";
import { gunakanParallax } from "@/hooks/gunakan-parallax";
import { gunakanKolomMasonry } from "@/hooks/gunakan-kolom-masonry";
import { TUTUP_OVERLAY } from "@/lib/peristiwa-popup";
import {
  inferPulau,
  namaProvinsiLokal,
  ringkasNamaProvinsi,
  PROVINSI_PETA_NAMA,
} from "@/lib/wilayah";
import { Peta, type ModePeta } from "@/components/peta";
import { PopupPeta } from "@/components/popup-peta";
import { RincianLaporan } from "@/components/rincian-laporan";

/** Provinsi yang ditekan di peta atau di rel kiri — pop-up laporan provinsi
 *  ini tumbuh dari titik layar tempat ia ditekan. */
type WilayahDipilih = { nama: string; pulau: string | null; asal: { x: number; y: number } };

/** Hasil pencarian di rel kanan — dibatasi supaya tetap terpindai. */
const BATAS_CARI = 10;

/**
 * Konsol pantau karhutla — tiga kolom terkunci satu viewport.
 *
 * Kiri pencarian + daftar 34 provinsi + peringkat luas terbakar, tengah judul
 * + peta berbingkai (bukan selayar penuh), kanan kartu laporan terbaru.
 * Di layar panggung halaman tidak menggulir — rel-relnya menggulir
 * sendiri-sendiri; di bawah itu ia mengalir biasa: peta dulu, sisanya
 * menyusul.
 *
 * Satu klik pada laporan membuka pop-up rincian yang sama dengan beranda
 * (geser media, komentar, bagikan) — URL ikut berpindah ke /fire/<slug> dan
 * kembali ke index (konsol peta) saat ditutup.
 */
export function HalamanPeta({
  berita,
  terbaru,
  populer,
  komentar,
  jumlahLaporan,
  kabupaten,
  bahasa,
}: {
  /** Arsip lengkap — pop-up wilayah dan pencarian. */
  berita: Berita[];
  /** Lima laporan terbaru — kelompok pertama rel kanan saat tidak mencari. */
  terbaru: Berita[];
  /** Lima laporan berkomentar terbanyak (di luar lima terbaru) — kelompok
   *  kedua rel kanan saat tidak mencari. */
  populer: Berita[];
  /** Jumlah komentar per id laporan — dipakai mengurutkan filter "populer"
   *  saat peta dilipat (arsip penuh). Hanya laporan yang punya komentar yang
   *  terdaftar; sisanya dihitung 0. */
  komentar: Record<string, number>;
  jumlahLaporan: Record<string, number>;
  /** Kabupaten berluas kebakaran dari layer GeoServer, terluas dulu. */
  kabupaten: KabupatenTerluas[];
  bahasa: Bahasa;
}) {
  const teks = TEKS_PETA[bahasa];
  const [wilayah, setWilayah] = useState<WilayahDipilih | null>(null);
  // Laporan yang pop-up rinciannya terbuka, atau null — sama seperti beranda.
  const [sorot, setSorot] = useState<Berita | null>(null);
  const [cari, setCari] = useState("");
  // Daftar kabupaten tampil sejak awal (rel gulirnya sendiri, 300px) dan bisa
  // dilipat lewat judulnya; saat mencari ia selalu terbuka.
  const [kabupatenBuka, setKabupatenBuka] = useState(true);
  // Sama untuk daftar provinsi: tampil sejak awal, bisa dilipat lewat judulnya.
  const [provinsiBuka, setProvinsiBuka] = useState(true);
  // Kedua rel bisa dilipat seluruhnya supaya peta lebih lega — dibuka lagi
  // lewat tab di tepi bingkai peta. Peta mengikuti sendiri (ResizeObserver
  // bawaan MapLibre), tak perlu resize manual.
  const [kiriBuka, setKiriBuka] = useState(true);
  const [kananBuka, setKananBuka] = useState(true);
  // Kolom tengah (peta) bisa dilipat — saat dilipat rel kanan melebar penuh
  // sampai batas rel kiri. Dibuka lagi lewat rel bukaan di bekas kolomnya.
  const [tengahBuka, setTengahBuka] = useState(true);
  /* Arsipnya kini dipasang langsung penuh (lihat daftarGrid), jadi tak ada
     lagi gerbang yang menahan daftar pendek — itu yang dulu membuat rel
     tampak "lima dulu, baru semua".

     Yang tersisa hanya memanaskan gambar. Kartunya memakai loading="lazy",
     jadi tanpa ini gambar baru mulai diunduh pada saat elemennya dipasang;
     memulainya sejak tombol ditekan membuat gambar tiba lebih cepat tanpa
     menunda apa pun. Tinggi kartu sudah dipesan lewat rasio, jadi gambar yang
     telat tidak lagi menggeser tata letak. */
  useEffect(() => {
    if (tengahBuka) return;
    for (const laporan of berita) {
      const media = laporan.media[0];
      const src = media?.jenis === "video"
        ? (media.poster ?? laporan.poster)
        : (media?.url ?? laporan.gambar ?? laporan.poster);
      if (src) {
        const muat = new Image();
        muat.src = src;
      }
    }
  }, [tengahBuka, berita]);
  // Mode lapisan aktif — diangkat dari <Peta> supaya aksen rel kiri (titik +
  // badge jumlah) bisa selaras dengan tema lapisan: asap = ungu berbahaya
  // #49006A (pusat asap terpekat), windy = oren bara seperti semula.
  const [modePeta, setModePeta] = useState<ModePeta>("asap");
  const asapAktif = modePeta === "asap";
  // Aksen tombol filter rel kanan — senada dengan pil lapisan dan TabRel:
  // ungu #49006a untuk aerosol, hijau emerald untuk windy.
  const aksenFilter = asapAktif
    ? "bg-[#49006a] text-white ring-1 ring-[#86198f]/60"
    : "bg-emerald-700 text-white ring-1 ring-emerald-500/60";
  // Aksen tombol tutup/buka kolom peta — ikut tema lapisan seperti pil filter,
  // supaya tombolnya terbaca sebagai bagian dari peta yang sedang aktif.
  const aksenTombolPeta = asapAktif
    ? "bg-[#49006a]/90 ring-[#d946ef]/40 shadow-[0_8px_24px_rgb(73_0_106/0.5)] hover:bg-[#5c0086] hover:ring-[#d946ef]/70"
    : "bg-emerald-700/90 ring-emerald-300/40 shadow-[0_8px_24px_rgb(4_120_87/0.45)] hover:bg-emerald-600 hover:ring-emerald-200/70";
  // Filter jenis laporan: terbaru / populer / semua.
  type FilterMedia = "semua" | "terbaru" | "populer";
  const [filterMedia, setFilterMedia] = useState<FilterMedia>("semua");
  // Mode tampilan rel kanan — kartu atau daftar.
  const [modeRel, setModeRel] = useState<"kartu" | "daftar">("kartu");

  const kunci = ringkasNamaProvinsi(cari.trim());

  /* Provinsi yang punya kabupaten cocok dengan kata kunci — mengetik "Berau"
     ikut memunculkan Kalimantan Timur di daftar provinsi dan laporan-laporannya
     di rel kanan, bukan "tidak ada yang cocok". */
  const provinsiKabupatenCocok = useMemo(() => {
    if (!kunci) return new Set<string>();
    return new Set(
      kabupaten
        .filter((k) => ringkasNamaProvinsi(k.nama).includes(kunci))
        .map((k) => namaProvinsiLokal(k.provinsi)),
    );
  }, [kabupaten, kunci]);

  /* Seluruh provinsi, terbanyak laporannya dulu dengan abjad sebagai
     penyeimbang — urutan yang sama dengan daftar pilihan di pop-up wilayah.
     Saat mencari, disaring lewat nama provinsi atau kabupatennya. */
  const daftarProvinsi = useMemo(() => {
    const semua = [...PROVINSI_PETA_NAMA].sort(
      (a, b) =>
        (jumlahLaporan[b] ?? 0) - (jumlahLaporan[a] ?? 0) ||
        a.localeCompare(b, "id"),
    );
    if (!kunci) return semua;
    return semua.filter((n) => ringkasNamaProvinsi(n).includes(kunci) || provinsiKabupatenCocok.has(n));
  }, [jumlahLaporan, kunci, provinsiKabupatenCocok]);

  /* Kabupaten ikut kotak cari yang sama — cocok lewat nama kabupaten atau
     provinsinya, jadi mengetik "kalimantan" menampilkan kabupaten di sana. */
  const daftarKabupaten = useMemo(() => {
    if (!kunci) return kabupaten;
    return kabupaten.filter((k) =>
      [k.nama, k.provinsi].some((t) => ringkasNamaProvinsi(t).includes(kunci)),
    );
  }, [kabupaten, kunci]);

  /* Pembantu filter — tidak ada filter media (video/foto), hanya filter kelompok. */

  /* Rel kanan: tanpa kata kunci ia menampilkan dua kelompok (terbaru + populer);
     saat mencari ia menyaring arsip lengkap. null = mode kelompok. */
  const laporanTampil = useMemo(() => {
    if (!kunci) return null;
    return berita
      .filter(
        (b) =>
          [b.judul, b.lokasi, b.provinsi].some(
            (t) => t && ringkasNamaProvinsi(t).includes(kunci),
          ) || (b.provinsi !== null && provinsiKabupatenCocok.has(b.provinsi)),
      )
      .slice(0, BATAS_CARI);
  }, [berita, kunci, provinsiKabupatenCocok]);

  /* Laporan terbaru — ditampilkan saat filterMedia "semua" atau "terbaru". */
  const laporanTerbaru = useMemo(() => {
    if (filterMedia === "populer") return [];
    return terbaru;
  }, [terbaru, filterMedia]);

  /* Laporan populer — ditampilkan saat filterMedia "semua" atau "populer". */
  const laporanPopuler = useMemo(() => {
    if (filterMedia === "terbaru") return [];
    return populer;
  }, [populer, filterMedia]);

  /* Versi arsip penuh dari "populer": SELURUH laporan diurut komentar
     terbanyak, bukan lima pilihan rel sempit. Prop `populer` sengaja tidak
     dipakai di sini — ia dibatasi lima DAN mengecualikan lima terbaru, jadi
     memakainya berarti filter ini selamanya menampilkan lima kartu saja. */
  const arsipPopuler = useMemo(() => {
    const nilai = (b: Berita) => komentar[b.id] ?? 0;
    // Salinan: sort() mengubah larik di tempat, dan `berita` milik prop.
    return [...berita].sort((a, b) => nilai(b) - nilai(a));
  }, [berita, komentar]);

  /* Pop-up tumbuh dari baris yang ditekan, sama seperti ia tumbuh dari
     provinsi yang ditekan di peta. */
  const pilihProvinsi = (nama: string, e: React.MouseEvent<HTMLElement>) => {
    const kotak = e.currentTarget.getBoundingClientRect();
    setWilayah({
      nama,
      pulau: inferPulau(nama),
      asal: { x: kotak.left + kotak.width / 2, y: kotak.top + kotak.height / 2 },
    });
  };

  // Pop-up rincian seperti beranda: URL ikut ke /fire/<slug>, kembali ke
  // index (konsol peta) saat ditutup. Pop-up wilayah (kalau ada) tetap di
  // bawahnya (z-46 > z-45).
  const bukaRincian = useCallback(
    (b: Berita) => {
      setSorot(b);
      if (typeof window !== "undefined") {
        const pathTujuan = b.slug ? `/${bahasa}/fire/${b.slug}` : `/${bahasa}`;
        if (window.location.pathname !== pathTujuan) {
          window.history.pushState({ slug: b.slug }, "", pathTujuan);
        }
      }
    },
    [bahasa],
  );

  const tutupRincian = useCallback(() => {
    setSorot(null);
    if (typeof window !== "undefined") {
      const pathPeta = `/${bahasa}`;
      if (window.location.pathname !== pathPeta) {
        window.history.pushState(null, "", pathPeta);
      }
    }
  }, [bahasa]);

  // Pop-up mana pun yang terbuka menghentikan guliran halaman di belakangnya.
  gunakanParallax(sorot !== null || wilayah !== null);

  // Sinkronkan pop-up saat pengunjung menekan tombol Back / Forward di peramban.
  useEffect(() => {
    const saatPopState = () => {
      const path = window.location.pathname;
      const pola = new RegExp(`^/(?:${BAHASA.join("|")})/fire/([^/]+)$`);
      const cocokan = path.match(pola);
      if (cocokan && cocokan[1]) {
        const slug = decodeURIComponent(cocokan[1]);
        const ketemu = berita.find((b) => b.slug === slug);
        if (ketemu) {
          setSorot(ketemu);
          return;
        }
      }
      setSorot(null);
    };

    window.addEventListener("popstate", saatPopState);
    return () => window.removeEventListener("popstate", saatPopState);
  }, [berita]);

  /* Panduan data lapisan aktif — kaki kolom tengah di panggung, penutup tab
     Wilayah di laci ponsel. */
  const tentangData = (
    <>
      <strong className="font-bold text-white">{teks.hakCipta}</strong> — {asapAktif ? teks.kakiAerosol : teks.kakiWindy}
    </>
  );

  /* Daftar provinsi + kabupaten, dipakai rel kiri (panggung) dan tab Wilayah
     laci (aliran). `idAwalan` membedakan id daftar keduanya; `lega` untuk
     laci: tanpa rel gulir bersarang dan baris lebih tinggi agar mudah disentuh. */
  const kelompokWilayah = (idAwalan: string, lega = false) => (
    <KelompokWilayah
      teks={teks}
      kunci={kunci}
      daftarProvinsi={daftarProvinsi}
      daftarKabupaten={daftarKabupaten}
      adaKabupaten={kabupaten.length > 0}
      provinsiBuka={provinsiBuka}
      onAlihProvinsi={() => setProvinsiBuka((b) => !b)}
      kabupatenBuka={kabupatenBuka}
      onAlihKabupaten={() => setKabupatenBuka((b) => !b)}
      onPilih={pilihProvinsi}
      idAwalan={idAwalan}
      lega={lega}
    />
  );

  // Bilah navigasi: tutup pop-up apa pun yang sedang terbuka.
  useEffect(() => {
    const tutupSemua = () => {
      setWilayah(null);
      tutupRincian();
    };
    window.addEventListener(TUTUP_OVERLAY, tutupSemua);
    return () => window.removeEventListener(TUTUP_OVERLAY, tutupSemua);
  }, [tutupRincian]);

  /* Rel kanan saat peta dilipat melebar penuh — daftar satu kolom akan
     meregang (media potret jadi kolom raksasa di tengah layar), jadi ia jadi
     masonry; mode daftar tetap satu kolom.

     Kolomnya dibagi di JS, BUKAN lewat CSS `columns`. Dengan CSS columns
     peramban menyeimbangkan sendiri isi tiap kolom memakai tinggi yang ada
     saat itu; karena tinggi kartu mengikuti gambar, begitu gambar berdatangan
     seluruh isi ditata ulang dan kartu meloncat antar kolom — itulah "kedip"
     saat pertama membuka (terukur: daftar melonjak 3998px -> 6335px). Dengan
     pembagian tetap, kartu tak punya jalan untuk pindah kolom: yang tersisa
     hanya geser turun di dalam kolomnya sendiri. */
  const kartuGrid = !tengahBuka && modeRel === "kartu";
  const jumlahKolom = gunakanKolomMasonry(kiriBuka);
  const kelasUlRel = kartuGrid ? "mt-2" : "mt-2 divide-y divide-white/10";
  const kelasLiRel = kartuGrid
    // Jarak antar kartu sama ke bawah dan ke samping (24px).
    ? "mb-6"
    : "py-5 first:pt-0 last:pb-0";

  /* Satu baris rel kanan — dipakai ketiga daftar supaya markupnya sama. */
  const itemRel = (b: Berita) => (
    <li key={b.id} className={kelasLiRel}>
      {modeRel === "kartu"
        ? <KartuLaporan b={b} bukaLabel={teks.bukaRincian} selengkapnya={teks.selengkapnya} lebihSedikit={teks.lebihSedikit} masonry={kartuGrid} onBuka={() => bukaRincian(b)} />
        : <ItemListLaporan b={b} bukaLabel={teks.bukaRincian} onBuka={() => bukaRincian(b)} />
      }
    </li>
  );

  /* Mode full (peta dilipat): tampilkan SEMUA foto arsip (terbaru dulu —
     `berita` sudah urut event_date desc), bukan dibatasi 5 seperti rel
     sempit. Filter eksplisit "populer" tetap dihormati. */
  /* Tanpa penundaan: begitu peta dilipat, arsipnya langsung penuh. Dulu di
     sini ada gerbang yang menahan daftar pendek sampai animasi + gambar siap,
     dan itu yang membuat rel tampak "lima dulu, baru semua". */
  const daftarGrid = filterMedia === "populer" ? arsipPopuler : berita;

  return (
    // Satu layar terkunci di semua ukuran: di panggung tiga kolom, di aliran
    // (ponsel/tablet) peta penuh dengan laci di atasnya — halaman tak menggulir.
    <div className="flex h-[100svh] flex-col overflow-hidden bg-pantau-malam pt-16 text-pantau-tulang">
      {/* Grid selalu tiga lajur; rel yang dilipat lajurnya menyusut ke 0.
          Lebarnya lewat variabel supaya grid-template-columns bisa
          dianimasikan (jumlah lajur tetap sama, px ke px). Lajur rel yang
          terbuka ikut memuat sela 8px ke kolom tengah, jadi sela di tepi
          layar, di bawah nav, dan di antara kolom sama di semua lebar layar —
          tanpa batas lebar maksimum yang menyisakan pita hitam. */}
      <div
        style={{
          /* KETIGANYA WAJIB bertipe sama — minmax(0, <panjang>) — di setiap
             keadaan. grid-template-columns hanya bisa dianimasikan kalau
             daftar treknya cocok tipe, dan begitu SATU trek tak cocok seluruh
             daftar berhenti diinterpolasi. Versi sebelumnya mencampur
             minmax(0,1fr) dengan 0px, jadi lajurnya melompat seketika: ada
             transisi 500ms yang terdaftar, tapi tak pernah menggigit.
             Karena itu tidak ada satu pun fr di sini; lajur yang dulu 1fr
             dinyatakan sebagai sisa ruang yang eksplisit supaya tetap 100%. */
          "--kolom-kiri": kiriBuka
            ? "minmax(0,calc(var(--rel-kiri) + 0.5rem))"
            : "minmax(0,0px)",
          // Saat tengah dilipat rel kanan melebar penuh sampai batas rel kiri;
          // saat tengah terbuka ia kembali selebar rel tetap. Kolom tengahnya
          // sendiri menyusut ke 0 — tombol buka kembali menempel di tepi kiri
          // rel kanan (lihat bawah).
          "--kolom-kanan": !kananBuka
            ? "minmax(0,0px)"
            : tengahBuka
              ? "minmax(0,calc(var(--rel-kanan) + 0.5rem))"
              : "minmax(0,calc(100% - var(--kolom-lebar-kiri)))",
          // Lebar kiri sebagai panjang telanjang: dipakai aritmetika di atas,
          // yang tak bisa membaca var berisi minmax().
          "--kolom-lebar-kiri": kiriBuka ? "calc(var(--rel-kiri) + 0.5rem)" : "0px",
          "--kolom-lebar-kanan": !kananBuka
            ? "0px"
            : tengahBuka
              ? "calc(var(--rel-kanan) + 0.5rem)"
              : "calc(100% - var(--kolom-lebar-kiri))",
          "--kolom-tengah": tengahBuka
            ? "minmax(0,calc(100% - var(--kolom-lebar-kiri) - var(--kolom-lebar-kanan)))"
            : "minmax(0,0px)",
        } as React.CSSProperties}
        className="relative flex min-h-0 w-full flex-1 flex-col panggung:p-2
                   [--rel-kiri:clamp(248px,16.67vw,320px)] [--rel-kanan:clamp(272px,18.75vw,360px)]
                   panggung:grid panggung:min-h-0 panggung:grid-cols-[var(--kolom-kiri)_var(--kolom-tengah)_var(--kolom-kanan)]
                   panggung:transition-[grid-template-columns] panggung:duration-500 panggung:ease-[cubic-bezier(0.22,1,0.36,1)]
                   motion-reduce:transition-none"
      >
        {/* ── Rel kiri: cari + provinsi + peringkat ─────────────────── */}
        {/* Pembungkus memotong rel selebar lajurnya; rel di dalamnya tetap
            selebar penuh dan menempel ke tepi peta, jadi saat dilipat ia
            tampak bergeser masuk ke bawah bingkai, bukan teksnya terlipat. */}
        {/* Di aliran kedua rel tersembunyi — isinya pindah ke LaciPeta. */}
        {/* col-start eksplisit: saat kolom tengah display:none (dilipat),
            penempatan otomatis akan menggeser rel kanan ke lajur tengah yang
            0px — dengan ini ia tetap di lajur kanan yang melebar. */}
        <div className="min-h-0 aliran:hidden panggung:col-start-1 panggung:row-start-1 panggung:flex panggung:justify-end panggung:overflow-hidden">
        <aside
          id="rel-kiri-pantau"
          data-lenis-prevent
          aria-label={teks.provinsi}
          inert={!kiriBuka}
          className={`pantau-rel min-h-0 border-white/10 bg-pantau-konsol px-3 py-3.5
                     aliran:rounded-2xl aliran:ring-1 aliran:ring-white/10
                     panggung:mr-2 panggung:h-full panggung:w-[var(--rel-kiri)] panggung:shrink-0 panggung:rounded-xl
                     panggung:overflow-y-auto panggung:overscroll-contain
                     transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none [contain:layout_paint] ${kiriBuka ? "opacity-100" : "opacity-0"}`}
        >
          <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
            <label htmlFor="cari-pantau" className="sr-only">
              {teks.cari}
            </label>
            <svg
              viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round"
              className="pointer-events-none absolute top-1/2 left-3 size-[17px] -translate-y-1/2 text-white"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" />
            </svg>
            <input
              id="cari-pantau" type="search" value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder={teks.cari} autoComplete="off"
              className="w-full rounded-lg bg-[#141414] py-2 pr-3 pl-10 text-sm text-pantau-tulang outline-none
                         placeholder:text-white/20 focus-visible:ring-2 focus-visible:ring-white/40
                         [&::-webkit-search-cancel-button]:hidden"
            />
          </form>

          {/* Daftar navigasi polos: teks biasa, garis tipis pemisah
              kelompok. Garisnya berhenti sebelum tepi kanan rel (pr-6). */}
          <div className="mt-4 pr-6">
            <button
              type="button"
              onClick={() => {
                setCari("");
                setFilterMedia("terbaru");
                setKananBuka(true);
                document.getElementById("rel-kanan-pantau")?.scrollTo({ top: 0 });
              }}
              aria-pressed={filterMedia === "terbaru"}
              className="block w-full rounded-md px-3 pb-1.5 text-left text-base leading-snug font-semibold text-white
                         transition-colors hover:text-pantau-tulang focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
            >
              {teks.terbaru}
            </button>

            {kelompokWilayah("pantau")}
          </div>
        </aside>
        </div>

        {/* ── Tengah: judul di atas, peta berbingkai di bawahnya ───────
            Di aliran kolom ini naik paling atas: peta adalah pekerjaannya.
            panggung:z-10 — TabRel mengangkangi garis tepi bingkai 18px ke
            arah rel, tapi relnya `[contain:layout_paint]` (stacking context
            sendiri yang terlukis sesudah section) sehingga separuh tab yang
            menumpang rel tertutup. Section diangkat agar tab tampil utuh;
            grid tak pernah tumpang tindih jadi tak ada yang ikut berubah.
            Karena itu section TIDAK boleh overflow-hidden saat terbuka —
            itu memotong tab tepat di garis bingkai.
            Saat dilipat section display:none di panggung (bukan kolom 0px):
            grid hanya berisi rel kiri + rel kanan penuh, sehingga membuka =
            section muncul kembali + rel kanan menyempit (keduanya px ke px —
            mulus, tanpa snap kolom 0px ↔ penuh dan tanpa kanvas MapLibre
            yang resize ke 0 lalu balik — sumber glitch buka). Di aliran
            section selalu tampil (peta = pekerjaannya). */}
        {/* Aliran: section mengisi layar di bawah nav. --sela-bawah = tinggi
            laci saat mengintip (TINGGI_INTIP) — PetaAsap/Peta memakainya untuk
            menaikkan bilah waktu, legenda, logo, dan kamera awal di atas laci.

            Panggung, saat dilipat: section TIDAK di-hidden dan kolomnya TETAP
            selebar penuh — rel kanan yang overlap di atasnya (col-start-2,
            z-20) sambil petanya memudar ke opacity 0. Membuka = rel kanan
            menyempit kembali (px ke px — mulus) sambil peta memudar masuk:
            tanpa snap kolom 0px ↔ penuh dan tanpa kanvas MapLibre yang
            resize ke 0 lalu balik (sumber glitch buka). pointer-events +
            overflow-hidden HANYA saat dilipat supaya isi tak terlihat tak
            bisa diklik / meluber. */}
        <section id="peta" aria-label={teks.judulHalaman} inert={!tengahBuka}
          className={`relative flex min-h-0 flex-col aliran:flex-1 aliran:[--sela-bawah:272px]
                      panggung:z-10 panggung:col-start-2 panggung:row-start-1 panggung:py-6
                      transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none
                      ${tengahBuka
                        ? "panggung:opacity-100"
                        : "panggung:pointer-events-none panggung:overflow-hidden panggung:opacity-0"}`}>
          {/* Pola titik bara di dua pojok berseberangan — tekstur, bukan
              isi, jadi hanya di layar panggung yang lega. */}
          <div aria-hidden="true" className="pantau-titik pantau-titik--kanan hidden panggung:block" />
          <div aria-hidden="true" className="pantau-titik pantau-titik--kiri hidden panggung:block" />
          {/* Tombol X kedua — di atas pola titik kanan, pojok kanan atas
              section (di LUAR bingkai peta). Penutup yang sama dengan pil di
              bingkai (setTengahBuka(false)), hanya bentuknya X melayang. */}
          {tengahBuka && (
            <button
              type="button"
              onClick={() => setTengahBuka(false)}
              aria-expanded={tengahBuka}
              aria-controls="peta"
              title={teks.tutupPeta}
              aria-label={teks.tutupPeta}
              className={`absolute top-1 right-2 z-[43] hidden size-9 items-center justify-center rounded-full
                         text-white ring-1 backdrop-blur-sm ${aksenTombolPeta}
                         transition hover:scale-105 active:scale-95
                         focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none
                         panggung:inline-flex`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4"
                   strokeLinecap="round" className="size-4">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}

          {/*<h2 className="relative px-2 pt-4 pb-3 text-[28px] leading-[1.05] font-bold tracking-[-0.02em] text-white panggung:pt-0
                         panggung:px-3.5 panggung:text-[clamp(24px,1.8vw,36px)]">
            {teks.judulHalaman}
          </h2>*/}

          {/* Ruang sisa antara judul dan kaki. Di panggung ia jadi container
              ukuran, sehingga lebar bingkai = min(lebar ruang, tinggi ruang ×
              rasio) — rasio desain 1080×544 terjaga dan bingkai tak pernah
              meluap di layar pendek. */}
          <div className="relative min-h-0 aliran:h-full panggung:flex panggung:flex-1 panggung:items-center panggung:justify-center panggung:[container-type:size]">
          <div className="relative w-full aliran:h-full panggung:w-[min(100cqw,calc(100cqh*1080/544))]">
          {/* isolate: hamparan peta (pil lapisan, zoom, bilah waktu — z-400..500)
              tertahan di dalam bingkai, sehingga LaciPeta (z-30, saudara
              bingkai ini) selalu menutupinya saat ditarik ke atas. */}
          <div className="relative isolate h-full overflow-hidden panggung:aspect-[1080/544] panggung:h-auto panggung:rounded-2xl">
            <Peta
              jumlahLaporan={jumlahLaporan}
              onPilihWilayah={(nama, pulau, asal) => setWilayah({ nama, pulau, asal })}
              mode={modePeta}
              onModeChange={setModePeta}
              /* Bingkai tengah lebih sempit dari viewport — legenda yang selalu
                 terbuka menindih bilah waktu, jadi ia jadi cip yang dibuka
                 sendiri seperti di ponsel; pil alih mode pun rapat ke atas
                 bingkai, bukan melayang di tengah peta. Kamera awal langsung
                 memuat seluruh Nusantara. */
              legendaRingkas
              tombolRapat
              muatNusantara
              /* Halaman konsol tidak menggulir, jadi roda tetikus bebas
                 dipakai untuk zoom peta seperti peta biasa. */
              zoomRoda
            />
          </div>
          {/* Tab lipat rel kiri/kanan mengapung di garis tepi bingkai —
              pembungkus ini selebar bingkai tapi tidak overflow-hidden, jadi
              separuh tab boleh keluar ke atas rel. Hanya mode panggung: di
              aliran relnya di bawah peta, bukan di samping (lihat TabRel). */}
          <TabRel
              sisi="kiri"
              terbuka={kiriBuka}
              kontrol="rel-kiri-pantau"
              labelTutup={bahasa === "en" ? "Collapse province panel" : "Tutup panel provinsi"}
              labelBuka={bahasa === "en" ? "Open province panel" : "Buka panel provinsi"}
              onUbah={() => setKiriBuka((b) => !b)}
              modePeta={modePeta}
            />
            <TabRel
              sisi="kanan"
              terbuka={kananBuka}
              kontrol="rel-kanan-pantau"
              labelTutup={bahasa === "en" ? "Collapse report panel" : "Tutup panel laporan"}
              labelBuka={bahasa === "en" ? "Open report panel" : "Buka panel laporan"}
              onUbah={() => setKananBuka((b) => !b)}
              modePeta={modePeta}
            />
            {/* Tombol tutup kolom peta — pil berlabel di sudut kanan atas
                bingkai. Panahnya menunjuk ke bawah: petanya yang turun, bukan
                panelnya yang naik. Warnanya ikut lapisan aktif, sepasang
                dengan tombol buka di bekas kolomnya. Hanya panggung.
                Ditahan right-14, bukan right-3: tumpukan zoom peta berdiri di
                sudut yang sama, dan pil yang menempel tepi kanan menimbun
                tombol Perbesar peta sampai tak bisa diklik. */}
            {tengahBuka && (
              <button
                type="button"
                onClick={() => setTengahBuka(false)}
                aria-expanded={tengahBuka}
                aria-controls="peta"
                title={teks.tutupPeta}
                aria-label={teks.tutupPeta}
                className={`group absolute top-3 right-14 z-[42] hidden items-center gap-1.5 rounded-full
                           py-2 pr-4 pl-3 text-[13px] leading-none font-semibold tracking-tight
                           text-white ring-1 backdrop-blur-sm ${aksenTombolPeta}
                           transition hover:scale-[1.03] active:scale-95
                           focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none
                           panggung:inline-flex`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6"
                     strokeLinecap="round" strokeLinejoin="round"
                     className="size-4 transition-transform group-hover:translate-y-0.5">
                  <path d="m6 10 6 6 6-6" />
                </svg>
                {teks.tutupPeta}
              </button>
            )}
          </div>
          </div>

          {/* Kaki kolom tengah — caption panduan data. Tombol lipat kolom
              pindah ke sudut kanan atas section (tombol X kotak ala mockup).
              Hanya panggung; di aliran peta selalu tampil dan footer ini hidden. */}
          <div className="relative mx-auto mt-4 hidden max-w-[78%] items-center justify-center px-3 aliran:hidden panggung:flex">
            <p className="min-w-0 flex-1 text-center text-[12.5px] leading-snug text-pantau-tulang/85">
              {/* Isinya panduan data lapisan yang sedang tampil — sama dengan
                  pop-up Panduan Data di sebelah pil lapisan. */}
              {tentangData}
            </p>
          </div>

          <LaciPeta
            teks={teks}
            cari={cari}
            onCari={setCari}
            laporan={laporanTampil ?? [...terbaru, ...populer]}
            onBuka={bukaRincian}
            asapAktif={asapAktif}
            wilayah={kelompokWilayah("laci", true)}
            tentangData={tentangData}
            aktif={sorot === null && wilayah === null}
          />
        </section>

        {/* ── Rel kanan: laporan terbaru, tanggal–judul–gambar ─────── */}
        {/* Pembuka kembali kolom tengah menempel di tepi kiri rel ini saat
            peta dilipat — rel kanan tetap penuh sampai batas rel kiri. */}
        <div className="relative min-h-0 aliran:hidden panggung:col-start-3 panggung:row-start-1 panggung:flex panggung:justify-start panggung:overflow-visible">
        {/* left-3, bukan left-0 + -translate-x-1/2. Memusatkan tombol di garis
            batas hanya aman selama ada kolom di kirinya; begitu rel kiri ikut
            ditutup, garis itu JADI tepi layar dan separuh tombol jatuh ke luar
            (terukur x = -10). Dijangkarkan ke dalam rel, ia utuh di semua
            kombinasi. */}
        {!tengahBuka && (
          <span className={`absolute top-1/2 z-[41] hidden -translate-y-1/2 panggung:block ${
            kiriBuka ? "left-0 -translate-x-1/2" : "left-3"
          }`}>
            <button
              type="button"
              onClick={() => {
                /* Satu fase saja. Sebelumnya daftar dikembalikan pendek dulu,
                   lalu lajur melebar dua frame sesudahnya, supaya unmount
                   puluhan kartu tidak jatuh satu commit dengan awal transisi
                   grid. Premis itu sudah tidak ada: daftarnya TIDAK pernah
                   dipendekkan lagi (arsip selalu penuh), jadi tak ada unmount
                   massal yang perlu dipisahkan — menunda animasi dua frame
                   cuma menambah jeda. Terukur juga: memecahnya jadi dua commit
                   membuat masonry dihitung ulang dua kali, dan halaman beku
                   490ms alih-alih 130ms. */
                setTengahBuka(true);
              }}
              aria-expanded={tengahBuka}
              aria-controls="peta"
              title={teks.bukaPeta}
              aria-label={teks.bukaPeta}
              className={`group flex size-9 items-center justify-center rounded-xl text-white ring-1 ${aksenTombolPeta}
                         transition hover:scale-105 active:scale-95
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
            >
              {/* Ikon bentang — pasangan tombol X penutup di atas. */}
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4"
                   strokeLinecap="round" className="size-4 transition-transform group-hover:scale-110">
                <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
              </svg>
            </button>
          </span>
        )}
        {/* Saat peta dilipat, TabRel kiri ikut tersembunyi di dalam section
            peta (opacity-0) sehingga sidebar kiri tak bisa ditutup lagi —
            tombol ini menggantikannya: menempel di tepi kiri rel kanan,
            di bawah tombol buka-peta. Ikon X saat terbuka, ikon panel saat
            tertutup (sekaligus pembuka kembali). Hanya panggung.

            translate-y-7, bukan -6: dengan 6 jaraknya cuma 6px dari tombol
            buka-peta dan keduanya terbaca sebagai satu gumpalan. Jangkarnya
            left-3 dengan alasan yang sama seperti tombol di atas.

            Warnanya SENGAJA bukan aksenTombolPeta. Dulu tombol ini kembar
            total dengan tombol buka-peta — ukuran, radius, dan warna tema yang
            sama — sehingga tak ada yang menandai mana yang memulihkan peta dan
            mana yang mengatur sidebar. Buka-peta memulihkan isi utama konsol,
            jadi ia yang memegang warna tema; penutup sidebar adalah perabot,
            jadi ia turun ke permukaan konsol. */}
        {!tengahBuka && (
          <span className={`absolute top-1/2 z-[41] hidden translate-y-7 panggung:block ${
            kiriBuka ? "left-0 -translate-x-1/2" : "left-3"
          }`}>
            <button
              type="button"
              onClick={() => setKiriBuka((b) => !b)}
              aria-expanded={kiriBuka}
              aria-controls="rel-kiri-pantau"
              title={kiriBuka
                ? (bahasa === "en" ? "Close left sidebar" : "Tutup sidebar kiri")
                : (bahasa === "en" ? "Open left sidebar" : "Buka sidebar kiri")}
              aria-label={kiriBuka
                ? (bahasa === "en" ? "Close left sidebar" : "Tutup sidebar kiri")
                : (bahasa === "en" ? "Open left sidebar" : "Buka sidebar kiri")}
              className="group flex size-9 items-center justify-center rounded-xl bg-pantau-konsol/95
                         text-white ring-1 ring-white/20 shadow-[0_6px_18px_rgb(0_0_0/0.5)] backdrop-blur-sm
                         transition hover:scale-105 hover:bg-pantau-konsol hover:ring-white/35 active:scale-95
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {kiriBuka ? (
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4"
                     strokeLinecap="round" className="size-4 transition-transform group-hover:scale-110">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" className="size-4 transition-transform group-hover:scale-110">
                  <rect x="4" y="5" width="16" height="14" rx="2" />
                  <line x1="10" y1="5" x2="10" y2="19" />
                </svg>
              )}
            </button>
          </span>
        )}
        {/* pl-16 saat peta dilipat: selokan untuk tombol buka-peta dan penutup
            sidebar yang mengapung di tepi kiri rel. Tombolnya berhenti 48px
            dari tepi rel, jadi isi mulai di 64px — tanpa ini keduanya
            melayang di atas foto dan judul kartu, dan kartu yang digulir lewat
            di bawahnya. Hanya saat peta dilipat: kalau peta terbuka kedua
            tombol itu tidak dirender, dan selokannya cuma jadi ruang kosong.
            Angka ini dicerminkan di gunakanKolomMasonry — kalau diubah di sini
            saja, perhitungan jumlah kolomnya ikut meleset. */}
        <aside
          id="rel-kanan-pantau"
          data-lenis-prevent
          aria-label={teks.terbaru}
          inert={!kananBuka}
          className={`pantau-rel min-h-0 border-white/10 bg-pantau-konsol p-4 sm:p-5
                     aliran:rounded-2xl aliran:ring-1 aliran:ring-white/10
                     panggung:ml-2 panggung:h-full panggung:shrink-0 panggung:rounded-xl
                     ${tengahBuka
                       ? "panggung:w-[var(--rel-kanan)]"
                       : kiriBuka
                         ? "panggung:w-full panggung:ml-0"
                         : "panggung:w-full panggung:ml-0 panggung:pl-16"}
                     panggung:overflow-y-auto panggung:overscroll-contain panggung:py-5
                     transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none [contain:layout_paint] ${kananBuka ? "opacity-100" : "opacity-0"}`}
        >
          {/* Toolbar: filter terbaru/terpopuler + toggle tampilan */}
          <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-white/10">
            {/* Filter Terbaru / Terpopuler — icon buttons */}
            <div className="flex items-center gap-1 rounded-lg bg-pantau-sumur p-1 ring-1 ring-white/10">
              {/* Terbaru */}
              <button
                type="button"
                onClick={() => setFilterMedia(filterMedia === "terbaru" ? "semua" : "terbaru")}
                title={bahasa === "en" ? "Filter: Latest reports" : "Filter: Laporan terbaru"}
                aria-label={bahasa === "en" ? "Filter: Latest reports" : "Filter: Laporan terbaru"}
                aria-pressed={filterMedia === "terbaru" || filterMedia === "semua"}
                className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
                  filterMedia === "terbaru" || filterMedia === "semua"
                    ? aksenFilter
                    : "text-pantau-abu hover:text-pantau-tulang hover:bg-white/10"
                }`}
              >
                {/* Ikon jam */}
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {/* Terpopuler */}
              <button
                type="button"
                onClick={() => setFilterMedia(filterMedia === "populer" ? "semua" : "populer")}
                title={bahasa === "en" ? "Filter: Popular reports" : "Filter: Laporan terpopuler"}
                aria-label={bahasa === "en" ? "Filter: Popular reports" : "Filter: Laporan terpopuler"}
                aria-pressed={filterMedia === "populer"}
                className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
                  filterMedia === "populer"
                    ? aksenFilter
                    : "text-pantau-abu hover:text-pantau-tulang hover:bg-white/10"
                }`}
              >
                {/* Ikon api/populer */}
                <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" aria-hidden="true">
                  <path d="M8 1.5c-.3 0-.6.2-.7.5l-.9 2.8-2.9-.3c-.3 0-.6.1-.7.4-.1.3 0 .6.2.8l2.2 1.9-1.4 2.5c-.2.3-.1.6.1.8.2.2.5.2.8.1L8 9.2l3.3 1.8c.3.2.6.1.8-.1.2-.2.3-.5.1-.8l-1.4-2.5 2.2-1.9c.2-.2.3-.5.2-.8-.1-.3-.4-.5-.7-.4l-2.9.3-.9-2.8c-.1-.3-.4-.5-.7-.5z" />
                </svg>
              </button>
            </div>

            {/* Toggle kartu / daftar */}
            <div className="flex items-center gap-1 rounded-lg bg-pantau-sumur p-1 ring-1 ring-white/10">
              {/* Mode kartu */}
              <button
                type="button"
                onClick={() => setModeRel("kartu")}
                title={bahasa === "en" ? "Card view" : "Tampilan kartu"}
                aria-label={bahasa === "en" ? "Card view" : "Tampilan kartu"}
                aria-pressed={modeRel === "kartu"}
                className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
                  modeRel === "kartu"
                    ? "bg-white/15 text-pantau-tulang"
                    : "text-pantau-abu hover:text-pantau-tulang hover:bg-white/10"
                }`}
              >
                {/* Ikon kartu besar */}
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" aria-hidden="true">
                  <rect x="1" y="1" width="14" height="6" rx="1.2" />
                  <rect x="1" y="9" width="14" height="6" rx="1.2" />
                </svg>
              </button>
              {/* Mode daftar */}
              <button
                type="button"
                onClick={() => setModeRel("daftar")}
                title={bahasa === "en" ? "List view" : "Tampilan daftar"}
                aria-label={bahasa === "en" ? "List view" : "Tampilan daftar"}
                aria-pressed={modeRel === "daftar"}
                className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
                  modeRel === "daftar"
                    ? "bg-white/15 text-pantau-tulang"
                    : "text-pantau-abu hover:text-pantau-tulang hover:bg-white/10"
                }`}
              >
                {/* Ikon daftar */}
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" aria-hidden="true">
                  <line x1="1" y1="3" x2="15" y2="3" strokeLinecap="round" />
                  <line x1="1" y1="8" x2="15" y2="8" strokeLinecap="round" />
                  <line x1="1" y1="13" x2="15" y2="13" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <h2 className="sr-only">{teks.terbaru}</h2>
          {laporanTampil !== null ? (
            laporanTampil.length > 0 ? (
              kartuGrid ? (
                <MasonryKolom daftar={laporanTampil} kolom={jumlahKolom} item={itemRel} />
              ) : (
                <ul className={kelasUlRel}>
                  {laporanTampil.map(itemRel)}
                </ul>
              )
            ) : (
              <p className="mt-3 rounded-xl bg-pantau-sumur px-3.5 py-4 text-[13px] leading-relaxed text-pantau-abu ring-1 ring-white/10">
                {teks.tidakCocok} {teks.cobaLain}
              </p>
            )
          ) : laporanTerbaru.length + laporanPopuler.length > 0 ? (
            kartuGrid ? (
              /* Model galeri: satu aliran masonry terbaru saja (bukan campur
                 terpopuler) supaya tidak "muncul semua". */
              daftarGrid.length > 0 ? (
                <MasonryKolom
                  daftar={daftarGrid}
                  kolom={jumlahKolom}
                  item={itemRel}
                  label={filterMedia === "populer" ? teks.populer : teks.terbaru}
                />
              ) : (
                <p className="mt-3 rounded-xl bg-pantau-sumur px-3.5 py-4 text-[13px] leading-relaxed text-pantau-abu ring-1 ring-white/10">
                  {teks.relKosong}
                </p>
              )
            ) : (
            <>
              {laporanTerbaru.length > 0 && (
                <section aria-label={teks.terbaru}>
                  {/*<h3 className="mt-4 font-mono text-[11px] font-semibold tracking-[0.18em] text-pantau-abu uppercase">
                    {teks.terbaru}
                  </h3>*/}
                  <ul className={kelasUlRel}>
                    {laporanTerbaru.map(itemRel)}
                  </ul>
                </section>
              )}
              {laporanPopuler.length > 0 && (
                <section aria-label={teks.populer} className="">
                  {/*<h3 className="font-mono text-[11px] font-semibold tracking-[0.18em] text-pantau-abu uppercase">
                    {teks.populer}
                  </h3>*/}
                  <ul className={kelasUlRel}>
                    {laporanPopuler.map(itemRel)}
                  </ul>
                </section>
              )}
            </>
            )
          ) : (
            <p className="mt-3 rounded-xl bg-pantau-sumur px-3.5 py-4 text-[13px] leading-relaxed text-pantau-abu ring-1 ring-white/10">
              {teks.relKosong}
            </p>
          )}
        </aside>
        </div>
      </div>

      {sorot !== null && (
        <RincianLaporan berita={sorot} bahasa={bahasa} onTutup={tutupRincian} gelap />
      )}

      {wilayah && (
        <PopupPeta
          nama={wilayah.nama}
          pulau={wilayah.pulau}
          jumlah={jumlahLaporan[wilayah.nama] ?? null}
          asal={wilayah.asal}
          berita={berita}
          jumlahLaporan={jumlahLaporan}
          onBukaRincian={(i) => {
            const ketemu = berita[i];
            if (ketemu) bukaRincian(ketemu);
          }}
          onTutup={() => setWilayah(null)}
          gelap
        />
      )}
    </div>
  );
}

/** Daftar provinsi dan kabupaten dengan judul kelompok yang bisa dilipat.
 *  Judul tebal & putih penuh; nama di bawahnya lebih kecil dan redup — dua
 *  tingkat yang terbaca sekilas. Kabupaten tak punya pop-up sendiri —
 *  menekannya membuka pop-up laporan provinsinya. */
function KelompokWilayah({
  teks, kunci, daftarProvinsi, daftarKabupaten, adaKabupaten,
  provinsiBuka, onAlihProvinsi, kabupatenBuka, onAlihKabupaten, onPilih, idAwalan, lega,
}: {
  teks: (typeof TEKS_PETA)[Bahasa];
  kunci: string;
  daftarProvinsi: string[];
  daftarKabupaten: KabupatenTerluas[];
  adaKabupaten: boolean;
  provinsiBuka: boolean;
  onAlihProvinsi: () => void;
  kabupatenBuka: boolean;
  onAlihKabupaten: () => void;
  onPilih: (nama: string, e: React.MouseEvent<HTMLElement>) => void;
  idAwalan: string;
  lega: boolean;
}) {
  // Rel kiri: daftar bergulir sendiri setinggi 300px. Laci: laci sudah
  // bergulir, jadi daftar dibiarkan memanjang (tanpa gulir bersarang).
  const kelasDaftar = lega ? "pb-3" : "pantau-rel max-h-[300px] overflow-y-auto overscroll-contain pb-3";
  const kelasItem = `block w-full truncate rounded-md pr-2 pl-[18px] text-left leading-snug text-white/70
                     transition-colors hover:bg-white/[0.06] hover:text-white
                     focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none
                     ${lega ? "py-2 text-[15px]" : "py-[3px] text-[13.5px]"}`;
  const kelasJudul = "flex w-full items-center justify-between gap-2 rounded-md px-3 pb-1 text-left text-base leading-snug font-semibold text-white transition-colors hover:text-pantau-tulang focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none";
  const panah = (buka: boolean) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round"
         className={`size-3.5 shrink-0 text-white/50 transition-transform ${buka ? "" : "-rotate-90"}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
  const kosong = (
    <p className="px-[18px] pb-3 text-[13px] leading-relaxed text-pantau-abu">
      {teks.tidakCocok} {teks.cobaLain}
    </p>
  );
  const provinsiTampil = provinsiBuka || Boolean(kunci);
  const kabupatenTampil = kabupatenBuka || Boolean(kunci);

  return (
    <>
      <div className="relative pt-2 before:absolute before:top-0 before:right-0 before:left-3 before:border-t before:border-white/15">
        <h2>
          <button type="button" onClick={onAlihProvinsi} aria-expanded={provinsiTampil}
                  aria-controls={`daftar-provinsi-${idAwalan}`} className={kelasJudul}>
            {teks.provinsi}
            {panah(provinsiTampil)}
          </button>
        </h2>
        {provinsiTampil && (daftarProvinsi.length > 0 ? (
          <ul id={`daftar-provinsi-${idAwalan}`} className={kelasDaftar}>
            {daftarProvinsi.map((nama) => (
              <li key={nama}>
                <button type="button" onClick={(e) => onPilih(nama, e)} className={kelasItem}>
                  {nama}
                </button>
              </li>
            ))}
          </ul>
        ) : kosong)}
      </div>

      {/* Kabupaten dari layer GeoServer (luas kebakaran), terluas dulu. */}
      {adaKabupaten && (
        <div className="relative pt-2 before:absolute before:top-0 before:right-0 before:left-3 before:border-t before:border-white/15">
          <h2>
            <button type="button" onClick={onAlihKabupaten} aria-expanded={kabupatenTampil}
                    aria-controls={`daftar-kabupaten-${idAwalan}`} className={kelasJudul}>
              {teks.kabupaten}
              {panah(kabupatenTampil)}
            </button>
          </h2>
          {kabupatenTampil && (daftarKabupaten.length > 0 ? (
            <ul id={`daftar-kabupaten-${idAwalan}`} className={kelasDaftar}>
              {daftarKabupaten.map((k) => {
                const provinsi = namaProvinsiLokal(k.provinsi);
                return (
                  <li key={`${k.provinsi}-${k.nama}`}>
                    <button type="button" onClick={(e) => onPilih(provinsi, e)}
                            aria-label={`${k.nama}, ${provinsi}`} title={provinsi} className={kelasItem}>
                      {k.nama}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : kosong)}
        </div>
      )}
    </>
  );
}

/** Posisi laci konsol di layar sempit. */
type PosisiLaci = "intip" | "setengah" | "penuh";

/** Tinggi laci saat mengintip (px): pegangan, kotak cari, dan deret kartu.
 *  Harus sama dengan `aliran:[--sela-bawah:272px]` di section peta — angka
 *  itu yang menaikkan bilah waktu, legenda, dan kamera awal di atas laci. */
const TINGGI_INTIP = 272;

/** Letak laci per posisi. Persen translate mengacu tinggi laci sendiri. */
function geserLaci(p: PosisiLaci) {
  if (p === "penuh") return "translateY(0px)";
  if (p === "setengah") return "translateY(45%)";
  return `translateY(calc(100% - ${TINGGI_INTIP}px))`;
}

/**
 * Laci konsol di ponsel/tablet (aliran): menumpang di atas peta layar penuh.
 *
 * Mengintip — pegangan, kotak cari, dan deret kartu laporan yang digeser ke
 * samping. Ditarik ke atas (atau pegangannya ditekan) ia berhenti di setengah
 * atau penuh, berisi tab Laporan dan Wilayah yang bergulir. Tarikan mengikuti
 * jari lalu mendarat di posisi terdekat dengan memperhitungkan laju lepas;
 * Escape dan menekan pegangan menurunkannya kembali.
 */
function LaciPeta({ teks, cari, onCari, laporan, onBuka, asapAktif, wilayah, tentangData, aktif }: {
  teks: (typeof TEKS_PETA)[Bahasa];
  cari: string;
  onCari: (nilai: string) => void;
  laporan: Berita[];
  onBuka: (b: Berita) => void;
  asapAktif: boolean;
  wilayah: React.ReactNode;
  tentangData: React.ReactNode;
  /** false saat pop-up lain terbuka — Escape milik pop-up itu. */
  aktif: boolean;
}) {
  const [posisi, setPosisi] = useState<PosisiLaci>("intip");
  const [tab, setTab] = useState<"laporan" | "wilayah">("laporan");
  const laciRef = useRef<HTMLDivElement | null>(null);
  // Tarikan yang baru selesai tak boleh ikut dihitung sebagai ketukan pegangan.
  const baruDiseret = useRef(false);

  const pindah = useCallback((p: PosisiLaci) => {
    const el = laciRef.current;
    // Tarikan menulis transform langsung ke DOM; kembalikan ke nilai posisi
    // secara eksplisit karena React tak menulis ulang style yang tak berubah.
    if (el) {
      el.style.transition = "";
      el.style.transform = geserLaci(p);
    }
    setPosisi(p);
  }, []);

  useEffect(() => {
    if (!aktif || posisi === "intip") return;
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") pindah("intip");
    };
    window.addEventListener("keydown", saatTombol);
    return () => window.removeEventListener("keydown", saatTombol);
  }, [aktif, posisi, pindah]);

  const batasGeser = (nilai: number, tinggi: number) => Math.min(Math.max(nilai, 0), tinggi - TINGGI_INTIP);

  /* Tarikan dimulai di kepala laci, tapi jari segera keluar dari kepala —
     gerak dan lepas didengar di window sampai jari diangkat. */
  const mulaiSeret = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input")) return;
    const el = laciRef.current;
    if (!el) return;
    const s = {
      y0: e.clientY,
      geser0: new DOMMatrixReadOnly(getComputedStyle(el).transform).m42,
      t0: performance.now(),
      tinggi: el.offsetHeight,
      bergerak: false,
    };

    const saatGerak = (ev: PointerEvent) => {
      const dy = ev.clientY - s.y0;
      if (!s.bergerak) {
        // Ambang 6px: ketukan pada pegangan tetap jadi klik, bukan tarikan.
        if (Math.abs(dy) < 6) return;
        s.bergerak = true;
        el.style.transition = "none";
      }
      ev.preventDefault();
      el.style.transform = `translateY(${batasGeser(s.geser0 + dy, s.tinggi)}px)`;
    };

    const saatLepas = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", saatGerak);
      window.removeEventListener("pointerup", saatLepas);
      window.removeEventListener("pointercancel", saatLepas);
      if (!s.bergerak) return;
      // Klik yang mungkin menyusul lepas ini diabaikan, lalu penanda direset
      // setelah klik itu sempat lewat.
      baruDiseret.current = true;
      setTimeout(() => {
        baruDiseret.current = false;
      }, 0);
      const dy = ev.clientY - s.y0;
      const geser = batasGeser(s.geser0 + dy, s.tinggi);
      // Laju lepas (px/ms) diproyeksikan 200ms ke depan: kibasan cepat
      // melompati posisi terdekat, tarikan pelan mendarat di yang terdekat.
      const laju = dy / Math.max(1, performance.now() - s.t0);
      const ramalan = geser + laju * 200;
      const titik: [PosisiLaci, number][] = [
        ["penuh", 0],
        ["setengah", s.tinggi * 0.45],
        ["intip", s.tinggi - TINGGI_INTIP],
      ];
      const tujuan = titik.reduce((a, b) => (Math.abs(b[1] - ramalan) < Math.abs(a[1] - ramalan) ? b : a))[0];
      pindah(tujuan);
    };

    window.addEventListener("pointermove", saatGerak, { passive: false });
    window.addEventListener("pointerup", saatLepas);
    window.addEventListener("pointercancel", saatLepas);
  };

  const terbuka = posisi !== "intip";
  const garisAksen = asapAktif ? "bg-[#86198f]" : "bg-emerald-500";
  const pesanKosong = (
    <p className="px-4 pb-4 text-[13px] leading-relaxed text-pantau-abu">
      {cari.trim() ? `${teks.tidakCocok} ${teks.cobaLain}` : teks.relKosong}
    </p>
  );

  return (
    <div
      ref={laciRef}
      role="region"
      aria-label={teks.laciLabel}
      data-lenis-prevent
      style={{ transform: geserLaci(posisi) }}
      className="absolute inset-x-0 top-2 bottom-0 z-[30] flex flex-col rounded-t-2xl bg-pantau-konsol
                 shadow-[0_-12px_32px_rgb(0_0_0/0.55)] ring-1 ring-white/10
                 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none
                 sm:mx-auto sm:max-w-xl panggung:hidden"
    >
      {/* Kepala laci — area tarik (pegangan + kotak cari + tab). */}
      <div
        onPointerDown={mulaiSeret}
        className="shrink-0 touch-none px-4 pt-1.5 pb-3"
      >
        <button
          type="button"
          onClick={() => {
            if (baruDiseret.current) {
              baruDiseret.current = false;
              return;
            }
            pindah(terbuka ? "intip" : "setengah");
          }}
          aria-expanded={terbuka}
          aria-label={terbuka ? teks.laciTutup : teks.laciBuka}
          className="mx-auto flex h-5 w-20 items-center justify-center rounded-full
                     focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
        >
          <span aria-hidden="true" className="block h-1 w-10 rounded-full bg-white/30" />
        </button>

        <form role="search" onSubmit={(e) => e.preventDefault()} className="relative mt-1.5">
          <label htmlFor="cari-laci" className="sr-only">
            {teks.cari}
          </label>
          <svg
            viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round"
            className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-white"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>
          {/* text-base (16px): di bawah itu Safari iOS memperbesar layar
              saat kotak disentuh. */}
          <input
            id="cari-laci" type="search" value={cari} enterKeyHint="search"
            onChange={(e) => onCari(e.target.value)}
            onFocus={() => pindah("penuh")}
            placeholder={teks.cari} autoComplete="off"
            className="w-full rounded-lg bg-[#141414] py-2.5 pr-3 pl-10 text-base text-pantau-tulang outline-none
                       placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-white/40
                       [&::-webkit-search-cancel-button]:hidden"
          />
        </form>

        {terbuka && (
          <div role="tablist" aria-label={teks.laciLabel} className="mt-3 grid grid-cols-2">
            {(["laporan", "wilayah"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`relative rounded-md pb-2.5 text-[15px] font-semibold transition-colors
                            focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none
                            ${tab === t ? "text-white" : "text-white/45"}`}
              >
                {t === "laporan" ? teks.laciLaporan : teks.laciWilayah}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-6 bottom-0 h-0.5 rounded-full ${tab === t ? garisAksen : "bg-white/10"}`}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {!terbuka ? (
        laporan.length > 0 ? (
          <ul
            aria-label={teks.terbaru}
            className="flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4
                       [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {laporan.map((b) => (
              // Dua kartu pas selebar laci. Sela antarkartu (16px) sama dengan
              // jarak tepi, sehingga kartu ketiga mulai tepat di tepi layar —
              // tak ada irisan tipis yang membuat sisi kanan tampak rapat.
              <li key={b.id} className="w-[calc((100%-1rem)/2)] shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => onBuka(b)}
                  aria-label={`${b.judul} — ${teks.bukaRincian}`}
                  className="group block w-full rounded-lg text-left focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                >
                  {/* Tinggi gambar tetap (bukan rasio) dan judul selalu memesan
                      dua baris — tinggi deret kartu sama di semua lebar layar,
                      jadi TINGGI_INTIP bisa satu angka tanpa memotong judul. */}
                  <span className="relative block h-[104px] overflow-hidden rounded-lg">
                    {/* Sama dengan kartu rel kanan: video diputar otomatis (bisu,
                        berulang) selama kartunya terlihat, dijeda saat digeser
                        keluar; foto memakai media pertamanya. */}
                    {b.media[0]?.jenis === "video" ? (
                      <VideoKeping
                        key={b.media[0].url}
                        url={b.media[0].url}
                        poster={b.media[0].poster ?? b.poster}
                        label={b.judul}
                      />
                    ) : (
                      <Keping berita={b} src={b.media[0]?.url} />
                    )}
                  </span>
                  <span className="mt-1.5 block text-[11px] text-white/55">{b.tanggal}</span>
                  <span className="mt-0.5 line-clamp-2 min-h-[2.75em] text-[13px] leading-snug font-semibold text-white">{b.judul}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          pesanKosong
        )
      ) : (
        <div
          className="pantau-rel min-h-0 flex-1 overflow-y-auto overscroll-contain px-2"
          // Di posisi setengah 45% laci berada di bawah layar — ganjal bawah
          // sebesar itu supaya baris terakhir tetap bisa digulir ke pandangan.
          style={{
            paddingBottom: posisi === "setengah"
              ? "calc(0.45 * (100svh - 4.5rem) + 1rem)"
              : "calc(1rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {tab === "laporan" ? (
            laporan.length > 0 ? (
              <ul className="divide-y divide-white/10 px-2">
                {laporan.map((b) => (
                  <li key={b.id} className="py-1.5">
                    <ItemListLaporan b={b} bukaLabel={teks.bukaRincian} onBuka={() => onBuka(b)} />
                  </li>
                ))}
              </ul>
            ) : (
              pesanKosong
            )
          ) : (
            <div className="pr-4">
              {wilayah}
              <p className="mt-4 border-t border-white/10 px-3 pt-4 text-[12.5px] leading-relaxed text-white/55">
                {tentangData}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Tab gagang di tepi bingkai peta untuk melipat/membuka satu rel. Panah
 *  menunjuk arah gerak relnya: ke tepi saat terbuka (klik = lipat), ke tengah
 *  saat terlipat (klik = buka). Warna mengikuti tema peta: ungu untuk asap,
 *  hijau untuk windy. */
function TabRel({ sisi, terbuka, kontrol, labelTutup, labelBuka, onUbah, modePeta }: {
  sisi: "kiri" | "kanan";
  terbuka: boolean;
  kontrol: string;
  labelTutup: string;
  labelBuka: string;
  onUbah: () => void;
  modePeta: ModePeta;
}) {
  const label = terbuka ? labelTutup : labelBuka;
  // kiri terbuka → ‹ (lipat ke kiri); kiri tertutup → › (buka ke tengah).
  const keKiri = sisi === "kiri" ? terbuka : !terbuka;

  // Warna tema: ungu #49006a untuk asap, hijau emerald untuk windy — cahaya
  // bayangannya ikut warna supaya tombol terasa melayang, bukan menempel.
  const warnaAktif = modePeta === "asap"
    ? "bg-[#49006a] ring-[#86198f]/60 shadow-[0_6px_20px_rgb(73_0_106/0.65)] hover:ring-[#d946ef]/70 hover:shadow-[0_10px_28px_rgb(134_25_143/0.8)]"
    : "bg-emerald-700 ring-emerald-400/50 shadow-[0_6px_20px_rgb(4_120_87/0.6)] hover:ring-emerald-300/70 hover:shadow-[0_10px_28px_rgb(16_185_129/0.7)]";

  return (
    /* Pembungkus memegang posisi (tepat di garis bingkai); tombol di dalamnya
       bebas beranimasi apung lewat transform tanpa menimpa translate posisi. */
    /* Terbuka: berpusat di garis antara rel dan peta. Terlipat: garis itu
       menempel tepi layar, jadi tombol bergeser masuk utuh ke dalam bingkai
       supaya tak terpotong. */
    <span
      className={`absolute top-1/2 z-[41] hidden -translate-y-1/2 transition-[translate] duration-500
                  ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none panggung:block ${
        sisi === "kiri"
          ? terbuka ? "left-0 -translate-x-1/2" : "left-0 translate-x-3"
          : terbuka ? "right-0 translate-x-1/2" : "right-0 -translate-x-3"
      }`}
    >
      <button
        type="button"
        onClick={onUbah}
        aria-expanded={terbuka}
        aria-controls={kontrol}
        aria-label={label}
        title={label}
        className={`group flex size-9 items-center justify-center rounded-full text-white ring-1 ring-inset
                    transition-[scale,box-shadow,background-color] duration-300 ease-out
                    hover:scale-110 active:scale-90
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white
                    motion-safe:animate-[tab-rel-apung_3.2s_ease-in-out_infinite] hover:[animation-play-state:paused]
                    ${warnaAktif}`}
      >
        {/* Satu panah yang berputar 180° — arah berganti dengan gerak,
            bukan lompatan bentuk. Saat hover ia menyenggol ke arah rel akan
            bergerak. */}
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5"
             strokeLinecap="round" strokeLinejoin="round"
             className={`size-4 transition-[rotate,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
               keKiri ? "rotate-0 group-hover:-translate-x-0.5" : "rotate-180 group-hover:translate-x-0.5"
             }`}>
          <path d="m14 6-6 6 6 6" />
        </svg>
      </button>
    </span>
  );
}

/**
 * Masonry berkolom tetap: kartu dibagi bergiliran (0,1,2,0,1,2…) ke sejumlah
 * daftar terpisah, lalu daftar-daftar itu dijajar.
 *
 * Sengaja TIDAK memakai CSS `columns`. Di sana peramban yang memutuskan isi
 * tiap kolom, dan keputusannya dihitung ulang tiap kali tinggi isi berubah —
 * sehingga gambar yang baru termuat melempar kartu ke kolom lain. Di sini
 * penempatan ditentukan indeks, jadi kekal: gambar yang telat hanya mendorong
 * kartu di bawahnya dalam kolom yang sama.
 *
 * Konsekuensi yang diterima: kolomnya tidak diseimbangkan menurut tinggi
 * (mustahil tanpa tahu tinggi gambar sebelum termuat), jadi satu kolom bisa
 * berakhir lebih panjang dari yang lain.
 */
function MasonryKolom({ daftar, kolom, item, label }: {
  daftar: Berita[];
  kolom: number;
  item: (b: Berita) => React.ReactNode;
  label?: string;
}) {
  const keranjang = useMemo(() => {
    const isi: Berita[][] = Array.from({ length: Math.max(1, kolom) }, () => []);
    daftar.forEach((b, i) => {
      isi[i % isi.length].push(b);
    });
    return isi;
  }, [daftar, kolom]);

  return (
    <div role="group" aria-label={label} className="mt-2 flex items-start gap-6">
      {keranjang.map((isiKolom, i) => (
        <ul key={i} className="flex min-w-0 flex-1 flex-col">
          {isiKolom.map(item)}
        </ul>
      ))}
    </div>
  );
}

/** Satu kartu rel kanan: tanggal–judul–media–deskripsi, plus titik galeri bila
 *  laporannya bermedia lebih dari satu (seperti TitikMedia beranda). Kartunya
 *  tumpukan grid satu sel: tombol dan titik menumpang di dalam gambar tanpa
 *  tombol di dalam tombol. Deskripsi dipangkas tiga baris (line-clamp-3);
 *  "baca selengkapnya" membuka rincian yang sama dengan klik kartu.
 *
 *  Mode `masonry` (rel kanan full): model galeri minimal — media rasio alami
 *  tanpa crop di paling atas, lalu judul, baris meta lokasi–tanggal mono,
 *  dan deskripsi; titik galeri disembunyikan (geser media tetap ada di
 *  rincian). */
function KartuLaporan({ b, bukaLabel, selengkapnya, lebihSedikit, masonry, onBuka }: { b: Berita; bukaLabel: string; selengkapnya: string; lebihSedikit: string; masonry?: boolean; onBuka: () => void }) {
  const [indeks, setIndeks] = useState(0);
  const jumlah = b.media.length;
  // Galeri bisa menyusut saat data dimuat ulang; indeks yang tertinggal di
  // luar batas akan merender undefined.
  const kini = indeks < jumlah ? indeks : 0;
  const item = b.media[kini];
  const galeri = jumlah > 1;
  const adalahVideo = item?.jenis === "video";
  // Laporan tanpa foto/video mana pun — blok media dilewati (lihat di bawah).
  const adaMedia = Boolean(item ?? b.gambar ?? b.poster);

  /* "… selengkapnya" gaya medsos: embel-embel HARUS bagian dari aliran teks
     (inline di ujung potongan), bukan overlay absolut — overlay menimpa kata
     di bawahnya sehingga titik-titiknya kotor/tak terbaca. Caranya: ukur
     dengan klon tak terlihat (layout sama, React tak terganggu), cari
     potongan terpanjang yang muat 3 baris via binary search, lalu render
     potongan + embel-embel. Tanpa pemotongan bila teksnya muat utuh. */
  const teksRef = useRef<HTMLSpanElement | null>(null);
  const sufRef = useRef<HTMLButtonElement | null>(null);
  const [potongan, setPotongan] = useState<string | null>(null);
  // Bentang = deskripsi dibuka penuh di tempat (tidak membuka pop-up).
  const [bentang, setBentang] = useState(false);
  useEffect(() => {
    const el = teksRef.current;
    const deskripsi = b.deskripsi;
    if (!el || !deskripsi || bentang) {
      // Tanpa deskripsi caption tak dirender; saat dibentangkan pengukuran
      // tak diperlukan (potongan lama dipakai lagi saat dilipat).
      return;
    }
    // Variabel lokal, bukan b.deskripsi: TypeScript tak mempersempit properti
    // objek di dalam closure cek() walau sudah dijaga di atas.
    const cek = () => {
      // Klon mewarisi kelas (termasuk line-clamp-3) + lebar kolomnya.
      const ukur = el.cloneNode(false) as HTMLSpanElement;
      ukur.style.width = `${el.clientWidth}px`;
      ukur.style.position = "fixed";
      ukur.style.visibility = "hidden";
      ukur.style.pointerEvents = "none";
      document.body.appendChild(ukur);
      try {
        ukur.textContent = deskripsi;
        if (ukur.scrollHeight <= ukur.clientHeight + 1) {
          setPotongan(null);
          return;
        }
        let lo = 0;
        let hi = deskripsi.length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          ukur.textContent = `${deskripsi.slice(0, mid).trimEnd()}... ${selengkapnya}`;
          if (ukur.scrollHeight <= ukur.clientHeight + 1) lo = mid;
          else hi = mid - 1;
        }
        setPotongan(deskripsi.slice(0, lo).trimEnd());
      } finally {
        ukur.remove();
      }
    };
    /* Yang menentukan potongan adalah lebar ELEMENNYA, bukan lebar jendela.
       Dulu di sini hanya ada listener resize jendela, dan itu meleset: kartu
       arsip dipasang tepat saat tombol tutup diklik, ketika rel masih selebar
       rel sempit (±368px dibagi 3 kolom ≈ 110px). Potongan dihitung di lebar
       itu — tiga baris cuma memuat ~17 karakter — lalu lajurnya melebar ke
       ±496px tanpa jendela pernah berubah ukuran, jadi hasil sempit tadi
       membeku. ResizeObserver menangkap pelebaran itu dan mengukur ulang. */
    let lebarTerukur = -1;
    const cekBilaLebarBerubah = () => {
      const lebar = el.clientWidth;
      // Teks yang dipotong mengubah tinggi, bukan lebar — penjaga ini
      // memastikan pengamat tidak memicu dirinya sendiri berulang kali.
      if (lebar === lebarTerukur) return;
      lebarTerukur = lebar;
      cek();
    };
    // Memanggil observe() sudah memicu callback sekali, jadi tak perlu cek()
    // manual di sini: pengukuran pertama datang dari situ.
    const amati = new ResizeObserver(cekBilaLebarBerubah);
    amati.observe(el);

    // Font Poppins bisa datang belakangan dan mengubah lebar baris tanpa
    // mengubah lebar elemen — pengamat di atas tak akan menyala untuk itu.
    let batal = false;
    document.fonts?.ready.then(() => {
      if (!batal) cek();
    }).catch(() => {});
    return () => {
      batal = true;
      amati.disconnect();
    };
  }, [b.deskripsi, selengkapnya, bentang, masonry]);

  /* Jaring pengaman: tombol "... selengkapnya" adalah <button> (bukan teks
     polos seperti saat diukur) — beda sub-piksel bisa membuatnya lolos ke
     baris keempat dan terpotong clamp. Bila itu terjadi, potong 10 karakter
     lagi sampai muat. */
  useEffect(() => {
    if (potongan === null || bentang) return;
    const el = teksRef.current;
    const suf = sufRef.current;
    if (!el || !suf) return;
    const id = requestAnimationFrame(() => {
      if (suf.getBoundingClientRect().bottom > el.getBoundingClientRect().bottom + 1) {
        setPotongan((p) => (p && p.length > 10 ? p.slice(0, p.length - 10).trimEnd() : p));
      }
    });
    return () => cancelAnimationFrame(id);
  }, [potongan, bentang]);

  return (
    /* Tumpukan grid satu sel: tombol kartu dan titik galeri menempati sel yang
       sama sehingga titiknya menumpang di dalam gambar — tanpa tombol di dalam
       tombol. Gambar adalah anak terakhir tombol, jadi dasar tumpukan = dasar
       gambar dan titik selalu duduk di tepi bawah gambar. Celahnya
       pointer-events-none supaya klik di luar titik tetap membuka laporan.
       Caption (deskripsi) berada di LUAR tumpukan sebagai tombol sendiri di
       bawahnya — kalau ia di dalam tombol, dasar tumpukan ikut turun dan
       titik keluar dari foto menimpa tulisan. */
    <div>
    <div className="grid">
      <button
        type="button" onClick={onBuka}
        title={bukaLabel} aria-label={`${b.judul} — ${bukaLabel}`}
        className={`group col-start-1 row-start-1 w-full min-w-0 text-left focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-pantau-bara focus-visible:ring-offset-2
                   focus-visible:ring-offset-pantau-konsol ${masonry ? "flex flex-col" : "block"}`}
      >
        {/* Model galeri: tanggal pindah ke baris meta di bawah judul. */}
        {!masonry && (
          <p className="font-mono text-[11px] tracking-[0.08em] text-pantau-abu uppercase">
            {b.tanggal}
          </p>
        )}
        <p className={masonry
          ? "order-2 mt-3 text-[15px] leading-snug text-pantau-tulang"
          : "mt-1.5 text-[17px] leading-[1.25] font-bold tracking-tight text-white aliran:text-[15px]"}>
          {b.judul}
        </p>
        {/* Baris meta model galeri: lokasi kiri, tanggal kanan, mono redup. */}
        {masonry && (
          <span className="order-3 mt-1.5 flex items-baseline justify-between gap-3 font-mono text-[11px] tracking-wider text-pantau-abu uppercase">
            <span className="truncate">{b.lokasi ?? b.provinsi ?? "Karhutla"}</span>
            <span className="shrink-0">{b.tanggal}</span>
          </span>
        )}
        {/* Masonry: rasio alami tanpa crop maupun kunci potret — tinggi kartu
            mengikuti medianya seperti galeri foto. Yang menjaga tata letaknya
            tetap tenang bukan rasio yang dipesan, melainkan kolom yang dibagi
            tetap di JS (lihat MasonryKolom): kartu boleh bertambah tinggi saat
            gambarnya tiba, tapi tak bisa pindah kolom. */}
        {/* Tanpa media sama sekali, blok ini tidak dirender: di masonry ia jadi
            kotak hitam tinggi berisi pil lokasi saja, dan kolomnya jadi timpang.
            Kartunya cukup teks. */}
        <span className={`${adaMedia ? "" : "hidden "}${masonry
          ? "relative order-1 block min-w-0 overflow-hidden bg-black"
          : `relative mt-3 block overflow-hidden bg-black ${b.vertikal ? "mx-auto aspect-[3/4] w-full max-w-[360px]" : "aspect-[16/10]"}`}`}>
          {item ? (
            item.jenis === "video" ? (
              <VideoKeping key={item.url} url={item.url} poster={item.poster ?? b.poster} label={b.judul} alami={masonry} />
            ) : (
              <Keping key={item.url} berita={b} src={item.url} alami={masonry} />
            )
          ) : (
            <Keping berita={b} alami={masonry} />
          )}
          {adalahVideo && (
            <span aria-hidden="true" className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-full bg-black/70 py-1 pr-2.5 pl-2 font-mono text-[10px] tracking-wider text-white uppercase ring-1 ring-white/25 backdrop-blur-sm">
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-2.5">
                <polygon points="6 4 20 12 6 20" strokeLinejoin="round" />
              </svg>
              Video
            </span>
          )}
        </span>
      </button>
      {/* Model galeri minimal tanpa titik — geser media ada di rincian. */}
      {galeri && !masonry && (
        <div role="group" aria-label={`Media ${kini + 1}/${jumlah}`}
             className="pointer-events-none col-start-1 row-start-1 flex items-end justify-center pb-2">
          {/* Alas pil gelap: titik menumpang di atas foto yang kecerahannya tak
              menentu — tanpa ini yang tidak aktif tenggelam di foto terang.
              Di atas 6 media titik diganti bilah segmen kompak yang lebarnya
              dikunci, kalau tidak pilnya selebar gambar. */}
          <div className="pointer-events-none flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-1 backdrop-blur-[2px]">
          {jumlah > 6 ? (
            <div className="flex w-36 items-center gap-1 px-1">
              {b.media.map((m, i) => (
                <button
                  key={`${m.jenis}-${m.url}`}
                  type="button"
                  onClick={() => setIndeks(i)}
                  aria-label={`Media ${i + 1}/${jumlah}`}
                  aria-current={i === kini}
                  className="pointer-events-auto flex h-[24px] min-w-0 flex-1 items-center
                             focus-visible:ring-2 focus-visible:ring-pantau-bara focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className={`h-[3px] w-full rounded-full transition-all ${
                      i === kini ? "bg-white" : "bg-white/40 hover:bg-white/70"
                    }`}
                  />
                </button>
              ))}
            </div>
          ) : (
          b.media.map((m, i) => (
            <button
              key={`${m.jenis}-${m.url}`}
              type="button"
              onClick={() => setIndeks(i)}
              aria-label={`Media ${i + 1}/${jumlah}`}
              aria-current={i === kini}
              className="pointer-events-auto flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full
                         focus-visible:ring-2 focus-visible:ring-pantau-bara focus-visible:outline-none"
            >
              <span
                aria-hidden="true"
                className={`block size-[5px] rounded-full transition-all ${
                  i === kini ? "scale-110 bg-white" : "bg-white/55 hover:bg-white/85"
                }`}
              />
            </button>
          ))
          )}
          </div>
        </div>
      )}
    </div>
    {/* Caption di luar tumpukan gambar (sejajar, bukan bersarang) supaya
        titik galeri tetap di tepi bawah foto. "… selengkapnya" inline gaya
        medsos: mengekliknya MEMBENTANGKAN teks di tempat (bukan membuka
        pop-up) — klik gambar/judul yang membuka rincian. */}
    {b.deskripsi && (
      <div className={masonry ? "mt-2" : "mt-2.5"}>
        {/* line-clamp-3 TANPA `block`: display:block menimpa -webkit-box
            milik line-clamp sehingga pemotongan 3 baris gagal total. Saat
            dibentangkan clamp dilepas supaya teks penuh tampil. */}
        <span ref={teksRef} className={`${bentang ? "" : "line-clamp-3 "}leading-relaxed ${masonry ? "text-[13px] text-pantau-tulang/70" : "text-[13px] text-pantau-tulang/75"}`}>
          {potongan === null || bentang ? (
            b.deskripsi
          ) : (
            <>
              {potongan}
              <button
                ref={sufRef}
                type="button"
                onClick={() => setBentang(true)}
                aria-expanded={bentang}
                aria-label={`${b.judul} — ${selengkapnya}`}
                className="p-0 text-left text-pantau-abu transition-colors hover:text-white
                           focus-visible:ring-2 focus-visible:ring-pantau-bara focus-visible:outline-none"
              >
                ... {selengkapnya}
              </button>
            </>
          )}
        </span>
        {bentang && potongan !== null && (
          <button
            type="button"
            onClick={() => setBentang(false)}
            aria-expanded={bentang}
            className="mt-0.5 block p-0 text-left text-[13px] leading-relaxed text-pantau-abu transition-colors hover:text-white
                       focus-visible:ring-2 focus-visible:ring-pantau-bara focus-visible:outline-none"
          >
            {lebihSedikit}
          </button>
        )}
      </div>
    )}
    </div>
  );
}

/** Pratinjau kartu rel kanan. Gambar yang lambat atau gagal tidak pernah
 *  memajang ikon rusak — pil lokasi di belakangnya yang tampil, dan gambar
 *  yang jadi memudar masuk di atasnya.
 *
 *  Varian `alami` (model galeri): gambar rasio aslinya, mengalir di dalam
 *  wadah (bukan absolute mengisi bingkai crop) — tinggi kartu mengikuti
 *  medianya. */
function Keping({ berita: b, src, alami }: { berita: Berita; src?: string; alami?: boolean }) {
  const [keadaan, setKeadaan] = useState<"memuat" | "ok" | "gagal">("memuat");
  const sumur = src ?? b.gambar ?? b.poster;

  /* Gambar dari cache bisa sudah `complete` sebelum hydration selesai —
     onLoad-nya sudah lewat dan tak menyala lagi, sehingga gambar terjebak
     opacity-0 selamanya. Ref ini mengejar ketertinggalannya saat pasang. */
  const pasangImg = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete) {
      setKeadaan(el.naturalWidth > 0 ? "ok" : "gagal");
    }
  }, []);

  /* Sengaja <img>, bukan next/image: gambar bisa berupa URL remote warisan
     (host dinamis per lingkungan) yang tak bisa didaftarkan ke
     remotePatterns statis. */
  if (alami) {
    /* Abu konsol, bukan hitam pekat: kartu yang gambarnya belum tiba tampak
       sebagai bidang kosong biasa, bukan kedipan hitam. */
    return (
      <span className="block bg-pantau-konsol">
        {sumur && keadaan !== "gagal" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={pasangImg}
            src={sumur} alt="" loading="lazy"
            onLoad={() => setKeadaan("ok")}
            onError={() => setKeadaan("gagal")}
            /* Tanpa fade masuk: tiap kali daftar kartu dibangun ulang (rel
               melebar/menyempit) React membuat <img> baru, dan memulainya dari
               opacity-0 membuat semua kartu berkedip hitam walau gambarnya
               sudah ada di cache. Gambar cache kini tampil seketika. */
            className="h-auto min-h-40 w-full transition-[filter] duration-500 group-hover:brightness-105"
          />
        ) : (
          <span className="flex min-h-40 items-center justify-center p-4">
            <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] tracking-wider text-pantau-tulang/70 uppercase">
              {b.lokasi ?? b.provinsi ?? "Karhutla"}
            </span>
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-pantau-konsol p-4">
      <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] tracking-wider text-pantau-tulang/70 uppercase">
        {b.lokasi ?? b.provinsi ?? "Karhutla"}
      </span>
      {sumur && keadaan !== "gagal" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={pasangImg}
          src={sumur} alt="" loading="lazy"
          onLoad={() => setKeadaan("ok")}
          onError={() => setKeadaan("gagal")}
          /* Sama seperti varian galeri: tampil seketika, tanpa fade yang
             membuat kartu berkedip hitam saat daftar dibangun ulang. */
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      )}
    </span>
  );
}

/** Video kartu rel kanan — autoplay bisu berulang seperti korsel beranda
 *  (VideoKartu), tapi "aktif"-nya berarti kartu terlihat di layar: hanya yang
 *  terlihat yang diputar, sisanya dijeda, supaya 6 kartu tak mengunduh dan
 *  men-decode bersamaan. Tanpa suara dan tanpa kontrol (kartunya sendiri sudah
 *  tombol pembuka laporan); pengurang gerak berarti diam di poster.
 *
 *  Varian `alami` (model galeri): poster yang mengalir menentukan tinggi
 *  wadah, video menutupinya penuh; tanpa poster, video sendiri yang
 *  mengalir dengan rasio aslinya. */
function VideoKeping({ url, poster, label, alami }: { url: string; poster: string | null; label: string; alami?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const terlihatRef = useRef(false);
  const [siap, setSiap] = useState(false);
  // Poster tampil seketika (gambar cache tak boleh berkedip hitam saat daftar
  // kartu dibangun ulang); state ini hanya menandai poster yang gagal dimuat.
  const [posterGagal, setPosterGagal] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Properti muted, bukan sekadar atribut — syarat autoplay sebagian peramban.
    el.muted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const amati = new IntersectionObserver(
      (masuk) => {
        terlihatRef.current = masuk.some((m) => m.isIntersecting);
        if (terlihatRef.current) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.25 },
    );
    amati.observe(el);
    return () => {
      amati.disconnect();
      el.pause();
    };
  }, []);

  /* play() saat kartu terlihat bisa ditolak kalau datanya belum siap — janjinya
     gagal dalam diam dan tak pernah dicoba lagi (kotak hitam). Begitu canplay,
     coba lagi selama kartunya masih terlihat. */
  const cobaPutar = useCallback((el: HTMLVideoElement) => {
    setSiap(true);
    if (terlihatRef.current) el.play().catch(() => {});
  }, []);

  /* Poster sebagai <img> sendiri di belakang video — pola beranda. Poster yang
     menumpang di atribut video ikut tak terlihat selama videonya opacity-0,
     sehingga penolakan putar (hemat daya) atau canplay yang macet berarti
     kotak hitam total. Dengan lapisan sendiri selalu ada bingkai terlihat. */
  const pasangPoster = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0) setPosterGagal(true);
  }, []);

  const videoEl = (kelas: string) => (
    <video
      ref={ref}
      src={url}
      aria-label={label}
      muted
      playsInline
      loop
      preload="metadata"
      onCanPlay={(e) => cobaPutar(e.currentTarget)}
      // canplay bisa lewat sebelum pendengarnya terpasang (video dari cache)
      // — video lalu berputar tapi tetap opacity-0 di belakang poster.
      // `playing` datang tiap kali pemutaran benar-benar mulai.
      onPlaying={() => setSiap(true)}
      className={kelas}
    />
  );

  if (alami) {
    return (
      <span className="relative block bg-black">
        {poster && !posterGagal ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={pasangPoster}
              src={poster} alt="" aria-hidden="true" loading="lazy"
              onError={() => setPosterGagal(true)}
              className="h-auto min-h-40 w-full transition-[filter] duration-500 group-hover:brightness-105"
            />
            {videoEl(`absolute inset-0 h-full w-full object-cover transition duration-500
                      group-hover:brightness-105 ${siap ? "opacity-100" : "opacity-0"}`)}
          </>
        ) : (
          videoEl("h-auto min-h-40 w-full")
        )}
      </span>
    );
  }

  return (
    <span className="absolute inset-0 bg-black">
      {poster && !posterGagal && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={pasangPoster}
          src={poster} alt="" aria-hidden="true" loading="lazy"
          onError={() => setPosterGagal(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      )}
      <video
        ref={ref}
        src={url}
        aria-label={label}
        muted
        playsInline
        loop
        preload="metadata"
        onCanPlay={(e) => cobaPutar(e.currentTarget)}
        // canplay bisa lewat sebelum pendengarnya terpasang (video dari cache)
        // — video lalu berputar tapi tetap opacity-0 di belakang poster.
        // `playing` datang tiap kali pemutaran benar-benar mulai.
        onPlaying={() => setSiap(true)}
        className={`absolute inset-0 h-full w-full object-cover transition duration-500
                    group-hover:scale-[1.03] ${siap ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}

/** Satu baris daftar rel kanan (mode list): thumbnail kecil kiri + tanggal–judul
 *  kanan. Thumbnail menampilkan badge video kalau ada. Tanpa galeri titik —
 *  ruangnya terlalu sempit untuk itu. */
function ItemListLaporan({ b, bukaLabel, onBuka }: { b: Berita; bukaLabel: string; onBuka: () => void }) {
  const item = b.media[0];
  const adalahVideo = item?.jenis === "video" || !!b.video;
  const gambar = item?.jenis === "video" ? (item.poster ?? b.poster ?? b.gambar) : (item?.url ?? b.gambar ?? b.poster);
  const [imgKeadaan, setImgKeadaan] = useState<"memuat" | "ok" | "gagal">("memuat");

  const pasangImg = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete) {
      setImgKeadaan(el.naturalWidth > 0 ? "ok" : "gagal");
    }
  }, []);

  return (
    <button
      type="button"
      onClick={onBuka}
      title={bukaLabel}
      aria-label={`${b.judul} — ${bukaLabel}`}
      className="group flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left transition-colors
                 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-pantau-bara focus-visible:ring-offset-2 focus-visible:ring-offset-pantau-konsol"
    >
      {/* Thumbnail kotak 44×44 */}
      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-pantau-sumur">
        {gambar && imgKeadaan !== "gagal" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={pasangImg}
            src={gambar}
            alt=""
            loading="lazy"
            onLoad={() => setImgKeadaan("ok")}
            onError={() => setImgKeadaan("gagal")}
            className={`absolute inset-0 h-full w-full object-cover transition duration-300 ${
              imgKeadaan === "ok" ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
        {adalahVideo && (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-5 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm ring-1 ring-white/25">
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-2.5 text-white">
                <polygon points="6 4 20 12 6 20" strokeLinejoin="round" />
              </svg>
            </span>
          </span>
        )}
      </span>

      {/* Teks */}
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] tracking-[0.08em] text-pantau-abu uppercase">
          {b.tanggal}
          {b.provinsi && (
            <> · <span className="text-pantau-abu/70">{b.provinsi}</span></>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-semibold leading-snug text-pantau-tulang">
          {b.judul}
        </span>
      </span>

      {/* Panah buka */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
           strokeLinejoin="round" className="size-3.5 shrink-0 text-pantau-abu/50 transition-colors group-hover:text-pantau-abu" aria-hidden="true">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}
