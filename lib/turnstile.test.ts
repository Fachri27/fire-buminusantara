import { test } from "node:test";
import assert from "node:assert/strict";
import { turnstileSah } from "./turnstile.ts";
import { URL_SITUS } from "./situs.ts";

const HOST = new URL(URL_SITUS).hostname;
const env = process.env as Record<string, string | undefined>;

/** Pasang lingkungan `nodeEnv` untuk satu uji; kembaliannya memanggil turnstileSah dengan siteverify tiruan. */
function siapkan(t: import("node:test").TestContext, nodeEnv: string) {
  const lama = { NODE_ENV: env.NODE_ENV, TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY, WEBAUTHN_ORIGIN: env.WEBAUTHN_ORIGIN };
  t.after(() => {
    for (const [k, v] of Object.entries(lama)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  });
  env.NODE_ENV = nodeEnv;
  env.TURNSTILE_SECRET_KEY = "rahasia-uji";
  env.WEBAUTHN_ORIGIN = "https://api.situs.uji, http://localhost:3000";
  t.mock.method(console, "error", () => {});
  let jawaban: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async () => Response.json(jawaban));
  return (j: Record<string, unknown>, aksi?: string) => {
    jawaban = j;
    return turnstileSah("token", null, aksi);
  };
}

test("turnstileSah: produksi — hostname harus domain situs, action harus cocok bila diminta", async (t) => {
  const uji = siapkan(t, "production");
  assert.equal(await uji({ success: true, hostname: HOST, action: "komentar" }, "komentar"), true);
  assert.equal(await uji({ success: true, hostname: "api.situs.uji", action: "" }), true, "domain dari WEBAUTHN_ORIGIN");
  assert.equal(await uji({ success: true, hostname: "jahat.example", action: "komentar" }, "komentar"), false);
  assert.equal(await uji({ success: true, hostname: "localhost", action: "" }), false, "localhost tidak di produksi");
  assert.equal(await uji({ success: true, hostname: HOST, action: "" }, "komentar"), false, "token widget laporan");
  assert.equal(await uji({ success: false, hostname: HOST }), false);
});

test("turnstileSah: di luar produksi hanya success yang dicek (kunci uji Cloudflare, localhost/IP LAN)", async (t) => {
  const uji = siapkan(t, "development");
  assert.equal(await uji({ success: true, hostname: "example.com", action: "test" }, "komentar"), true);
  assert.equal(await uji({ success: false }, "komentar"), false);
});
