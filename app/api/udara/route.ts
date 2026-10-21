import { NextRequest, NextResponse } from "next/server";
import { brotliCompressSync, gzipSync, constants as konstantaZlib } from "node:zlib";
import { getUdaraMetadata, getUdaraFrame } from "@/lib/udara-reader";
import { GalatHuluZarr } from "@/lib/zarr-reader";

/**
 * Data lapisan "Angin dan Kualitas Udara" (AQI PM2.5 + angin 10 m, CAMS).
 * Kontrak sejajar dengan /api/sebaran-asap: `mode=metadata` (linimasa yang
 * sama persis) dan `mode=frame` (biner tiga bidang aqi | u | v, lihat
 * lib/udara-reader.ts).
 */

/** Bilangan bulat non-negatif polos — tolak "1.5", "12abc", "-1" sebelum menyentuh ECMWF. */
const POLA_BILANGAN = /^\d{1,6}$/;
/** time_step store berisi jam 0..120 (shape 121). */
const STEP_MAKS = 120;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "metadata";
  const force = searchParams.get("force") === "true" || searchParams.has("_ts");

  try {
    if (mode === "metadata") {
      const metadata = await getUdaraMetadata(force);
      return NextResponse.json(metadata, {
        headers: {
          "Cache-Control": force
            ? "no-cache, no-store, must-revalidate"
            : "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
        },
      });
    }

    if (mode === "frame") {
      const timeChunkStr = searchParams.get("timeChunk") ?? "";
      const stepStr = searchParams.get("step") ?? "";
      const timeInnerStr = searchParams.get("timeInner") ?? "0";

      if (!POLA_BILANGAN.test(timeChunkStr) || !POLA_BILANGAN.test(stepStr) || !/^[01]$/.test(timeInnerStr)) {
        return NextResponse.json({ error: "Invalid timeChunk, step or timeInner parameter" }, { status: 400 });
      }
      const timeChunk = Number(timeChunkStr);
      const step = Number(stepStr);
      const timeInner = Number(timeInnerStr);
      if (step > STEP_MAKS) {
        return NextResponse.json({ error: `step must be 0..${STEP_MAKS}` }, { status: 400 });
      }

      const { buffer, lengkap } = await getUdaraFrame(timeChunk, step, timeInner);

      // Kompresi di sini (bukan nginx) dengan alasan yang sama seperti
      // /api/sebaran-asap: octet-stream tidak masuk gzip_types bawaan.
      // Brotli mutu 5 — mutu bawaan 11 boros CPU untuk puluhan frame.
      // Frame kosong (run belum ditulis ECMWF) tidak boleh ditahan CDN/peramban
      // seharian: begitu datanya tiba, permintaan berikutnya harus mendapatkannya.
      const terima = req.headers.get("accept-encoding") ?? "";
      let isi: Uint8Array = buffer;
      const kepala: Record<string, string> = {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": lengkap
          ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=172800"
          : "no-cache, no-store, must-revalidate",
        Vary: "Accept-Encoding",
      };
      if (terima.includes("br")) {
        isi = brotliCompressSync(buffer, {
          params: { [konstantaZlib.BROTLI_PARAM_QUALITY]: 5 },
        });
        kepala["Content-Encoding"] = "br";
        kepala["Content-Length"] = String(isi.byteLength);
      } else if (terima.includes("gzip")) {
        isi = gzipSync(buffer);
        kepala["Content-Encoding"] = "gzip";
        kepala["Content-Length"] = String(isi.byteLength);
      }

      return new Response(isi as unknown as BodyInit, {
        status: 200,
        headers: kepala,
      });
    }

    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
  } catch (error) {
    console.error("[API udara] Error:", error);
    const dariHulu = error instanceof GalatHuluZarr;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: dariHulu ? 502 : 500 }
    );
  }
}
