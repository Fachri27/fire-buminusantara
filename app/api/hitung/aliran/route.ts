import { connection } from "next/server";
import { emberIp } from "@/lib/batas-laju";
import { berlanggananHitung, daftarId, type Hitung, hitungLangsung, umumkanHitung } from "@/lib/suka";
import { ipDari } from "@/lib/turnstile";

// Pola yang sama dengan app/api/admin/tunggakan/aliran (SSE, bukan WebSocket:
// satu arah, HTTP biasa, tanpa server kustom di samping `next start`), tetapi
// publik: hanya angka yang sudah tampil di umpan.

/** Aplikasi mengirim seluruh umpannya sekaligus (±125 kartu), bukan hanya yang terlihat. */
const MAKS_ID = 200;
/** Komentar keep-alive, di bawah batas idle 60 detik nginx & 100 detik Cloudflare. */
const DETAK_MS = 20_000;
/** Jaring pengaman: perubahan yang tidak diumumkan (moderasi CMS, hapus akun, replika lain). */
const JARING_MS = 60_000;
/** Atap aliran terbuka per proses, supaya rute publik ini tidak bisa menghabiskan memori/soket. */
const MAKS_ALIRAN = 2000;
/** Aliran terbuka serentak per IP (satu tab/aplikasi cukup satu); IP tak terbaca berbagi satu ember. */
const MAKS_PER_IP = 4;

let terbuka = 0;
const perIp = new Map<string, number>();
/**
 * id → jumlah aliran yang memantaunya. Jaring pengaman SATU untuk semua
 * aliran: tiap JARING_MS semua id yang dipantau diumumkan lewat loket
 * (umumkanHitung), yang menghitungnya sekali dan membagi hasilnya ke semua
 * aliran — bukan satu kueri per aliran.
 */
const pantauan = new Map<number, number>();
let jaring: ReturnType<typeof setInterval> | null = null;

/** Kurangi hitungan satu kunci; yang nol dihapus supaya Map tidak tumbuh. */
function kurangi<K>(peta: Map<K, number>, kunci: K) {
  const n = (peta.get(kunci) ?? 1) - 1;
  if (n > 0) peta.set(kunci, n);
  else peta.delete(kunci);
}

/**
 * GET /api/hitung/aliran?id=1,2,3 → text/event-stream. Pesan pertama memuat
 * angka semua id; sesudahnya hanya id yang angkanya berubah. Bentuk `data`
 * sama dengan /api/hitung: { [id]: { suka, komentar } }.
 */
export async function GET(req: Request) {
  await connection();
  const ids = daftarId(new URL(req.url).searchParams.get("id"), MAKS_ID);
  if (ids.length === 0) return Response.json({ galat: "id wajib diisi." }, { status: 400 });
  if (terbuka >= MAKS_ALIRAN) {
    return Response.json({ galat: "Server sedang sibuk." }, { status: 503, headers: { "Retry-After": "60" } });
  }
  const ember = emberIp("aliran", ipDari(req), MAKS_PER_IP);
  if ((perIp.get(ember.kunci) ?? 0) >= ember.batas) {
    return Response.json({ galat: "Terlalu banyak aliran dari jaringan ini." }, { status: 429, headers: { "Retry-After": "60" } });
  }
  terbuka++;
  perIp.set(ember.kunci, (perIp.get(ember.kunci) ?? 0) + 1);
  for (const id of ids) pantauan.set(id, (pantauan.get(id) ?? 0) + 1);
  jaring ??= setInterval(() => {
    for (const id of pantauan.keys()) umumkanHitung(id);
  }, JARING_MS);

  const penyandi = new TextEncoder();
  const dipantau = new Set(ids);
  /** id → "suka,komentar" terakhir yang dikirim ke aliran ini. */
  const terkirim = new Map<number, string>();
  let hidup = true;
  let tutup = () => {};

  const aliran = new ReadableStream<Uint8Array>({
    start(kendali) {
      const tulis = (teks: string) => {
        if (!hidup) return;
        try {
          kendali.enqueue(penyandi.encode(teks));
        } catch {
          tutup();
        }
      };

      const kirimBeda = (angka: Record<number, Hitung>) => {
        const beda: Record<number, Hitung> = {};
        let ada = false;
        for (const [kunci, h] of Object.entries(angka)) {
          const id = Number(kunci);
          const jejak = `${h.suka},${h.komentar}`;
          if (!dipantau.has(id) || terkirim.get(id) === jejak) continue;
          terkirim.set(id, jejak);
          beda[id] = h;
          ada = true;
        }
        if (ada) tulis(`data: ${JSON.stringify(beda)}\n\n`);
      };

      const muatSemua = async () => {
        try {
          kirimBeda(await hitungLangsung(ids));
        } catch {
          // Database sesaat tak terjangkau bukan alasan memutus aliran.
        }
      };

      const lepasLangganan = berlanggananHitung(kirimBeda);
      const detak = setInterval(() => tulis(": detak\n\n"), DETAK_MS);

      tutup = () => {
        if (!hidup) return;
        hidup = false;
        terbuka--;
        kurangi(perIp, ember.kunci);
        for (const id of ids) kurangi(pantauan, id);
        if (terbuka === 0 && jaring) {
          clearInterval(jaring);
          jaring = null;
        }
        lepasLangganan();
        clearInterval(detak);
        req.signal.removeEventListener("abort", tutup);
        try {
          kendali.close();
        } catch {}
      };

      req.signal.addEventListener("abort", tutup);
      void muatSemua();
    },
    cancel() {
      tutup();
    },
  });

  return new Response(aliran, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
