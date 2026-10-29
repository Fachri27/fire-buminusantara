import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { GET } from "../app/media/[...path]/route.ts";
import { getMinioClient } from "./unggah.ts";

const AKAR_MEDIA = path.join(process.cwd(), "media");
const NAMA_UJI = `${randomUUID()}.jpg`;
const UJI_DIR = path.join(AKAR_MEDIA, "gambar");
const UJI_FILE = path.join(UJI_DIR, NAMA_UJI);
const KONTEN_UJI = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

type S3ClientMock = { send: (cmd: unknown) => Promise<unknown> };

/** Ganti client.send selama satu uji — tak ada yang menyentuh MinIO sungguhan. */
function tiruMinio(t: { after: (fn: () => void) => void }, send: S3ClientMock["send"]): void {
  const client = getMinioClient() as unknown as S3ClientMock;
  const asli = client.send;
  client.send = send;
  t.after(() => { client.send = asli; });
}

test("media route: melayani berkas lokal dengan header lengkap", async (t) => {
  await mkdir(UJI_DIR, { recursive: true });
  await writeFile(UJI_FILE, KONTEN_UJI);

  t.after(async () => {
    await rm(UJI_FILE, { force: true });
  });
  // Objek tak ada di MinIO → jatuh ke cadangan lokal.
  tiruMinio(t, async () => {
    throw Object.assign(new Error("NoSuchKey"), { $metadata: { httpStatusCode: 404 } });
  });

  const req = new Request(`http://localhost/media/gambar/${NAMA_UJI}`);
  const res = await GET(req, { params: Promise.resolve({ path: ["gambar", NAMA_UJI] }) });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/jpeg");
  assert.equal(res.headers.get("content-length"), String(KONTEN_UJI.length));
  assert.equal(res.headers.get("accept-ranges"), "bytes");
  assert.ok(res.headers.get("etag"), "harus menyertakan ETag");
  assert.ok(res.headers.get("last-modified"), "harus menyertakan Last-Modified");
  assert.equal(res.headers.get("cache-control"), "public, max-age=86400", "sehari, tanpa immutable");

  const etag = res.headers.get("etag")!;

  // 304 Not Modified dengan If-None-Match
  const req304 = new Request(`http://localhost/media/gambar/${NAMA_UJI}`, {
    headers: { "if-none-match": etag },
  });
  const res304 = await GET(req304, { params: Promise.resolve({ path: ["gambar", NAMA_UJI] }) });
  assert.equal(res304.status, 304);
  assert.equal(res304.headers.get("etag"), etag);

  // 304 Not Modified dengan If-Modified-Since
  const lastModified = res.headers.get("last-modified")!;
  const reqIms = new Request(`http://localhost/media/gambar/${NAMA_UJI}`, {
    headers: { "if-modified-since": lastModified },
  });
  const resIms = await GET(reqIms, { params: Promise.resolve({ path: ["gambar", NAMA_UJI] }) });
  assert.equal(resIms.status, 304);

  // 206 Partial Content dengan Range
  const reqRange = new Request(`http://localhost/media/gambar/${NAMA_UJI}`, {
    headers: { range: "bytes=0-3" },
  });
  const resRange = await GET(reqRange, { params: Promise.resolve({ path: ["gambar", NAMA_UJI] }) });
  assert.equal(resRange.status, 206);
  assert.equal(resRange.headers.get("content-range"), `bytes 0-3/${KONTEN_UJI.length}`);
  assert.equal(resRange.headers.get("content-length"), "4");
  const bytes = Buffer.from(await resRange.arrayBuffer());
  assert.equal(bytes.length, 4);
  assert.deepEqual(bytes, KONTEN_UJI.subarray(0, 4));

  // Penjagaan path traversal
  const reqJahat = new Request("http://localhost/media/../package.json");
  const resJahat = await GET(reqJahat, { params: Promise.resolve({ path: ["..", "package.json"] }) });
  assert.equal(resJahat.status, 404);
});

const NAMA_WEBP = `${randomUUID()}.webp`;

test("media route: stream langsung via GetObjectCommand tanpa HeadObjectCommand dan mendukung 304", async (t) => {
  const { getMinioClient } = await import("./unggah.ts");
  const client = getMinioClient();
  const originalSend = client.send;

  const perintahTerkirim: string[] = [];
  let simulasiRange: string | undefined;

  type S3ClientMock = {
    send: (cmd: unknown) => Promise<unknown>;
  };
  type S3CommandMock = {
    constructor?: { name?: string };
    input?: { Range?: string; IfNoneMatch?: string };
  };

  // Mock client.send
  (client as unknown as S3ClientMock).send = async (rawCmd: unknown) => {
    const cmd = rawCmd as S3CommandMock;
    const namaPerintah = cmd.constructor?.name || "UnknownCommand";
    perintahTerkirim.push(namaPerintah);

    if (namaPerintah === "GetObjectCommand") {
      simulasiRange = cmd.input?.Range;

      if (cmd.input?.IfNoneMatch === '"s3-etag-123"') {
        const err = Object.assign(new Error("Not Modified"), {
          $metadata: { httpStatusCode: 304 },
        });
        throw err;
      }

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]));
          controller.close();
        },
      });

      return {
        $metadata: { httpStatusCode: cmd.input?.Range ? 206 : 200 },
        Body: stream,
        ContentLength: 4,
        ContentType: "image/webp",
        ETag: '"s3-etag-123"',
        LastModified: new Date("2026-09-01T12:00:00Z"),
        ContentRange: cmd.input?.Range ? "bytes 0-3/4" : undefined,
      };
    }

    throw new Error(`Unexpected command: ${namaPerintah}`);
  };

  t.after(() => {
    (client as unknown as S3ClientMock).send = originalSend as unknown as S3ClientMock["send"];
  });

  // 1. Permintaan biasa ke MinIO
  const req1 = new Request(`http://localhost/media/gambar/${NAMA_WEBP}`);
  const res1 = await GET(req1, { params: Promise.resolve({ path: ["gambar", NAMA_WEBP] }) });

  assert.equal(res1.status, 200);
  assert.equal(res1.headers.get("content-type"), "image/webp");
  assert.equal(res1.headers.get("etag"), '"s3-etag-123"');
  assert.equal(res1.headers.get("content-length"), "4");
  assert.equal(res1.headers.get("cache-control"), "public, max-age=86400");
  assert.equal(perintahTerkirim.includes("HeadObjectCommand"), false, "HeadObjectCommand TIDAK boleh dipanggil");
  assert.equal(perintahTerkirim.filter((p) => p === "GetObjectCommand").length, 1);

  // 2. Permintaan dengan If-None-Match menghasilkan 304
  const req2 = new Request(`http://localhost/media/gambar/${NAMA_WEBP}`, {
    headers: { "if-none-match": '"s3-etag-123"' },
  });
  const res2 = await GET(req2, { params: Promise.resolve({ path: ["gambar", NAMA_WEBP] }) });
  assert.equal(res2.status, 304);
  assert.equal(res2.headers.get("etag"), '"s3-etag-123"');

  // 3. Permintaan Range mengalirkan 206 langsung
  perintahTerkirim.length = 0;
  const req3 = new Request(`http://localhost/media/gambar/${NAMA_WEBP}`, {
    headers: { range: "bytes=0-3" },
  });
  const res3 = await GET(req3, { params: Promise.resolve({ path: ["gambar", NAMA_WEBP] }) });
  assert.equal(res3.status, 206);
  assert.equal(res3.headers.get("content-range"), "bytes 0-3/4");
  assert.equal(simulasiRange, "bytes=0-3");
  assert.equal(perintahTerkirim.includes("HeadObjectCommand"), false);
});

test("media route: hanya kunci unggahan publik yang dilayani; asli/ & bentuk lain 404 tanpa lookup", async (t) => {
  let lookup = 0;
  tiruMinio(t, async () => {
    lookup++;
    throw new Error("tidak boleh dipanggil");
  });

  const uuid = randomUUID();
  const ditolak = [
    ["asli", `${uuid}.jpg`], // salinan ber-EXIF
    ["asli", `${uuid}.mp4`],
    ["gambar", "foto.jpg"], // bukan UUID
    ["gambar", `${uuid}.html`], // ekstensi asing
    ["gambar", `${uuid.toUpperCase()}.jpg`],
    ["lain", `${uuid}.jpg`], // folder asing
    ["gambar", "..", "asli", `${uuid}.jpg`],
    ["..", "package.json"],
    [`${uuid}.jpg`],
    ["gambar", "sub", `${uuid}.jpg`],
  ];
  for (const bagian of ditolak) {
    const res = await GET(new Request(`http://localhost/media/${bagian.join("/")}`), {
      params: Promise.resolve({ path: bagian }),
    });
    assert.equal(res.status, 404, bagian.join("/"));
  }
  assert.equal(lookup, 0, "kunci yang ditolak tidak boleh sampai ke MinIO");
});
