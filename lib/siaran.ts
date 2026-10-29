import { randomBytes } from "node:crypto";
import { AccessToken, RoomServiceClient, ServerError } from "livekit-server-sdk";
import { lewatBatas } from "./batas-laju.ts";
import { koordinat } from "./batas-laporan.ts";
import { prisma } from "./prisma.ts";

/**
 * Siaran langsung warga dari aplikasi mobile (LiveKit). Kontrak: docs/LIVE.md
 * di repo aplikasi.
 *
 * Situs ini hanya membuat ruang dan menandatangani token — video tidak pernah
 * lewat sini, melainkan HP → server LiveKit → penonton. API secret tinggal di
 * server, tidak pernah di aplikasi. Satu ruang per siaran.
 *
 * Penonton:
 *   - petugas (CMS)  → semua siaran, identitas `petugas-…`
 *   - warga (publik) → hanya siaran yang pelapornya memilih "Tampilkan di
 *     beranda warga" (metadata ruang `publik: true`), identitas `warga-…`.
 *     Dengan akun boleh komentar/hati/hadiah; tamu hanya menonton.
 *
 * Metadata ruang dan atribut peserta terbaca SEMUA penonton, termasuk tamu.
 * Karena itu ruang publik hanya memuat titik kasar (~1 km); titik persis
 * dikirim aplikasi pelapor ke peserta `petugas-…` saja lewat text stream
 * topik "lokasi".
 *
 * Tanpa LIVEKIT_URL/KEY/SECRET semua rute siaran menjawab 503.
 */

const AWALAN_PELAPOR = "pelapor-";
const AWALAN_WARGA = "warga-";
const POLA_RUANG = /^siaran-[a-z0-9-]+$/;

/** Kursi penonton warga per ruang. Ruang sendiri dibuat tanpa maxParticipants:
 *  batas LiveKit berlaku untuk semua peserta, sehingga warga yang memenuhi
 *  ruang dulu mengunci petugas (dan pelapor yang menyambung ulang) di luar. */
const BATAS_WARGA = 50;
/** Ruang publik hilang dari beranda setelah dilaporkan sekian akun berbeda. */
const AMBANG_LAPORAN = 3;
/** Beranda setiap HP menanyakan daftar siaran tiap 8 detik; hasilnya dibagi. */
const SIMPAN_DAFTAR_MS = 5_000;

type Jawaban = [status: number, isi: Record<string, unknown> | unknown[]];

function konfigurasi() {
  const url = process.env.LIVEKIT_URL ?? "";
  const kunci = process.env.LIVEKIT_API_KEY ?? "";
  const rahasia = process.env.LIVEKIT_API_SECRET ?? "";
  return url && kunci && rahasia ? { url, kunci, rahasia } : null;
}

let _ruangan: RoomServiceClient | null = null;
function ruangan(k: NonNullable<ReturnType<typeof konfigurasi>>) {
  _ruangan ??= new RoomServiceClient(k.url.replace(/^ws/, "http"), k.kunci, k.rahasia);
  return _ruangan;
}

const BELUM_SIAP: Jawaban = [503, { galat: "Siaran langsung belum tersedia." }];
const TAK_TERHUBUNG: Jawaban = [502, { galat: "Server siaran tidak bisa dihubungi." }];
const acak = (n = 4) => randomBytes(n).toString("hex");

function bacaJson(teks: string | undefined): Record<string, unknown> {
  try {
    return JSON.parse(teks || "{}");
  } catch {
    return {};
  }
}

/** Dibulatkan ke 2 desimal (~1 km): warga cukup tahu kira-kira di mana. */
const kasar = (n: number) => Math.round(n * 100) / 100;

/** POST /api/mobile/live/token — ruang baru + token pelapor (hanya menerbitkan).
 *  Syarat akun untuk siaran publik diperiksa rute. */
export async function tokenPelapor(isi: Record<string, unknown> | null, namaAkun: string | null): Promise<Jawaban> {
  const k = konfigurasi();
  if (!k) return BELUM_SIAP;

  const judul = String(isi?.judul ?? "").trim();
  if (!judul) return [422, { galat: "Tulis singkat apa yang sedang terjadi." }];
  if (judul.length > 255) return [422, { galat: "Judul maksimal 255 karakter." }];
  const anonim = isi?.anonim === true;
  const publik = isi?.publik === true;
  const nama = anonim ? "" : (String(isi?.nama ?? "").trim() || namaAkun || "").slice(0, 100);
  const titik = koordinat(String(isi?.lat ?? ""), String(isi?.lng ?? ""));
  const persis = titik && !("galat" in titik) ? titik : null;
  // Metadata ruang & atribut awal token terbaca semua penonton: ruang publik
  // hanya mendapat titik kasar.
  const lokasi = persis && publik ? { lat: kasar(persis.lat), lng: kasar(persis.lng) } : persis;

  const ruang = `siaran-${Date.now().toString(36)}-${acak(2)}`;
  try {
    await ruangan(k).createRoom({
      name: ruang,
      // Dibuang 2 menit setelah kosong; 30 detik setelah pelapor pergi.
      // Tanpa maxParticipants: kursi warga dibatasi tokenWarga (BATAS_WARGA).
      emptyTimeout: 120,
      departureTimeout: 30,
      metadata: JSON.stringify({ judul, nama: nama || null, anonim, publik, mulai: Date.now(), ...lokasi }),
    });
  } catch {
    return [502, { galat: "Server siaran tidak bisa dihubungi. Coba lagi nanti." }];
  }

  const at = new AccessToken(k.kunci, k.rahasia, {
    identity: `${AWALAN_PELAPOR}${acak()}`,
    name: nama || (anonim ? "Anonim" : "Warga"),
    attributes: lokasi ? { lat: String(lokasi.lat), lng: String(lokasi.lng) } : {},
    ttl: "2h",
  });
  // canSubscribe: menerima komentar, hati & hadiah (text stream). Penonton tidak
  // menerbitkan media, jadi pelapor tetap tidak menerima video/suara apa pun.
  at.addGrant({ room: ruang, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: true });
  return [200, { url: k.url, token: await at.toJwt(), ruang }];
}

type Siaran = {
  ruang: string; judul: string; nama: string; mulai: number;
  lat: number | null; lng: number | null; akurasi: number | null;
  publik: boolean; penonton: number;
  /** Akun berbeda yang melaporkan siaran ini dan laporannya belum ditinjau. */
  laporan: number;
};

/** Jumlah akun berbeda per ruang yang melaporkan siaran (status 'baru'). Laporan
 *  tamu tidak dihitung — IP murah diganti, akun tidak. */
async function pelaporSiaran(ruang: string[]): Promise<Map<string, number>> {
  const hitung = new Map<string, number>();
  if (ruang.length === 0) return hitung;
  const kelompok = await prisma.content_reports.groupBy({
    by: ["target_id", "reporter_user_id"],
    where: { jenis: "siaran", target_id: { in: ruang }, status: "baru", reporter_user_id: { not: null } },
  });
  for (const g of kelompok) hitung.set(g.target_id, (hitung.get(g.target_id) ?? 0) + 1);
  return hitung;
}

/** Siaran yang sedang berjalan (ada pelapor yang menerbitkan), terbaru dulu. */
async function siaranAktif(k: NonNullable<ReturnType<typeof konfigurasi>>): Promise<Siaran[] | null> {
  let semua;
  try {
    semua = await ruangan(k).listRooms();
  } catch {
    return null;
  }
  const aktif = semua.filter((r) => POLA_RUANG.test(r.name) && r.numPublishers > 0);
  // Basis data bermasalah tidak boleh mematikan siaran: anggap belum dilaporkan.
  const laporan = await pelaporSiaran(aktif.map((r) => r.name)).catch(() => new Map<string, number>());
  const hasil = await Promise.all(
    aktif.map(async (r): Promise<Siaran> => {
      const meta = bacaJson(r.metadata);
      const peserta = await ruangan(k).listParticipants(r.name).catch(() => []);
      const a = peserta.find((p) => p.identity.startsWith(AWALAN_PELAPOR))?.attributes ?? {};
      const angka = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
      return {
        ruang: r.name,
        judul: String(meta.judul ?? r.name),
        nama: String(peserta.find((p) => p.identity.startsWith(AWALAN_PELAPOR))?.name || meta.nama || "Warga"),
        mulai: Number(meta.mulai ?? Number(r.creationTime) * 1000),
        lat: angka(a.lat) ?? angka(meta.lat),
        lng: angka(a.lng) ?? angka(meta.lng),
        akurasi: angka(a.akurasi),
        publik: meta.publik === true,
        penonton: Math.max(0, r.numParticipants - 1),
        laporan: laporan.get(r.name) ?? 0,
      };
    }),
  );
  return hasil.sort((a, b) => b.mulai - a.mulai);
}

/**
 * siaranAktif yang dibagi ke semua permintaan (beranda & CMS) selama
 * SIMPAN_DAFTAR_MS, termasuk janji yang sedang berjalan — tanpa ini setiap
 * polling setiap HP memanggil 1 listRooms + 1 listParticipants per ruang ke
 * LiveKit. Kegagalan tidak disimpan. Per proses, cukup untuk satu container.
 *
 * Disimpan di globalThis, bukan variabel modul: Next membundel tiap rute
 * sendiri-sendiri, sehingga akhiriSiaran dari rute CMS tidak akan bisa
 * mengosongkan simpanan milik rute beranda.
 */
const simpanan = globalThis as { __daftarSiaran?: { sejak: number; janji: Promise<Siaran[] | null> } | null };
function siaranAktifSebentar(k: NonNullable<ReturnType<typeof konfigurasi>>): Promise<Siaran[] | null> {
  const ada = simpanan.__daftarSiaran;
  if (ada && Date.now() - ada.sejak <= SIMPAN_DAFTAR_MS) return ada.janji;
  const baru = { sejak: Date.now(), janji: siaranAktif(k).catch(() => null) };
  simpanan.__daftarSiaran = baru;
  void baru.janji.then((d) => {
    if (!d && simpanan.__daftarSiaran === baru) simpanan.__daftarSiaran = null;
  });
  return baru.janji;
}

/** Semua siaran, untuk CMS petugas (termasuk yang disembunyikan dari beranda). */
export async function daftarSiaran(): Promise<Jawaban> {
  const k = konfigurasi();
  if (!k) return BELUM_SIAP;
  const daftar = await siaranAktifSebentar(k);
  return daftar ? [200, daftar] : TAK_TERHUBUNG;
}

/** GET /api/mobile/live — siaran publik untuk beranda aplikasi, tanpa lokasi
 *  persis dan tanpa siaran yang sudah dilaporkan beberapa akun. */
export async function daftarSiaranPublik(): Promise<Jawaban> {
  const k = konfigurasi();
  if (!k) return [200, []]; // beranda tetap jalan tanpa server siaran
  const daftar = await siaranAktifSebentar(k);
  if (!daftar) return TAK_TERHUBUNG;
  return [
    200,
    daftar
      .filter((s) => s.publik && s.laporan < AMBANG_LAPORAN)
      .map((s) => ({
        ruang: s.ruang, judul: s.judul, nama: s.nama, mulai: s.mulai, penonton: s.penonton,
        lat: s.lat === null ? null : kasar(s.lat), lng: s.lng === null ? null : kasar(s.lng),
      })),
  ];
}

/** Ruang yang sedang disiarkan, atau jawaban galat. */
async function ruangHidup(
  k: NonNullable<ReturnType<typeof konfigurasi>>,
  ruang: string,
): Promise<{ ok: true; meta: Record<string, unknown> } | { ok: false; jawab: Jawaban }> {
  if (!POLA_RUANG.test(ruang)) return { ok: false, jawab: [400, { galat: "Siaran tidak dikenal." }] };
  try {
    const [r] = await ruangan(k).listRooms([ruang]);
    if (!r || r.numPublishers === 0) return { ok: false, jawab: [404, { galat: "Siaran sudah berakhir." }] };
    return { ok: true, meta: bacaJson(r.metadata) };
  } catch {
    return { ok: false, jawab: TAK_TERHUBUNG };
  }
}

const PENUH: Jawaban = [503, { galat: "Penonton siaran ini sedang penuh. Coba lagi sebentar lagi." }];

/**
 * POST /api/mobile/live/tonton { ruang } — token warga, tanpa menerbitkan
 * media. Dengan akun: komentar, hati, hadiah; tamu (akun null) hanya menonton.
 */
export async function tokenWarga(ruang: string, akun: { name: string } | null): Promise<Jawaban> {
  const k = konfigurasi();
  if (!k) return BELUM_SIAP;
  const r = await ruangHidup(k, ruang);
  if (!r.ok) return r.jawab;
  if (r.meta.publik !== true) return [403, { galat: "Siaran ini hanya untuk petugas." }];
  const laporan = await pelaporSiaran([ruang]).catch(() => new Map<string, number>());
  if ((laporan.get(ruang) ?? 0) >= AMBANG_LAPORAN) return [403, { galat: "Siaran ini sedang ditinjau petugas." }];

  // Kursi dihitung dari peserta yang benar-benar tersambung — numParticipants
  // listRooms tertinggal beberapa detik.
  let warga: number;
  try {
    warga = (await ruangan(k).listParticipants(ruang)).filter((p) => p.identity.startsWith(AWALAN_WARGA)).length;
  } catch {
    return TAK_TERHUBUNG;
  }
  if (warga >= BATAS_WARGA) return PENUH;
  // Token yang belum dipakai belum memakan kursi. Supaya tidak bisa ditimbun lalu
  // dipakai serentak, penerbitan per ruang dibatasi dan umurnya pendek — umur
  // token hanya berlaku untuk sambungan pertama; LiveKit memperbaruinya sendiri
  // selama peserta tersambung.
  if (await lewatBatas(`tonton-ruang:${ruang}`, BATAS_WARGA * 2, 120)) return PENUH;

  const at = new AccessToken(k.kunci, k.rahasia, { identity: `${AWALAN_WARGA}${acak()}`, name: akun?.name || "Warga", ttl: "2m" });
  at.addGrant({ room: ruang, roomJoin: true, canSubscribe: true, canPublish: false, canPublishData: akun !== null });
  return [200, { url: k.url, token: await at.toJwt() }];
}

/** Token petugas CMS untuk menonton siaran apa pun (pemanggil wajib memeriksa sesi CMS). */
export async function tokenPetugas(ruang: string, petugas: { id: number; nama: string }): Promise<Jawaban> {
  const k = konfigurasi();
  if (!k) return BELUM_SIAP;
  const r = await ruangHidup(k, ruang);
  if (!r.ok) return r.jawab;
  const at = new AccessToken(k.kunci, k.rahasia, { identity: `petugas-${petugas.id}-${acak(2)}`, name: petugas.nama, ttl: "1h" });
  at.addGrant({ room: ruang, roomJoin: true, canSubscribe: true, canPublish: false, canPublishData: true });
  return [200, { url: k.url, token: await at.toJwt() }];
}

/** Petugas menurunkan siaran (pemanggil wajib memeriksa sesi CMS): ruang
 *  dibubarkan dan semua peserta, termasuk pelapor, terputus. */
export async function akhiriSiaran(ruang: string): Promise<Jawaban> {
  const k = konfigurasi();
  if (!k) return BELUM_SIAP;
  if (!POLA_RUANG.test(ruang)) return [400, { galat: "Siaran tidak dikenal." }];
  try {
    await ruangan(k).deleteRoom(ruang);
  } catch (e) {
    // Ruang yang sudah bubar sendiri: tujuannya sudah tercapai.
    if (!(e instanceof ServerError && e.status === 404)) return TAK_TERHUBUNG;
  }
  simpanan.__daftarSiaran = null; // beranda & CMS langsung melihat siaran itu hilang
  return [200, { ok: true }];
}
