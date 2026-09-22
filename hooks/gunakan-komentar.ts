"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Komentar } from "@/lib/komentar";

/** Site key Turnstile. Tanpa ini (development) widget tidak dirender dan
 *  verifikasi di server pun dilewati — sama seperti di Pasopati. */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type TurnstileInstance = {
  render: (wadah: HTMLElement, opsi: Record<string, unknown>) => number;
  execute: (wadah: HTMLElement, opsi?: Record<string, unknown>) => void;
  reset: (id: number) => void;
  remove: (id: number | null) => void;
};

type WindowTurnstile = Window & { turnstile?: TurnstileInstance };

function turnstile(): TurnstileInstance | null {
  return (window as WindowTurnstile).turnstile ?? null;
}

/** Padanan Alpine komentarLaporan() di beranda.js proyek Pasopati: kolom
 *  komentar pada pop-up rincian, digerakkan sendiri lewat endpoint JSON yang
 *  sama, tanpa Livewire. */
export function gunakanKomentar(idLaporan: number) {
  const [daftar, setDaftar] = useState<Komentar[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [anonim, setAnonim] = useState(false);
  const [isi, setIsi] = useState("");
  const [balasKe, setBalasKe] = useState<number | null>(null);
  const [balasNama, setBalasNama] = useState("");

  /**
   * Identitas pengisi komentar dipulihkan SESUDAH hidrasi, bukan di dalam
   * inisialisasi useState.
   *
   * Inisialisasi lazy useState ikut berjalan pada render hidrasi di klien, jadi
   * membaca localStorage di sana membuat klien merender nama tersimpan
   * sementara server merender kosong — dan React membuang seluruh pohon itu
   * dengan "Hydration failed because the server rendered text didn't match"
   * (inisial "F" lawan "?" di kolom komentar). Menaruhnya di useEffect membuat
   * render pertama identik dengan server, lalu nilainya terisi sepersekian
   * detik kemudian.
   */
  useEffect(() => {
    try {
      const namaTersimpan = localStorage.getItem("komentar_nama");
      const emailTersimpan = localStorage.getItem("komentar_email");
      if (namaTersimpan) setNama(namaTersimpan);
      if (emailTersimpan) setEmail(emailTersimpan);
    } catch {
      // localStorage bisa ditolak (mode privat, kuki diblokir) — biarkan kosong.
    }
  }, []);
  const [dibuka, setDibuka] = useState<number[]>([]);
  const [website, setWebsite] = useState("");
  const [galat, setGalat] = useState("");

  const [prevId, setPrevId] = useState(idLaporan);
  if (idLaporan !== prevId) {
    setPrevId(idLaporan);
    setMemuat(true);
    setGalat("");
    setBalasKe(null);
    setBalasNama("");
    setDibuka([]);
    setDaftar([]);
  }

  const ketikRef = useRef<HTMLTextAreaElement | null>(null);
  const wadahRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<number | null>(null);
  const sedangKirimRef = useRef(false);
  // Kiriman yang sedang menunggu token dari execute(); dibangunkan callback widget.
  const penungguToken = useRef<((token: string) => void)[]>([]);
  const currentIdRef = useRef(idLaporan);

  useEffect(() => {
    currentIdRef.current = idLaporan;
  }, [idLaporan]);

  // Bersihkan widget Turnstile saat hook unmount (pop-up ditutup)
  useEffect(() => {
    return () => {
      const ts = turnstile();
      if (ts && widgetRef.current !== null) {
        try {
          ts.remove(widgetRef.current);
        } catch {}
        widgetRef.current = null;
      }
    };
  }, []);

  const alamat = `/api/laporan/${idLaporan}/komentar`;

  const batalBalas = useCallback(() => {
    setBalasKe(null);
    setBalasNama("");
  }, []);

  // Ambil komentar laporan ini
  useEffect(() => {
    let batal = false;

    fetch(alamat, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { komentar?: Komentar[] }) => {
        if (batal) return;
        setDaftar(data.komentar ?? []);
        setMemuat(false);
      })
      .catch(() => {
        if (batal) return;
        setMemuat(false);
        setGalat("Komentar gagal dimuat. Coba muat ulang halaman.");
      });

    return () => {
      batal = true;
    };
  }, [alamat]);

  // Reset widget Turnstile saat ganti laporan
  useEffect(() => {
    const ts = turnstile();
    if (ts && widgetRef.current !== null) {
      try {
        ts.reset(widgetRef.current);
      } catch {
        /* widget sudah lepas bersama pop-up yang ditutup */
      }
    }
  }, [idLaporan]);

  /** Buang widget yang sedang menempel, apa pun keadaannya. `remove` pada id
   *  yang sudah mati itulah yang membuat Turnstile mengeluh di konsol
   *  ("Cannot find Widget …", "Nothing to remove found…"), jadi id-nya selalu
   *  dinolkan di sini — sekali lepas, ia tak boleh dipakai lagi. */
  const lepasWidget = useCallback(() => {
    const ts = turnstile();
    if (ts && widgetRef.current !== null) {
      try {
        ts.remove(widgetRef.current);
      } catch {
        /* sudah lepas bersama wadahnya */
      }
    }
    widgetRef.current = null;
  }, []);

  /* Wadah captcha adalah CALLBACK REF, bukan useRef.

     Widget Turnstile hidup menempel pada satu simpul DOM, jadi siklus hidupnya
     harus mengikuti simpul itu: dipasang saat simpulnya lahir, dibuang saat
     simpulnya lepas. Dengan useRef biasa pemiliknya tak pernah tahu kapan
     wadahnya berganti — desktop dan sheet ponsel memakai dua <div> berbeda
     untuk satu ref yang sama, dan formulir komentar juga di-mount ulang tiap
     pop-up rincian dibuka. Widget lama pun tertinggal di DOM yang sudah
     dibuang, dan setiap reset/remove berikutnya menembak id mati.

     Mode explicit dengan appearance "interaction-only": kotak captcha tidak
     tampil sama sekali; token tetap dikirim & diperiksa di server. */
  const captchaRef = useCallback(
    (wadah: HTMLDivElement | null) => {
      wadahRef.current = wadah;
      lepasWidget();
      if (!wadah || !SITE_KEY) return;

      const pasang = () => {
        // Skrip Turnstile bisa belum termuat, dan dalam penantian itu wadahnya
        // bisa sudah dilepas React — jangan menempel ke simpul yang hilang.
        if (wadahRef.current !== wadah) return;
        const ts = turnstile();
        if (!ts) {
          window.setTimeout(pasang, 100);
          return;
        }
        widgetRef.current = ts.render(wadah, {
          sitekey: SITE_KEY,
          appearance: "interaction-only",
          // Tantangan BARU dijalankan saat kirim (lihat ambilToken), bukan saat
          // formulir dibuka: token Turnstile berumur 5 menit, dan formulir yang
          // dibuka lalu didiamkan selalu mengirim token yang sudah basi.
          execution: "execute",
          callback: (token: string) => {
            penungguToken.current.splice(0).forEach((bangun) => bangun(token));
          },
          "expired-callback": () => {
            const t = turnstile();
            if (t && widgetRef.current !== null) {
              try {
                t.reset(widgetRef.current);
              } catch {
                /* widget sudah lepas */
              }
            }
          },
          "error-callback": () => {
            // Jangan gantungkan kiriman yang menunggu: token kosong = gagal.
            penungguToken.current.splice(0).forEach((bangun) => bangun(""));
            const t = turnstile();
            if (t && widgetRef.current !== null) {
              try {
                t.reset(widgetRef.current);
              } catch {
                /* widget sudah lepas */
              }
            }
          },
        });
      };

      pasang();
    },
    [lepasWidget],
  );

  // Token Turnstile sekali pakai: setelah dikirim — berhasil atau gagal —
  // widget harus meminta token baru.
  const ulangCaptcha = useCallback(() => {
    const ts = turnstile();
    if (ts && widgetRef.current !== null) {
      try {
        ts.reset(widgetRef.current);
      } catch {
        /* widget sudah lepas bersama pop-up yang ditutup */
      }
    }
  }, []);

  /** Jalankan tantangan Turnstile SEKARANG dan tunggu tokennya.
   *
   *  Dulu token diminta saat formulir dibuka dan kiriman ditolak kalau ia belum
   *  tiba ("Verifikasi keamanan belum siap") — padahal yang kurang cuma waktu.
   *  Sekarang tantangan baru berjalan di detik kirim; token kosong berarti
   *  benar-benar gagal, bukan sekadar belum sempat. */
  const ambilToken = useCallback(async (): Promise<string> => {
    if (!SITE_KEY) return "";
    // Skrip Turnstile bisa masih dimuat saat tombol ditekan; wadahnya memasang
    // widget lewat polling 100ms, jadi tunggu sebentar alih-alih menolak.
    for (let i = 0; widgetRef.current === null && i < 50; i++) {
      await new Promise((lanjut) => window.setTimeout(lanjut, 100));
    }
    const ts = turnstile();
    const wadah = wadahRef.current;
    // execute() menerima WADAH-nya, bukan id widget (lihat dokumentasi
    // client-side rendering Turnstile).
    if (!ts || !wadah || widgetRef.current === null) return "";

    return new Promise<string>((selesai) => {
      const bangun = (token: string) => {
        window.clearTimeout(jam);
        selesai(token);
      };
      const jam = window.setTimeout(() => {
        penungguToken.current = penungguToken.current.filter((f) => f !== bangun);
        selesai("");
      }, 20_000);
      penungguToken.current.push(bangun);
      try {
        ts.execute(wadah);
      } catch {
        bangun("");
      }
    });
  }, []);

  // Saat mulai membalas, fokus dipindah ke kolom ketik yang ada di ujung lain
  // rel, supaya tidak perlu dicari sendiri.
  useEffect(() => {
    if (balasKe === null) return;
    const kolom = ketikRef.current;
    if (!kolom) return;
    kolom.focus();
    kolom.setSelectionRange(kolom.value.length, kolom.value.length);
  }, [balasKe]);

  // Akar dari sebuah komentar: id itu sendiri bila ia akar, atau id akar yang
  // menaunginya bila ia balasan.
  const akarDari = useCallback(
    (id: number | null): number | null => {
      if (!id) return null;
      for (const k of daftar) {
        if (k.id === id) return k.id;
        if ((k.balasan ?? []).some((b) => b.id === id)) return k.id;
      }
      return null;
    },
    [daftar],
  );

  const tampilkanBalasan = useCallback(
    (akarId: number) => dibuka.includes(akarId),
    [dibuka],
  );

  const alihkanBalasan = useCallback((akarId: number) => {
    setDibuka((d) => (d.includes(akarId) ? d.filter((x) => x !== akarId) : [...d, akarId]));
  }, []);

  const mulaiBalas = useCallback((k: Komentar) => {
    setBalasKe(k.id);
    setBalasNama(k.nama);
  }, []);

  // Sebutan diambil dari data (`sebutan`), bukan dari teks yang diketik.
  const sebutanDari = useCallback(
    (k: Komentar) => (k.sebutan ? `@${k.sebutan}` : null),
    [],
  );

  // Kalau teksnya sendiri sudah diawali sebutan yang sama, awalan itu dipangkas
  // supaya tidak tampil dua kali.
  const isiTanpaSebutan = useCallback((k: Komentar) => {
    const awalan = k.sebutan ? `@${k.sebutan}` : null;
    if (!awalan || !k.isi.startsWith(awalan)) return k.isi;
    return k.isi.slice(awalan.length).replace(/^\s+/, "");
  }, []);

  const kirim = useCallback(async () => {
    if (sedangKirimRef.current || mengirim || !isi.trim()) return;
    sedangKirimRef.current = true;
    setMengirim(true);
    setGalat("");

    const captchaToken = await ambilToken();
    if (SITE_KEY && !captchaToken) {
      sedangKirimRef.current = false;
      setMengirim(false);
      ulangCaptcha();
      setGalat("Verifikasi keamanan gagal. Coba kirim lagi.");
      return;
    }

    const targetId = idLaporan;
    let respon: {
      komentar?: Komentar[];
      message?: string;
      errors?: Record<string, string>;
    } | null = null;

    try {
      const r = await fetch(alamat, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          nama: anonim ? "" : nama,
          email: anonim ? "" : email,
          anonim,
          isi,
          balas_ke: balasKe,
          website,
          captcha: captchaToken,
        }),
      });
      respon = (await r.json().catch(() => null)) ?? null;
      if (!r.ok) throw respon;
    } catch (gagal) {
      sedangKirimRef.current = false;
      setMengirim(false);
      ulangCaptcha();
      // Pesan validasi dulu, lalu `message`, baru pesan umum — sama seperti
      // versi Alpine memilih dari data.errors → data.message.
      const data = (gagal as
        | { message?: string; errors?: Record<string, string> }
        | null) ?? respon;
      let pesan: string | null = null;
      if (data && data.errors) pesan = Object.values(data.errors)[0];
      else if (data && data.message) pesan = data.message;
      setGalat(pesan ?? "Komentar gagal dikirim. Coba lagi.");
      return;
    }

    sedangKirimRef.current = false;
    setMengirim(false);
    ulangCaptcha();

    // Cegah kontaminasi komentar jika pengguna berpindah laporan sebelum respons tiba
    if (currentIdRef.current !== targetId) return;

    // Balasan baru dibuka otomatis — kalau tidak, kirimannya sendiri tidak
    // kelihatan karena utasnya masih tertutup.
    const akar = akarDari(balasKe);
    setDaftar(respon?.komentar ?? []);
    setIsi("");
    batalBalas();
    if (akar !== null) {
      setDibuka((d) => (d.includes(akar) ? d : [...d, akar]));
    }
    try {
      // Identitas anonim tidak pernah disimpan — pilihan anonim memang untuk
      // tidak meninggalkan jejak nama di perangkat ini.
      if (!anonim) {
        localStorage.setItem("komentar_nama", nama);
        localStorage.setItem("komentar_email", email);
      }
    } catch {
      /* storage mungkin diblokir */
    }
  }, [
    alamat, akarDari, ambilToken, anonim, batalBalas, balasKe,
    email, idLaporan, isi, mengirim, nama, ulangCaptcha, website,
  ]);

  return {
    daftar, memuat, mengirim, galat,
    nama, setNama,
    email, setEmail,
    anonim, setAnonim,
    isi, setIsi,
    website, setWebsite,
    balasKe, balasNama,
    batalBalas, mulaiBalas,
    tampilkanBalasan, alihkanBalasan,
    sebutanDari, isiTanpaSebutan,
    kirim,
    ketikRef, captchaRef,
  };
}