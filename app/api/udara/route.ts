import { NextRequest, NextResponse } from "next/server";
import { brotliCompressSync, gzipSync, constants as konstantaZlib } from "node:zlib";
import { getUdaraMetadata, getUdaraFrame } from "@/lib/udara-reader";
import { GalatHuluZarr, STEP_MAKS, adaDiLinimasa, bacaParamFrame } from "@/lib/zarr-reader";

/**
 * Data lapisan "Angin dan Kualitas Udara" (AQI PM2.5 + angin 10 m, CAMS).
 * Kontrak sejajar dengan /api/sebaran-asap: `mode=metadata` (linimasa yang
 * sama persis) dan `mode=frame` (biner tiga bidang aqi | u | v, lihat
 * lib/udara-reader.ts).
 */

/**
 * Iframe peta Windy (/api/forecasting) di-sandbox tanpa allow-same-origin,
 * jadi fetch-nya ke sini datang dari origin "null" — data publik tanpa
 * kredensial, aman dibuka untuk semua origin.
 */
const CORS = { "Access-Control-Allow-Origin": "*" };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "metadata";
  const force = searchParams.get("force") === "true" || searchParams.has("_ts");

  try {
    if (mode === "metadata") {
      const metadata = await getUdaraMetadata(force);
      return NextResponse.json(metadata, {
        headers: {
          ...CORS,
          "Cache-Control": force
            ? "no-cache, no-store, must-revalidate"
            : "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
        },
      });
    }

    if (mode === "frame") {
      const param = bacaParamFrame(searchParams);
      if (!param) {
        return NextResponse.json(
          { error: `Invalid timeChunk, step (0..${STEP_MAKS}) or timeInner (0|1) parameter` },
          { status: 400, headers: CORS }
        );
      }
      const { timeChunk, step, timeInner } = param;
      // Hanya kombinasi linimasa saat ini — timeChunk bebas = 3 unduhan ECMWF per permintaan.
      if (!(await adaDiLinimasa(timeChunk, step, timeInner))) {
        return NextResponse.json({ error: "Frame tidak ada di linimasa saat ini" }, { status: 404, headers: CORS });
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
        ...CORS,
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

    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400, headers: CORS });
  } catch (error) {
    console.error("[API udara] Error:", error);
    const status = error instanceof GalatHuluZarr ? (error.status === 503 ? 503 : 502) : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status, headers: CORS }
    );
  }
}
