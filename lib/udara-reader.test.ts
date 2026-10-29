import test from "node:test";
import assert from "node:assert/strict";
import {
  BYTE_ANGIN_KOSONG,
  BYTE_PER_FRAME_UDARA,
  ENKODE_UDARA,
  GRID_UDARA,
  aqiDariPm25,
  bangunIndeksGridUdara,
  byteAngin,
  byteAqi,
  getUdaraFrame,
  kemasFrameUdara,
} from "./udara-reader.ts";
import { GalatHuluZarr } from "./zarr-reader.ts";

// Grid sintetis berbentuk store ARCO: 451 lintang × 900 bujur, resolusi 0,4°.
const BARIS_GLOBAL = 451;
const KOLOM_GLOBAL = 900;
const TITIK_GLOBAL = BARIS_GLOBAL * KOLOM_GLOBAL;
const lintangNaik = Float64Array.from({ length: BARIS_GLOBAL }, (_, i) => -90 + 0.4 * i); // susunan store sebenarnya
const bujurMinus180 = Float64Array.from({ length: KOLOM_GLOBAL }, (_, j) => -180 + 0.4 * j);

const dekati = (aktual: number, harap: number, toleransi = 1e-9) =>
  assert.ok(Math.abs(aktual - harap) <= toleransi, `${aktual} ≉ ${harap}`);

test("GRID_UDARA dan ukuran frame konsisten dengan batas & resolusinya", () => {
  assert.equal(GRID_UDARA.cols, Math.round((GRID_UDARA.east - GRID_UDARA.west) / GRID_UDARA.resolusi) + 1);
  assert.equal(GRID_UDARA.rows, Math.round((GRID_UDARA.north - GRID_UDARA.south) / GRID_UDARA.resolusi) + 1);
  assert.equal(BYTE_PER_FRAME_UDARA, 300 * 191 * 3);
  assert.equal(BYTE_PER_FRAME_UDARA, 171_900);
  assert.deepEqual({ ...ENKODE_UDARA }, { aqiMaks: 500, anginMin: -40, anginMaks: 40 });
});

test("aqiDariPm25 mengikuti titik patah EPA 2024, kontinu tanpa celah", () => {
  dekati(aqiDariPm25(0), 0);
  dekati(aqiDariPm25(4.5), 25);
  dekati(aqiDariPm25(9.0), 50);
  dekati(aqiDariPm25(35.4), 100);
  dekati(aqiDariPm25(55.4), 150);
  dekati(aqiDariPm25(125.4), 200);
  dekati(aqiDariPm25(225.4), 300);
  dekati(aqiDariPm25(300), 449.2); // 300 + (300 − 225,4) × 200/100
  dekati(aqiDariPm25(325.4), 500);
  assert.equal(aqiDariPm25(1000), 500);
  assert.equal(aqiDariPm25(-3), 0, "PM2.5 negatif (artefak numerik model) → 0");

  // Kontinu di setiap titik patah (tak ada lompatan seperti tabel resmi 9,0 → 9,1)
  for (const c of [9.0, 35.4, 55.4, 125.4, 225.4, 325.4]) {
    dekati(aqiDariPm25(c - 1e-9), aqiDariPm25(c + 1e-9), 1e-6);
  }
  // Monoton naik
  let sebelumnya = -1;
  for (let c = 0; c <= 400; c += 0.1) {
    const aqi = aqiDariPm25(c);
    assert.ok(aqi >= sebelumnya, `AQI turun di C=${c}`);
    sebelumnya = aqi;
  }
});

test("aqiDariPm25 menolak NaN, tak hingga, dan nilai hilang GRIB (FLT_MAX)", () => {
  assert.ok(Number.isNaN(aqiDariPm25(NaN)));
  assert.ok(Number.isNaN(aqiDariPm25(Infinity)));
  assert.ok(Number.isNaN(aqiDariPm25(3.4028234663852886e38)));
});

test("byteAqi memetakan 0..500 ke 0..255 dan NaN ke 0", () => {
  assert.equal(byteAqi(0), 0);
  assert.equal(byteAqi(500), 255);
  assert.equal(byteAqi(50), 26); // 25,5 dibulatkan ke atas
  assert.equal(byteAqi(250), 128);
  assert.equal(byteAqi(900), 255);
  assert.equal(byteAqi(-10), 0);
  assert.equal(byteAqi(NaN), 0);
});

test("byteAngin memetakan -40..40 m/s ke 0..255 dan kosong ke 128", () => {
  assert.equal(byteAngin(-40), 0);
  assert.equal(byteAngin(40), 255);
  assert.equal(byteAngin(0), 128);
  assert.equal(byteAngin(10), 159); // 50/80 × 255 = 159,375
  assert.equal(byteAngin(-100), 0);
  assert.equal(byteAngin(100), 255);
  assert.equal(byteAngin(NaN), BYTE_ANGIN_KOSONG);
  assert.equal(byteAngin(3.4028234663852886e38), BYTE_ANGIN_KOSONG);
  assert.equal(BYTE_ANGIN_KOSONG, 128);
});

test("bangunIndeksGridUdara mengindeks lewat koordinat store (lintang naik, bujur -180..180)", () => {
  const { baris, kolom } = bangunIndeksGridUdara(lintangNaik, bujurMinus180);
  assert.equal(baris.length, GRID_UDARA.rows);
  assert.equal(kolom.length, GRID_UDARA.cols);
  assert.equal(baris[0], 125); // -40°
  assert.equal(baris[100], 225); // 0°
  assert.equal(baris[190], 315); // +36°
  assert.equal(kolom[0], 600); // 60°
  assert.equal(kolom[299], 899); // 179,6° — kolom terakhir store
  for (let r = 0; r < GRID_UDARA.rows; r++) dekati(lintangNaik[baris[r]], -40 + 0.4 * r, 1e-6);
  for (let c = 0; c < GRID_UDARA.cols; c++) dekati(bujurMinus180[kolom[c]], 60 + 0.4 * c, 1e-6);
});

test("bangunIndeksGridUdara juga benar untuk susunan GRIB (lintang turun, bujur 0..360)", () => {
  const lintangTurun = Float64Array.from({ length: BARIS_GLOBAL }, (_, i) => 90 - 0.4 * i);
  const bujur0 = Float64Array.from({ length: KOLOM_GLOBAL }, (_, j) => 0.4 * j);
  const { baris, kolom } = bangunIndeksGridUdara(lintangTurun, bujur0);
  assert.equal(baris[0], 325); // -40° di indeks (90 + 40) / 0,4
  assert.equal(baris[190], 135); // +36°
  assert.equal(kolom[0], 150); // 60 / 0,4
  assert.equal(kolom[299], 449); // 179,6 / 0,4
});

test("bangunIndeksGridUdara melempar bila grid store tidak memuat titik potong", () => {
  const lintangGeser = Float64Array.from(lintangNaik, (x) => x + 0.2);
  assert.throws(() => bangunIndeksGridUdara(lintangGeser, bujurMinus180), /lintang/);
  const bujurGeser = Float64Array.from(bujurMinus180, (x) => x + 0.2);
  assert.throws(() => bangunIndeksGridUdara(lintangNaik, bujurGeser), /bujur/);
});

test("kemasFrameUdara: baris 0 = selatan, kolom 0 = barat, bidang aqi | u | v, timeInner dihormati", () => {
  // Chunk [2, 1, 451, 900]: u10 naik ke timur, v10 naik ke utara, pm2p5
  // berbeda per timeInner — sehingga orientasi & irisan bisa dicek.
  const pm = new Float32Array(2 * TITIK_GLOBAL);
  const u = new Float32Array(2 * TITIK_GLOBAL);
  const v = new Float32Array(2 * TITIK_GLOBAL);
  for (let t = 0; t < 2; t++) {
    for (let i = 0; i < BARIS_GLOBAL; i++) {
      for (let j = 0; j < KOLOM_GLOBAL; j++) {
        const k = t * TITIK_GLOBAL + i * KOLOM_GLOBAL + j;
        pm[k] = t === 0 ? 20e-9 : 100e-9; // 20 µg/m³ → AQI ≈71; 100 µg/m³ → AQI ≈182
        u[k] = (bujurMinus180[j] - 120) / 3; // 60° → -20 m/s, 180° → +20 m/s
        v[k] = lintangNaik[i]; // -40° → -40 m/s (byte 0), 36° → +36 m/s
      }
    }
  }
  const indeks = bangunIndeksGridUdara(lintangNaik, bujurMinus180);
  const { cols, rows } = GRID_UDARA;
  const n = cols * rows;
  const piksel = (buf: Uint8Array, r: number, c: number) => {
    const o = r * cols + c;
    return [buf[o], buf[n + o], buf[2 * n + o]];
  };
  // Titik sumber dihitung terpisah dari pencarian indeks: lat = -40 + 0,4r, lon = 60 + 0,4c
  const harap = (t: number, r: number, c: number) => {
    const i = Math.round((-40 + 0.4 * r + 90) / 0.4);
    const j = Math.round((60 + 0.4 * c + 180) / 0.4);
    const k = t * TITIK_GLOBAL + i * KOLOM_GLOBAL + j;
    return [byteAqi(aqiDariPm25(pm[k] * 1e9)), byteAngin(u[k]), byteAngin(v[k])];
  };
  const sampel = [[0, 0], [0, cols - 1], [rows - 1, 0], [rows - 1, cols - 1], [100, 150], [10, 280], [35, 3]];

  const run0 = kemasFrameUdara(pm, u, v, 0, indeks);
  assert.equal(run0.buffer.byteLength, BYTE_PER_FRAME_UDARA);
  assert.equal(run0.lengkap, true);
  for (const [r, c] of sampel) assert.deepEqual(piksel(run0.buffer, r, c), harap(0, r, c), `run0 r=${r} c=${c}`);

  // Makna fisik pojok: barat-daya u ≈ -20 & v ≈ -40; timur-laut u ≈ +20 & v ≈ +36.
  const [aqiBd, uBd, vBd] = piksel(run0.buffer, 0, 0);
  const [, uTl, vTl] = piksel(run0.buffer, rows - 1, cols - 1);
  assert.equal(aqiBd, byteAqi(aqiDariPm25(20)));
  assert.ok(Math.abs(uBd - byteAngin(-20)) <= 1 && Math.abs(vBd - byteAngin(-40)) <= 1, `barat-daya ${uBd},${vBd}`);
  assert.ok(Math.abs(uTl - byteAngin(19.87)) <= 1 && Math.abs(vTl - byteAngin(36)) <= 1, `timur-laut ${uTl},${vTl}`);
  // u naik ke timur sepanjang baris, v naik ke utara sepanjang kolom
  assert.ok(piksel(run0.buffer, 0, cols - 1)[1] > piksel(run0.buffer, 0, 0)[1]);
  assert.ok(piksel(run0.buffer, rows - 1, 0)[2] > piksel(run0.buffer, 0, 0)[2]);

  const run1 = kemasFrameUdara(pm, u, v, TITIK_GLOBAL, indeks);
  for (const [r, c] of sampel) assert.deepEqual(piksel(run1.buffer, r, c), harap(1, r, c), `run1 r=${r} c=${c}`);
  assert.equal(piksel(run1.buffer, 40, 60)[0], byteAqi(aqiDariPm25(100)));
  assert.notEqual(piksel(run1.buffer, 40, 60)[0], piksel(run0.buffer, 40, 60)[0]);
});

test("kemasFrameUdara: titik kosong → aqi 0 / angin 128; irisan kosong tidak lengkap", () => {
  const pm = new Float32Array(TITIK_GLOBAL).fill(20e-9);
  const u = new Float32Array(TITIK_GLOBAL).fill(5);
  const v = new Float32Array(TITIK_GLOBAL).fill(-5);
  const indeks = bangunIndeksGridUdara(lintangNaik, bujurMinus180);
  // Titik sumber untuk keluaran (r=3, c=4)
  const k = indeks.baris[3] * KOLOM_GLOBAL + indeks.kolom[4];
  pm[k] = NaN;
  u[k] = NaN;
  v[k] = 3.4028234663852886e38;

  const hasil = kemasFrameUdara(pm, u, v, 0, indeks);
  assert.equal(hasil.lengkap, true);
  const n = GRID_UDARA.cols * GRID_UDARA.rows;
  const titik = (o: number) => [hasil.buffer[o], hasil.buffer[n + o], hasil.buffer[2 * n + o]];
  assert.deepEqual(titik(3 * GRID_UDARA.cols + 4), [0, 128, 128]);
  assert.deepEqual(titik(0), [byteAqi(aqiDariPm25(20)), byteAngin(5), byteAngin(-5)]);

  const kosong = new Float32Array(TITIK_GLOBAL).fill(NaN);
  const tanpaData = kemasFrameUdara(kosong, kosong, kosong, 0, indeks);
  assert.equal(tanpaData.lengkap, false);
  for (let i = 0; i < n; i++) {
    assert.equal(tanpaData.buffer[i], 0);
    assert.equal(tanpaData.buffer[n + i], 128);
    assert.equal(tanpaData.buffer[2 * n + i], 128);
  }
  // Satu variabel kosong saja sudah cukup untuk tidak lengkap (jangan di-cache)
  assert.equal(kemasFrameUdara(pm, u, kosong, 0, indeks).lengkap, false);
});

test("getUdaraFrame mengingat chunk 404 sebentar — permintaan ulang tak mengunduh lagi", async (t) => {
  const tokenAsli = process.env.CAMS_ZARR_TOKEN;
  const fetchAsli = globalThis.fetch;
  process.env.CAMS_ZARR_TOKEN = "token-uji";
  let panggilan = 0;
  globalThis.fetch = (async () => {
    panggilan++;
    return new Response(null, { status: 404, statusText: "Not Found" });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = fetchAsli;
    if (tokenAsli === undefined) delete process.env.CAMS_ZARR_TOKEN;
    else process.env.CAMS_ZARR_TOKEN = tokenAsli;
  });

  const galat404 = (e: unknown) => e instanceof GalatHuluZarr && e.status === 404;
  await assert.rejects(getUdaraFrame(424_242, 3, 0), galat404);
  const setelahPertama = panggilan;
  assert.ok(setelahPertama > 0, "permintaan pertama menembak hulu");

  // Pasangan timeInner berbagi chunk yang sama — ikut tertolak dari ingatan.
  await assert.rejects(getUdaraFrame(424_242, 3, 0), galat404);
  await assert.rejects(getUdaraFrame(424_242, 3, 1), galat404);
  assert.equal(panggilan, setelahPertama, "tak ada unduhan ECMWF baru");
});
