import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hangatkanSemuaFrame } from "@/lib/zarr-reader";

export const maxDuration = 60; // Timeout 60 detik untuk pre-warm background

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

function isLocalhostRequest(req: NextRequest): boolean {
  const hostname = req.nextUrl.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  ) {
    return true;
  }

  const hostHeader = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  if (
    hostHeader === "localhost" ||
    hostHeader === "127.0.0.1" ||
    hostHeader === "::1" ||
    hostHeader === "[::1]"
  ) {
    return true;
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const clientIp = forwardedFor.split(",")[0].trim().toLowerCase();
    if (clientIp === "127.0.0.1" || clientIp === "::1") {
      return true;
    }
  }

  return false;
}

async function prosesPrewarm(req: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";
  const secretKey = process.env.CRON_SECRET;

  // 1. Enforce fail-closed security in production
  if (isProduction && !secretKey) {
    console.error(
      "[Cron warm-asap] CRON_SECRET is not configured on the server in production."
    );
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 401 }
    );
  }

  // 2. Disallow passing secrets via URL query string to avoid credential leakage in server access logs
  if (req.nextUrl.searchParams.has("secret")) {
    return NextResponse.json(
      {
        error:
          "Passing secrets via query parameter is disallowed. Use 'Authorization: Bearer <token>' header instead.",
      },
      { status: 400 }
    );
  }

  // 3. Extract secret from Authorization: Bearer <token> header
  const authHeader = req.headers.get("authorization");
  let token: string | null = null;
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1].trim().length > 0) {
      token = match[1].trim();
    }
  }

  // 4. Authenticate token using timingSafeEqual or allow dev exceptions
  let isAuthorized = false;

  if (secretKey && token) {
    isAuthorized = timingSafeCompare(token, secretKey);
  }

  if (!isAuthorized) {
    if (!isProduction) {
      if (!secretKey) {
        console.warn(
          "[Cron warm-asap] Development mode: CRON_SECRET is not configured. Allowing invocation without secret."
        );
        isAuthorized = true;
      } else if (isLocalhostRequest(req) && !token) {
        console.warn(
          "[Cron warm-asap] Development mode: Allowing unauthenticated invocation from localhost."
        );
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing cron secret" },
      { status: 401 }
    );
  }

  try {
    const hasil = await hangatkanSemuaFrame();

    return NextResponse.json({
      success: true,
      message: `Berhasil menghangatkan ${hasil.berhasil}/${hasil.total} frame sebaran asap ke memori server`,
      ...hasil,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Cron warm-asap] Gagal pre-warm:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal menghangatkan cache sebaran asap",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return prosesPrewarm(req);
}

export async function POST(req: NextRequest) {
  return prosesPrewarm(req);
}
