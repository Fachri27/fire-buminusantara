import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const url = new URL(process.env.DATABASE_URL);
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 5,
  }),
});

const sekarang = new Date();

const DAFTAR_KEJADIAN = [
  {
    slug: "karhutla-sebangau-palangka-raya-kalteng",
    title_id: "Kebakaran Lahan Gambut Sebangau Mengancam Kawasan Konservasi",
    title_en: "Sebangau Peatland Fire Threatens Conservation Area",
    description_id: "Titik api melanda lahan gambut di pinggiran Taman Nasional Sebangau. Petugas BPBD dan Manggala Agni melakukan pembasahan intensif karena kedalaman gambut mencapai lebih dari 2 meter.",
    description_en: "Hotspots struck peatland on the outskirts of Sebangau National Park. Local disaster management and firefighters are conducting deep wetting.",
    event_date: new Date("2026-09-02"),
    location: "Palangka Raya, Kalimantan Tengah",
    location_lat: -2.2136,
    location_lng: 113.9108,
    orientation: "landscape",
    image_id: "fire/gambar/fc648306-82e1-450e-b6d8-7a919b698635.jpeg",
  },
  {
    slug: "karhutla-sampit-kotawaringin-timur",
    title_id: "Asap Tebal Selimuti Jalur Lintas Sampit Akibat Kebakaran Semak",
    title_en: "Thick Smoke Blankets Sampit Trans Road Due to Brush Fire",
    description_id: "Kebakaran semak belukar dan lahan telantar menimbulkan kabut asap tebal yang menurunkan jarak pandang pengendara di jalur lingkar selatan Sampit.",
    description_en: "Shrub and abandoned land fires produce thick haze reducing driver visibility on the Sampit southern ring road.",
    event_date: new Date("2026-09-03"),
    location: "Kotawaringin Timur, Kalimantan Tengah",
    location_lat: -2.5333,
    location_lng: 112.9500,
    orientation: "horizontal",
    image_id: "fire/gambar/fc648306-82e1-450e-b6d8-7a919b698635.jpeg",
  },
  {
    slug: "karhutla-pulang-pisau-kalteng",
    title_id: "Karhutla Meluas di Kahayan Hilir Pulang Pisau",
    title_en: "Wildfire Expands in Kahayan Hilir, Pulang Pisau",
    description_id: "Upaya pemadaman darat menghadapi kendala terbatasnya sumber air permukaan saat musim kemarau melanda area gambut Pulang Pisau.",
    description_en: "Ground extinguishing efforts face obstacles due to limited surface water sources during the dry season in Pulang Pisau peat areas.",
    event_date: new Date("2026-09-01"),
    location: "Pulang Pisau, Kalimantan Tengah",
    location_lat: -2.7485,
    location_lng: 114.2562,
    orientation: "landscape",
    image_id: "fire/gambar/fc648306-82e1-450e-b6d8-7a919b698635.jpeg",
  },
  {
    slug: "karhutla-rasau-jaya-kubu-raya-kalbar",
    title_id: "Kebakaran Lahan Gambut Dekat Pemukiman Rasau Jaya",
    title_en: "Peatland Fire Near Residential Area in Rasau Jaya",
    description_id: "Api gambut membakar lebih dari 15 hektare lahan di Rasau Jaya, kepulan asap pekat terbawa angin mendekati kawasan bandara Supadio Pontianak.",
    description_en: "Peat fire burned more than 15 hectares in Rasau Jaya, with dense smoke drifting toward Supadio Airport Pontianak.",
    event_date: new Date("2026-09-03"),
    location: "Kubu Raya, Kalimantan Barat",
    location_lat: -0.1667,
    location_lng: 109.3500,
    orientation: "landscape",
    image_id: "fire/gambar/fc648306-82e1-450e-b6d8-7a919b698635.jpeg",
  },
  {
    slug: "karhutla-kendawangan-ketapang-kalbar",
    title_id: "Manggala Agni Terjunkan Water Bombing di Kendawangan",
    title_en: "Manggala Agni Deploys Water Bombing in Kendawangan",
    description_id: "Helikopter pembom air dikerahkan untuk memutus perambatan api di lokasi terpencil hutan rawa gambut pesisir selatan Ketapang.",
    description_en: "Water bombing helicopters were deployed to stop fire progression in remote coastal peat swamp forest of southern Ketapang.",
    event_date: new Date("2026-08-30"),
    location: "Ketapang, Kalimantan Barat",
    location_lat: -1.8500,
    location_lng: 110.0000,
    orientation: "horizontal",
    image_id: "fire/gambar/fc648306-82e1-450e-b6d8-7a919b698635.jpeg",
  },
  {
    slug: "karhutla-landasan-ulin-banjarbaru-kalsel",
    title_id: "Kebakaran Lahan Ring Satu Bandara Syamsudin Noor Terkendali",
    title_en: "Land Fire Near Syamsudin Noor Airport Successfully Contained",
    description_id: "Regu siaga darurat gabungan TNI, Polri, dan BPBD berhasil melokalisir kebakaran semak belukar di Landasan Ulin sebelum mengganggu aktivitas penerbangan.",
    description_en: "Joint emergency team successfully localized brush fire in Landasan Ulin before disrupting flight operations.",
    event_date: new Date("2026-09-02"),
    location: "Banjarbaru, Kalimantan Selatan",
    location_lat: -3.4500,
    location_lng: 114.7333,
    orientation: "landscape",
    image_id: "fire/gambar/fc648306-82e1-450e-b6d8-7a919b698635.jpeg",
  },
  {
    slug: "karhutla-pangkalan-kerinci-pelalawan-riau",
    title_id: "Patroli Udara Temukan Titik Api Tersebar di Pelalawan",
    title_en: "Aerial Patrol Detects Scattered Hotspots in Pelalawan",
    description_id: "Satgas Karhutla Riau meningkatkan patroli terpadu setelah citra satelit mendeteksi lonjakan anomali termal di lanskap gambut Semenanjung Kampar.",
    description_en: "Riau Karhutla Task Force stepped up integrated patrols after satellite imagery detected thermal anomalies across Kampar Peninsula peat landscape.",
    event_date: new Date("2026-09-04"),
    location: "Pelalawan, Riau",
    location_lat: 0.4000,
    location_lng: 101.8500,
    orientation: "landscape",
    image_id: "fire/gambar/fc648306-82e1-450e-b6d8-7a919b698635.jpeg",
  },
  {
    slug: "karhutla-dumai-pesisir-riau",
    title_id: "Pemadaman Lahan Perkebunan Gambut di Medang Kampai Dumai",
    title_en: "Peat Plantation Fire Suppression in Medang Kampai Dumai",
    description_id: "Kondisi angin kencang mempersulit proses pemadaman api bawah tanah di wilayah pesisir Dumai, mesin pompa apung dikerahkan ke parit terdekat.",
    description_en: "Strong winds complicate suppression of subsurface fires on Dumai coast, floating pumps deployed to nearby canals.",
    event_date: new Date("2026-09-03"),
    location: "Dumai, Riau",
    location_lat: 1.6667,
    location_lng: 101.4500,
    orientation: "horizontal",
    image_id: "fire/gambar/fc648306-82e1-450e-b6d8-7a919b698635.jpeg",
  },
  {
    slug: "karhutla-pampangan-oki-sumsel",
    title_id: "Lahan Gambut Dalam Pampangan OKI Terbakar, Satgas Siaga Satu",
    title_en: "Deep Peat Fire in Pampangan OKI Triggers High Alert",
    description_id: "Kabupaten Ogan Komering Ilir menetapkan status siaga darurat menyusul terbakarnya ratusan hektare lahan tidur bervegetasi purun dan semak belukar.",
    description_en: "Ogan Komering Ilir declared emergency alert status following fires in hundreds of hectares of idle peatland.",
    event_date: new Date("2026-09-04"),
    location: "Ogan Komering Ilir, Sumatera Selatan",
    location_lat: -3.2500,
    location_lng: 104.9167,
    orientation: "landscape",
    image_id: "fire/gambar/fc648306-82e1-450e-b6d8-7a919b698635.jpeg",
  },
  {
    slug: "karhutla-bayung-lencir-muba-sumsel",
    title_id: "Sekat Kanal Dipercepat Redam Api di Bayung Lencir",
    title_en: "Canal Blocking Accelerated to Dampen Fire in Bayung Lencir",
    description_id: "Pembuatan sekat kanal darurat dilakukan untuk menaikkan muka air tanah guna menahan laju kebakaran merambat ke area konsesi restorasi ekosistem.",
    description_en: "Emergency canal blocking underway to raise water table and prevent fire spread into ecosystem restoration concessions.",
    event_date: new Date("2026-09-01"),
    location: "Musi Banyuasin, Sumatera Selatan",
    location_lat: -2.0333,
    location_lng: 103.7833,
    orientation: "horizontal",
    image_id: "fire/gambar/fc648306-82e1-450e-b6d8-7a919b698635.jpeg",
  },
  {
    slug: "karhutla-kumpeh-muaro-jambi",
    title_id: "Hektaran Lahan Tidur di Kumpeh Hangus Terbakar",
    title_en: "Hectares of Idle Land in Kumpeh Scorched by Fire",
    description_id: "Tim gabungan BPBD Muaro Jambi bersama masyarakat peduli api (MPA) terus berupaya memadamkan api yang membakar lahan semak di Kumpeh.",
    description_en: "Joint BPBD Muaro Jambi and community fire brigades continue efforts to extinguish burning shrubland in Kumpeh.",
    event_date: new Date("2026-09-02"),
    location: "Muaro Jambi, Jambi",
    location_lat: -1.5500,
    location_lng: 103.8167,
    orientation: "landscape",
    image_id: "fire/gambar/fc648306-82e1-450e-b6d8-7a919b698635.jpeg",
  }
];

async function main() {
  console.log("Menanam data kejadian karhutla realistis...");
  let count = 0;
  for (const k of DAFTAR_KEJADIAN) {
    await prisma.events.upsert({
      where: { slug: k.slug },
      update: {
        title_id: k.title_id,
        title_en: k.title_en,
        description_id: k.description_id,
        description_en: k.description_en,
        event_date: k.event_date,
        location: k.location,
        location_lat: k.location_lat,
        location_lng: k.location_lng,
        orientation: k.orientation,
        image_id: k.image_id,
        updated_at: sekarang,
      },
      create: {
        ...k,
        created_at: sekarang,
        updated_at: sekarang,
      },
    });
    count++;
  }
  console.log(`Berhasil menanam / memperbarui ${count} data kejadian karhutla.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
