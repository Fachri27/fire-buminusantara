import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeProtectedHeader, exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import {
  anonimkanMedia,
  asalPublik,
  bukaTokenApple,
  bundleApple,
  masukUjiBoleh,
  rahasiaKlienApple,
  segelTokenApple,
  sesiKedaluwarsa,
  sidikToken,
  tokenDari,
} from "./akun-mobile.ts";
import { penandaAkun, penandaPengunjung } from "./suka.ts";

const minta = (headers: Record<string, string>, url = "http://0.0.0.0:3000/api/mobile/saya/laporan") =>
  new Request(url, { headers });

test("tokenDari: hanya Bearer dengan panjang wajar", () => {
  const token = "a".repeat(43);
  assert.equal(tokenDari(minta({ authorization: `Bearer ${token}` })), token);
  assert.equal(tokenDari(minta({ authorization: `Basic ${token}` })), null);
  assert.equal(tokenDari(minta({ authorization: "Bearer pendek" })), null);
  assert.equal(tokenDari(minta({})), null);
});

test("sidikToken: sha256 hex, token mentah tidak disimpan", () => {
  const sidik = sidikToken("rahasia");
  assert.match(sidik, /^[0-9a-f]{64}$/);
  assert.notEqual(sidik, "rahasia");
});

test("sesiKedaluwarsa: 90 hari sejak terakhir dipakai, tepat 90 hari sudah kedaluwarsa", () => {
  const kini = new Date("2026-10-23T12:00:00Z");
  const lalu = (hari: number, ms = 0) => new Date(kini.getTime() - hari * 86_400_000 - ms);
  const dibuat = lalu(400);
  assert.equal(sesiKedaluwarsa({ created_at: dibuat, last_used_at: lalu(1) }, kini), false, "dipakai kemarin");
  assert.equal(sesiKedaluwarsa({ created_at: dibuat, last_used_at: lalu(90, -1) }, kini), false, "kurang 1 ms dari 90 hari");
  assert.equal(sesiKedaluwarsa({ created_at: dibuat, last_used_at: lalu(90) }, kini), true, "tepat 90 hari");
  assert.equal(sesiKedaluwarsa({ created_at: dibuat, last_used_at: lalu(91) }, kini), true);
});

test("sesiKedaluwarsa: tanpa last_used_at dihitung dari created_at", () => {
  const kini = new Date("2026-10-23T12:00:00Z");
  const lalu = (hari: number, ms = 0) => new Date(kini.getTime() - hari * 86_400_000 - ms);
  assert.equal(sesiKedaluwarsa({ created_at: lalu(0), last_used_at: null }, kini), false, "baru dibuat");
  assert.equal(sesiKedaluwarsa({ created_at: lalu(90, -1), last_used_at: null }, kini), false);
  assert.equal(sesiKedaluwarsa({ created_at: lalu(90), last_used_at: null }, kini), true, "tepat 90 hari sejak dibuat");
});

test("asalPublik: dari Host/X-Forwarded-*, bukan alamat bind 0.0.0.0", () => {
  assert.equal(asalPublik(minta({ host: "192.168.1.10:3000" })), "http://192.168.1.10:3000");
  assert.equal(
    asalPublik(minta({ host: "web:3000", "x-forwarded-host": "fire.nusantara.earth", "x-forwarded-proto": "https" })),
    "https://fire.nusantara.earth",
  );
});

test("penandaAkun tidak bertabrakan dengan penanda pengunjung web", () => {
  assert.notEqual(penandaAkun(1), penandaPengunjung("akun:1", null));
  assert.notEqual(penandaAkun(1), penandaAkun(2));
});

test("masuk uji terkunci di produksi dan tanpa MOBILE_MASUK_UJI", () => {
  const lama = { ...process.env };
  process.env.MOBILE_MASUK_UJI = "1";
  (process.env as Record<string, string>).NODE_ENV = "production";
  assert.equal(masukUjiBoleh(), false);
  (process.env as Record<string, string>).NODE_ENV = "development";
  assert.equal(masukUjiBoleh(), true);
  delete process.env.MOBILE_MASUK_UJI;
  assert.equal(masukUjiBoleh(), false);
  Object.assign(process.env, lama);
});

test("bundleApple: APPLE_BUNDLE_ID boleh beberapa, dipisah koma", () => {
  const lama = process.env.APPLE_BUNDLE_ID;
  process.env.APPLE_BUNDLE_ID = " earth.nusantara.fire.lapor , earth.nusantara.fire.lapor.preview,";
  assert.deepEqual(bundleApple(), ["earth.nusantara.fire.lapor", "earth.nusantara.fire.lapor.preview"]);
  process.env.APPLE_BUNDLE_ID = "";
  assert.deepEqual(bundleApple(), []);
  if (lama === undefined) delete process.env.APPLE_BUNDLE_ID;
  else process.env.APPLE_BUNDLE_ID = lama;
});

test("rahasiaKlienApple: JWT ES256 untuk REST API Apple, null tanpa kunci .p8", async () => {
  const lama = { ...process.env };
  delete process.env.APPLE_TEAM_ID;
  assert.equal(await rahasiaKlienApple("earth.nusantara.fire.lapor"), null);

  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  process.env.APPLE_TEAM_ID = "TIM1234567";
  process.env.APPLE_KEY_ID = "KUNCI12345";
  // Seperti di .env satu baris: baris baru PEM ditulis \n.
  process.env.APPLE_PRIVATE_KEY = (await exportPKCS8(privateKey)).replace(/\n/g, "\\n");
  const jwt = await rahasiaKlienApple("earth.nusantara.fire.lapor.preview");
  assert.ok(jwt);
  assert.deepEqual(decodeProtectedHeader(jwt), { alg: "ES256", kid: "KUNCI12345" });
  const { payload } = await jwtVerify(jwt, publicKey, { issuer: "TIM1234567", audience: "https://appleid.apple.com" });
  assert.equal(payload.sub, "earth.nusantara.fire.lapor.preview");
  assert.ok(payload.exp! - payload.iat! <= 15_777_000, "Apple menolak client_secret > 6 bulan");
  for (const k of ["APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"]) delete process.env[k];
  Object.assign(process.env, lama);
});

test("segelTokenApple: AES-256-GCM terikat ke pengguna, kunci salah atau nilai diubah ditolak", (t) => {
  const lama = process.env.APPLE_TOKEN_SECRET;
  t.after(() => {
    if (lama === undefined) delete process.env.APPLE_TOKEN_SECRET;
    else process.env.APPLE_TOKEN_SECRET = lama;
  });
  const token = "r1a2b3.0.rsxw.contoh-refresh-token-apple";
  const PENGGUNA = BigInt(7);

  delete process.env.APPLE_TOKEN_SECRET;
  assert.throws(() => segelTokenApple(token, PENGGUNA), /APPLE_TOKEN_SECRET kosong/, "tanpa kunci tidak disimpan polos");

  process.env.APPLE_TOKEN_SECRET = "kunci-uji-pertama";
  const segel = segelTokenApple(token, PENGGUNA);
  assert.match(segel, /^v1:[\w-]+:[\w-]+$/);
  assert.ok(!segel.includes(token));
  assert.notEqual(segelTokenApple(token, PENGGUNA), segel, "IV acak: segel berbeda tiap kali");
  assert.equal(bukaTokenApple(segel, PENGGUNA), token);

  assert.throws(() => bukaTokenApple(segel, BigInt(8)), "AAD: segel baris lain tidak bisa dipakai");
  const [awalan, iv, isi] = segel.split(":");
  const diubah = Buffer.from(isi, "base64url");
  diubah[0] ^= 1;
  assert.throws(() => bukaTokenApple(`${awalan}:${iv}:${diubah.toString("base64url")}`, PENGGUNA), "nilai diubah");
  assert.throws(() => bukaTokenApple("v1:rusak", PENGGUNA), /rusak/);

  process.env.APPLE_TOKEN_SECRET = "kunci-uji-kedua";
  assert.throws(() => bukaTokenApple(segel, PENGGUNA), "kunci diganti = token lama tak terbaca");
  delete process.env.APPLE_TOKEN_SECRET;
  assert.throws(() => bukaTokenApple(segel, PENGGUNA), /APPLE_TOKEN_SECRET kosong/);
});

test("bukaTokenApple: token polos dari sebelum ada segel dikembalikan apa adanya", () => {
  assert.equal(bukaTokenApple("r1a2b3.0.polos", BigInt(7)), "r1a2b3.0.polos");
});

test("anonimkanMedia: hanya keterangan bernama pelapor yang diganti, entri lain utuh", () => {
  const media = [
    { path: "fire/a.jpg", type: "image", keterangan: "Siti Rahasia", exif: { lat: -2 } },
    { path: "fire/b.jpg", type: "image", keterangan: "Asap tebal di tepi kanal" },
    { path: "fire/c.mp4", type: "video", poster: "fire/c.jpg" },
  ];
  const hasil = anonimkanMedia(media, new Set(["Siti Rahasia"]));
  assert.equal(hasil.berubah, true);
  assert.deepEqual(hasil.media, [
    { path: "fire/a.jpg", type: "image", keterangan: "anonim", exif: { lat: -2 } },
    media[1],
    media[2],
  ]);
  assert.equal(anonimkanMedia(media, new Set(["Orang Lain"])).berubah, false);
  assert.deepEqual(anonimkanMedia(null, new Set(["Siti Rahasia"])), { media: null, berubah: false });
});
