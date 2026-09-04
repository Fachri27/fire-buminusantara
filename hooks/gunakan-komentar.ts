"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Komentar } from "@/lib/komentar";

/** Site key Turnstile. Tanpa ini (development) widget tidak dirender dan
 *  verifikasi di server pun dilewati — sama seperti di Pasopati. */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type TurnstileInstance = {
  render: (wadah: HTMLElement, opsi: Record<string, unknown>) => number;
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
  const [nama, setNama] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem("komentar_nama") ?? "";
    } catch {
      return "";
    }
  });
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem("komentar_email") ?? "";
    } catch {
      return "";
    }
  });
  const [anonim, setAnonim] = useState(false);
  const [isi, setIsi] = useState("");
  const [balasKe, setBalasKe] = useState<number | null>(null);
  const [balasNama, setBalasNama] = useState("");
  const [dibuka, setDibuka] = useState<number[]>([]);
  const [website, setWebsite] = useState("");
  const [galat, setGalat] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");

  const [prevId, setPrevId] = useState(idLaporan);
  if (idLaporan !== prevId) {
    setPrevId(idLaporan);
    setMemuat(true);
    setGalat("");
    setBalasKe(null);
    setBalasNama("");
    setDibuka([]);
    setDaftar([]);
    setCaptchaToken("");
  }

  const ketikRef = useRef<HTMLTextAreaElement | null>(null);
  const captchaRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<number | null>(null);
  const sedangKirimRef = useRef(false);
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

  // Widget Turnstile dipasang sekali, mode explicit: kotak captcha tidak
  // ditampilkan sama sekali; token tetap dikirim & diperiksa di server.
  // Dibungkus useCallback supaya pemilik sheet (mobile) bisa memasang ulang
  // widgetnya setiap wadahnya di-mount kembali.
  const pasangCaptcha = useCallback(() => {
    if (!SITE_KEY) return;

    const pasang = () => {
      const wadah = captchaRef.current;
      const ts = turnstile();
      if (!wadah) return;
      if (!ts) {
        window.setTimeout(pasang, 100);
        return;
      }
      try {
        ts.remove(widgetRef.current);
      } catch {
        /* belum ada widget */
      }
      wadah.innerHTML = "";
      widgetRef.current = ts.render(wadah, {
        sitekey: SITE_KEY,
        appearance: "interaction-only",
        callback: (token: string) => setCaptchaToken(token),
        "expired-callback": () => {
          setCaptchaToken("");
          if (widgetRef.current !== null) {
            try {
              ts.reset(widgetRef.current);
            } catch {
              /* widget sudah lepas bersama pop-up yang ditutup */
            }
          }
        },
        "error-callback": () => {
          setCaptchaToken("");
          if (widgetRef.current !== null) {
            try {
              ts.reset(widgetRef.current);
            } catch {
              /* widget sudah lepas bersama pop-up yang ditutup */
            }
          }
        },
      });
    };

    pasang();
  }, []);

  // Token Turnstile sekali pakai: setelah dikirim — berhasil atau gagal —
  // widget harus meminta token baru.
  const ulangCaptcha = useCallback(() => {
    setCaptchaToken("");
    const ts = turnstile();
    if (ts && widgetRef.current !== null) {
      try {
        ts.reset(widgetRef.current);
      } catch {
        /* widget sudah lepas bersama pop-up yang ditutup */
      }
    }
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
    if (Boolean(SITE_KEY) && !captchaToken) {
      setGalat("Verifikasi keamanan belum siap. Tunggu sebentar dan coba lagi.");
      return;
    }
    sedangKirimRef.current = true;
    setMengirim(true);
    setGalat("");

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
    alamat, akarDari, anonim, batalBalas, balasKe, captchaToken,
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
    ketikRef, captchaRef, pasangCaptcha,
  };
}