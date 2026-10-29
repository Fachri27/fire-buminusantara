import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

// Menguji deploy/gen-secrets.sh (bash + openssl) — ditaruh di lib/ supaya ikut
// pola `npm test`, seperti media-route.test.ts yang menguji rute di app/.
const jalankan = promisify(execFile);
const SKRIP = path.join(process.cwd(), "deploy/gen-secrets.sh");

test("gen-secrets: slot *_SECRET/*_PASS kosong diisi acak, kecuali MANUAL_KEYS", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "gen-secrets-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const env = path.join(dir, ".env");
  await writeFile(
    env,
    [
      "SESSION_SECRET=",
      "DB_PASS=",
      "CRON_SECRET=sudah-ada",
      "LIVEKIT_API_SECRET=",
      "LIVEKIT_API_KEY=",
      "TRUSTED_PROXY_HOPS=1",
    ].join("\n") + "\n",
  );

  const { stdout } = await jalankan("bash", [SKRIP, env]);
  assert.match(stdout, /terisi: 2 kunci acak/);

  const isi = Object.fromEntries(
    (await readFile(env, "utf8"))
      .trim()
      .split("\n")
      .map((baris) => [baris.slice(0, baris.indexOf("=")), baris.slice(baris.indexOf("=") + 1)]),
  );
  assert.match(isi.SESSION_SECRET, /^[A-Za-z0-9]{20,}$/);
  assert.match(isi.DB_PASS, /^[A-Za-z0-9]{20,}$/);
  assert.notEqual(isi.SESSION_SECRET, isi.DB_PASS);
  assert.equal(isi.CRON_SECRET, "sudah-ada", "yang sudah berisi tidak ditimpa");
  assert.equal(isi.LIVEKIT_API_SECRET, "", "harus sama dengan server LiveKit — tidak boleh diacak");
  assert.equal(isi.LIVEKIT_API_KEY, "");
  assert.equal(isi.TRUSTED_PROXY_HOPS, "1");
});
