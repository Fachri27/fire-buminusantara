/**
 * GET /api/mobile/captcha — halaman Turnstile kecil yang dibuka aplikasi di
 * WebView sesaat sebelum laporan tamu/anonim dikirim. Dilayani dari domain
 * situs sendiri, jadi validasi hostname Turnstile tetap lolos. Token dikirim
 * ke aplikasi lewat window.ReactNativeWebView.postMessage, lalu ditukar di
 * POST /api/mobile/tiket.
 *
 * Route handler HTML, bukan halaman [locale]: tanpa kepala/kaki situs, dan
 * /api tidak disentuh pengalih bahasa di proxy.ts.
 */
export function GET() {
  const kunci = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verifikasi</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 15px/1.45 system-ui, -apple-system, sans-serif; background: #f7f8f5; color: #1b211d; }
  @media (prefers-color-scheme: dark) { body { background: #101312; color: #f7f8f8; } }
  main { display: grid; justify-items: center; gap: 14px; padding: 24px; text-align: center; }
  p { margin: 0; opacity: .75; }
</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=siap&render=explicit" async defer></script>
</head>
<body>
<main>
  <p id="pesan">Memastikan kiriman dari manusia…</p>
  <div id="widget"></div>
</main>
<script>
  var KUNCI = ${JSON.stringify(kunci)};
  function kirim(pesan) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(pesan));
  }
  function siap() {
    // Tanpa site key (hanya terjadi di pengembangan): server pun melewatkan verifikasi.
    if (!KUNCI) return kirim({ token: "tanpa-captcha" });
    turnstile.render("#widget", {
      sitekey: KUNCI,
      language: "id",
      theme: "auto",
      callback: function (token) {
        document.getElementById("pesan").textContent = "Terverifikasi.";
        kirim({ token: token });
      },
      "error-callback": function () { kirim({ galat: "Verifikasi gagal dimuat. Periksa koneksi lalu coba lagi." }); },
      "expired-callback": function () { turnstile.reset("#widget"); },
    });
  }
</script>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
