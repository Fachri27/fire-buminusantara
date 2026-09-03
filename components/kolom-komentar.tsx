"use client";

import { useEffect, useRef, useState } from "react";
import type { gunakanKomentar } from "@/hooks/gunakan-komentar";

type Kendali = ReturnType<typeof gunakanKomentar>;

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type UlasanProps = {
  daftar: Kendali["daftar"];
  memuat: Kendali["memuat"];
  galat: Kendali["galat"];
  tampilkanBalasan: Kendali["tampilkanBalasan"];
  alihkanBalasan: Kendali["alihkanBalasan"];
  mulaiBalas: Kendali["mulaiBalas"];
  sebutanDari: Kendali["sebutanDari"];
  isiTanpaSebutan: Kendali["isiTanpaSebutan"];
};

/** Daftar komentar pada pop-up rincian — padanan markup kolom komentar di
 *  beranda.blade.php proyek Pasopati (x-for → .map). */
export function UlasanKomentar({
  daftar, memuat, galat,
  tampilkanBalasan, alihkanBalasan, mulaiBalas,
  sebutanDari, isiTanpaSebutan,
}: UlasanProps) {
  return (
    <section aria-label="Komentar laporan">
      <p className="rincian__kosong" hidden={memuat || daftar.length > 0}>
        Belum ada komentar. Jadi yang pertama.
      </p>

      <ul className="rincian__utas">
        {daftar.map((k) => (
          <li key={k.id} className="rincian__komen">
            <span className="rincian__inisial" aria-hidden="true">{(k.nama || "?").charAt(0)}</span>

            <div className="rincian__komen-isi">
              <p className="rincian__komen-teks">
                {/* Spasi eksplisit antar span: JSX menghilangkan jeda baris di
                    antara elemen, dan CSS sengaja tanpa margin — tanpa ini nama
                    dan teksnya menempel. */}
                <span className="rincian__komen-nama">{k.nama}</span>{" "}
                <span>{k.isi}</span>
              </p>

              <p className="rincian__komen-kaki">
                <span>{k.waktu}</span>
                <button type="button" className="rincian__balas" onClick={() => mulaiBalas(k)}>
                  Balas
                </button>
              </p>

              {k.balasan && k.balasan.length > 0 && (
                <div>
                  {/* Garis pendek sebelum labelnya menandai cabang yang sedang
                      dilipat, seperti pada rujukan. */}
                  <button
                    type="button"
                    className="rincian__lihat"
                    aria-expanded={tampilkanBalasan(k.id)}
                    onClick={() => alihkanBalasan(k.id)}
                  >
                    <span className="rincian__lihat-garis" aria-hidden="true" />
                    <span>
                      {tampilkanBalasan(k.id)
                        ? "Sembunyikan balasan"
                        : `Lihat balasan (${k.balasan.length})`}
                    </span>
                  </button>

                  <ul className={`rincian__balasan${!tampilkanBalasan(k.id) ? " rincian__balasan--tutup" : ""}`}>
                    {k.balasan.map((b) => (
                      <li key={b.id} className="rincian__komen">
                        <span className="rincian__inisial" aria-hidden="true">{(b.nama || "?").charAt(0)}</span>

                        <div className="rincian__komen-isi">
                          <p className="rincian__komen-teks">
                            <span className="rincian__komen-nama">{b.nama}</span>{" "}
                            {sebutanDari(b) && <span className="rincian__sebutan">{sebutanDari(b)}</span>}{" "}
                            <span>{isiTanpaSebutan(b)}</span>
                          </p>

                          <p className="rincian__komen-kaki">
                            <span>{b.waktu}</span>
                            <button type="button" className="rincian__balas" onClick={() => mulaiBalas(b)}>
                              Balas
                            </button>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="rincian__galat" hidden={!galat}>{galat}</p>
    </section>
  );
}

type FormProps = {
  mengirim: Kendali["mengirim"];
  galat: Kendali["galat"];
  nama: Kendali["nama"];
  setNama: Kendali["setNama"];
  email: Kendali["email"];
  setEmail: Kendali["setEmail"];
  anonim: Kendali["anonim"];
  setAnonim: Kendali["setAnonim"];
  isi: Kendali["isi"];
  setIsi: Kendali["setIsi"];
  website: Kendali["website"];
  setWebsite: Kendali["setWebsite"];
  balasKe: Kendali["balasKe"];
  balasNama: Kendali["balasNama"];
  batalBalas: Kendali["batalBalas"];
  kirim: Kendali["kirim"];
  ketikRef: Kendali["ketikRef"];
  captchaRef: Kendali["captchaRef"];
  pasangCaptcha: Kendali["pasangCaptcha"];
};

/** Kolom kirim, dipatok di dasar rel. Cukup isi nama dan email, tidak perlu
 *  login — sama seperti pada proyek Pasopati.
 *
 *  Di ponsel (≤ 860px — breakpoint yang sama dengan CSS pop-up) formulir
 *  lengkap tidak muat menempel di dasar rel: yang tampil hanya baris pemicu
 *  "Tambahkan komentar…", dan menekannya membuka sheet berisi seluruh isian
 *  (teks, nama, email, anonim, captcha). Di desktop semuanya inline seperti
 *  semula. */
export function FormulirKomentar({
  mengirim, galat, nama, setNama, email, setEmail, anonim, setAnonim, isi, setIsi,
  website, setWebsite, balasKe, balasNama, batalBalas,
  kirim, ketikRef, captchaRef, pasangCaptcha,
}: FormProps) {
  const belumLengkap = mengirim || !isi.trim() || (!anonim && (!nama.trim() || !email.trim()));

  const [ponsel, setPonsel] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const terap = () => setPonsel(mq.matches);
    terap();
    mq.addEventListener("change", terap);
    return () => mq.removeEventListener("change", terap);
  }, []);

  // Menekan "Balas" langsung membuka sheet berisi formulirnya.
  useEffect(() => {
    if (ponsel && balasKe !== null) setSheet(true);
  }, [ponsel, balasKe]);

  // Sheet tutup sendiri setelah komentar berhasil terkirim — tanda suksesnya:
  // mengirim kembali false DAN isi sudah dikosongkan oleh hook. Bila gagal,
  // isi masih terisi sehingga sheet tetap terbuka menampilkan pesan galatnya.
  const kirimSebelumnya = useRef(false);
  useEffect(() => {
    if (kirimSebelumnya.current && !mengirim && !isi.trim()) setSheet(false);
    kirimSebelumnya.current = mengirim;
  }, [mengirim, isi]);

  // Pasang widget Turnstile saat WADAHNYA ada: di desktop form tampil inline
  // sehingga wadah captcha selalu ada; di ponsel wadahnya baru ada saat sheet
  // terbuka. Sebelumnya hanya (ponsel && sheet), jadi di DESKTOP widget tak
  // pernah ter-render → token captcha selalu kosong → "Verifikasi captcha
  // gagal". (Pemasangan membuang widget lama lebih dulu, jadi aman dipanggil
  // ulang.)
  useEffect(() => {
    if (!ponsel || sheet) pasangCaptcha();
  }, [ponsel, sheet, pasangCaptcha]);

  // Fokus ke kotak ketik begitu sheet terbuka.
  useEffect(() => {
    if (ponsel && sheet) ketikRef.current?.focus();
  }, [ponsel, sheet, ketikRef]);

  // Isian yang sama untuk versi inline dan versi sheet — satu sumber markup.
  const bidang = (
    <>
      {/* Umpan jebakan (honeypot): hanya bot yang mengisinya. */}
      <div className="rincian__jebakan" aria-hidden="true">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={website}
                 onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {balasKe !== null && (
        <p className="rincian__membalas">
          <span>
            Membalas <strong className="rincian__balas">{balasNama}</strong>
          </span>
          <button type="button" className="rincian__batal" onClick={batalBalas}>
            Batal
          </button>
        </p>
      )}

      {SITE_KEY && <div className="rincian__captcha" ref={captchaRef} />}

      <div className="rincian__identitas">
        <label className="sr-only" htmlFor="komentar-nama">Nama</label>
        <input
          id="komentar-nama"
          className="rincian__input"
          type="text"
          maxLength={100}
          placeholder="Nama"
          required={!anonim}
          disabled={anonim}
          value={nama}
          onChange={(e) => setNama(e.target.value)}
        />
        <label className="sr-only" htmlFor="komentar-email">Email</label>
        <input
          id="komentar-email"
          className="rincian__input"
          type="email"
          maxLength={100}
          placeholder="Email"
          required={!anonim}
          disabled={anonim}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {/* Pilihan anonim, sama polanya dengan form laporan: isian identitas
          dimatikan dan kiriman tampil sebagai "Anonim". */}
      <label className="rincian__anonim">
        <input
          type="checkbox"
          checked={anonim}
          onChange={(e) => setAnonim(e.target.checked)}
        />
        Kirim sebagai anonim
      </label>
    </>
  );

  const barisKetik = (
    <div className="rincian__baris">
      <span className="rincian__inisial rincian__inisial--kecil" aria-hidden="true">
        {anonim ? "A" : nama ? nama.charAt(0).toUpperCase() : "?"}
      </span>

      <label className="rincian__ketik-bungkus">
        <span className="sr-only">Komentar</span>
        <textarea
          ref={ketikRef}
          className="rincian__ketik"
          rows={sheet ? 3 : 1}
          maxLength={2000}
          placeholder="Tambahkan komentar…"
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          onKeyDown={(e) => {
            // Shift+Enter diperbolehkan membuat baris baru di sheet.
            if (e.key === "Enter" && (!sheet || !e.shiftKey)) {
              e.preventDefault();
              kirim();
            }
          }}
        />
      </label>

      <button
        type="submit"
        className="rincian__tombol-kirim"
        disabled={belumLengkap}
      >
        {mengirim ? "Mengirim…" : "Kirim"}
      </button>
    </div>
  );

  // ── Desktop: formulir lengkap inline di dasar rel, seperti sebelumnya. ──
  if (!ponsel) {
    return (
      <form className="rincian__kirim" onSubmit={(e) => { e.preventDefault(); kirim(); }}>
        {bidang}
        {barisKetik}
      </form>
    );
  }

  // ── Ponsel: baris pemicu + sheet formulir. ──
  return (
    <>
      {!sheet && (
        <button
          type="button"
          className="rincian__kirim rincian__pemicu"
          onClick={() => setSheet(true)}
        >
          <span className="rincian__inisial rincian__inisial--kecil" aria-hidden="true">
            {anonim ? "A" : nama ? nama.charAt(0).toUpperCase() : "?"}
          </span>
          <span className="rincian__pemicu-teks">
            {balasKe !== null ? `Membalas ${balasNama}…` : "Tambahkan komentar…"}
          </span>
        </button>
      )}

      {sheet && (
        <div
          className="rincian__sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Tulis komentar"
          onClick={(e) => { if (e.target === e.currentTarget) setSheet(false); }}
        >
          <form
            className="rincian__sheet-panel"
            onSubmit={(e) => { e.preventDefault(); kirim(); }}
          >
            <div className="rincian__sheet-kepala">
              <p className="rincian__sheet-judul">Tulis komentar</p>
              <button
                type="button"
                className="rincian__sheet-tutup"
                aria-label="Tutup formulir komentar"
                onClick={() => setSheet(false)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {galat && <p className="rincian__galat" role="alert">{galat}</p>}

            {bidang}
            {barisKetik}
          </form>
        </div>
      )}
    </>
  );
}