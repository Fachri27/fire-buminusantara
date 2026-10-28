import type { Bahasa } from "@/lib/bahasa";

/* Teks peta per bahasa untuk bagian hotspot, peringkat, dan Panduan Peta.
   Kalimat lisensi CAMS ("Contains modified … information 2026") sengaja tak
   diterjemahkan — bunyinya ditetapkan lisensinya. */
export const TEKS_PETA = {
  id: {
    peringkat: "Peringkat hotspot",
    hotspotFirms: "Hotspot NASA FIRMS",
    perHari: "per hari",
    jam24: "24 jam terakhir",
    memuat: "memuat…",
    titik: "titik",
    memuatSatelit: "Memuat data satelit…",
    firmsGagal: "FIRMS tak terjangkau, dicoba lagi tiap menit.",
    firmsGagalSingkat: "FIRMS tak terjangkau",
    dataTersimpan: "Data tersimpan, FIRMS sedang tak terjangkau.",
    kepercayaan: ["Rendah", "Sedang", "Tinggi"],
    panduan: {
      judul: "Panduan Peta",
      tutup: "Tutup panduan",
      topikLabel: "Topik panduan",
      topik: {
        aerosol: {
          label: "Aerosol Karhutla",
          ringkas: "Sebaran asap",
          pembuka: "Seberapa pekat asap kebakaran hutan dan lahan di udara, dari model atmosfer Copernicus.",
        },
        angin: {
          label: "Angin dan Kualitas Udara",
          ringkas: "AQI dan arah angin",
          pembuka: "Kualitas udara dari partikel halus PM2.5, beserta angin yang membawanya.",
        },
        hotspot: {
          label: "Hotspot",
          ringkas: "Titik panas satelit",
          pembuka: "Titik panas yang terdeteksi satelit NASA dalam satu hari. Satu titik belum tentu satu kebakaran.",
        },
        peringkat: {
          label: "Peringkat Hotspot",
          ringkas: "Wilayah terbanyak",
          pembuka: "Provinsi dan kabupaten/kota dengan deteksi hotspot terbanyak pada hari yang tampil di peta.",
        },
      },
      bagian: {
        data: "Data",
        caraBaca: "Cara membaca",
        rentang: "Rentang waktu",
        lapisan: "Lapisan",
        sumber: "Sumber",
        skalaAqi: "Skala AQI",
        satelit: "Satelit",
        warna: "Warna",
        detailTitik: "Detail titik",
        catatan: "Catatan",
        dihitung: "Yang dihitung",
        membuka: "Membuka",
        batas: "Batas wilayah",
      },
      aerosol: {
        data: "OMAOD 550 nm (Organic Matter Aerosol Optical Depth) dari model global CAMS: banyaknya partikel asap biomassa di kolom udara.",
        caraBaca:
          "Makin ungu makin pekat. Tombol di kanan pita legenda mengganti palet (Fire Watch, Bara, Spektrum) tanpa mengubah datanya. Angka di tiap provinsi adalah jumlah laporan warga.",
        rentang:
          "Hari ini dan enam hari sebelumnya sampai tiga hari ke depan, tiap tiga jam, sama dengan hotspot. Langkah berlabel Prediksi adalah prakiraan. Siklus model di legenda menunjukkan run CAMS terbaru, dua kali sehari.",
        lapisan:
          "Tombol Lapisan di kolom kanan menyalakan atau mematikan animasi asap, batas provinsi, jumlah laporan, dan tiga lapisan hotspot.",
        sumberLanjut:
          "Peta dasar © EOX IT Services GmbH (Sentinel-2 cloudless). Komisi Eropa dan ECMWF tidak bertanggung jawab atas penggunaan data atau informasi yang disajikan.",
      },
      angin: {
        data: "Indeks Kualitas Udara (AQI, standar US EPA) dihitung dari konsentrasi PM2.5 model CAMS. Partikel yang bergerak adalah angin 10 m dari run model CAMS/IFS yang sama.",
        aqi: ["Baik", "Sedang", "Tidak sehat bagi kelompok sensitif", "Tidak sehat", "Sangat tidak sehat", "Berbahaya"],
        rentang: "Hari ini dan enam hari sebelumnya sampai tiga hari ke depan, tiap tiga jam, sama dengan Aerosol Karhutla dan hotspot.",
        lapisan:
          "Sakelar Angin di panel Lapisan mematikan warna AQI dan animasi angin; peta dasarnya berganti ke citra satelit. Batas provinsi, jumlah laporan, dan hotspot tetap bisa dinyalakan.",
        petaDasar: "Peta dasar dari",
      },
      hotspot: {
        satelit: [
          "MODIS di satelit Terra dan Aqua, resolusi 1 km",
          "VIIRS di satelit S-NPP, resolusi 375 m",
          "VIIRS di satelit NOAA-20, resolusi 375 m",
        ],
        kepercayaan: ["Kepercayaan rendah", "Kepercayaan sedang", "Kepercayaan tinggi"],
        warna: "Bentuk penanda menunjukkan satelitnya, warnanya tingkat kepercayaan deteksi.",
        rentang:
          "Satu hari (WIB) mengikuti bilah waktu peta: hari ini dan enam hari sebelumnya. Hari ini berisi deteksi 24 jam terakhir, seperti SiPongi; hari sebelumnya pukul 00.00–24.00 WIB. Data tiba sekitar tiga jam setelah satelit melintas, jadi hari ini masih bertambah. Langkah prakiraan memakai hari terakhir yang ada datanya.",
        detail: "Arahkan kursor atau ketuk sebuah titik untuk melihat waktu deteksi, satelit, dan FRP (daya radiasi api).",
        catatan: "Hotspot menandai suhu permukaan yang tinggi. Pastikan kebakaran lewat pengecekan lapangan.",
        sumberLanjut: "(Fire Information for Resource Management System), bagian dari NASA ESDIS.",
      },
      peringkat: {
        dihitung:
          "Deteksi ketiga satelit: MODIS Terra/Aqua, VIIRS S-NPP, dan VIIRS NOAA-20, seperti jumlah di legenda SiPongi. Satelit-satelit itu melintas berdekatan (S-NPP dan NOAA-20 sekitar 50 menit berselang), jadi satu api sering terhitung lebih dari sekali: angkanya jumlah deteksi, bukan jumlah api.",
        caraBaca:
          "Panjang isi merah menunjukkan jumlah dibanding peringkat pertama. Arahkan kursor atau ketuk angka untuk rincian per satelit, tingkat kepercayaan, serta siang dan malam. Nomor di bawah daftar berpindah halaman; tombol unduh menyimpan seluruh peringkat sebagai CSV.",
        membuka: "Tombol daftar di kiri atas peta membuka dan menutup panel peringkat.",
        batas:
          "Provinsi mengikuti 34 poligon peta. Kabupaten/kota mengikuti 515 wilayah dari Simontini, disederhanakan sekitar 100 m, jadi titik tepat di perbatasan bisa masuk wilayah tetangga.",
      },
    },
  },
  en: {
    peringkat: "Hotspot ranking",
    hotspotFirms: "NASA FIRMS hotspots",
    perHari: "per day",
    jam24: "last 24 hours",
    memuat: "loading…",
    titik: "points",
    memuatSatelit: "Loading satellite data…",
    firmsGagal: "FIRMS is unreachable, retrying every minute.",
    firmsGagalSingkat: "FIRMS unreachable",
    dataTersimpan: "Saved data, FIRMS is currently unreachable.",
    kepercayaan: ["Low", "Medium", "High"],
    panduan: {
      judul: "Map Guide",
      tutup: "Close guide",
      topikLabel: "Guide topics",
      topik: {
        aerosol: {
          label: "Wildfire Smoke Aerosol",
          ringkas: "Smoke spread",
          pembuka: "How thick wildfire smoke is in the air, from the Copernicus atmosphere model.",
        },
        angin: {
          label: "Wind and Air Quality",
          ringkas: "AQI and wind direction",
          pembuka: "Air quality from fine PM2.5 particles, and the wind that carries them.",
        },
        hotspot: {
          label: "Hotspots",
          ringkas: "Satellite heat points",
          pembuka: "Heat points detected by NASA satellites in one day. One point is not necessarily one fire.",
        },
        peringkat: {
          label: "Hotspot Ranking",
          ringkas: "Most-affected areas",
          pembuka: "Provinces and regencies/cities with the most hotspot detections on the day shown on the map.",
        },
      },
      bagian: {
        data: "Data",
        caraBaca: "How to read it",
        rentang: "Time range",
        lapisan: "Layers",
        sumber: "Source",
        skalaAqi: "AQI scale",
        satelit: "Satellites",
        warna: "Colours",
        detailTitik: "Point details",
        catatan: "Note",
        dihitung: "What is counted",
        membuka: "Opening it",
        batas: "Area boundaries",
      },
      aerosol: {
        data: "OMAOD 550 nm (Organic Matter Aerosol Optical Depth) from the global CAMS model: how many biomass smoke particles are in the air column.",
        caraBaca:
          "The more purple, the thicker the smoke. The button to the right of the legend bar switches the palette (Fire Watch, Bara, Spektrum) without changing the data. The number in each province is the count of citizen reports.",
        rentang:
          "Today and the six days before it, up to three days ahead, every three hours, the same as hotspots. Steps labelled Prediksi are forecasts. The model cycle in the legend shows the latest CAMS run, published twice a day.",
        lapisan:
          "The Layers button in the right-hand column turns the smoke animation, province borders, report counts and the three hotspot layers on or off.",
        sumberLanjut:
          "Basemap © EOX IT Services GmbH (Sentinel-2 cloudless). Neither the European Commission nor ECMWF is responsible for any use of the data or information presented.",
      },
      angin: {
        data: "Air Quality Index (AQI, US EPA standard) calculated from CAMS PM2.5 concentrations. The moving particles show 10 m wind from the same CAMS/IFS model run.",
        aqi: ["Good", "Moderate", "Unhealthy for sensitive groups", "Unhealthy", "Very unhealthy", "Hazardous"],
        rentang: "Today and the six days before it, up to three days ahead, every three hours, the same as the smoke aerosol layer and hotspots.",
        lapisan:
          "The Wind switch in the Layers panel turns off the AQI colours and wind animation, and the basemap switches to satellite imagery. Province borders, report counts and hotspots can still be turned on.",
        petaDasar: "Basemap from",
      },
      hotspot: {
        satelit: [
          "MODIS on the Terra and Aqua satellites, 1 km resolution",
          "VIIRS on the S-NPP satellite, 375 m resolution",
          "VIIRS on the NOAA-20 satellite, 375 m resolution",
        ],
        kepercayaan: ["Low confidence", "Medium confidence", "High confidence"],
        warna: "The marker shape shows the satellite; its colour shows how confident the detection is.",
        rentang:
          "One day (WIB) following the map's time slider: today and the six days before it. Today shows detections from the last 24 hours, as SiPongi does; earlier days run from 00:00 to 24:00 WIB. Data arrives about three hours after a satellite pass, so today is still filling in. Forecast steps use the latest day with data.",
        detail: "Hover over or tap a point to see the detection time, satellite and FRP (fire radiative power).",
        catatan: "A hotspot marks unusually hot ground. Confirm a fire with a field check.",
        sumberLanjut: "(Fire Information for Resource Management System), part of NASA ESDIS.",
      },
      peringkat: {
        dihitung:
          "Detections from all three satellites: MODIS on Terra/Aqua, VIIRS on S-NPP, and VIIRS on NOAA-20, matching the totals in SiPongi's legend. They pass close together (S-NPP and NOAA-20 about 50 minutes apart), so one fire is often counted more than once: the numbers are detections, not fires.",
        caraBaca:
          "The length of the red fill shows the count relative to first place. Hover over or tap a number for its breakdown by satellite, confidence, and day and night. The numbers below each list switch pages; the download button saves the full ranking as CSV.",
        membuka: "The list button at the top left of the map opens and closes the ranking panel.",
        batas:
          "Provinces follow the map's 34 polygons. Regencies/cities follow 515 areas from Simontini, simplified to about 100 m, so a point right on a border can fall into the neighbouring area.",
      },
    },
  },
} as const;

export type TeksPeta = (typeof TEKS_PETA)[Bahasa];

/** Locale Intl per bahasa situs. */
export const LOCALE: Record<Bahasa, string> = { id: "id-ID", en: "en-GB" };

/** "2026-10-27" → "27 Okt 2026" / "27 Oct 2026". */
export function formatHariPeta(hari: string, bahasa: Bahasa): string {
  return new Date(`${hari}T00:00:00Z`).toLocaleDateString(LOCALE[bahasa], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
