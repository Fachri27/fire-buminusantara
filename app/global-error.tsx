"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log fatal unhandled error to client console for telemetry auditing
    console.error("Global application error boundary caught:", error);
  }, [error]);

  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>500 — Gangguan Sistem Kritis | Fire</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body
        style={{
          margin: 0,
          backgroundColor: "#0d1117",
          color: "#e6edf3",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          boxSizing: "border-box",
        }}
      >
        <main
          style={{
            maxWidth: "32rem",
            width: "100%",
            backgroundColor: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "0.75rem",
            padding: "2.25rem 2rem",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
            textAlign: "center",
          }}
        >
          {/* Status Indicator Icon */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: "9999px",
              backgroundColor: "rgba(248, 81, 73, 0.12)",
              border: "1px solid rgba(248, 81, 73, 0.3)",
              marginBottom: "1.25rem",
              color: "#f85149",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <div
            style={{
              display: "inline-block",
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#f85149",
              marginBottom: "0.5rem",
            }}
          >
            Critical System Failure // Galat 500
          </div>

          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              lineHeight: 1.25,
              margin: "0 0 0.75rem 0",
              color: "#f0f6fc",
            }}
          >
            Sistem Mengalami Kendala Kritis
          </h1>

          <p
            style={{
              fontSize: "0.875rem",
              lineHeight: 1.5,
              color: "#8b949e",
              margin: "0 0 1.5rem 0",
            }}
          >
            Terjadi kegagalan fatal pada tingkat aplikasi root. Layanan telemetri
            dan pemantauan karhutla terhenti sementara dan tidak dapat memulihkan diri secara otomatis.
          </p>

          {error?.digest && (
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "0.75rem",
                padding: "0.5rem 0.75rem",
                backgroundColor: "#0d1117",
                border: "1px solid #30363d",
                borderRadius: "0.375rem",
                color: "#79c0ff",
                marginBottom: "1.5rem",
                wordBreak: "break-all",
              }}
            >
              Diagnostic Digest: {error.digest}
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
              marginTop: "0.5rem",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                backgroundColor: "#e60012",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
                transition: "opacity 0.2s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              Coba Pulihkan Sesi
            </button>

            <Link
              href="/id"
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                backgroundColor: "#21262d",
                color: "#c9d1d9",
                border: "1px solid #30363d",
                borderRadius: "0.375rem",
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
                transition: "background-color 0.2s ease, color 0.2s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "#30363d";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "#21262d";
                e.currentTarget.style.color = "#c9d1d9";
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Kembali ke Beranda
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
