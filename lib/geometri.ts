type Cincin = [number, number][];
type Geometri = { type: string; coordinates: unknown };

export function poligonFitur(g: Geometri): Cincin[][] {
  return (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Cincin[][];
}

/** Luas bertanda (rumus tali sepatu). Tandanya tidak dipakai, hanya besarnya. */
export function luasCincin(c: Cincin): number {
  let jumlah = 0;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    jumlah += c[j][0] * c[i][1] - c[i][0] * c[j][1];
  }
  return jumlah / 2;
}

export function kotakCincin(c: Cincin): [number, number, number, number] {
  let minX = Infinity, maksX = -Infinity, minY = Infinity, maksY = -Infinity;
  for (const [x, y] of c) {
    if (x < minX) minX = x; if (x > maksX) maksX = x;
    if (y < minY) minY = y; if (y > maksY) maksY = y;
  }
  return [minX, minY, maksX, maksY];
}

/** Pusat massa poligon — bukan rata-rata titik sudut, yang tertarik ke sisi
 *  yang simpulnya paling rapat. */
export function pusatMassaCincin(c: Cincin): [number, number] | null {
  const luas = luasCincin(c);
  if (!luas) return null;
  let x = 0, y = 0;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const silang = c[j][0] * c[i][1] - c[i][0] * c[j][1];
    x += (c[j][0] + c[i][0]) * silang;
    y += (c[j][1] + c[i][1]) * silang;
  }
  return [x / (6 * luas), y / (6 * luas)];
}

/** Uji lempar sinar. Hole ikut terhitung karena aturan ganjil-genap dipakai
 *  pada seluruh cincin satu poligon. */
export function titikDalamCincin(x: number, y: number, c: Cincin): boolean {
  let dalam = false;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const [xi, yi] = c[i], [xj, yj] = c[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dalam = !dalam;
  }
  return dalam;
}

export function titikDalamGeometri(lng: number, lat: number, g: Geometri): boolean {
  for (const poligon of poligonFitur(g)) {
    let dalam = false;
    for (const cincin of poligon) if (titikDalamCincin(lng, lat, cincin)) dalam = !dalam;
    if (dalam) return true;
  }
  return false;
}

export type TempatAngka = { titik: [number, number]; kotak: [number, number, number, number] };

/**
 * Tempat angka jumlah laporan diletakkan pada sebuah provinsi.
 *
 * Pusat kotak pembatas tidak dipakai: pada provinsi yang melengkung atau
 * terpecah banyak pulau (Maluku, Kepulauan Riau, Sulawesi) titik itu jatuh di
 * laut. Yang dicari titik yang benar-benar berada DI DALAM daratan terbesarnya.
 *
 * Dikembalikan sekalian kotak pembatas cincin terbesar itu — bukan kotak
 * seluruh provinsi — karena cincin itulah yang harus cukup lapang memuat
 * angkanya. Kepulauan Riau kotak provinsinya raksasa sementara tiap pulaunya
 * sebesar titik.
 */
export function tempatAngka(g: Geometri): TempatAngka | null {
  let terbesar: Cincin | null = null;
  let luasTerbesar = -1;

  for (const poligon of poligonFitur(g)) {
    const cincin = poligon[0]; // cincin luar; hole diabaikan untuk ukuran
    if (!cincin || cincin.length < 3) continue;
    const luas = Math.abs(luasCincin(cincin));
    if (luas > luasTerbesar) { luasTerbesar = luas; terbesar = cincin; }
  }
  if (!terbesar) return null;

  const kotak = kotakCincin(terbesar);
  const pusat = pusatMassaCincin(terbesar);

  // Cukup untuk bentuk yang cembung.
  if (pusat && titikDalamCincin(pusat[0], pusat[1], terbesar)) return { titik: pusat, kotak };

  // Bentuk cekung (Sulawesi yang seperti huruf K): pusat massanya di luar
  // daratan. Sapu kisi, ambil titik dalam yang paling dekat ke pusat massa —
  // masih terbaca sebagai "tengah" tanpa hitungan pole-of-inaccessibility.
  const KISI = 32;
  const acuan = pusat ?? [(kotak[0] + kotak[2]) / 2, (kotak[1] + kotak[3]) / 2];
  let pilihan: [number, number] | null = null;
  let terdekat = Infinity;

  for (let bx = 0; bx < KISI; bx++) {
    for (let by = 0; by < KISI; by++) {
      const x = kotak[0] + ((bx + 0.5) / KISI) * (kotak[2] - kotak[0]);
      const y = kotak[1] + ((by + 0.5) / KISI) * (kotak[3] - kotak[1]);
      if (!titikDalamCincin(x, y, terbesar)) continue;
      const d = (x - acuan[0]) ** 2 + (y - acuan[1]) ** 2;
      if (d < terdekat) { terdekat = d; pilihan = [x, y]; }
    }
  }
  return pilihan ? { titik: pilihan, kotak } : null;
}

export type Jalur = { d: string; viewBox: string };

/**
 * Siluet sebuah provinsi sebagai satu path SVG.
 *
 * Bujur/lintang dipetakan lurus ke kotak pandang — untuk gambar sebesar ibu
 * jari, proyeksi persegi panjang polos sudah tidak terbedakan dari yang benar.
 * Lintangnya dibalik karena sumbu y SVG tumbuh ke bawah.
 *
 * Seluruh cincin masuk ke SATU path supaya `fill-rule: evenodd` melubangi
 * danau dan teluk yang tertutup daratan, bukan menimpanya dengan warna isi.
 */
export function jalurSvg(g: Geometri, sisi = 100): Jalur | null {
  const cincin = poligonFitur(g).flat().filter((c) => c.length >= 3);
  if (!cincin.length) return null;

  let minX = Infinity, maksX = -Infinity, minY = Infinity, maksY = -Infinity;
  for (const c of cincin) {
    const [a, b, x, y] = kotakCincin(c);
    if (a < minX) minX = a; if (x > maksX) maksX = x;
    if (b < minY) minY = b; if (y > maksY) maksY = y;
  }

  const lebar = maksX - minX, tinggi = maksY - minY;
  if (!(lebar > 0) || !(tinggi > 0)) return null;

  const skala = sisi / Math.max(lebar, tinggi);
  const px = (x: number) => ((x - minX) * skala).toFixed(1);
  const py = (y: number) => ((maksY - y) * skala).toFixed(1);

  const d = cincin
    .map((c) => `M${c.map(([x, y]) => `${px(x)} ${py(y)}`).join("L")}Z`)
    .join("");

  return { d, viewBox: `0 0 ${(lebar * skala).toFixed(1)} ${(tinggi * skala).toFixed(1)}` };
}
