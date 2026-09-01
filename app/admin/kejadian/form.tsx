"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { PetaLokasi } from "../peta-lokasi";
import { BilahUnggah } from "@/components/bilah-unggah";
import { DatePicker } from "@/components/ui/date-picker";
import type { ItemMedia } from "@/lib/media";

export type NilaiAwal = {
  id?: number;
  title_id: string; title_en: string; slug: string;
  description_id: string; description_en: string;
  event_date: string; location: string;
  location_lat: string; location_lng: string;
  orientation: string;
  /** Galeri yang sudah tersimpan, urut sama dengan indeks `keep_media`. */
  galeri: ItemMedia[];
};

type Lokasi = { id: string; nama: string; lat: number; lng: number };

function buatSlug(teks: string): string {
  return teks
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 200);
}

/**
 * Form kejadian. Satu komponen untuk tambah maupun ubah — bedanya cuma nilai
 * awal dan tombolnya, jadi memisahkannya hanya akan menggandakan aturan
 * validasi dan pencarian lokasi.
 *
 * Isinya dibagi tiga bagian bernama sesuai urutan kerja seorang editor:
 * menulis laporannya, menaruh waktu & tempatnya, lalu melampirkan medianya.
 */
export function FormKejadian({
  awal, aksi, sedangUbah,
}: {
  awal: NilaiAwal;
  aksi: (data: FormData) => void;
  sedangUbah: boolean;
}) {
  const [judulId, setJudulId] = useState(awal.title_id);
  const [slug, setSlug] = useState(awal.slug);
  const [slugManual, setSlugManual] = useState(Boolean(awal.slug));
  const [lokasi, setLokasi] = useState(awal.location);
  const [lat, setLat] = useState(awal.location_lat);
  const [lng, setLng] = useState(awal.location_lng);
  const [hasil, setHasil] = useState<Lokasi[]>([]);
  const [mencari, setMencari] = useState(false);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [habis, setHabis] = useState(false);

  // Hasil dibagi 10 halaman; menggulir ke dasar daftar mengambil halaman
  // berikutnya. `permintaan` membuang jawaban yang sudah ketinggalan ketika
  // pengguna terus mengetik.
  const BAGI = 10;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const permintaan = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function ambil(kata: string, geser: number) {
    const id = ++permintaan.current;
    if (geser === 0) setMencari(true); else setMemuatLagi(true);
    try {
      const r = await fetch(`/api/lokasi?q=${encodeURIComponent(kata)}&offset=${geser}`);
      const baru: Lokasi[] = r.ok ? (await r.json()).hasil ?? [] : [];
      if (id !== permintaan.current) return;
      setHasil((lama) => (geser === 0 ? baru : [...lama, ...baru]));
      setHabis(baru.length < BAGI);
    } catch {
      if (id === permintaan.current) { setHasil(geser === 0 ? [] : (lama) => lama); setHabis(true); }
    } finally {
      if (id === permintaan.current) { setMencari(false); setMemuatLagi(false); }
    }
  }

  function cariLokasi(kata: string) {
    clearTimeout(timer.current);
    const t = kata.trim();
    if (t.length < 2) { setHasil([]); setHabis(false); return; }
    // Ditunda sedikit supaya setiap ketikan tidak menembolok database jauh.
    timer.current = setTimeout(() => ambil(t, 0), 300);
  }

  return (
    <form action={aksi}>
      <Bagian nomor="01" judul="Laporan">
        <Isian
          label="Judul (ID)"
          nama="title_id"
          wajib
          value={judulId}
          onChange={(e) => {
            const v = e.target.value;
            setJudulId(v);
            if (!slugManual) {
              setSlug(buatSlug(v));
            }
          }}
        />
        <Isian label="Judul (EN)" nama="title_en" wajib nilai={awal.title_en} />
        <Isian
          label="Slug"
          nama="slug"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugManual(e.target.value.trim().length > 0);
          }}
          mono
          bantuan="Dipakai di alamat permalink. Dibuat otomatis dari judul Indonesia, atau bisa disesuaikan manual."
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <IsianPanjang label="Deskripsi (ID)" nama="description_id" nilai={awal.description_id}
                        bantuan="Ringkasan kejadian dalam Bahasa Indonesia." />
          <IsianPanjang label="Deskripsi (EN)" nama="description_en" nilai={awal.description_en}
                        bantuan="English summary of the event." />
        </div>
      </Bagian>

      <Bagian nomor="02" judul="Waktu & tempat">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="event_date" className="cms-mata mb-1.5 block">
              Tanggal kejadian<Wajib />
            </label>
            <DatePicker
              id="event_date"
              nama="event_date"
              nilai={awal.event_date}
              wajib
            />
          </div>
          <div>
            <label htmlFor="orientation" className="cms-mata mb-1.5 block">Orientasi kartu</label>
            <select id="orientation" name="orientation" defaultValue={awal.orientation} className="cms-isian w-full">
              <option value="landscape">Landscape — foto di bawah teks</option>
              <option value="horizontal">Horizontal — foto memenuhi kartu</option>
            </select>
            <Bantuan>Menentukan bentuk kartunya di korsel halaman depan.</Bantuan>
          </div>
        </div>

        <div>
          <label htmlFor="location" className="cms-mata mb-1.5 block">
            Lokasi<Wajib />
          </label>
          <input id="location" name="location" required value={lokasi}
                 onChange={(e) => { setLokasi(e.target.value); cariLokasi(e.target.value); }}
                 placeholder="Ketik nama tempat, mis. Kubu Raya"
                 autoComplete="off" className="cms-isian w-full" />
          <Bantuan>
            Pilih dari hasil pencarian supaya provinsinya terbaca — itu yang menentukan
            angka di peta dan pulau pada kartu.
          </Bantuan>

          {mencari && <p className="cms-mata mt-2">Mencari…</p>}

          {hasil.length > 0 && (
            <ul
              onScroll={(e) => {
                const el = e.currentTarget;
                if (!habis && !memuatLagi &&
                    el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                  ambil(lokasi.trim(), hasil.length);
                }
              }}
              className="mt-2 max-h-56 overflow-y-auto rounded-[3px] border border-[var(--garis-tegas)]
                           bg-[var(--papan)]">
              {hasil.map((h) => (
                <li key={h.id} className="border-b border-[var(--garis)] last:border-b-0">
                  <button type="button"
                          onClick={() => {
                            // Koordinat ikut dari baris yang sama — kalau diisi
                            // sendiri, titik di peta bisa tidak cocok dengan
                            // nama lokasinya.
                            setLokasi(h.nama); setLat(String(h.lat)); setLng(String(h.lng)); setHasil([]);
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left
                                     text-[13.5px] hover:bg-white">
                    <span className="min-w-0 truncate"><Sorot teks={h.nama} kata={lokasi} /></span>
                    <span className="cms-angka shrink-0 text-[11.5px] text-[var(--lirih)]">
                      {h.lat.toFixed(3)}, {h.lng.toFixed(3)}
                    </span>
                  </button>
                </li>
              ))}
              {memuatLagi && (
                <li className="cms-mata px-3 py-2 text-[12px]">Memuat…</li>
              )}
              {!habis && !memuatLagi && (
                <li className="cms-mata px-3 py-2 text-[11.5px] text-[var(--lirih)]">
                  Gulir ke bawah untuk memuat lagi
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Pemilih titik langsung di peta — jalur ketiga di samping hasil
            pencarian dan isian koordinat manual. Ketiganya menulis ke dua
            state lat/lng yang sama, jadi saling mengikuti. */}
        <div>
          <p className="cms-mata mb-1.5">Pilih lokasi di peta</p>
          <div className="overflow-hidden rounded-[3px] border border-[var(--garis-tegas)]">
            <PetaLokasi lat={lat} lng={lng}
                        onPilih={(a, b) => { setLat(a.toFixed(6)); setLng(b.toFixed(6)); }} />
          </div>
          <Bantuan>
            Tekan peta untuk menaruh titik, geser penandanya untuk merapikan.
            Hasil pencarian dan isian koordinat ikut menggerakkan peta.
          </Bantuan>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <IsianTerkendali label="Latitude" nama="location_lat" nilai={lat} onUbah={setLat} />
          <IsianTerkendali label="Longitude" nama="location_lng" nilai={lng} onUbah={setLng} />
        </div>
      </Bagian>

      <Bagian nomor="03" judul="Media">
        <Galeri tersimpan={awal.galeri} />
      </Bagian>

      {/* Bilah aksi menempel di dasar layar: form ini panjang, dan tombol simpan
          tidak boleh ikut hilang ke bawah saat editor sedang di bagian media. */}
      <AksiSimpan sedangUbah={sedangUbah} />
    </form>
  );
}

/** Bilah aksi menempel di dasar layar: form ini panjang, dan tombol simpan
 *  tidak boleh ikut hilang ke bawah saat editor sedang di bagian media.
 *  `useFormStatus` harus di komponen anak — ia hanya tahu status <form> di
 *  atasnya di pohon, dan di komponen ini belum ada <form> yang melingkupinya. */
function AksiSimpan({ sedangUbah }: { sedangUbah: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 -mx-5 mt-8 flex flex-wrap items-center gap-3 border-t
                    border-[var(--garis-tegas)] bg-[var(--kertas)] px-5 py-3 lg:-mx-10 lg:px-10">
      {pending && <BilahUnggah />}
      <button type="submit" disabled={pending} className="cms-tombol cms-tombol--utama">
        {sedangUbah ? "Simpan perubahan" : "Tambah kejadian"}
      </button>
      <Link href="/admin/kejadian" className="cms-mata px-1 underline-offset-4 hover:underline">
        Batal
      </Link>
    </div>
  );
}

/** Satu bagian form. Nomornya menandai urutan kerja, dan urutannya memang
 *  berarti: lokasi menentukan peta, media menentukan tampilan kartunya. */
function Bagian({ nomor, judul, children }: { nomor: string; judul: string; children: React.ReactNode }) {
  return (
    <section className="max-w-[820px] border-b border-[var(--garis)] py-7 first:pt-0">
      <div className="mb-5 flex items-baseline gap-3">
        <span aria-hidden="true" className="cms-angka text-[13px] text-[var(--lirih)]">{nomor}</span>
        <h2 className="cms-judul text-[15px]">{judul}</h2>
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

function Wajib() {
  return <span aria-hidden="true" className="text-[var(--api)]"> *</span>;
}

function Bantuan({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[12px] leading-[1.5] text-[var(--lirih)]">{children}</p>;
}

/** Teks hasil pencarian dengan bagian yang sama dengan ketikan pengguna
 *  ditebalkan — semua kemunculannya, tidak hanya yang pertama. */
function Sorot({ teks, kata }: { teks: string; kata: string }) {
  const k = kata.trim().toLowerCase();
  if (!k) return <>{teks}</>;
  const bagian: React.ReactNode[] = [];
  let pos = 0;
  for (let n = 0; ; n++) {
    const i = teks.toLowerCase().indexOf(k, pos);
    if (i < 0) break;
    bagian.push(teks.slice(pos, i), <strong key={n}>{teks.slice(i, i + k.length)}</strong>);
    pos = i + k.length;
  }
  bagian.push(teks.slice(pos));
  return <>{bagian}</>;
}

function Isian({
  label,
  nama,
  nilai,
  value,
  onChange,
  tipe = "text",
  wajib,
  bantuan,
  mono,
}: {
  label: string;
  nama: string;
  nilai?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  tipe?: string;
  wajib?: boolean;
  bantuan?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label htmlFor={nama} className="cms-mata mb-1.5 block">
        {label}{wajib && <Wajib />}
      </label>
      <input
        id={nama}
        name={nama}
        type={tipe}
        {...(value !== undefined ? { value, onChange } : { defaultValue: nilai, onChange })}
        required={wajib}
        className={`cms-isian w-full ${mono ? "cms-angka" : ""}`}
      />
      {bantuan && <Bantuan>{bantuan}</Bantuan>}
    </div>
  );
}

function IsianPanjang({ label, nama, nilai, bantuan }: {
  label: string; nama: string; nilai: string; bantuan?: string;
}) {
  return (
    <div>
      <label htmlFor={nama} className="cms-mata mb-1.5 block">{label}</label>
      <textarea id={nama} name={nama} rows={4} defaultValue={nilai} className="cms-isian w-full" />
      {bantuan && <Bantuan>{bantuan}</Bantuan>}
    </div>
  );
}

function IsianTerkendali({ label, nama, nilai, onUbah }: {
  label: string; nama: string; nilai: string; onUbah: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={nama} className="cms-mata mb-1.5 block">{label}<Wajib /></label>
      <input id={nama} name={nama} type="number" step="any" required
             value={nilai} onChange={(e) => onUbah(e.target.value)}
             className="cms-isian cms-angka w-full" />
    </div>
  );
}

type ItemBaruGaleri = {
  id: string;
  berkas: File;
  nama: string;
  url: string;
  video: boolean;
  /** Bingkai pertama video, ditangkap di peramban — poster pratinjau sebelum tersimpan. */
  bingkai?: string;
  keterangan?: string;
};

/**
 * Ambil satu bingkai video sebagai gambar statis, langsung di peramban.
 *
 * Poster server baru ada SETELAH disimpan; sebelum itu pratinjau galeri tetap
 * butuh sesuatu yang murah — <video> memaksa peramban mengunduh metadata video
 * untuk sekadar thumbnail, dan itu yang mau dihindari. Gagal (kodek tidak
 * didukung, peramban kuno, video rusak) mengembalikan null dan pemanggil
 * kembali ke <video> seperti dulu.
 */
function bingkaiLokal(url: string): Promise<string | null> {
  return new Promise((selesai) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    // `beres` boleh menyebut `jeda` sebelum deklarasi: ia baru terpanggil
    // lewat event — selalu setelah baris `const jeda` selesai dieksekusi.
    const beres = (hasil: string | null) => {
      clearTimeout(jeda);
      video.removeAttribute("src");
      video.load();
      selesai(hasil);
    };
    const jeda = setTimeout(() => beres(null), 8_000);

    video.addEventListener(
      "seeked",
      () => {
        try {
          const kanvas = document.createElement("canvas");
          const lebar = video.videoWidth || 340;
          const tinggi = video.videoHeight || Math.round((lebar * 9) / 16);
          const skala = Math.min(1, 340 / lebar);
          kanvas.width = Math.max(1, Math.round(lebar * skala));
          kanvas.height = Math.max(1, Math.round(tinggi * skala));
          kanvas.getContext("2d")?.drawImage(video, 0, 0, kanvas.width, kanvas.height);
          beres(kanvas.toDataURL("image/jpeg", 0.75));
        } catch {
          beres(null);
        }
      },
      { once: true },
    );
    video.addEventListener("error", () => beres(null), { once: true });
    video.addEventListener(
      "loadeddata",
      () => {
        // Video lebih pendek dari 0,5 detik tetap kebagian bingkai.
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      },
      { once: true },
    );

    video.src = url;
    video.load();
  });
}

/**
 * Galeri media: beberapa foto/video per kejadian.
 *
 * Yang sudah tersimpan dirender sebagai kotak centang `keep_media` bernilai
 * INDEKS — melepas centang berarti berkasnya dibuang saat disimpan. Tiap berkas
 * punya isian `media_desc_<indeks>` (tersimpan) / `media_desc_baru` (baru,
 * dijumlah urut sama dengan `media_files`) untuk keterangannya. Berkas baru
 * masuk lewat satu input `media_files` bertipe multiple dan terakumulasi
 * tanpa menghapus berkas yang sudah dipilih sebelumnya.
 */
function Galeri({ tersimpan }: { tersimpan: ItemMedia[] }) {
  const [baru, setBaru] = useState<ItemBaruGaleri[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // URL objek menahan berkasnya di memori sampai dilepas. Pencabutan hanya
  // saat unmount — cleanup yang jalan di tiap perubahan daftar akan mencabut
  // URL yang masih dipakai pratinjau (termasuk tangkapan bingkai yang sedang
  // berjalan). Berkas yang dibuang manual dicabut sendiri di hapusBaru().
  const rujukBaru = useRef(baru);
  useEffect(() => {
    rujukBaru.current = baru;
  }, [baru]);
  useEffect(() => {
    return () => {
      rujukBaru.current.forEach((b) => URL.revokeObjectURL(b.url));
    };
  }, []);

  function sinkronkanInput(daftar: ItemBaruGaleri[]) {
    if (!inputRef.current) return;
    try {
      if (typeof DataTransfer !== "undefined") {
        const dt = new DataTransfer();
        daftar.forEach((b) => dt.items.add(b.berkas));
        inputRef.current.files = dt.files;
      }
    } catch {
      // Fallback jika lingkungan browser tidak mendukung mutasi DataTransfer
    }
  }

  function pilih(berkasList: FileList | null) {
    if (!berkasList || berkasList.length === 0) return;

    const tambahan: ItemBaruGaleri[] = Array.from(berkasList).map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      berkas: f,
      nama: f.name,
      url: URL.createObjectURL(f),
      video: f.type.startsWith("video/"),
      keterangan: "",
    }));

    // Urutannya penting: menyetel .value = "" pada input berkas MENGOSONGKAN
    // .files. Kalau reset dilakukan setelah sinkronkanInput(), berkas yang baru
    // saja ditulis langsung terhapus dan form terkirim tanpa lampiran —
    // tersimpan tanpa media, tanpa galat. Jadi reset dulu, sinkron belakangan.
    if (inputRef.current) inputRef.current.value = "";

    setBaru((lama) => {
      const gabungan = [...lama, ...tambahan];
      sinkronkanInput(gabungan);
      return gabungan;
    });

    // Poster pratinjau untuk video baru ditangkap di belakang; bila berhasil,
    // kartu video berganti dari <video> ke gambar statis tanpa perlu disimpan.
    for (const item of tambahan) {
      if (!item.video) continue;
      void bingkaiLokal(item.url).then((dataUrl) => {
        if (!dataUrl) return;
        setBaru((lama) =>
          lama.map((b) => (b.id === item.id ? { ...b, bingkai: dataUrl } : b)),
        );
      });
    }
  }

  function hapusBaru(id: string) {
    setBaru((lama) => {
      const target = lama.find((b) => b.id === id);
      if (target) URL.revokeObjectURL(target.url);
      const sisa = lama.filter((b) => b.id !== id);
      sinkronkanInput(sisa);
      return sisa;
    });
  }

  return (
    <div>
      <label htmlFor="media_files" className="cms-mata mb-1.5 block">
        Galeri media
      </label>

      {tersimpan.length > 0 && (
        <>
          <p className="mb-2 text-[12.5px] text-[var(--redup)]">
            Tersimpan sekarang — lepas centang untuk membuangnya saat disimpan.
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tersimpan.map((m, i) => (
              <div key={i}
                   className="overflow-hidden rounded-[3px] border border-[var(--garis-tegas)]
                              bg-[var(--papan)]">
                {/* Kotak centang dan gambarnya satu label; isian keterangan
                    sengaja DI LUAR label — label yang menaungi dua kontrol
                    membuat klik pada isian ikut menyalakan centangnya. */}
                <label className="group relative block cursor-pointer
                                  has-[:focus-visible]:outline has-[:focus-visible]:outline-2
                                  has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--limau)]">
                  <input type="checkbox" name="keep_media" value={i} defaultChecked className="peer sr-only" />

                  {/* Yang akan dibuang diredupkan dan diberi cap; tanpa penanda
                      seperti ini, melepas centang tidak terlihat sama sekali. */}
                  <div aria-hidden="true"
                       className="pointer-events-none absolute inset-0 z-[1] bg-[var(--jelaga)]/55
                                  transition-opacity peer-checked:opacity-0" />
                  <span aria-hidden="true"
                        className="cms-cap absolute top-1.5 left-1.5 z-[2] border-white bg-[var(--api)] text-white
                                   opacity-100 transition-opacity peer-checked:opacity-0">
                    Dibuang
                  </span>

                  {m.jenis === "video" ? (
                    m.poster ? (
                      <div className="relative">
                        <img src={m.poster} alt={`Media ${i + 1}`} className="h-[96px] w-full object-cover" />
                        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                          <span className="flex size-6 items-center justify-center rounded-full bg-black/60 shadow-xs">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="ml-0.5 size-3">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-[96px] w-full flex-col items-center justify-center bg-[var(--kertas)] text-[var(--redup)]">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="size-6 opacity-40">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                        <span className="cms-mata mt-1 text-[10px]">Video {i + 1}</span>
                      </div>
                    )
                  ) : (
                    <img src={m.url} alt={`Media ${i + 1}`} className="h-[96px] w-full object-cover" />
                  )}

                  <p className="cms-mata flex items-center justify-between px-2 py-1.5">
                    <span>{m.jenis === "video" ? "Video" : "Foto"}</span>
                    <span className="cms-angka text-[11px] text-[var(--jelaga)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </p>
                </label>

                <div className="border-t border-[var(--garis)] bg-[var(--kertas)] p-2">
                  <label htmlFor={`media_desc_${i}`} className="cms-mata mb-1 block text-[10px] text-[var(--redup)]">
                    Keterangan media
                  </label>
                  <input
                    id={`media_desc_${i}`}
                    type="text"
                    name={`media_desc_${i}`}
                    defaultValue={m.keterangan ?? ""}
                    placeholder="Deskripsi / alt teks…"
                    aria-label={`Keterangan media ${i + 1}`}
                    className="w-full rounded-[2px] border border-[var(--garis)] bg-white px-2 py-1 text-[11.5px] text-[var(--jelaga)]
                               outline-none placeholder:text-[var(--lirih)] focus:border-[var(--limau)]"
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <input
        ref={inputRef}
        id="media_files"
        name="media_files"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
        onChange={(e) => pilih(e.target.files)}
        className="cms-isian w-full"
      />
      <Bantuan>
        Boleh beberapa foto/video sekaligus, maksimal 100 MB per berkas. Memilih berkas
        lagi akan menambah ke daftar tanpa menghapus pilihan sebelumnya.
      </Bantuan>

      {baru.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[12.5px] font-semibold text-[var(--hijau)]">
            Berkas baru terpilih ({baru.length}):
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {baru.map((b) => (
              <div
                key={b.id}
                className="group relative overflow-hidden rounded-[3px] border border-[var(--hijau)] bg-[var(--papan)]"
              >
                <button
                  type="button"
                  onClick={() => hapusBaru(b.id)}
                  title="Batalkan berkas ini"
                  aria-label={`Batalkan ${b.nama}`}
                  className="absolute top-1 right-1 z-[3] grid size-5 cursor-pointer place-items-center rounded-full bg-black/60 text-white transition hover:bg-[var(--api)]"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor" className="size-3">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>

                <span className="cms-cap absolute top-1 left-1 z-[2] border-[var(--hijau)] bg-[var(--papan)] text-[var(--hijau)] text-[9px]">
                  Baru
                </span>

                {b.video ? (
                  b.bingkai ? (
                    <div className="relative">
                      <img src={b.bingkai} alt="" className="h-[96px] w-full object-cover" />
                      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                        <span className="flex size-6 items-center justify-center rounded-full bg-black/60 shadow-xs">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="ml-0.5 size-3">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex h-[96px] w-full flex-col items-center justify-center bg-[var(--kertas)] text-[var(--redup)]">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="size-6 opacity-40">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                      <span className="cms-mata mt-1 text-[10px]">Video</span>
                    </div>
                  )
                ) : (
                  <img src={b.url} alt="" className="h-[96px] w-full object-cover" />
                )}
                <p className="truncate px-2 pt-1.5 text-[11px] text-[var(--redup)]" title={b.nama}>
                  {b.nama}
                </p>

                <div className="border-t border-[var(--garis)] bg-[var(--kertas)] p-2">
                  <label htmlFor={`media_desc_baru_${b.id}`} className="cms-mata mb-1 block text-[10px] text-[var(--redup)]">
                    Keterangan media
                  </label>
                  <input
                    id={`media_desc_baru_${b.id}`}
                    type="text"
                    name="media_desc_baru"
                    value={b.keterangan ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBaru((lama) =>
                        lama.map((item) => (item.id === b.id ? { ...item, keterangan: val } : item)),
                      );
                    }}
                    placeholder="Deskripsi / alt teks…"
                    aria-label={`Keterangan ${b.nama}`}
                    className="w-full rounded-[2px] border border-[var(--garis)] bg-white px-2 py-1 text-[11.5px] text-[var(--jelaga)]
                               outline-none placeholder:text-[var(--lirih)] focus:border-[var(--hijau)]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
