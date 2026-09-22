"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/** Jarak (px) sebelum arah geseran diputuskan — di bawahnya masih ketukan. */
const AMBANG_ARAH = 8;
/** Bagian tinggi panel yang harus dilewati jari supaya laporan berganti. */
const AMBANG_JARAK = 0.18;
/** Kecepatan lepas (px/ms) yang cukup untuk berganti walau jaraknya pendek. */
const AMBANG_LAJU = 0.4;
/** Rentang (ms) sampel jari yang dipakai menghitung laju saat dilepas. */
const JENDELA_LAJU = 100;
/** Batas durasi luncuran pindah laporan — durasi pastinya dari laju jari. */
const DURASI_MIN = 200;
const DURASI_MAKS = 380;
const DURASI_BALIK = 320;
const KURVA_BALIK = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Kunci sessionStorage: intipan pengenal cukup sekali per sesi. */
const KUNCI_INTIP = "rincian-geser-dikenalkan";

type Opsi = {
  /** false = gestur mati (desktop, lembar komentar terbuka, dsb.). */
  aktif: boolean;
  /** Identitas laporan yang tampil — berubah = perpindahan selesai. */
  kunci: number;
  onSebelumnya?: () => void;
  onBerikutnya?: () => void;
  kurangiGerak: boolean;
};

/**
 * Geser vertikal antar-laporan di ponsel, seperti umpan video pendek: geser
 * ke atas membuka laporan berikutnya, ke bawah yang sebelumnya.
 *
 * Panel mengikuti jari dan pratinjau laporan tetangga ikut naik dari tepi
 * layar. Saat dilepas melewati ambang, panel dan pratinjaunya meluncur satu
 * layar penuh; begitu induk mengganti laporannya, semuanya dikembalikan ke
 * posisi nol tanpa transisi — pratinjau yang tadi memenuhi layar digantikan
 * panel asli di tempat yang sama, jadi pergantiannya tidak terlihat.
 *
 * Transform ditulis langsung ke gaya elemen, bukan lewat state React: satu
 * render per touchmove membuat geseran tersendat di ponsel kelas bawah.
 *
 * Mengembalikan empat ref untuk dipasang pemanggil: panel (yang mengikuti
 * jari), rel (yang bergulir sendiri di ponsel — geseran di dalamnya baru
 * dipakai pindah laporan bila gulirnya sudah mentok di tepi searah), dan dua
 * pratinjau tetangga yang menempel di atas/bawah panel.
 */
export function gunakanGeserLaporan({
  aktif, kunci, onSebelumnya, onBerikutnya, kurangiGerak,
}: Opsi) {
  const panelRef = useRef<HTMLDivElement>(null);
  const relRef = useRef<HTMLDivElement>(null);
  const hantuAtasRef = useRef<HTMLDivElement>(null);
  const hantuBawahRef = useRef<HTMLDivElement>(null);

  // Callback terbaru disimpan di ref supaya pendengar sentuh tidak perlu
  // dipasang ulang tiap render induk.
  const navRef = useRef({ onSebelumnya, onBerikutnya, kurangiGerak });
  useLayoutEffect(() => {
    navRef.current = { onSebelumnya, onBerikutnya, kurangiGerak };
  });

  /** true selama panel meluncur keluar dan menunggu laporan baru. */
  const pindahRef = useRef(false);
  const cadanganRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Laporan baru tiba: kembalikan panel dan pratinjau ke nol seketika, dan
  // mulai rel dari atas — sisa gulir laporan lama tak ada artinya di sini.
  useLayoutEffect(() => {
    if (cadanganRef.current) clearTimeout(cadanganRef.current);
    pindahRef.current = false;
    tulis(0, "none");
    if (relRef.current) relRef.current.scrollTop = 0;
    // Pratinjau meniru kepala panel (baris tanggal + tombol). Tingginya
    // bergantung pada ukuran tombol dan huruf, jadi diukur dari panel asli —
    // selisih beberapa piksel saja sudah terlihat sebagai judul yang melompat
    // ketika pratinjau digantikan panelnya.
    const kepala = panelRef.current?.querySelector<HTMLElement>(".rincian__kepala");
    if (kepala?.offsetHeight) {
      panelRef.current?.parentElement?.style.setProperty("--tinggi-kepala", `${kepala.offsetHeight}px`);
    }
  }, [kunci]);

  function tulis(geser: number, transisi: string) {
    const panel = panelRef.current;
    if (!panel) return;
    const t = `translate3d(0, ${geser}px, 0)`;
    panel.style.transition = transisi;
    panel.style.transform = geser === 0 && transisi === "none" ? "" : t;
    for (const [el, dasar] of [[hantuAtasRef.current, "-100%"], [hantuBawahRef.current, "100%"]] as const) {
      if (!el) continue;
      el.style.transition = transisi;
      el.style.transform = `translate3d(0, calc(${dasar} + ${geser}px), 0)`;
    }
  }

  useEffect(() => {
    const panel = panelRef.current;
    if (!aktif || !panel) return;

    let awal: { x: number; y: number; target: EventTarget | null } | null = null;
    let keadaan: "tunggu" | "geser" | "lepas" = "tunggu";
    /** dy saat geseran dikunci — dikurangkan supaya panel mulai dari 0,
     *  bukan meloncat sejauh zona mati AMBANG_ARAH. */
    let titikKunci = 0;
    let geser = 0;
    // Sampel posisi jari dalam JENDELA_LAJU terakhir, untuk laju saat dilepas.
    let jejak: { y: number; t: number }[] = [];
    let bingkai = 0;

    const relMentok = (arahJari: number) => {
      const rel = relRef.current;
      if (!rel || !(awal?.target instanceof Node) || !rel.contains(awal.target)) return true;
      // Jari naik (arahJari < 0) = menggulir ke bawah: hanya boleh pindah bila
      // rel sudah di dasar. Jari turun = menggulir ke atas: rel harus di puncak.
      if (arahJari < 0) return rel.scrollTop + rel.clientHeight >= rel.scrollHeight - 1;
      return rel.scrollTop <= 0;
    };

    const mulai = (e: TouchEvent) => {
      if (pindahRef.current || e.touches.length !== 1) { awal = null; return; }
      const el = e.target as HTMLElement | null;
      // Kolom isian menangani geserannya sendiri.
      if (el?.closest("input, textarea, select, [contenteditable]")) { awal = null; return; }
      const s = e.touches[0];
      awal = { x: s.clientX, y: s.clientY, target: e.target };
      keadaan = "tunggu";
      geser = 0;
      jejak = [{ y: s.clientY, t: e.timeStamp }];
    };

    const gerak = (e: TouchEvent) => {
      if (!awal || keadaan === "lepas") return;
      const s = e.touches[0];
      const dx = s.clientX - awal.x;
      const dy = s.clientY - awal.y;

      if (keadaan === "tunggu") {
        const tegak = dy !== 0 && Math.abs(dy) >= Math.abs(dx);
        // preventDefault SEJAK gerakan pertama, bukan setelah zona mati:
        // begitu peramban sempat mulai menggulir rel, touchmove berikutnya
        // tak bisa dibatalkan lagi (cancelable=false) — gulir rel dan pantulan
        // iOS lalu berebut dengan panel, dan itulah yang terasa tersendat.
        if (tegak && relMentok(dy) && e.cancelable) e.preventDefault();
        if (Math.hypot(dx, dy) < AMBANG_ARAH) return;
        // Geseran mendatar milik slider media; geseran tegak di rel yang masih
        // bisa bergulir milik rel itu sendiri.
        if (!tegak || !relMentok(dy)) { keadaan = "lepas"; return; }
        keadaan = "geser";
        titikKunci = dy;
      }

      if (e.cancelable) e.preventDefault();
      const { onSebelumnya: sebelum, onBerikutnya: berikut } = navRef.current;
      const jarak = dy - titikKunci;
      const adaTujuan = jarak < 0 ? !!berikut : !!sebelum;
      // Tanpa tetangga di arah itu panel hanya melar sedikit lalu kembali —
      // tanda bahwa daftarnya sudah habis, bukan gestur yang macet.
      geser = adaTujuan ? jarak : jarak * 0.22;
      jejak.push({ y: s.clientY, t: e.timeStamp });
      while (jejak.length > 2 && e.timeStamp - jejak[0].t > JENDELA_LAJU) jejak.shift();
      // Satu tulisan per bingkai layar: touchmove bisa datang lebih rapat dari
      // refresh rate, dan menulis transform di antaranya hanya membuang kerja.
      if (!bingkai) {
        bingkai = requestAnimationFrame(() => { bingkai = 0; tulis(geser, "none"); });
      }
    };

    const selesai = (e: TouchEvent) => {
      if (!awal) return;
      const berlaku = keadaan === "geser";
      awal = null;
      if (!berlaku) return;
      if (bingkai) { cancelAnimationFrame(bingkai); bingkai = 0; }

      const { onSebelumnya: sebelum, onBerikutnya: berikut, kurangiGerak: tenang } = navRef.current;
      const tinggi = panel.clientHeight || window.innerHeight;
      // Laju jari (px/ms) dalam jendela terakhir. Jari yang sempat diam sebelum
      // diangkat dihitung lajunya nol — bukan jentikan.
      const akhir = jejak[jejak.length - 1];
      const pertama = jejak[0];
      const laju = e.timeStamp - akhir.t > 80 || akhir.t === pertama.t
        ? 0
        : (akhir.y - pertama.y) / (akhir.t - pertama.t);
      const tujuan = geser < 0 ? berikut : sebelum;
      const searah = Math.sign(laju) === Math.sign(geser);
      const cukup = Math.abs(geser) > tinggi * AMBANG_JARAK ||
        (Math.abs(laju) > AMBANG_LAJU && Math.abs(geser) > 24 && searah);

      if (e.type === "touchend" && tujuan && cukup) {
        pindahRef.current = true;
        const pindah = () => {
          tujuan();
          // Induk tidak mengganti laporannya (mis. daftar berubah di tengah
          // jalan): pulihkan panel daripada membiarkannya di luar layar.
          // Laporan yang benar-benar berganti membatalkan timer ini lewat
          // efek [kunci] di atas.
          cadanganRef.current = setTimeout(() => {
            pindahRef.current = false;
            tulis(0, tenang ? "none" : `transform ${DURASI_BALIK}ms ${KURVA_BALIK}`);
          }, 400);
        };
        if (tenang) { tulis(0, "none"); pindah(); return; }

        // Luncuran MENERUSKAN laju jari, bukan mulai dari nol dengan kurva
        // tetap: durasinya = sisa jarak ÷ laju (dibatasi), dan kemiringan awal
        // kurvanya disetel supaya kecepatan di bingkai pertama sama dengan
        // kecepatan jari saat diangkat. Jentikan cepat tetap cepat, seretan
        // pelan meluncur tenang.
        const sisa = tinggi - Math.abs(geser);
        const v = searah ? Math.abs(laju) : 0;
        const durasi = Math.round(Math.min(DURASI_MAKS, Math.max(DURASI_MIN, v > 0 ? (sisa / v) * 1.6 : DURASI_MAKS)));
        const miring = v > 0 ? (v * durasi) / Math.max(sisa, 1) : 0;
        const y1 = Math.min(1, Math.max(0.3, 0.3 * miring));
        tulis(geser < 0 ? -tinggi : tinggi, `transform ${durasi}ms cubic-bezier(0.3, ${y1.toFixed(3)}, 0.3, 1)`);
        cadanganRef.current = setTimeout(pindah, durasi);
        return;
      }
      tulis(0, tenang ? "none" : `transform ${DURASI_BALIK}ms ${KURVA_BALIK}`);
    };

    panel.addEventListener("touchstart", mulai, { passive: true });
    // passive:false — preventDefault di sini yang menahan rel ikut bergulir
    // selama panel sedang diseret.
    panel.addEventListener("touchmove", gerak, { passive: false });
    panel.addEventListener("touchend", selesai);
    panel.addEventListener("touchcancel", selesai);
    return () => {
      if (bingkai) cancelAnimationFrame(bingkai);
      panel.removeEventListener("touchstart", mulai);
      panel.removeEventListener("touchmove", gerak);
      panel.removeEventListener("touchend", selesai);
      panel.removeEventListener("touchcancel", selesai);
    };
  }, [aktif]);

  useEffect(() => () => {
    if (cadanganRef.current) clearTimeout(cadanganRef.current);
  }, []);

  // Pengenalan sekali per sesi: panel terangkat sebentar memperlihatkan
  // laporan berikutnya di bawahnya, lalu turun lagi. Tanpa ini geseran
  // tegak tidak tertebak — tak ada tombol yang menandainya di ponsel.
  useEffect(() => {
    if (!aktif || kurangiGerak || !onBerikutnya) return;
    try {
      if (sessionStorage.getItem(KUNCI_INTIP)) return;
    } catch {
      return;
    }
    // Tanda "sudah dikenalkan" ditulis saat intipannya benar-benar jalan,
    // bukan saat efek dipasang — efek yang dibongkar sebelum 900ms (mode
    // ketat React, panel yang langsung ditutup) tak boleh menghanguskannya.
    const naik = setTimeout(() => {
      if (pindahRef.current) return;
      try { sessionStorage.setItem(KUNCI_INTIP, "1"); } catch { /* tak apa */ }
      tulis(-72, `transform 420ms ${KURVA_BALIK}`);
    }, 900);
    const turun = setTimeout(() => {
      if (!pindahRef.current) tulis(0, `transform 520ms ${KURVA_BALIK}`);
    }, 1500);
    return () => { clearTimeout(naik); clearTimeout(turun); };
    // Sekali saat gestur pertama kali aktif; kunci sengaja tak ikut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktif, kurangiGerak]);

  return { panelRef, relRef, hantuAtasRef, hantuBawahRef };
}
