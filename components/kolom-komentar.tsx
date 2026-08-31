"use client";

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
  nama: Kendali["nama"];
  setNama: Kendali["setNama"];
  email: Kendali["email"];
  setEmail: Kendali["setEmail"];
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
};

/** Kolom kirim, dipatok di dasar rel. Cukup isi nama dan email, tidak perlu
 *  login — sama seperti pada proyek Pasopati. */
export function FormulirKomentar({
  mengirim, nama, setNama, email, setEmail, isi, setIsi,
  website, setWebsite, balasKe, balasNama, batalBalas,
  kirim, ketikRef, captchaRef,
}: FormProps) {
  const belumLengkap = mengirim || !isi.trim() || !nama.trim() || !email.trim();

  return (
    <form className="rincian__kirim" onSubmit={(e) => { e.preventDefault(); kirim(); }}>
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
          required
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
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="rincian__baris">
        <span className="rincian__inisial rincian__inisial--kecil" aria-hidden="true">
          {nama ? nama.charAt(0).toUpperCase() : "?"}
        </span>

        <label className="rincian__ketik-bungkus">
          <span className="sr-only">Komentar</span>
          <textarea
            ref={ketikRef}
            className="rincian__ketik"
            rows={1}
            maxLength={2000}
            placeholder="Tambahkan komentar…"
            value={isi}
            onChange={(e) => setIsi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
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
    </form>
  );
}