import { NextRequest, NextResponse } from "next/server";
import petaProvinsi from "@/public/data/peta-provinsi.json";
import { inferPulau } from "@/lib/wilayah";
import { PUSAT_WILAYAH } from "@/lib/pusat-wilayah";

// Pemetaan nama provinsi ke pulau
const PROVINSI_PULAU: Record<string, string> = {};
for (const feature of petaProvinsi.features) {
  const nama = feature.properties.nama;
  const pulau = inferPulau(nama);
  if (pulau) PROVINSI_PULAU[nama] = pulau;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // 1. Parse lat, lon, and zoom query parameters strictly using Number.parseFloat()
  const rawLat = Number.parseFloat(searchParams.get("lat") ?? "");
  const rawLon = Number.parseFloat(searchParams.get("lon") ?? "");
  const rawZoom = Number.parseFloat(searchParams.get("zoom") ?? "");

  // 2 & 3. Enforce strict geographic boundaries for Indonesia and safe defaults on NaN / non-finite values
  const safeLat = Number.isNaN(rawLat) || !Number.isFinite(rawLat)
    ? 0.200
    : Math.min(Math.max(rawLat, -15.0), 15.0);
  const safeLon = Number.isNaN(rawLon) || !Number.isFinite(rawLon)
    ? 118.000
    : Math.min(Math.max(rawLon, 90.0), 145.0);
  const safeZoom = Number.isNaN(rawZoom) || !Number.isFinite(rawZoom)
    ? 5.0
    : Math.min(Math.max(rawZoom, 2.0), 18.0);

  const lat = safeLat.toFixed(3);
  const lon = safeLon.toFixed(3);
  // Dua desimal: konsol /peta mengirim zoom pecahan hasil cameraForBounds
  // lapisan Aerosol, dan pembulatan ke satu desimal sudah menggeser Papua.
  const zoom = safeZoom.toFixed(2);
  // Konsol /peta: halamannya tak menggulir, jadi roda tetikus memperbesar
  // peta seperti lapisan Aerosol, bukan diteruskan ke guliran halaman.
  const konsol = searchParams.get("konsol") === "1";
  // Landing karhutla: tombol bentang selayar dipasang di tumpukan zoom iframe
  // — kliknya mengirim BUKA_SELAYAR ke halaman induk lewat postMessage.
  const bentang = searchParams.get("bentang") === "1";
  // ringkas: legendaRingkas aktif (bingkai sempit / panggung dasbor)
  const ringkas = searchParams.get("ringkas") === "1";
  // aplikasi: aplikasi Laporin — tombol lapisan, legenda AQI, dan bilah waktu
  // native di luar iframe, jadi peta tampil polos seperti lapisan Aerosol-nya.
  const aplikasi = searchParams.get("aplikasi") === "1";
  // Tema terang / gelap (disinkronkan dengan tema aktif situs)
  const temaAwal = searchParams.get("tema") === "light" ? "light" : "dark";
  // Kontrol zoom ditaruh di top 16px bila ada tombol bentang selayar di atasnya
  // atau saat mode ringkas aktif tanpa modal selayar. Saat di modal selayar (!bentang && !ringkas),
  // tombol tutup selayar (X) menempati top 16px, sehingga tumpukan zoom mulai di top 80px (sama persis dengan PetaAsap).
  const topControls = bentang || ringkas ? "16px" : "80px";
  // Dibangun di sisi server (bukan backtick bersarang di dalam template skrip)
  // dan disisipkan sebagai anak pertama tumpukan — sama seperti posisi tombol
  // bentang di tumpukan kendali lapisan Aerosol (PetaAsap).
  const tombolBentang = bentang
    ? '<button id="btn-bentang" type="button" aria-label="Buka peta selayar" title="Buka peta selayar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg></button>'
    : "";

  // Router Windy hanya mengenali zoom bulat di URL — zoom pecahan membuatnya
  // membuang seluruh posisi dan jatuh ke lokasi GeoIP. Pecahannya diterapkan
  // belakangan lewat setView (ZOOM_AWAL di skrip).
  const zoomUrl = Math.round(safeZoom);

  const targetUrl = `https://www.windy.com/-Air-quality-index-aqi?cams,aqi,${lat},${lon},${zoomUrl}`;

  try {
    const resWindy = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!resWindy.ok) {
      return new NextResponse(`Windy upstream error: ${resWindy.statusText}`, { status: 502 });
    }

    const html = await resWindy.text();

    const baseTag = `<base href="https://www.windy.com/">`;

    // 1. Script injected at the VERY TOP of <head> before Windy's scripts execute
    const preInitScript = `
      <script>
        (function() {
          // 00. Dokumen ini di-sandbox tanpa allow-same-origin (origin buram,
          // lihat header CSP di bawah & atribut sandbox di peta.tsx): akses
          // localStorage / sessionStorage / document.cookie melempar
          // SecurityError dan bisa mematikan boot Windy. Ganti dengan tiruan
          // dalam-memori — isinya memang tak perlu bertahan antarmuat.
          function gudangMemori() {
            var isi = {};
            var g = {};
            Object.defineProperties(g, {
              length: { get: function() { return Object.keys(isi).length; } },
              key: { value: function(i) { var k = Object.keys(isi); return i < k.length ? k[i] : null; } },
              getItem: { value: function(k) { k = String(k); return Object.prototype.hasOwnProperty.call(isi, k) ? isi[k] : null; } },
              setItem: { value: function(k, v) { isi[String(k)] = String(v); } },
              removeItem: { value: function(k) { delete isi[String(k)]; } },
              clear: { value: function() { isi = {}; } }
            });
            return g;
          }
          ['localStorage', 'sessionStorage'].forEach(function(nama) {
            try { window[nama].getItem('_'); } catch (e) {
              try { Object.defineProperty(window, nama, { value: gudangMemori(), configurable: true }); } catch (e2) {}
            }
          });
          try { void document.cookie; } catch (e) {
            var kue = {};
            try {
              Object.defineProperty(document, 'cookie', {
                configurable: true,
                get: function() { return Object.keys(kue).map(function(k) { return k + '=' + kue[k]; }).join('; '); },
                set: function(v) {
                  var pasangan = String(v).split(';')[0];
                  var i = pasangan.indexOf('=');
                  if (i > 0) kue[pasangan.slice(0, i).trim()] = pasangan.slice(i + 1).trim();
                }
              });
            } catch (e2) {}
          }

          // 0. Spoof document.referrer to bypass iframe unlegal embed check
          try {
            Object.defineProperty(document, 'referrer', {
              get: function() { return 'https://www.windy.com/'; },
              configurable: true
            });
          } catch(e) {}
          try {
            Object.defineProperty(Document.prototype, 'referrer', {
              get: function() { return 'https://www.windy.com/'; },
              configurable: true
            });
          } catch(e) {}

          // 0b. Bungkam telemetri/analitik Windy (/ga/) dan endpoint privat
          // (account.windy.com, capalerts). Endpoint /forecast/fragment/ dibiarkan
          // lolos karena mendukung CORS publik dan menyediakan data weather .now.temperature.
          var _windyBungkam = function(u) {
            try { u = String(u); } catch(e) { return false; }
            return (u.indexOf('node.windy.com') !== -1 && (u.indexOf('/ga/') !== -1 || u.indexOf('/capalerts/') !== -1)) ||
                   (u.indexOf('account.windy.com') !== -1);
          };
          try {
            var _fetchAsli = window.fetch;
            window.fetch = function(input, init) {
              var url = (input && typeof input === 'object' && input.url) ? input.url : input;
              if (_windyBungkam(url)) {
                var urlStr = String(url);
                var isJson = urlStr.indexOf('account.windy.com') !== -1 || urlStr.indexOf('/capalerts/') !== -1;
                return Promise.resolve(new Response(isJson ? '{}' : null, {
                  status: 200,
                  statusText: 'OK',
                  headers: isJson ? { 'Content-Type': 'application/json' } : {}
                }));
              }
              return _fetchAsli.apply(this, arguments);
            };
          } catch(e) {}
          try {
            var _xhrOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              this.__windyBungkam = _windyBungkam(url);
              var urlStr = String(url);
              this.__windyIsJson = urlStr.indexOf('account.windy.com') !== -1 || urlStr.indexOf('/capalerts/') !== -1;
              return _xhrOpen.apply(this, arguments);
            };
            var _xhrSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function() {
              if (this.__windyBungkam) {
                var diri = this;
                setTimeout(function() {
                  try {
                    Object.defineProperty(diri, 'readyState', { value: 4, writable: false });
                    Object.defineProperty(diri, 'status', { value: 200, writable: false });
                    Object.defineProperty(diri, 'statusText', { value: 'OK', writable: false });
                    var resPayload = diri.__windyIsJson ? '{"alerts":[],"result":"ok"}' : '';
                    Object.defineProperty(diri, 'responseText', { value: resPayload, writable: false });
                    Object.defineProperty(diri, 'response', { value: resPayload, writable: false });
                  } catch(e) {}
                  try { if (typeof diri.onreadystatechange === 'function') diri.onreadystatechange(); } catch(e) {}
                  try { diri.dispatchEvent(new Event('readystatechange')); } catch(e) {}
                  try { diri.dispatchEvent(new Event('load')); } catch(e) {}
                  try { diri.dispatchEvent(new Event('loadend')); } catch(e) {}
                }, 0);
                return;
              }
              return _xhrSend.apply(this, arguments);
            };
          } catch(e) {}
          try {
            if (navigator.sendBeacon) {
              var _beaconAsli = navigator.sendBeacon.bind(navigator);
              navigator.sendBeacon = function(url, data) {
                if (_windyBungkam(url)) return true;
                return _beaconAsli(url, data);
              };
            }
          } catch(e) {}
          // Jaring pengaman: telan sisa rejection "Failed to fetch" di dalam
          // iframe peta (konteks ini hanya Windy + skrip peta kita), juga
          // IndexedDB yang ditolak di origin buram (sandbox) — Windy tetap
          // jalan tanpa tembolok IDB-nya, hanya konsolnya banjir galat.
          window.addEventListener('unhandledrejection', function(ev) {
            try {
              var m = ev && ev.reason && (ev.reason.message || String(ev.reason));
              if (m && (m.indexOf('Failed to fetch') !== -1 || m.indexOf('Indexed Database') !== -1)) { ev.preventDefault(); }
            } catch(e) {}
          });

          // A. Wrap history methods to prevent cross-origin SecurityError caused by <base href>
          var _docOrigin = window.location.origin;
          var _origReplace = window.history.replaceState;
          window.history.replaceState = function(state, title, url) {
            try {
              if (typeof url === 'string' && !url.startsWith('http://') && !url.startsWith('https://')) {
                url = _docOrigin + (url.startsWith('/') ? url : '/' + url);
              }
              return _origReplace.call(window.history, state, title, url);
            } catch(e) {}
          };
          var _origPush = window.history.pushState;
          window.history.pushState = function(state, title, url) {
            try {
              if (typeof url === 'string' && !url.startsWith('http://') && !url.startsWith('https://')) {
                url = _docOrigin + (url.startsWith('/') ? url : '/' + url);
              }
              return _origPush.call(window.history, state, title, url);
            } catch(e) {}
          };

          // B. Pre-seed URL path & search before router parses window.location
          var targetPath = '/-Air-quality-index-aqi';
          var targetSearch = '?cams,aqi,${lat},${lon},${zoomUrl}';
          try {
            if (!window.location.pathname.includes('Air-quality-index') || !window.location.search.includes('aqi')) {
              window.history.replaceState(null, '', _docOrigin + targetPath + targetSearch);
            }
          } catch(e) {}

          // C. Pre-seed localStorage
          try {
            window.localStorage.setItem('startUpOverlay', JSON.stringify('aqi'));
            window.localStorage.setItem('startUpLastOverlay', JSON.stringify(true));
            window.localStorage.setItem('startUpLastProduct', JSON.stringify('cams'));
            window.localStorage.setItem('product', JSON.stringify('cams'));
            window.localStorage.setItem('overlay', JSON.stringify('aqi'));
          } catch(e) {}

          // D. Hook window.W.broadcast to BLOCK unwanted plugins from ever opening
          window.W = window.W || {};
          var _b = null;
          Object.defineProperty(window.W, 'broadcast', {
            configurable: true,
            enumerable: true,
            get: function() { return _b; },
            set: function(b) {
              _b = b;
              if (b && typeof b.emit === 'function') {
                var origEmit = b.emit;
                var blocked = {
                  'rhpane-top': true,
                  'progress-bar': true,
                  'search-input': true,
                  'startup-weather': true,
                  'startup-promos': true,
                  'startup-articles': true,
                  'startup-live-alerts': true,
                  'startup-pin2hp': true,
                  'onboarding': true,
                  'detail': true,
                  'default-model-selector': true,
                  'picker': true,
                  'picker-mobile': true,
                  'mobile-ui': true,
                  'menu': true,
                  'tools': true,
                  'share': true,
                  'articles': true,
                  'warnings': true
                };
                b.emit = function(event, name) {
                  if (event === 'rqstOpen' && blocked[name]) {
                    return false;
                  }
                  return origEmit.apply(this, arguments);
                };
                b.fire = b.emit;
                b.trigger = b.emit;
              }
            }
          });

          // E. Hook window.W.store safely to seed cams & aqi on boot and prevent desync
          var _s = null;
          Object.defineProperty(window.W, 'store', {
            configurable: true,
            enumerable: true,
            get: function() { return _s; },
            set: function(s) {
              _s = s;
              if (s && typeof s.set === 'function') {
                try {
                  s.set('product', 'cams');
                  s.set('overlay', 'aqi');
                } catch (e) {}

                // Pantau bila product ter-reset kembali ke ecmwf saat overlay adalah aqi:
                // paksa seketika kembali ke cams agar tile AQI tidak 404 / hitam.
                if (typeof s.on === 'function') {
                  try {
                    s.on('product', function(p) {
                      if (p !== 'cams' && s.get('overlay') === 'aqi') {
                        setTimeout(function() {
                          try { s.set('product', 'cams'); } catch (e) {}
                        }, 0);
                      }
                    });
                  } catch (e) {}
                }
              }
            }
          });

          // E2. Artikel & promo Windy ("Baru di Windy…", ajakan Premium). Selain
          // diblokir lewat broadcast (D), Windy bisa membukanya langsung lewat
          // plugin.open() — yang tak melewati broadcast. Begitu W.plugins ada,
          // open() ketiganya diganti no-op dan yang terlanjur terbuka ditutup;
          // CSS di bawah (#plugin-articles dkk.) menyembunyikannya sebagai pengaman.
          var PLUGIN_ARTIKEL = ['articles', 'startup-articles', 'startup-promos'];
          var cobaArtikel = 0;
          var penjagaArtikel = setInterval(function() {
            cobaArtikel++;
            var pl = window.W && window.W.plugins;
            var selesai = !!pl;
            if (pl) {
              PLUGIN_ARTIKEL.forEach(function(n) {
                var p = pl[n];
                if (!p) { selesai = false; return; }
                if (p.__dimatikan) return;
                try {
                  if (p.isOpen && typeof p.close === 'function') p.close();
                  p.open = function() { return Promise.resolve(); };
                  p.__dimatikan = true;
                } catch (e) { selesai = false; }
              });
            }
            // Berhenti setelah semuanya terpasang, atau menyerah setelah ±60 dtk.
            if (selesai || cobaArtikel > 150) clearInterval(penjagaArtikel);
          }, 400);

          // F. Disable context menu / right click completely
          window.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }, true);
          document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }, true);
        })();
      </script>
    `;

    // 2. Custom Styles for Windy + Administrative Polygons & Numbers
    const customStyles = `
      <style>
        /* Suppress context menu */
        #plugin-contextmenu,
        .contextmenu,
        .context-menu,
        #contextmenu,
        .leaflet-contextmenu {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          opacity: 0 !important;
        }

        /* A. Suppress all layer menu and sidebar elements */
        [data-plugin="rhpane-top"],
        #plugin-rhpane-top,
        .rhpane__top-icons,
        .rhitem--main-menu,
        .rhpane__overlays-wrapper,
        .rhpane__overlays-levels,
        .more-layers,
        .rhbottom__map-tools,
        .rhbottom__pois-controls,
        .rhbottom__checkboxes,
        .closing-x,
        [data-plugin="progress-bar"],
        #plugin-progress-bar,
        .progress-bar-wrapper,
        .progress-bar-right,
        .pb-calendar,
        .play-pause,
        .progress-bar,
        .timecode,
        #bottom,
        [data-plugin="search-input"],
        #plugin-search-input,
        #search,
        .search,
        #plugin-articles,
        [data-plugin="articles"],
        #plugin-startup-articles,
        [data-plugin="startup-articles"],
        #plugin-startup-promos,
        [data-plugin="startup-promos"],
        [data-plugin="startup-weather"],
        #plugin-startup-weather,
        .plugin-startup-weather,
        .top-banner,
        .rh-banners,
        #banner,
        #plugin-promo,
        .promo-container,
        .plugin-promo,
        #fav-alert-menu,
        #articles,
        #unlegal-embed,
        .unlegal-embed,
        /* Pemilih peta dasar Mapy.com (Outdoor / Winter sports / Aerial) —
           muncul sendiri saat zoom > 11; zoom pun dibatasi, lihat setMaxZoom. */
        [data-plugin="map-selector"],
        #plugin-map-selector,
        .map-selector,
        #warnings {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          max-width: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
        }

        /* A2. Elemen KHUSUS MOBILE Windy — hilangkan semuanya:
           - "Unduh Aplikasi" (#open-in-app, data-t=MENU_MOBILE)
           - hamburger merah kanan-bawah + toolbar kanan (home/cari/pin/favorit)
           Sebagian dibuat runtime saat Windy mendeteksi perangkat mobile, jadi
           daftar selectornya dibuat menyeluruh. Legenda AQI (#plugin-rhbottom)
           dan logo tetap ditampilkan oleh aturan di bawah. */
        #open-in-app,
        [data-ref="openInApp"],
        [data-t="MENU_MOBILE"],
        #mobile-ovr-select,
        .mobile-ovr-select,
        [data-ref="mobileOvrSelect"],
        #mobile-calendar,
        #plugin-mobile-calendar,
        #mobile-menu,
        .mobile-menu,
        [data-plugin="mobile-menu"],
        #hamburger,
        .hamburger,
        [data-ref="hamburger"],
        .rhitem__hamburger,
        /* Toolbar TOUCH/TABLET Windy — plugin "mobile-ui" (lazy-load, muncul saat
           Windy mendeteksi perangkat sentuh: home/cari/pin/favorit + hamburger
           merah bulat). Elemen ini BUKAN .rhitem, jadi harus disasar sendiri;
           #plugin-mobile-ui adalah kontainer pluginnya — menyembunyikannya
           menghapus seluruh toolbar sekaligus. Selector diverifikasi dari
           mobile-ui.js Windy v51.1.2. */
        #plugin-mobile-ui,
        .mobile-ui,
        .mobile-ui__icon,
        .mobile-ui__hamburger-icon,
        .mobile-ui__avatar,
        /* Semua tombol toolbar Windy (home / cari / pin / favorit / menu). Di
           mobile mereka dipindah keluar dari .rhpane__top-icons (yang sudah
           disembunyikan), jadi disasar langsung. Legenda AQI & logo BUKAN
           .rhitem, jadi tetap tampil. */
        .rhitem,
        [class*="rhitem--"],
        .rhpane__top-icons,
        .rhpane__overlays,
        .rhpane--mobile,
        .mobile-rhpane,
        .mobile-toolbar,
        #mobile-toolbar,
        .mobile-rh-tools,
        #plugin-picker-mobile {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
        }

        /* B. Transparent rhpane container */
        .rhpane {
          pointer-events: none !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* C. AQI Indicator on BOTTOM-RIGHT */
        #plugin-rhbottom {
          position: fixed !important;
          bottom: 16px !important;
          right: 20px !important;
          left: auto !important;
          top: auto !important;
          margin: 0 !important;
          width: 320px !important;
          z-index: 1000 !important;
          display: flex !important;
          pointer-events: auto !important;
        }

        .rhbottom__legend {
          display: flex !important;
          pointer-events: auto !important;
          margin: 0 !important;
          width: 320px !important;
          height: 24px !important;
          border-radius: 6px !important;
          overflow: hidden !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }

        /* D. Copernicus logo on BOTTOM-LEFT */
        .rhpane,
        .mobiletablethide.rhpane,
        #device-mobile .rhpane,
        #device-tablet .rhpane {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: none !important;
        }

        /* --kolom-kiri (SET_KOLOM): lebar kolom peringkat induk yang menutupi
           tepi kiri iframe — iframe melebar ke bawahnya supaya tak di-resize
           saat kolom diciutkan (peta.tsx), jadi logo kiri digeser keluar. */
        .rhpane__bottom-messages {
          position: fixed !important;
          bottom: 16px !important;
          left: calc(20px + var(--kolom-kiri, 0px)) !important;
          right: auto !important;
          top: auto !important;
          z-index: 1000 !important;
          margin: 0 !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          pointer-events: auto !important;
          transform: none !important;
          width: 115px !important;
          height: auto !important;
        }

        .rhpane__bottom-messages a {
          height: auto !important;
          display: flex !important;
          align-items: center !important;
        }

        .rhpane__bottom-messages img,
        img[src*="copernicus"] {
          width: 115px !important;
          max-width: 115px !important;
          height: auto !important;
          display: block !important;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.8)) !important;
          opacity: 0.95 !important;
        }

        /* E. Windy logo placed beside Copernicus */
        #logo-wrapper,
        [class*="on"] #logo-wrapper,
        #device-mobile #logo-wrapper,
        #device-tablet #logo-wrapper,
        body #logo-wrapper {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          container: none !important;
          border: none !important;
          background: transparent !important;
          width: auto !important;
          height: auto !important;
          pointer-events: none !important;
          z-index: 1000 !important;
        }

        #logo,
        #logo-wrapper #logo,
        [class*="on"] #logo-wrapper #logo,
        #device-mobile #logo,
        #device-tablet #logo {
          position: fixed !important;
          top: auto !important;
          right: auto !important;
          bottom: 16px !important;
          left: calc(151px + var(--kolom-kiri, 0px)) !important;
          z-index: 1000 !important;
          transform: scale(0.8) !important;
          transform-origin: bottom left !important;
          pointer-events: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          opacity: 0.95 !important;
          display: flex !important;
          align-items: center !important;
          visibility: visible !important;
          transition: opacity 0.2s ease !important;
        }

        #logo:hover {
          opacity: 1 !important;
        }

        /* E2. Mobile: responsive styles untuk bilah AQI, legenda, dan logo atribusi */
        @media (max-width: 640px) {
          /* #plugin-rhbottom: Bilah AQI penuh dengan jarak 12px di sisi kiri & kanan */
          #plugin-rhbottom {
            width: calc(100% - 24px) !important;
            left: 12px !important;
            right: 12px !important;
            bottom: 12px !important;
            margin: 0 auto !important;
            justify-content: center !important;
          }

          /* .rhbottom__legend: Skala penuh dengan tinggi 22px dan font 10px tanpa meluap */
          .rhbottom__legend {
            width: 100% !important;
            max-width: 100% !important;
            height: 22px !important;
            font-size: 10px !important;
            line-height: 22px !important;
          }

          .rhbottom__legend > *,
          .rhbottom__legend span,
          .rhbottom__legend div,
          .rhbottom__legend p,
          .rhbottom__legend li,
          .rhbottom__legend text {
            font-size: 10px !important;
            line-height: 22px !important;
            white-space: nowrap !important;
          }

          /* Attribution logos (.rhpane / Copernicus & Windy logos):
             Di mobile ditempatkan di atas bilah AQI pada bottom: 44px */
          .rhpane {
            position: fixed !important;
            bottom: 44px !important;
            left: 12px !important;
            right: auto !important;
            top: auto !important;
            transform: scale(0.85) !important;
            transform-origin: bottom left !important;
            pointer-events: none !important;
            z-index: 1002 !important;
          }

          .rhpane__bottom-messages {
            position: fixed !important;
            left: 12px !important;
            bottom: 44px !important;
            right: auto !important;
            top: auto !important;
            width: 115px !important;
            transform: scale(0.85) !important;
            transform-origin: bottom left !important;
            z-index: 1002 !important;
          }

          .rhpane .rhpane__bottom-messages {
            position: relative !important;
            left: 0 !important;
            bottom: 0 !important;
            transform: none !important;
          }

          .rhpane__bottom-messages img,
          img[src*="copernicus"] {
            width: 115px !important;
            max-width: 115px !important;
          }

          #logo,
          #logo-wrapper #logo,
          [class*="on"] #logo-wrapper #logo,
          #device-mobile #logo,
          #device-tablet #logo {
            left: 122px !important;
            right: auto !important;
            bottom: 44px !important;
            top: auto !important;
            transform: scale(0.68) !important;
            transform-origin: bottom left !important;
            z-index: 1002 !important;
          }

          #custom-zoom-controls {
            right: 12px;
            top: ${topControls};
          }
        }

        #contrib {
          display: none !important;
        }

        /* F. Cleanest basemap: Suppress ALL text, city labels, country labels, ocean labels */
        .labels-layer,
        .leaflet-gridlayer-feature,
        [class*="labels-layer"],
        [class*="gridlayer-feature"],
        .country-1, .country-2, .country-3,
        .city-1, .city-2, .city-3,
        [data-temp]::after {
          display: none !important;
          content: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          width: 0 !important;
          height: 0 !important;
        }

        /* G. Disable click popups and pickers */
        #plugin-detail,
        #plugin-default-model-selector,
        #plugin-station,
        #plugin-nearest-stations,
        #plugin-sounding,
        #plugin-webcams,
        #plugin-airports,
        .plugin-popup,
        .plugin-desktop-bottom,
        .plugin-bottom,
        #picker-dot,
        .picker-dot,
        .picker,
        .location-summary {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          opacity: 0 !important;
          height: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
        }

        /* H. Full viewport coverage */
        html, body, #map-container, #map, #leaflet-map {
          width: 100vw !important;
          height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background-color: #000000 !important;
        }
        /* Plugin artikel Windy kadang lolos dari penjaga E2 (open() terpanggil
           sebelum penjaga terpasang, lalu selesai dimuat sesudahnya). CSS-nya
           menggeser peta (body.onarticles: -250px desktop, -200px tablet,
           scale 0.93 ponsel) walau panenya tersembunyi — batalkan di sini. */
        .onarticles #map-container {
          transform: none !important;
          border-radius: 0 !important;
        }

        /* I. Administrative Polygon Styling */
        .leaflet-pane.leaflet-wilayah-pane svg {
          pointer-events: none !important;
        }
        .leaflet-pane.leaflet-wilayah-pane path,
        .provinsi-layer,
        path.provinsi-layer {
          cursor: pointer !important;
          pointer-events: auto !important;
          /* Hanya fill-opacity yang dianimasikan: transisi stroke-width
             menata ulang geometri SVG tiap bingkai dan filter drop-shadow
             memaksa pass render tambahan — keduanya berkedip di Chromium
             saat kursor menyapu poligon di atas kanvas WebGL. */
          transition: fill-opacity 0.2s ease;
        }

        .leaflet-wilayahPane-pane path:hover,
        .leaflet-pane.leaflet-wilayahPane-pane path:hover,
        .provinsi-layer:hover,
        path.provinsi-layer:hover {
          stroke: #ffffff !important;
          stroke-width: 2.5px !important;
          fill: #ffffff !important;
          fill-opacity: 0.20 !important;
        }

        /* J. Number Badges (.peta-angka) inside polygon centroids */
        .peta-angka {
          width: 0 !important;
          height: 0 !important;
          overflow: visible !important;
          pointer-events: none !important;
        }

        .peta-angka__nilai {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          transform: translate(-50%, -50%) !important;
          white-space: nowrap !important;
          font-size: 14px !important;
          font-weight: 700 !important;
          line-height: 1 !important;
          font-variant-numeric: tabular-nums !important;
          color: #fff !important;
          text-shadow:
            0 0 3px rgb(26 25 25 / 0.85),
            1px 1px 0 rgb(26 25 25 / 0.7),
            -1px 1px 0 rgb(26 25 25 / 0.7),
            1px -1px 0 rgb(26 25 25 / 0.7),
            -1px -1px 0 rgb(26 25 25 / 0.7) !important;
          pointer-events: none !important;
        }

        /* Titik lokasi pengguna dari aplikasi Laporin (SET_LOKASIKU) — rupanya
           sama dengan .lokasiku peta MapLibre aplikasi (components/peta-gl.tsx). */
        .lokasiku {
          width: 16px !important;
          height: 16px !important;
          border-radius: 50% !important;
          background: #1a73e8 !important;
          border: 3px solid #fff !important;
          box-sizing: border-box !important;
          box-shadow: 0 0 0 6px rgba(26, 115, 232, 0.25), 0 1px 4px rgba(0, 0, 0, 0.4) !important;
          pointer-events: none !important;
        }

        /* K. Fire Incident Markers from Kejadian API */
        .marker-titik-kejadian {
          position: relative;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer !important;
          pointer-events: auto !important;
          z-index: 500;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .marker-titik-kejadian:hover {
          transform: scale(1.35);
          z-index: 600;
        }
        .marker-titik-kejadian__ping {
          position: absolute;
          inset: -4px;
          border-radius: 9999px;
          background: rgba(239, 68, 68, 0.45);
          animation: denyut-kejadian 2s infinite ease-out;
          pointer-events: none;
        }
        .marker-titik-kejadian__core {
          position: relative;
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #f97316 0%, #dc2626 100%);
          border: 2px solid #ffffff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.65), 0 0 10px rgba(249, 115, 22, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        @keyframes denyut-kejadian {
          0% { transform: scale(0.8); opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        .peta-angka--bertumpuk,
        .angka-mati .peta-angka,
        .udara-mati #plugin-rhbottom,
        .udara-mati #legend-mobile {
          display: none !important;
        }
        /* Angin mati = basemap satelit EOX tampil (jagaLapisanUdara) dan legenda
           AQI di atas sembunyi: kredit wajib lisensinya mengisi sudut legenda itu. */
        #atribusi-eox {
          display: none;
          position: fixed;
          right: 20px;
          bottom: 16px;
          z-index: 1000;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(20, 16, 15, 0.6);
          color: rgba(255, 255, 255, 0.8);
          font: 500 10px/1.4 system-ui, -apple-system, sans-serif;
        }
        #atribusi-eox a {
          color: inherit;
        }
        .udara-mati #atribusi-eox {
          display: block;
        }
        @media (max-width: 640px) {
          #atribusi-eox {
            right: 12px;
            bottom: 12px;
          }
        }
        /* Batas provinsi dimatikan (SET_LAPISAN): poligon hanya dibeningkan
           supaya hover/klik provinsi tetap jalan, sama dengan lapisan Aerosol. */
        .poligon-mati path.provinsi-layer,
        .poligon-mati path.provinsi-layer:hover {
          stroke-opacity: 0 !important;
          fill-opacity: 0 !important;
        }

        /* Tooltip custom styling.
           Tanpa backdrop-filter: tooltip mengikuti kursor di atas kanvas
           WebGL, dan blur yang disampel ulang tiap mousemove berkedip di
           Chromium — latar solid pekat menggantikannya. */
        .leaflet-tooltip.provinsi-tooltip {
          background: rgba(20, 16, 15, 0.94) !important;
          border: 1px solid rgba(255, 255, 255, 0.25) !important;
          color: #ffffff !important;
          border-radius: 8px !important;
          padding: 6px 12px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6) !important;
          pointer-events: none !important;
        }
        .leaflet-tooltip.provinsi-tooltip::before {
          border-top-color: rgba(20, 16, 15, 0.88) !important;
        }
        html.light .leaflet-tooltip.provinsi-tooltip {
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1px solid rgba(0, 0, 0, 0.1) !important;
          color: #1a1919 !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12) !important;
        }
        html.light .leaflet-tooltip.provinsi-tooltip::before {
          border-top-color: rgba(255, 255, 255, 0.95) !important;
        }

        /* Tombol kontrol zoom kustom (Posisi, ukuran, dan glassmorphism seragam dengan PetaAsap) */
        #custom-zoom-controls {
          position: fixed;
          right: 12px;
          top: ${topControls};
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          z-index: 999;
          pointer-events: auto;
        }
        @media (min-width: 640px) {
          #custom-zoom-controls {
            right: 16px;
          }
        }
        #custom-zoom-controls button {
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          user-select: none;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        #custom-zoom-controls button:active {
          transform: scale(0.9);
        }
        #custom-zoom-controls button svg {
          pointer-events: none;
        }

        /* Default / Tema Gelap */
        #custom-zoom-controls button,
        #custom-zoom-controls.tema-dark button {
          background: rgba(20, 16, 15, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }
        #custom-zoom-controls button:hover,
        #custom-zoom-controls.tema-dark button:hover {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        /* Tema Terang (Light Mode) */
        #custom-zoom-controls.tema-light button,
        html.light #custom-zoom-controls button {
          background: rgba(255, 255, 255, 0.92) !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06) !important;
          color: #1a1919 !important;
        }
        #custom-zoom-controls.tema-light button:hover,
        html.light #custom-zoom-controls button:hover {
          background: #ffffff !important;
          color: #000000 !important;
        }

        /* Tombol bentang selayar — ajakan utama membuka peta besar, jadi lebih
           besar dari tombol navigasi: 44px (padanan h-11 w-11 PetaAsap) */
        #btn-bentang {
          width: 44px !important;
          height: 44px !important;
        }
        #btn-bentang svg {
          width: 20px !important;
          height: 20px !important;
        }
${ringkas ? `
        /* Bingkai ringkas yang lebar (peta kecil landing di desktop, sematan):
           tombol bentang 40px (padanan bentangBesar h-10 di PetaAsap, ambangnya
           sama: AMBANG_SEMPIT 800) — tetap lebih besar dari tombol rapat 28px. */
        @media (min-width: 800px) {
          #btn-bentang {
            width: 40px !important;
            height: 40px !important;
          }
        }
        /* Kolom kendali ringkas lebih rapat (padanan gap-1.5 PetaAsap). */
        #custom-zoom-controls {
          gap: 6px;
        }` : ""}
${aplikasi ? `
        /* Aplikasi: kendali, legenda AQI, dan kredit native (lembar Legenda &
           Panduan); batas provinsi & laporan hanya di tab Laporan aplikasi.
           Logo Windy/Copernicus naik ke kiri atas, bilah waktu native di dasar. */
        #custom-zoom-controls,
        #plugin-rhbottom,
        #legend-mobile,
        #atribusi-eox,
        .provinsi-layer,
        .peta-angka {
          display: none !important;
        }
        .rhpane,
        .rhpane__bottom-messages,
        #logo,
        #logo-wrapper #logo,
        [class*="on"] #logo-wrapper #logo,
        #device-mobile #logo,
        #device-tablet #logo {
          top: 12px !important;
          bottom: auto !important;
          transform-origin: top left !important;
        }
        /* Ponsel: Copernicus menumpang di .rhpane (relative) — tanpa ini ia
           turun 12px di bawah logo Windy. */
        .rhpane .rhpane__bottom-messages {
          top: 0 !important;
        }` : ""}

        /* Tombol navigasi (+, -, home, lapisan) — 28px jika ringkas (legendaRingkas), default 36px */
        #btn-zoom-in,
        #btn-zoom-out,
        #btn-zoom-home,
        #btn-lapisan {
          width: ${ringkas ? "28px" : "36px"} !important;
          height: ${ringkas ? "28px" : "36px"} !important;
        }
        #btn-zoom-in svg,
        #btn-zoom-out svg,
        #btn-zoom-home svg,
        #btn-lapisan svg {
          width: ${ringkas ? "13px" : "16px"} !important;
          height: ${ringkas ? "13px" : "16px"} !important;
        }
        /* Tombol Lapisan: titik merah = lapisan hotspot menyala (kelas ada-hotspot). */
        #btn-lapisan {
          position: relative;
        }
        #btn-lapisan .lencana-hotspot {
          display: none;
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: #ef4444;
          box-shadow: 0 0 0 2px rgba(20, 16, 15, 0.95);
        }
        #btn-lapisan.ada-hotspot .lencana-hotspot {
          display: block;
        }
        html.light #btn-lapisan .lencana-hotspot {
          box-shadow: 0 0 0 2px #ffffff;
        }

        /* MOBILE: Pastikan sentuhan pan dan pinch-to-zoom di perangkat sentuh mulus dan responsif */
        @media (pointer: coarse), (max-width: 640px) {
          #map-container, #map, #leaflet-map,
          .leaflet-container, .leaflet-pane, .leaflet-pane canvas {
            touch-action: none !important;
            -webkit-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
          }
        }
      </style>
    `;

    // 3. Custom Script: Setup Leaflet Administrative Polygons, sync time, and postMessage Bridge
    const geoDataJson = JSON.stringify(petaProvinsi);
    const centroidsJson = JSON.stringify(PUSAT_WILAYAH);
    const pulauJson = JSON.stringify(PROVINSI_PULAU);

    const customScript = `
      <div id="atribusi-eox">&copy; <a href="https://s2maps.eu" target="_blank" rel="noopener noreferrer">EOX IT Services GmbH</a> (Sentinel-2 cloudless)</div>
      <script>
        (function() {
          document.documentElement.classList.add('${temaAwal}');
          const GEO_DATA = ${geoDataJson};
          const CENTROIDS = ${centroidsJson};
          const PROVINSI_PULAU = ${pulauJson};
          const ANGKA_SELA = 4;

          let currentJumlahLaporan = {};
          let geoLayer = null;
          let markersLayer = null;
          let daftarAngka = [];
          let mapInitialized = false;
          // [lat, lng] lokasi pengguna dari aplikasi; digambar begitu peta siap.
          let lokasiku = null;
          let penandaLokasiku = null;

          // ── Lapisan udara: AQI + partikel angin dari /api/udara ──────────
          // Pengganti lapisan AQI & partikel bawaan Windy: frame Windy per jam,
          // tanpa pembauran dan tanpa riwayat, jadi pemutarannya patah-patah.
          // Mesin ini meniru renderLoop lapisan Aerosol (peta-asap.tsx):
          // progres pecahan maju dt / durasi langkah (0,75 dtk pada 1×, 0,35 dtk
          // pada 2×) dan berulang; frame A = floor, B = A + 1, campuran = sisa
          // pecahannya. Medan AQI dibaurkan di GPU (dua tekstur LINEAR,
          // mix(a, b, u_mix)); partikel angin mengambil u/v dengan bobot
          // campuran yang sama — angin dan AQI bergerak bersama.
          //
          // Semuanya satu custom layer di MapLibre milik Windy (v5:
          // render(gl, opsi)), disisipkan tepat di bawah 'raster-basemap' —
          // posisi lapisan AQI Windy ('tileLayer') — jadi garis pantai Windy
          // dan pane Leaflet (batas provinsi, hotspot, angka) tetap di atasnya.
          // Lapisan AQI Windy dibiarkan tampil di bawahnya: di dalam kotak data
          // tertutup medan kita yang buram, di luarnya (peta diperkecil jauh)
          // jadi latar — tanpa itu di sana kanvasnya abu-abu kosong. Partikel
          // Windy baru dimatikan setelah frame pertama kita tergambar: bila
          // /api/udara gagal, peta Windy tetap utuh.
          //
          // Pemutaran mulai dari langkah terdekat dengan sekarang, lalu
          // berulang dari awal rentang (7 hari lalu) — sama dengan Aerosol.
          //
          // Bilah waktunya di induk (peta.tsx). Masuk: PUTAR_UDARA {putar, laju},
          // SET_PROGRES {progres}, GESER_UDARA {geser, progres}, WINDY_ACTIVE /
          // WINDY_NONAKTIF. Keluar: LINIMASA_UDARA (daftar langkah, sekali per
          // metadata) dan WAKTU_UDARA (progres tiap frame selama berputar/digeser).
          const URL_UDARA = location.origin + '/api/udara';
          // Versi format frame (v2: wilayah diperlebar + tata per bidang) —
          // ikut di URL supaya tembolok HTTP peramban tak menyajikan format lama.
          const VERSI_UDARA = '&v=2';
          const DURASI_LANGKAH = { 1: 0.75, 2: 0.35 };
          const MAKS_UNDUH_SERENTAK = 3;
          let petaUdara = null;          // MapLibre milik Windy
          let udaraMeta = null;          // { grid, enkode, timesteps, latestModelRunIso, ... }
          let udaraLangkah = [];
          let udaraKunci = [];           // kunci frame per indeks langkah
          let udaraFrame = {};           // kunci → Uint8Array cols*rows*3 [aqi, u, v]
          const udaraDiambil = {};       // kunci → Promise (permintaan berjalan, tak diulang)
          const udaraGagal = {};         // kunci → waktu gagal terakhir (jeda coba ulang 5 dtk)
          let udaraAntre = [];
          let udaraUnduhJalan = 0;
          let udaraTerunduh = 0;
          let udaraProgres = 0;          // indeks pecahan; mulai dari langkah terdekat dengan sekarang
          let udaraProgresDariInduk = false; // induk sudah menyetel posisi (lanjut setelah iframe dimuat ulang)
          let udaraMemutar = false;
          let udaraLaju = 1;
          let udaraGeser = false;        // slider induk sedang digeser
          let udaraAktif = true;         // lapisan Angin sedang ditampilkan induk
          let udaraTampil = true;        // sakelar Angin di panel Lapisan induk (SET_LAPISAN)
          let udaraTerlihat = true;      // iframe berada di viewport halaman induk
          let udaraSiap = false;         // frame pertama tergambar → lapisan Windy disembunyikan
          let udaraSiapDijadwalkan = false;
          let udaraMenunggu = false;     // putar tertahan menunggu frame berikutnya
          let udaraRaf = 0;
          let udaraWaktuLalu = 0;
          const mqKurangiGerak = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
          function kurangiGerak() { return !!(mqKurangiGerak && mqKurangiGerak.matches); }
          let kolomKiri = 0;             // panel peringkat induk menutupi tepi kiri (SET_KOLOM)

          function kunciUdara(m) { return m.timeChunk + '_' + m.step + '_' + m.timeInner; }
          function kirimInduk(pesan) {
            if (window.parent && window.parent !== window) window.parent.postMessage(pesan, '*');
          }
          function hitungTerunduh() {
            let t = 0;
            for (let i = 0; i < udaraKunci.length; i++) if (udaraFrame[udaraKunci[i]]) t++;
            udaraTerunduh = t;
          }
          function laporWaktuUdara() {
            if (!udaraLangkah.length) return;
            kirimInduk({
              type: 'WAKTU_UDARA',
              progres: udaraProgres,
              memutar: udaraMemutar,
              laju: udaraLaju,
              menunggu: udaraMenunggu,
              terunduh: udaraTerunduh,
              total: udaraLangkah.length
            });
          }

          function muatFrameUdara(m) {
            const k = kunciUdara(m);
            if (udaraFrame[k]) return Promise.resolve(udaraFrame[k]);
            if (udaraDiambil[k]) return udaraDiambil[k];
            const g = udaraMeta.grid;
            const ukuran = g.cols * g.rows * 3;
            const p = fetch(URL_UDARA + '?mode=frame&timeChunk=' + m.timeChunk + '&step=' + m.step + '&timeInner=' + m.timeInner + VERSI_UDARA)
              .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.arrayBuffer();
              })
              .then(function(b) {
                if (b.byteLength !== ukuran) throw new Error('ukuran frame ' + b.byteLength);
                // Dikirim per bidang (aqi | u | v — lebih mampat), disusun ulang
                // jadi [aqi, u, v] per titik untuk tekstur RGB & sampel partikel.
                const bidang = new Uint8Array(b);
                const n = g.cols * g.rows;
                const u8 = new Uint8Array(ukuran);
                for (let i = 0, o = 0; i < n; i++, o += 3) {
                  u8[o] = bidang[i];
                  u8[o + 1] = bidang[n + i];
                  u8[o + 2] = bidang[2 * n + i];
                }
                udaraFrame[k] = u8;
                hitungTerunduh();
                mintaGambarUdara();
                laporWaktuUdara();
                return u8;
              })
              .catch(function() {
                udaraGagal[k] = Date.now();
                return null;
              })
              .finally(function() {
                delete udaraDiambil[k];
              });
            udaraDiambil[k] = p;
            return p;
          }
          // Frame A, B, dan sesudahnya — dipanggil tiap frame layar; permintaan
          // yang sedang berjalan atau baru gagal tak diulang.
          function pastikanFrameUdara(i) {
            const m = udaraLangkah[i];
            if (!m) return;
            const k = udaraKunci[i];
            if (udaraFrame[k] || udaraDiambil[k] || (udaraGagal[k] && Date.now() - udaraGagal[k] < 5000)) return;
            muatFrameUdara(m);
          }
          // Unduhan latar seluruh linimasa (±114 KB per frame), berurutan dari
          // posisi putar ke depan supaya frame yang segera tampil datang duluan.
          function antreUnduhanUdara() {
            const n = udaraLangkah.length;
            const awal = Math.floor(udaraProgres) % n;
            udaraAntre = [];
            for (let i = 0; i < n; i++) udaraAntre.push(udaraLangkah[(awal + i) % n]);
            pompaUnduhanUdara();
          }
          function pompaUnduhanUdara() {
            while (udaraUnduhJalan < MAKS_UNDUH_SERENTAK && udaraAntre.length) {
              const m = udaraAntre.shift();
              if (udaraFrame[kunciUdara(m)]) continue;
              udaraUnduhJalan++;
              muatFrameUdara(m).then(function() {
                udaraUnduhJalan--;
                pompaUnduhanUdara();
              });
            }
          }

          let penundaMetaUdara = null;
          function muatMetaUdara(jeda) {
            clearTimeout(penundaMetaUdara);
            fetch(URL_UDARA + '?mode=metadata' + VERSI_UDARA)
              .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
              })
              .then(function(d) {
                const g = d && d.grid;
                if (!d || !Array.isArray(d.timesteps) || d.timesteps.length < 2 || !g || !(g.cols > 1) || !(g.rows > 1) || !(g.resolusi > 0)) {
                  throw new Error('metadata udara tak sah');
                }
                terimaMetaUdara(d);
                // Siklus model baru terbit tiap ±12 jam — periksa tiap 30 menit.
                penundaMetaUdara = setTimeout(function() { muatMetaUdara(); }, 30 * 60 * 1000);
              })
              .catch(function() {
                const berikut = Math.min(60000, (jeda || 4000) * 2);
                penundaMetaUdara = setTimeout(function() { muatMetaUdara(berikut); }, jeda || 4000);
              });
          }
          function terimaMetaUdara(d) {
            const runLama = udaraMeta && udaraMeta.latestModelRunIso;
            const nLama = udaraLangkah.length;
            udaraMeta = d;
            if (runLama === d.latestModelRunIso && nLama === d.timesteps.length) return;
            udaraLangkah = d.timesteps;
            udaraKunci = udaraLangkah.map(kunciUdara);
            // Cache lokal saja: iframe di-sandbox (origin buram), jadi jendela
            // induk tak terjangkau untuk berbagi frame antarmuat ulang.
            udaraFrame = {};
            hitungTerunduh();
            const n = udaraLangkah.length;
            // Seperti mulaiDariSekarang Aerosol: pemuatan awal dan siklus model
            // baru mulai dari langkah terdekat dengan sekarang. Kecuali iframe
            // baru dimuat ulang (masuk/keluar selayar) dan induk sudah
            // menyetel posisi lanjutannya, atau slider sedang digeser.
            const awal = nLama === 0 && udaraProgresDariInduk;
            if (!awal && !udaraGeser) udaraProgres = indeksKiniUdara();
            udaraProgres = Math.min(Math.max(0, udaraProgres), n - 1);
            kirimInduk({
              type: 'LINIMASA_UDARA',
              langkah: udaraLangkah.map(function(m) {
                return { labelWib: m.labelWib, adalahPrediksi: !!m.adalahPrediksi, waktu: m.waktu };
              }),
              modelRunWib: d.latestModelRunWib || null
            });
            antreUnduhanUdara();
            laporWaktuUdara();
            mintaGambarUdara();
          }

          // Padanan indeksWaktuKini peta-asap.tsx: langkah terdekat dengan sekarang.
          function indeksKiniUdara() {
            const kini = Date.now();
            let terbaik = 0;
            let selisihTerbaik = Infinity;
            for (let i = 0; i < udaraLangkah.length; i++) {
              const selisih = Math.abs((udaraLangkah[i].waktu || 0) - kini);
              if (selisih < selisihTerbaik) {
                selisihTerbaik = selisih;
                terbaik = i;
              }
            }
            return terbaik;
          }
          function frameSiapUdara(i) {
            return !!udaraFrame[udaraKunci[i]];
          }
          function setelProgresUdara(p) {
            const n = udaraLangkah.length;
            udaraProgres = n ? ((p % n) + n) % n : Math.max(0, p);
            if (n) {
              const iA = Math.floor(udaraProgres) % n;
              pastikanFrameUdara(iA);
              pastikanFrameUdara((iA + 1) % n);
            }
            mintaGambarUdara();
            laporWaktuUdara();
          }

          // Loop 60 FPS — semantik renderLoop Aerosol. Peta digambar ulang tiap
          // frame selama berputar/digeser, atau selama partikel angin hidup.
          // Sakelar Angin mati: waktu tetap berjalan (bilah waktu induk & hari
          // hotspot mengikutinya), hanya penggambarannya yang berhenti.
          function putaranUdara(t) {
            udaraRaf = 0;
            if (!udaraAktif || !udaraTerlihat || document.hidden) {
              udaraWaktuLalu = 0;
              return;
            }
            const dt = udaraWaktuLalu ? Math.min(0.1, (t - udaraWaktuLalu) / 1000) : 0;
            udaraWaktuLalu = t;
            const n = udaraLangkah.length;
            if (n > 1) {
              if (udaraMemutar && !udaraGeser) {
                const iA = Math.floor(udaraProgres) % n;
                if (!frameSiapUdara((iA + 1) % n)) {
                  // Frame tujuan belum tiba: tahan di tempat — tanpa loncatan.
                  udaraMenunggu = true;
                } else {
                  udaraMenunggu = false;
                  let p = udaraProgres + dt / DURASI_LANGKAH[udaraLaju];
                  // Melewati batas langkah sementara frame sesudahnya belum ada:
                  // berhenti tepat di batas (campuran 0 = frame yang sudah ada).
                  if (Math.floor(p) > iA && !frameSiapUdara((iA + 2) % n)) p = iA + 1;
                  udaraProgres = p % n;
                }
              } else {
                udaraMenunggu = false;
              }
              const jA = Math.floor(udaraProgres) % n;
              pastikanFrameUdara(jA);
              pastikanFrameUdara((jA + 1) % n);
              pastikanFrameUdara((jA + 2) % n);
              if (udaraMemutar || udaraGeser) laporWaktuUdara();
            }
            const partikelHidup = udaraTampil && udaraSiap && !kurangiGerak();
            if ((n > 1 && (udaraMemutar || udaraGeser)) || partikelHidup) {
              if (petaUdara && udaraTampil) petaUdara.triggerRepaint();
              udaraRaf = requestAnimationFrame(putaranUdara);
            } else {
              udaraWaktuLalu = 0;
            }
          }
          function mulaiPutaranUdara() {
            if (udaraRaf || !udaraAktif || !udaraTerlihat || document.hidden) return;
            udaraWaktuLalu = 0;
            udaraRaf = requestAnimationFrame(putaranUdara);
          }
          function hentikanPutaranUdara() {
            if (udaraRaf) cancelAnimationFrame(udaraRaf);
            udaraRaf = 0;
            udaraWaktuLalu = 0;
          }
          function mintaGambarUdara() {
            if (petaUdara) {
              try { petaUdara.triggerRepaint(); } catch (e) {}
            }
            mulaiPutaranUdara();
          }

          // ── Palet AQI ──
          // Diambil langsung dari gradien AQI Windy sendiri (W.colors.aqi) —
          // Windy tidak menginterpolasi linear di RGB, jadi mencontoh warnanya
          // lebih setia daripada menyalin titik hentinya. Cadangan: hasil
          // sampel yang sama tiap 10 AQI (0–500), diambil dari Windy v51.
          const PALET_CADANGAN = [20,141,20, 14,132,14, 7,124,7, 0,115,0, 94,180,13, 203,243,49, 184,185,6, 219,190,40, 255,198,80, 229,165,70, 203,133,61, 197,115,57, 192,99,54, 186,82,52, 180,66,51, 172,50,50, 179,53,75, 185,56,105, 186,61,135, 182,68,163, 177,78,185, 180,74,178, 182,70,169, 185,66,159, 187,62,150, 188,59,139, 189,56,129, 189,54,118, 189,51,107, 188,49,98, 187,47,87, 185,47,86, 183,46,85, 181,46,84, 179,45,83, 177,44,83, 175,44,82, 173,43,81, 171,43,80, 169,42,79, 167,42,78, 165,41,77, 163,41,76, 161,40,75, 159,40,74, 157,39,73, 155,38,72, 153,38,71, 151,37,70, 149,37,69, 147,36,68];
          const LEBAR_PALET = 512;
          let paletUdara = null;  // Uint8Array LEBAR_PALET*4, AQI 0..aqiMaks
          function warnaCadangan(v) {
            const x = Math.min(50, Math.max(0, v / 10));
            const i = Math.min(49, Math.floor(x));
            const f = x - i;
            const c = [];
            for (let j = 0; j < 3; j++) c.push(Math.round(PALET_CADANGAN[i * 3 + j] + (PALET_CADANGAN[i * 3 + 3 + j] - PALET_CADANGAN[i * 3 + j]) * f));
            return c;
          }
          function warnaAqi(v) {
            try {
              const g = window.W && W.colors && W.colors.aqi && W.colors.aqi.getColor();
              const c = g && g.RGBA(v);
              if (c && c.length >= 3 && isFinite(c[0])) return [c[0], c[1], c[2]];
            } catch (e) {}
            return warnaCadangan(v);
          }
          function bangunPaletUdara() {
            const maks = (udaraMeta && udaraMeta.enkode && udaraMeta.enkode.aqiMaks) || 500;
            const p = new Uint8Array(LEBAR_PALET * 4);
            for (let i = 0; i < LEBAR_PALET; i++) {
              const c = warnaAqi((i / (LEBAR_PALET - 1)) * maks);
              p[i * 4] = c[0];
              p[i * 4 + 1] = c[1];
              p[i * 4 + 2] = c[2];
              p[i * 4 + 3] = 255;
            }
            return p;
          }

          // ── WebGL ──
          // GLSL digabung dengan spasi (tanpa komentar GLSL & tanpa direktif #).
          const VS_MEDAN = [
            'attribute vec2 a_pos;',
            'uniform mat4 u_matrix;',
            'varying vec2 v_pos;',
            'void main() { v_pos = a_pos; gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0); }'
          ].join(' ');
          // Koordinat Mercator → lon/lat → texel: s = ((lon - barat) / res + 0,5) / kolom
          // (nilai ada di titik grid = pusat texel). Kanal R = AQI/aqiMaks.
          // Tepi kotak data memudar lembut ke latar Windy (u_tepi derajat).
          const FS_MEDAN = [
            'precision highp float;',
            'uniform sampler2D u_texA;',
            'uniform sampler2D u_texB;',
            'uniform sampler2D u_palet;',
            'uniform float u_mix;',
            'uniform vec4 u_batas;',
            'uniform vec3 u_grid;',
            'uniform float u_tepi;',
            'varying vec2 v_pos;',
            'const float PI = 3.141592653589793;',
            'void main() {',
            '  float lon = fract(v_pos.x) * 360.0 - 180.0;',
            '  float lat = degrees(2.0 * atan(exp(PI * (1.0 - 2.0 * v_pos.y))) - PI * 0.5);',
            '  vec2 st = vec2(((lon - u_batas.x) / u_grid.x + 0.5) / u_grid.y, ((lat - u_batas.y) / u_grid.x + 0.5) / u_grid.z);',
            '  float aqi = mix(texture2D(u_texA, st).r, texture2D(u_texB, st).r, u_mix);',
            '  vec3 rgb = texture2D(u_palet, vec2(aqi * 0.998046875 + 0.0009765625, 0.5)).rgb;',
            '  float w = smoothstep(0.0, u_tepi, lon - u_batas.x) * smoothstep(0.0, u_tepi, u_batas.z - lon)',
            '    * smoothstep(0.0, u_tepi, lat - u_batas.y) * smoothstep(0.0, u_tepi, u_batas.w - lat);',
            '  gl_FragColor = vec4(rgb * w, w);',
            '}'
          ].join(' ');
          const VS_LAYAR = [
            'attribute vec2 a_pos;',
            'varying vec2 v_uv;',
            'void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }'
          ].join(' ');
          // Jejak partikel memudar tiap frame. floor() memastikan nilai 8-bit
          // benar-benar turun — tanpa itu sisa jejak tipis tak pernah hilang.
          const FS_PUDAR = [
            'precision mediump float;',
            'uniform sampler2D u_jejak;',
            'uniform float u_pudar;',
            'varying vec2 v_uv;',
            'void main() { gl_FragColor = floor(texture2D(u_jejak, v_uv) * 255.0 * u_pudar) / 255.0; }'
          ].join(' ');
          const FS_TAMPIL = [
            'precision mediump float;',
            'uniform sampler2D u_jejak;',
            'uniform float u_opasitas;',
            'varying vec2 v_uv;',
            'void main() { gl_FragColor = texture2D(u_jejak, v_uv) * u_opasitas; }'
          ].join(' ');
          const VS_GARIS = [
            'attribute vec3 a_titik;',
            'uniform vec2 u_ukuran;',
            'varying float v_a;',
            'void main() { v_a = a_titik.z; gl_Position = vec4(a_titik.x / u_ukuran.x * 2.0 - 1.0, 1.0 - a_titik.y / u_ukuran.y * 2.0, 0.0, 1.0); }'
          ].join(' ');
          const FS_GARIS = [
            'precision mediump float;',
            'varying float v_a;',
            'void main() { gl_FragColor = vec4(v_a); }'
          ].join(' ');

          function buatProgram(gl, vs, fs) {
            function shader(jenis, sumber) {
              const s = gl.createShader(jenis);
              gl.shaderSource(s, sumber);
              gl.compileShader(s);
              if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.error('[udara] shader:', gl.getShaderInfoLog(s));
                return null;
              }
              return s;
            }
            const v = shader(gl.VERTEX_SHADER, vs);
            const f = shader(gl.FRAGMENT_SHADER, fs);
            if (!v || !f) return null;
            const p = gl.createProgram();
            gl.attachShader(p, v);
            gl.attachShader(p, f);
            gl.linkProgram(p);
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
              console.error('[udara] program:', gl.getProgramInfoLog(p));
              return null;
            }
            const info = { p: p, a: {}, u: {} };
            const nA = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
            for (let i = 0; i < nA; i++) {
              const a = gl.getActiveAttrib(p, i);
              info.a[a.name] = gl.getAttribLocation(p, a.name);
            }
            const nU = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
            for (let i = 0; i < nU; i++) {
              const u = gl.getActiveUniform(p, i);
              info.u[u.name] = gl.getUniformLocation(p, u.name);
            }
            return info;
          }
          function buatTekstur(gl, filter) {
            const t = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            return t;
          }
          function mercY(lat) {
            const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
            return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
          }
          function latDariMercY(y) {
            return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
          }

          const gpu = {
            gl: null, medan: null, pudar: null, tampil: null, garis: null,
            bufMedan: null, bufLayar: null, bufGaris: null,
            texA: null, texB: null, texPalet: null,
            kunciA: '', kunciB: '', campur: 0, adaMedan: false, gridKunci: ''
          };
          // Keadaan frame yang sedang digambar — dipakai bersama medan AQI dan partikel.
          const bingkai = { a: null, b: null, kunciA: '', kunciB: '', campur: 0 };
          function tentukanBingkai() {
            const n = udaraLangkah.length;
            if (!n) return false;
            const iA = Math.floor(udaraProgres) % n;
            const iB = (iA + 1) % n;
            let kA = udaraKunci[iA], kB = udaraKunci[iB];
            let a = udaraFrame[kA] || null, b = udaraFrame[kB] || null;
            let campur = udaraProgres - Math.floor(udaraProgres);
            if (!a && b) { a = b; kA = kB; campur = 0; }
            if (!b) { b = a; kB = kA; campur = 0; }
            if (!a) {
              // Belum ada frame di titik ini (lompat jauh): tahan gambar terakhir.
              if (!bingkai.a) return false;
              return true;
            }
            bingkai.a = a; bingkai.b = b; bingkai.kunciA = kA; bingkai.kunciB = kB; bingkai.campur = campur;
            return true;
          }
          function unggahFrame(gl, tex, data) {
            const g = udaraMeta.grid;
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            // Baris 0 = tepi selatan → t = 0; kolom 0 = tepi barat → s = 0.
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, g.cols, g.rows, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
          }
          function bangunKotakMedan(gl) {
            const g = udaraMeta.grid;
            const x0 = (g.west + 180) / 360, x1 = (g.east + 180) / 360;
            const yU = mercY(g.north), yS = mercY(g.south);
            const d = [];
            // Salinan dunia -1, 0, +1 (lihat fract() di shader), seperti lapisan Aerosol.
            for (let w = -1; w <= 1; w++) {
              d.push(x0 + w, yU, x1 + w, yU, x0 + w, yS, x0 + w, yS, x1 + w, yU, x1 + w, yS);
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, gpu.bufMedan);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW);
            gpu.gridKunci = [g.west, g.south, g.east, g.north, g.cols, g.rows].join(',');
          }
          function siapkanMedan(gl) {
            const g = udaraMeta.grid;
            const kunciGrid = [g.west, g.south, g.east, g.north, g.cols, g.rows].join(',');
            if (kunciGrid !== gpu.gridKunci) {
              bangunKotakMedan(gl);
              gpu.kunciA = gpu.kunciB = '';
            }
            if (!gpu.texPalet) {
              gpu.texPalet = buatTekstur(gl, gl.LINEAR);
              paletUdara = bangunPaletUdara();
              gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, LEBAR_PALET, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, paletUdara);
            }
            if (bingkai.kunciA !== gpu.kunciA) {
              unggahFrame(gl, gpu.texA, bingkai.a);
              gpu.kunciA = bingkai.kunciA;
            }
            if (bingkai.kunciB !== gpu.kunciB) {
              unggahFrame(gl, gpu.texB, bingkai.b);
              gpu.kunciB = bingkai.kunciB;
            }
            gpu.campur = bingkai.campur;
            gpu.adaMedan = true;
          }
          function gambarMedan(gl, matriks) {
            const m = gpu.medan;
            if (!m || !gpu.adaMedan || !matriks) return;
            const g = udaraMeta.grid;
            gl.useProgram(m.p);
            gl.bindBuffer(gl.ARRAY_BUFFER, gpu.bufMedan);
            gl.enableVertexAttribArray(m.a.a_pos);
            gl.vertexAttribPointer(m.a.a_pos, 2, gl.FLOAT, false, 0, 0);
            gl.uniformMatrix4fv(m.u.u_matrix, false, matriks);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, gpu.texA);
            gl.uniform1i(m.u.u_texA, 0);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, gpu.texB);
            gl.uniform1i(m.u.u_texB, 1);
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, gpu.texPalet);
            gl.uniform1i(m.u.u_palet, 2);
            gl.uniform1f(m.u.u_mix, gpu.campur);
            gl.uniform4f(m.u.u_batas, g.west, g.south, g.east, g.north);
            gl.uniform3f(m.u.u_grid, g.resolusi, g.cols, g.rows);
            gl.uniform1f(m.u.u_tepi, 3.0);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.drawArrays(gl.TRIANGLES, 0, 18);
            gl.disableVertexAttribArray(m.a.a_pos);
            gl.activeTexture(gl.TEXTURE0);
          }

          // ── Partikel angin ──
          // Simulasi di CPU (beberapa ribu partikel, murah), posisi dalam piksel
          // CSS layar. Angin diambil bilinear di ruang (grid 0,4°) dan linear di
          // waktu (campuran yang sama dengan medan AQI). Tiap frame ruas
          // (posisi lama → baru) digambar ke tekstur jejak seukuran layar yang
          // memudar — teknik jejak ala Windy/webgl-wind — lalu tekstur itu
          // ditumpuk ke peta. Jejak dikosongkan selama peta digeser/di-zoom.
          const KEC_PARTIKEL = 4.5;     // piksel CSS per detik per m/s
          const PUDAR_PER_FRAME = 0.962;
          // Tekstur jejak 0,7× piksel perangkat: garis 1 texel jadi ±1,4 piksel
          // perangkat yang lembut (setipis partikel Windy), dan pass pudarnya
          // lebih murah dari resolusi penuh.
          const SKALA_JEJAK = 0.7 * Math.min(2, window.devicePixelRatio || 1);
          const LANGKAH_STATIS = 8;     // ruas garis diam (prefers-reduced-motion)
          const partikel = { n: 0, kap: 0, x: null, y: null, umur: null, maks: null, verts: null };
          const jejak = {
            tex: [null, null], fbo: [null, null], aktif: 0, w: 0, h: 0, cssW: 0, cssH: 0,
            bersih: false, opasitas: 0, waktu: 0, kunciKamera: '', gerakTerakhir: 0,
            perluPeta: true, perluSebar: true
          };
          const petaLayar = { gx0: 0, dgx: 0, gy: null, w: 0, h: 0 };

          function siapkanJejak(gl, cssW, cssH) {
            const w = Math.max(1, Math.round(cssW * SKALA_JEJAK));
            const h = Math.max(1, Math.round(cssH * SKALA_JEJAK));
            jejak.cssW = cssW;
            jejak.cssH = cssH;
            if (jejak.tex[0] && jejak.w === w && jejak.h === h) return;
            for (let i = 0; i < 2; i++) {
              if (!jejak.tex[i]) {
                jejak.tex[i] = buatTekstur(gl, gl.LINEAR);
                jejak.fbo[i] = gl.createFramebuffer();
              }
              gl.bindTexture(gl.TEXTURE_2D, jejak.tex[i]);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
              gl.bindFramebuffer(gl.FRAMEBUFFER, jejak.fbo[i]);
              gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, jejak.tex[i], 0);
            }
            jejak.w = w;
            jejak.h = h;
            jejak.bersih = false;
            jejak.perluPeta = true;
            jejak.perluSebar = true;
            bersihkanJejak(gl);
          }
          function bersihkanJejak(gl) {
            if (jejak.bersih) return;
            for (let i = 0; i < 2; i++) {
              gl.bindFramebuffer(gl.FRAMEBUFFER, jejak.fbo[i]);
              gl.viewport(0, 0, jejak.w, jejak.h);
              gl.clearColor(0, 0, 0, 0);
              gl.clear(gl.COLOR_BUFFER_BIT);
            }
            jejak.bersih = true;
          }
          // Layar → grid: lon linear di x; lintang lewat Mercator per baris piksel.
          // Peta Windy tak pernah diputar/dimiringkan.
          function hitungPetaLayar(w, h) {
            const g = udaraMeta.grid;
            const p0 = petaUdara.unproject([0, 0]);
            const p1 = petaUdara.unproject([w, h]);
            petaLayar.gx0 = (p0.lng - g.west) / g.resolusi;
            petaLayar.dgx = (p1.lng - p0.lng) / w / g.resolusi;
            const y0 = mercY(p0.lat), y1 = mercY(p1.lat);
            if (!petaLayar.gy || petaLayar.gy.length < h + 2) petaLayar.gy = new Float32Array(h + 2);
            for (let r = 0; r <= h + 1; r++) {
              petaLayar.gy[r] = (latDariMercY(y0 + ((y1 - y0) * r) / h) - g.south) / g.resolusi;
            }
            petaLayar.w = w;
            petaLayar.h = h;
          }
          const anginSampel = [0, 0];
          // u/v (m/s) di titik layar (x, y), atau false di luar kotak data.
          function sampelAngin(x, y) {
            const g = udaraMeta.grid;
            const cols = g.cols, rows = g.rows, baris = cols * 3;
            const gx = petaLayar.gx0 + x * petaLayar.dgx;
            const yi = y | 0;
            const gyA = petaLayar.gy[yi];
            const gy = gyA + (petaLayar.gy[yi + 1] - gyA) * (y - yi);
            if (!(gx >= 0 && gy >= 0 && gx < cols - 1 && gy < rows - 1)) return false;
            const i0 = gx | 0, j0 = gy | 0;
            const fx = gx - i0, fy = gy - j0;
            const k00 = j0 * baris + i0 * 3 + 1;
            const k10 = k00 + 3, k01 = k00 + baris, k11 = k01 + 3;
            const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
            const A = bingkai.a, B = bingkai.b, m = bingkai.campur;
            const uA = A[k00] * w00 + A[k10] * w10 + A[k01] * w01 + A[k11] * w11;
            const vA = A[k00 + 1] * w00 + A[k10 + 1] * w10 + A[k01 + 1] * w01 + A[k11 + 1] * w11;
            const uB = B[k00] * w00 + B[k10] * w10 + B[k01] * w01 + B[k11] * w11;
            const vB = B[k00 + 1] * w00 + B[k10 + 1] * w10 + B[k01 + 1] * w01 + B[k11 + 1] * w11;
            const e = udaraMeta.enkode || {};
            const min = isFinite(e.anginMin) ? e.anginMin : -40;
            const skala = ((isFinite(e.anginMaks) ? e.anginMaks : 40) - min) / 255;
            anginSampel[0] = (uA + (uB - uA) * m) * skala + min;
            anginSampel[1] = (vA + (vB - vA) * m) * skala + min;
            return true;
          }
          // Kepadatan mengikuti luas layar; bingkai kecil/ponsel lebih jarang.
          function sebarPartikel(w, h) {
            const n = Math.max(200, Math.min(5000, Math.round((w * h) / (w < 640 ? 380 : 260))));
            if (partikel.kap < n) {
              partikel.kap = n;
              partikel.x = new Float32Array(n);
              partikel.y = new Float32Array(n);
              partikel.umur = new Float32Array(n);
              partikel.maks = new Float32Array(n);
              partikel.verts = new Float32Array(Math.max(n * 6, Math.ceil(n / 2) * LANGKAH_STATIS * 6));
            }
            partikel.n = n;
            for (let i = 0; i < n; i++) {
              lahirkanPartikel(i, w, h);
              partikel.umur[i] = Math.random() * partikel.maks[i];
            }
          }
          function lahirkanPartikel(i, w, h) {
            let x = 0, y = 0;
            for (let c = 0; c < 4; c++) {
              x = Math.random() * w;
              y = Math.random() * h;
              if (sampelAngin(x, y)) break;
            }
            partikel.x[i] = x;
            partikel.y[i] = y;
            partikel.umur[i] = 0;
            partikel.maks[i] = 1 + Math.random() * 1.6;
          }
          function langkahPartikel(dt, w, h) {
            const v = partikel.verts;
            const K = KEC_PARTIKEL * dt;
            let s = 0;
            for (let i = 0; i < partikel.n; i++) {
              if (partikel.umur[i] >= partikel.maks[i]) lahirkanPartikel(i, w, h);
              const x = partikel.x[i], y = partikel.y[i];
              if (!sampelAngin(x, y)) {
                partikel.umur[i] = partikel.maks[i];
                continue;
              }
              const u = anginSampel[0], vv = anginSampel[1];
              const nx = x + u * K, ny = y - vv * K;
              const um = partikel.umur[i], maks = partikel.maks[i];
              // Makin kencang makin terang; muncul & hilang lembut (0,25 dtk).
              const a = (0.4 + 0.6 * Math.min(1, Math.sqrt(u * u + vv * vv) / 12)) * Math.min(1, um * 4, (maks - um) * 4);
              v[s++] = x; v[s++] = y; v[s++] = a;
              v[s++] = nx; v[s++] = ny; v[s++] = a;
              partikel.x[i] = nx;
              partikel.y[i] = ny;
              partikel.umur[i] = um + dt;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) partikel.umur[i] = maks;
            }
            return s;
          }
          // prefers-reduced-motion: garis arus diam (benih tetap, LANGKAH_STATIS
          // ruas searah angin, ekor memudar) — ikut berubah saat waktu digeser.
          function garisStatis(w, h) {
            const v = partikel.verts;
            const benih = Math.ceil(partikel.n / 2);
            const K = KEC_PARTIKEL * 0.06;
            let s = 0;
            for (let i = 0; i < benih; i++) {
              let x = partikel.x[i], y = partikel.y[i];
              for (let j = 0; j < LANGKAH_STATIS; j++) {
                if (x < 0 || y < 0 || x >= w || y >= h || !sampelAngin(x, y)) break;
                const u = anginSampel[0], vv = anginSampel[1];
                const nx = x + u * K, ny = y - vv * K;
                const a = (0.25 + 0.55 * Math.min(1, Math.sqrt(u * u + vv * vv) / 14)) * ((j + 1) / LANGKAH_STATIS);
                v[s++] = x; v[s++] = y; v[s++] = a;
                v[s++] = nx; v[s++] = ny; v[s++] = a;
                x = nx;
                y = ny;
              }
            }
            return s;
          }
          function gambarLayar(gl, prog) {
            gl.bindBuffer(gl.ARRAY_BUFFER, gpu.bufLayar);
            gl.enableVertexAttribArray(prog.a.a_pos);
            gl.vertexAttribPointer(prog.a.a_pos, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.disableVertexAttribArray(prog.a.a_pos);
          }
          function gambarRuas(gl, jumlah) {
            if (!jumlah) return;
            const p = gpu.garis;
            gl.useProgram(p.p);
            gl.uniform2f(p.u.u_ukuran, jejak.cssW, jejak.cssH);
            gl.bindBuffer(gl.ARRAY_BUFFER, gpu.bufGaris);
            gl.bufferData(gl.ARRAY_BUFFER, partikel.verts.subarray(0, jumlah), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(p.a.a_titik);
            gl.vertexAttribPointer(p.a.a_titik, 3, gl.FLOAT, false, 0, 0);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.drawArrays(gl.LINES, 0, jumlah / 3);
            gl.disableVertexAttribArray(p.a.a_titik);
          }
          // Pass luar layar (prerender): perbarui tekstur jejak partikel.
          function perbaruiJejak(gl) {
            const kanvas = petaUdara.getCanvas();
            const w = kanvas.clientWidth, h = kanvas.clientHeight;
            if (!w || !h || !gpu.garis) return;
            siapkanJejak(gl, w, h);
            const kini = performance.now();
            const dt = jejak.waktu ? Math.min(0.05, (kini - jejak.waktu) / 1000) : 0;
            jejak.waktu = kini;
            const c = petaUdara.getCenter();
            const kunci = c.lng.toFixed(6) + ',' + c.lat.toFixed(6) + ',' + petaUdara.getZoom().toFixed(5) + ',' + w + 'x' + h;
            if (kunci !== jejak.kunciKamera) {
              jejak.kunciKamera = kunci;
              jejak.gerakTerakhir = kini;
              jejak.perluPeta = true;
            }
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.STENCIL_TEST);
            gl.disable(gl.SCISSOR_TEST);
            gl.disable(gl.CULL_FACE);
            gl.colorMask(true, true, true, true);
            if (kurangiGerak()) {
              if (jejak.perluPeta) { hitungPetaLayar(w, h); jejak.perluPeta = false; }
              if (jejak.perluSebar) { sebarPartikel(w, h); jejak.perluSebar = false; }
              const jumlah = garisStatis(w, h);
              gl.bindFramebuffer(gl.FRAMEBUFFER, jejak.fbo[jejak.aktif]);
              gl.viewport(0, 0, jejak.w, jejak.h);
              gl.clearColor(0, 0, 0, 0);
              gl.clear(gl.COLOR_BUFFER_BIT);
              gambarRuas(gl, jumlah);
              jejak.bersih = false;
              jejak.opasitas = 1;
              return;
            }
            // Peta sedang bergeser/di-zoom: jejak lama tak lagi sejajar —
            // kosongkan dan sembunyikan partikel sampai peta diam 150 ms.
            if (kini - jejak.gerakTerakhir < 150) {
              bersihkanJejak(gl);
              jejak.opasitas = 0;
              jejak.perluSebar = true;
              return;
            }
            if (jejak.perluPeta) { hitungPetaLayar(w, h); jejak.perluPeta = false; }
            if (jejak.perluSebar) { sebarPartikel(w, h); jejak.perluSebar = false; }
            jejak.opasitas = Math.min(1, jejak.opasitas + dt * 2.5);
            const jumlah = langkahPartikel(dt, w, h);
            const lain = 1 - jejak.aktif;
            gl.bindFramebuffer(gl.FRAMEBUFFER, jejak.fbo[lain]);
            gl.viewport(0, 0, jejak.w, jejak.h);
            gl.disable(gl.BLEND);
            gl.useProgram(gpu.pudar.p);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, jejak.tex[jejak.aktif]);
            gl.uniform1i(gpu.pudar.u.u_jejak, 0);
            gl.uniform1f(gpu.pudar.u.u_pudar, Math.pow(PUDAR_PER_FRAME, dt * 60));
            gambarLayar(gl, gpu.pudar);
            gambarRuas(gl, jumlah);
            jejak.aktif = lain;
            jejak.bersih = false;
          }
          function tampilkanJejak(gl) {
            if (!gpu.tampil || !jejak.tex[0] || jejak.opasitas <= 0) return;
            gl.useProgram(gpu.tampil.p);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, jejak.tex[jejak.aktif]);
            gl.uniform1i(gpu.tampil.u.u_jejak, 0);
            gl.uniform1f(gpu.tampil.u.u_opasitas, jejak.opasitas * 0.9);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gambarLayar(gl, gpu.tampil);
          }

          const lapisUdara = {
            id: 'udara',
            type: 'custom',
            renderingMode: '2d',
            onAdd: function(_peta, gl) {
              gpu.gl = gl;
              gpu.medan = buatProgram(gl, VS_MEDAN, FS_MEDAN);
              gpu.pudar = buatProgram(gl, VS_LAYAR, FS_PUDAR);
              gpu.tampil = buatProgram(gl, VS_LAYAR, FS_TAMPIL);
              gpu.garis = buatProgram(gl, VS_GARIS, FS_GARIS);
              gpu.bufMedan = gl.createBuffer();
              gpu.bufGaris = gl.createBuffer();
              gpu.bufLayar = gl.createBuffer();
              gl.bindBuffer(gl.ARRAY_BUFFER, gpu.bufLayar);
              gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
              gpu.texA = buatTekstur(gl, gl.LINEAR);
              gpu.texB = buatTekstur(gl, gl.LINEAR);
              gpu.kunciA = gpu.kunciB = gpu.gridKunci = '';
            },
            prerender: function(gl) {
              if (!udaraMeta || !gpu.medan || !tentukanBingkai()) return;
              if (gl.bindVertexArray) gl.bindVertexArray(null);
              siapkanMedan(gl);
              perbaruiJejak(gl);
              gl.bindFramebuffer(gl.FRAMEBUFFER, null);
              gl.bindBuffer(gl.ARRAY_BUFFER, null);
              gl.useProgram(null);
            },
            render: function(gl, opsi) {
              if (!udaraMeta || !gpu.adaMedan) return;
              if (gl.bindVertexArray) gl.bindVertexArray(null);
              const matriks = (opsi && opsi.defaultProjectionData && opsi.defaultProjectionData.mainMatrix) ||
                (opsi && opsi.modelViewProjectionMatrix) || opsi;
              gl.disable(gl.DEPTH_TEST);
              gl.disable(gl.STENCIL_TEST);
              gambarMedan(gl, matriks);
              tampilkanJejak(gl);
              gl.bindBuffer(gl.ARRAY_BUFFER, null);
              gl.useProgram(null);
              // Frame pertama tergambar. Efeknya (sembunyikan lapisan Windy,
              // ubah store) dijalankan sesudah render — bukan di tengahnya.
              if (!udaraSiap && !udaraSiapDijadwalkan) {
                udaraSiapDijadwalkan = true;
                setTimeout(tandaiSiapUdara, 0);
              }
            },
            onRemove: function(_peta, gl) {
              [gpu.texA, gpu.texB, gpu.texPalet, jejak.tex[0], jejak.tex[1]].forEach(function(t) { if (t) gl.deleteTexture(t); });
              [jejak.fbo[0], jejak.fbo[1]].forEach(function(f) { if (f) gl.deleteFramebuffer(f); });
              [gpu.bufMedan, gpu.bufGaris, gpu.bufLayar].forEach(function(b) { if (b) gl.deleteBuffer(b); });
              gpu.texPalet = null;
              gpu.adaMedan = false;
              jejak.tex = [null, null];
              jejak.fbo = [null, null];
              jejak.w = jejak.h = 0;
            }
          };

          // Lapisan kita di bawah 'raster-basemap' (garis pantai & bayangan
          // daratan Windy menimpa warna AQI, sama seperti lapisan AQI Windy) dan
          // di atas lapisan AQI Windy ('tileLayer'), yang tetap tampil sebagai
          // latar di luar kotak data. Setelah data siap: partikel Windy
          // dimatikan. Diperiksa ulang saat gaya peta berubah dan tiap
          // 500 ms (pastikanSemuaLogo) — Windy bisa memasang ulang lapisannya.
          function jagaLapisanUdara() {
            const peta = petaUdara;
            if (!peta) return;
            try {
              // Tepat di bawah 'raster-basemap'; bila tak ada, paling atas —
              // tapi tetap di bawah lapisan hotspot (jagaLapisanHotspot).
              const sebelum = peta.getLayer('raster-basemap') ? 'raster-basemap'
                : peta.getLayer(ID_PENDAR_HOTSPOT) ? ID_PENDAR_HOTSPOT : undefined;
              if (!peta.getLayer('udara')) {
                peta.addLayer(lapisUdara, sebelum);
              } else if (typeof peta.getLayersOrder === 'function') {
                // Windy bisa memasang lapisannya SESUDAH kita (lapisan kita lalu
                // terkubur di bawah 'alpha_clear' yang menghapus kanvas).
                const urut = peta.getLayersOrder();
                const iS = sebelum ? urut.indexOf(sebelum) : urut.length;
                if (urut.indexOf('udara') !== iS - 1) peta.moveLayer('udara', sebelum);
              }
              // Sakelar Angin mati: basemap satelit lapisan Aerosol (peta-asap.tsx)
              // menggantikan basemap abu-abu Windy — dipasang saat pertama
              // dibutuhkan, di atas 'raster-basemap' dan di bawah hotspot.
              const diBawahHotspot = peta.getLayer(ID_PENDAR_HOTSPOT) ? ID_PENDAR_HOTSPOT : undefined;
              if (!udaraTampil && !peta.getLayer('satelit')) {
                if (!peta.getSource('satelit')) {
                  peta.addSource('satelit', {
                    type: 'raster',
                    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpeg'],
                    tileSize: 256,
                    attribution: 'Sentinel-2 cloudless by EOX IT Services GmbH',
                    maxzoom: 14
                  });
                }
                peta.addLayer({
                  id: 'satelit',
                  type: 'raster',
                  source: 'satelit',
                  paint: { 'raster-brightness-max': 0.85, 'raster-contrast': 0.15, 'raster-saturation': -0.1 }
                }, diBawahHotspot);
              } else if (peta.getLayer('satelit') && typeof peta.getLayersOrder === 'function') {
                const urut = peta.getLayersOrder();
                if (urut.indexOf('satelit') < urut.indexOf('raster-basemap')) peta.moveLayer('satelit', diBawahHotspot);
              }
              // Lapisan kita dan AQI Windy ('tileLayer') di bawahnya ikut
              // sakelar — tanpa yang kedua warna AQI tetap tembus. Hanya
              // disetel saat berbeda: setLayoutProperty memicu 'styledata'.
              [['udara', udaraTampil], ['tileLayer', udaraTampil], ['satelit', !udaraTampil]].forEach(function(l) {
                if (peta.getLayer(l[0]) && (peta.getLayoutProperty(l[0], 'visibility') === 'none') === l[1]) {
                  peta.setLayoutProperty(l[0], 'visibility', l[1] ? 'visible' : 'none');
                }
              });
            } catch (e) {}
            jagaLapisanHotspot();
            if (udaraSiap) {
              try {
                if (window.W.store.get('particlesAnim') !== 'off') window.W.store.set('particlesAnim', 'off');
              } catch (e) {}
            }
          }
          function tandaiSiapUdara() {
            udaraSiap = true;
            jagaLapisanUdara();
            mulaiPutaranUdara();
          }
          function mulaiLapisanUdara() {
            if (petaUdara) return;
            petaUdara = petaMapLibreWindy();
            if (!petaUdara) return;
            jagaLapisanUdara();
            try { petaUdara.on('styledata', jagaLapisanUdara); } catch (e) {}
            muatMetaUdara();
            document.addEventListener('visibilitychange', function() {
              if (!document.hidden) mintaGambarUdara();
            });
            // Iframe di luar viewport halaman (beranda digulir): jangan animasi.
            try {
              new IntersectionObserver(function(entri) {
                udaraTerlihat = entri[entri.length - 1].isIntersecting;
                if (udaraTerlihat) mintaGambarUdara();
              }).observe(document.body);
            } catch (e) {}
          }

          // Lapisan tambahan hotspot (pesan SET_HOTSPOT dari peta.tsx) — padanan
          // lib/lapisan-hotspot.ts di lapisan Aerosol. Tiap baris [lng, lat,
          // kepercayaan, satelit, FRP, waktu, malam, provinsi] digambar sebagai
          // penanda lapisan satelit ala SiPongi (segi lima Terra/Aqua, segi enam
          // SNPP, bintang NOAA-20; hijau/kuning/merah). Warna, bentuk & ukurannya
          // disamakan dengan konstanta di sana.
          //
          // Penandanya digambar sendiri di kanvas 2D tepat di atas kanvas peta:
          // lapisan simbol MapLibre tidak pernah tergambar di peta
          // Windy (tahap penempatan simbolnya tak jalan), padahal bentuklah yang
          // membedakan satelit. Kanvasnya tak menangkap klik dan berada di bawah
          // pane Leaflet (batas provinsi, angka laporan). Digambar ulang hanya
          // bila kamera, ukuran, atau data berubah — bukan tiap frame animasi
          // udara. Pesan yang tiba sebelum peta siap disimpan dulu.
          const WARNA_SIPONGI = ['#4caf50', '#fbc02d', '#f01e1e'];
          const SISI_HOTSPOT = [5, 6, 0]; // 0 = bintang lima
          // Lapisan kosong di puncak tumpukan — jangkar urutan jagaLapisanUdara.
          const ID_PENDAR_HOTSPOT = 'hotspot-pendar';
          // Ukuran penanda (px CSS) per zoom — sama dengan icon-size lib (13 px × faktor).
          const UKURAN_HOTSPOT = [[3, 7.8], [6, 11], [9, 15], [12, 20.8]];
          let hotspotTertunda = null;
          let hotspotUrut = [];        // baris urut gambar — indeksnya = indeks hotspotMerc
          let provinsiHotspot = [];    // nama provinsi untuk kartu info (indeks = kolom ke-8)
          let hotspotMerc = null;      // Float64Array [x, y] Mercator 0..1 per titik, urut kepercayaan
          let hotspotKelas = null;     // Uint8Array: penanda s * 3 + k
          let kanvasHotspot = null;
          let kunciKameraHotspot = '';
          let spriteHotspot = null;    // [kelas] → kanvas, digambar ulang bila DPR berubah
          let dprSprite = 0;
          function jalurBentukHotspot(s, c, r) {
            const sisi = SISI_HOTSPOT[s] === undefined ? 5 : SISI_HOTSPOT[s];
            const n = sisi || 10;
            const luar = sisi ? r : r * 1.12;
            const titik = [];
            for (let i = 0; i < n; i++) {
              const sudut = -Math.PI / 2 + (i * 2 * Math.PI) / n;
              const jari = !sisi && i % 2 ? luar * 0.45 : luar;
              titik.push((c + jari * Math.cos(sudut)).toFixed(2) + ',' + (c + jari * Math.sin(sudut)).toFixed(2));
            }
            return 'M' + titik.join('L') + 'Z';
          }
          // Penanda pada ukuran terbesar (20,8 px CSS) × DPR; diperkecil saat digambar.
          function siapkanSpriteHotspot(dpr) {
            if (spriteHotspot && dprSprite === dpr) return;
            dprSprite = dpr;
            spriteHotspot = [];
            const sisi = Math.ceil(21 * dpr);
            for (let s = 0; s < SISI_HOTSPOT.length; s++) {
              for (let k = 0; k < 3; k++) {
                const kv = document.createElement('canvas');
                kv.width = kv.height = sisi;
                const ctx = kv.getContext('2d');
                const tepi = 1.6 * dpr;
                const jalur = new Path2D(jalurBentukHotspot(s, sisi / 2, sisi / 2 - tepi));
                ctx.fillStyle = WARNA_SIPONGI[k];
                ctx.fill(jalur);
                ctx.lineJoin = 'round';
                ctx.lineWidth = tepi;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.stroke(jalur);
                spriteHotspot[s * 3 + k] = kv;
              }
            }
          }
          function ukuranHotspot(zoom) {
            const u = UKURAN_HOTSPOT;
            if (zoom <= u[0][0]) return u[0][1];
            for (let i = 1; i < u.length; i++) {
              if (zoom <= u[i][0]) {
                const f = (zoom - u[i - 1][0]) / (u[i][0] - u[i - 1][0]);
                return u[i - 1][1] + (u[i][1] - u[i - 1][1]) * f;
              }
            }
            return u[u.length - 1][1];
          }
          function gambarKanvasHotspot(paksa) {
            const peta = petaMapLibreWindy();
            if (!peta) return;
            const wadah = peta.getCanvasContainer();
            const kanvasPeta = peta.getCanvas();
            if (!kanvasHotspot || kanvasHotspot.parentNode !== wadah) {
              kanvasHotspot = document.createElement('canvas');
              kanvasHotspot.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
              kanvasPeta.insertAdjacentElement('afterend', kanvasHotspot);
              paksa = true;
            }
            const lebar = kanvasPeta.clientWidth;
            const tinggi = kanvasPeta.clientHeight;
            const dpr = window.devicePixelRatio || 1;
            const pusat = peta.getCenter();
            const zoom = peta.getZoom();
            const kunci = [pusat.lng.toFixed(6), pusat.lat.toFixed(6), zoom.toFixed(4), lebar, tinggi, dpr].join(',');
            if (!paksa && kunci === kunciKameraHotspot) return;
            kunciKameraHotspot = kunci;
            if (kanvasHotspot.width !== Math.round(lebar * dpr) || kanvasHotspot.height !== Math.round(tinggi * dpr)) {
              kanvasHotspot.width = Math.round(lebar * dpr);
              kanvasHotspot.height = Math.round(tinggi * dpr);
              kanvasHotspot.style.width = lebar + 'px';
              kanvasHotspot.style.height = tinggi + 'px';
            }
            const ctx = kanvasHotspot.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, kanvasHotspot.width, kanvasHotspot.height);
            if (!hotspotMerc || !hotspotMerc.length) return;
            siapkanSpriteHotspot(dpr);
            // Proyeksi Mercator sendiri (peta Windy tanpa rotasi/kemiringan):
            // jauh lebih cepat daripada peta.project() untuk puluhan ribu titik.
            const dunia = 512 * Math.pow(2, zoom) * dpr;
            const cx = (pusat.lng + 180) / 360;
            const sinPusat = Math.sin((pusat.lat * Math.PI) / 180);
            const cy = 0.5 - Math.log((1 + sinPusat) / (1 - sinPusat)) / (4 * Math.PI);
            const ox = (lebar * dpr) / 2 - cx * dunia;
            const oy = (tinggi * dpr) / 2 - cy * dunia;
            const uk = ukuranHotspot(zoom) * dpr;
            const setengah = uk / 2;
            const W = kanvasHotspot.width + uk;
            const H = kanvasHotspot.height + uk;
            let alfa = -1;
            for (let i = 0, n = hotspotKelas.length; i < n; i++) {
              const x = hotspotMerc[i * 2] * dunia + ox;
              const y = hotspotMerc[i * 2 + 1] * dunia + oy;
              if (x < -setengah || y < -setengah || x > W || y > H) continue;
              const kelas = hotspotKelas[i];
              const a = kelas % 3 === 0 ? 0.85 : 1;
              if (a !== alfa) { ctx.globalAlpha = a; alfa = a; }
              ctx.drawImage(spriteHotspot[kelas], x - setengah, y - setengah, uk, uk);
            }
            ctx.globalAlpha = 1;
          }
          // Pasang lapisan jangkar (kosong) bila belum ada dan jaga di puncak —
          // Windy bisa memasang lapisan sesudahnya. Kanvas penanda ikut dijaga.
          let kameraHotspotTerpasang = false;
          function jagaLapisanHotspot() {
            const peta = petaMapLibreWindy();
            if (!peta) return;
            try {
              if (!peta.getSource('hotspot')) {
                peta.addSource('hotspot', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
              }
              if (!peta.getLayer(ID_PENDAR_HOTSPOT)) {
                peta.addLayer({ id: ID_PENDAR_HOTSPOT, type: 'circle', source: 'hotspot' });
              } else if (typeof peta.getLayersOrder === 'function') {
                const urut = peta.getLayersOrder();
                if (urut[urut.length - 1] !== ID_PENDAR_HOTSPOT) peta.moveLayer(ID_PENDAR_HOTSPOT);
              }
              if (!kameraHotspotTerpasang) {
                kameraHotspotTerpasang = true;
                peta.on('render', function() { gambarKanvasHotspot(false); });
                peta.on('resize', function() { gambarKanvasHotspot(true); });
              }
            } catch (e) {}
          }
          // ── Info titik hotspot (padanan kartuHotspot lib/lapisan-hotspot.ts) ──
          // Lewat tooltip mengambang yang sama dengan nama provinsi, bukan
          // pop-up klik — klik/ketuk ke provinsi tak pernah terhalang. Mouse:
          // selama kursor di atas titik, tooltip berisi kartu hotspot. Layar
          // sentuh: ketukan pada titik membuka kartunya hanya mulai
          // ZOOM_KETUK_HOTSPOT; di zoom lebih jauh titiknya rapat menutupi
          // provinsi, jadi ketukan selalu memilih provinsi.
          const ZOOM_KETUK_HOTSPOT = 7;
          const NAMA_SATELIT = ['NASA-TERRA/AQUA (MODIS)', 'NASA-SNPP (VIIRS)', 'NASA-NOAA20 (VIIRS)', 'NASA-NOAA21 (VIIRS)'];
          const LABEL_KEPERCAYAAN = ['rendah', 'sedang', 'tinggi'];
          const BULAN_WIB = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          function formatWib(ms) {
            const d = new Date(ms + 7 * 3600 * 1000);
            const jj = String(d.getUTCHours()).padStart(2, '0');
            const mm = String(d.getUTCMinutes()).padStart(2, '0');
            return d.getUTCDate() + ' ' + BULAN_WIB[d.getUTCMonth()] + ', ' + jj + ':' + mm + ' WIB';
          }
          function lolosHtml(t) {
            return String(t).replace(/[&<>"]/g, function(c) {
              return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
            });
          }
          // t = [lng, lat, kepercayaan, satelit, FRP, waktu, malam, provinsi]
          function kartuHotspot(t) {
            const k = t[2];
            const jalur = jalurBentukHotspot(t[3], 6, 5);
            const warna = WARNA_SIPONGI[k] || WARNA_SIPONGI[0];
            function baris(label, isi) {
              return '<span style="color:rgba(255,255,255,0.6);">' + label + '</span><span style="text-align:right;">' + lolosHtml(isi) + '</span>';
            }
            return '<div style="min-width:190px;">' +
              '<div style="font-weight:700;color:#f59e0b;margin-bottom:2px;">' + lolosHtml(provinsiHotspot[t[7]] || '-') + '</div>' +
              '<div style="display:flex;align-items:center;gap:6px;font-size:11px;">' +
              '<svg viewBox="0 0 12 12" width="11" height="11"><path d="' + jalur + '" fill="' + warna + '" stroke="rgba(0,0,0,0.6)" stroke-linejoin="round"/></svg>' +
              'Hotspot · kepercayaan ' + (LABEL_KEPERCAYAAN[k] || '-') + '</div>' +
              '<div style="display:grid;grid-template-columns:auto 1fr;gap:1px 12px;margin-top:5px;font-size:11px;font-weight:500;">' +
              baris('Waktu', formatWib(t[5] * 60000) + (t[6] ? ' (malam)' : '')) +
              baris('Satelit', NAMA_SATELIT[t[3]] || '-') +
              baris('FRP', Number(t[4]).toLocaleString('id-ID') + ' MW') +
              '</div></div>';
          }
          // Titik dalam ±jari px dari (clientX, clientY) — proyeksi sama dengan
          // gambarKanvasHotspot; bila beberapa, kepercayaan tertinggi lalu terdekat.
          function hotspotDiLayar(clientX, clientY, jari) {
            const peta = petaMapLibreWindy();
            if (!peta || !hotspotMerc || !hotspotMerc.length) return null;
            const kotak = peta.getCanvas().getBoundingClientRect();
            const px = clientX - kotak.left;
            const py = clientY - kotak.top;
            if (px < 0 || py < 0 || px > kotak.width || py > kotak.height) return null;
            const pusat = peta.getCenter();
            const dunia = 512 * Math.pow(2, peta.getZoom());
            const sinPusat = Math.sin((pusat.lat * Math.PI) / 180);
            const ox = kotak.width / 2 - ((pusat.lng + 180) / 360) * dunia;
            const oy = kotak.height / 2 - (0.5 - Math.log((1 + sinPusat) / (1 - sinPusat)) / (4 * Math.PI)) * dunia;
            let terbaik = -1, kTerbaik = -1, dTerbaik = Infinity;
            for (let i = 0, n = hotspotUrut.length; i < n; i++) {
              const dx = hotspotMerc[i * 2] * dunia + ox - px;
              if (dx > jari || dx < -jari) continue;
              const dy = hotspotMerc[i * 2 + 1] * dunia + oy - py;
              if (dy > jari || dy < -jari) continue;
              const k = hotspotUrut[i][2];
              const d = dx * dx + dy * dy;
              if (k > kTerbaik || (k === kTerbaik && d < dTerbaik)) {
                terbaik = i;
                kTerbaik = k;
                dTerbaik = d;
              }
            }
            return terbaik >= 0 ? hotspotUrut[terbaik] : null;
          }
          function dariSentuhan(e) {
            if (e.pointerType) return e.pointerType !== 'mouse';
            return !!(window.matchMedia && window.matchMedia('(hover: none)').matches);
          }

          function gambarHotspot(titik) {
            hotspotTertunda = titik;
            // Kepercayaan rendah dulu → tinggi digambar paling atas.
            const urut = (titik || []).slice().sort(function(a, b) { return a[2] - b[2]; });
            hotspotUrut = urut;
            hotspotMerc = new Float64Array(urut.length * 2);
            hotspotKelas = new Uint8Array(urut.length);
            urut.forEach(function(t, i) {
              const sinLat = Math.sin((Math.max(-85, Math.min(85, t[1])) * Math.PI) / 180);
              hotspotMerc[i * 2] = (t[0] + 180) / 360;
              hotspotMerc[i * 2 + 1] = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
              hotspotKelas[i] = (t[3] || 0) * 3 + t[2];
            });
            if (!petaMapLibreWindy()) return;
            jagaLapisanHotspot();
            gambarKanvasHotspot(true);
          }
          // Tampilan awal peta: disinkronkan dengan zoom/center asli Windy sampai pengguna berinteraksi
          // Konsol /peta: roda memperbesar peta, dan zoom awalnya pecahan (hasil
          // cameraForBounds lapisan Aerosol) — jangan dibulatkan ke bawah.
          const KONSOL = ${konsol};
          const ZOOM_AWAL = parseFloat('${zoom}');
          let tampilanAwal = { pusat: [parseFloat('${lat}'), parseFloat('${lon}')], zoom: ZOOM_AWAL };
          // Kamera terakhir lapisan Aerosol yang dikirim parent (SET_KAMERA) —
          // bila ada, dipakai menggantikan tampilanAwal saat memosisikan ulang.
          let kameraTarget = null;

          // Selisih zoom dari parent (SKALA_ZOOM) yang menunggu iframe
          // di-resize. Diterapkan di handler resize — sebelum Windy sempat
          // menggambar — atau lewat cadangan waktu bila resize tak datang.
          let deltaTertunda = 0;
          let penundaDelta = null;
          function terapkanDeltaTertunda() {
            clearTimeout(penundaDelta);
            const delta = deltaTertunda;
            deltaTertunda = 0;
            if (!delta || !window.W || !window.W.map || !window.W.map.map) return;
            const m = window.W.map.map;
            try {
              const mml = m._maplibreMap;
              if (mml && typeof mml.resize === 'function') mml.resize();
            } catch (e) {}
            try {
              if (typeof m.invalidateSize === 'function') m.invalidateSize({ animate: false, pan: false });
            } catch (e) {}
            try {
              m.setView(m.getCenter(), m.getZoom() + delta, { animate: false });
            } catch (e) {}
            try {
              const mml = m._maplibreMap;
              if (mml && typeof mml.redraw === 'function') mml.redraw();
            } catch (e) {}
            // Tombol rumah ikut menyesuaikan, tetap memuat Nusantara penuh.
            tampilanAwal = { pusat: tampilanAwal.pusat, zoom: tampilanAwal.zoom + delta };
            if (kameraTarget) kameraTarget = { pusat: kameraTarget.pusat, zoom: kameraTarget.zoom + delta };
          }
          // MapLibre milik Windy me-resize kanvasnya lewat ResizeObserver lalu
          // baru menggambar di frame berikutnya — satu frame basi (zoom lama,
          // kanvas kosong di tepi) sempat tampil saat bingkai konsol berubah.
          // Di konsol pelacakan itu dimatikan dan resize ditangani sinkron di
          // event resize: ubah ukuran, terapkan selisih zoom, gambar ulang —
          // semuanya sebelum browser melukis frame.
          function petaMapLibreWindy() {
            try {
              const m = window.W && window.W.map && window.W.map.map;
              return m && m._maplibreMap ? m._maplibreMap : null;
            } catch (e) { return null; }
          }
          function matikanLacakResize() {
            const mml = petaMapLibreWindy();
            if (mml && mml._trackResize) mml._trackResize = false;
          }
          if (KONSOL) {
            // Parent mengirim SKALA_ZOOM lalu melepas ukuran iframe; selisih
            // zoom yang tertunda diterapkan di sini bersama resize kanvas.
            // (Dulu dipanggil langsung secara sinkron — tak mungkin lagi sejak
            // iframe di-sandbox tanpa allow-same-origin.)
            window.addEventListener('resize', function() {
              matikanLacakResize();
              const mml = petaMapLibreWindy();
              try { if (mml) mml.resize(); } catch (e) {}
              if (deltaTertunda) {
                terapkanDeltaTertunda();
              } else {
                try { if (mml) mml.redraw(); } catch (e) {}
              }
            });
          }
          let interaksiPengguna = false;

          function disableMapScrollZoom(map) {
            if (!map) return;
            // Di konsol /peta zoom roda justru dinyalakan — sama seperti lapisan Aerosol.
            const aksi = KONSOL ? 'enable' : 'disable';
            try {
              if (map.scrollWheelZoom && typeof map.scrollWheelZoom[aksi] === 'function') {
                map.scrollWheelZoom[aksi]();
              }
            } catch (e) {}
            try {
              if (map._maplibreMap && map._maplibreMap.scrollZoom && typeof map._maplibreMap.scrollZoom[aksi] === 'function') {
                map._maplibreMap.scrollZoom[aksi]();
              }
            } catch (e) {}
            // Pastikan sentuhan geser (panning) dan cubit (pinch-to-zoom) selalu aktif dan mulus di mobile
            try {
              if (map.dragging && typeof map.dragging.enable === 'function') {
                map.dragging.enable();
              }
            } catch (e) {}
            try {
              if (map.touchZoom && typeof map.touchZoom.enable === 'function') {
                map.touchZoom.enable();
              }
            } catch (e) {}
            try {
              var ml = map._maplibreMap;
              if (ml) {
                if (ml.dragPan && typeof ml.dragPan.enable === 'function') {
                  ml.dragPan.enable();
                }
                if (ml.touchZoomRotate && typeof ml.touchZoomRotate.enable === 'function') {
                  ml.touchZoomRotate.enable();
                } else if (ml.touchZoom && typeof ml.touchZoom.enable === 'function') {
                  ml.touchZoom.enable();
                }
              }
            } catch (e) {}
          }

          function pastikanSentuhMulus() {
            try {
              var m = window.W && window.W.map && window.W.map.map;
              if (!m) return;
              if (m.dragging && typeof m.dragging.enable === 'function' && typeof m.dragging.enabled === 'function' && !m.dragging.enabled()) {
                m.dragging.enable();
              }
              var mml = m._maplibreMap;
              if (mml && mml.dragPan && typeof mml.dragPan.enable === 'function' && typeof mml.dragPan.isEnabled === 'function' && !mml.dragPan.isEnabled()) {
                mml.dragPan.enable();
              }
            } catch (e) {}
          }

          function enforceLatestAQI() {
            try {
              ['detail', 'default-model-selector', 'picker', 'station', 'nearest-stations', 'sounding', 'webcams', 'app-review-dialog', 'onboarding'].forEach(function(name) {
                var p = window.W.plugins && window.W.plugins[name];
                if (p) {
                  p.open = function() { return false; };
                  if (p.isOpen && typeof p.close === 'function') {
                    p.close();
                  }
                }
              });

              if (window.W && window.W.map && window.W.map.map) {
                var m = window.W.map.map;
                disableMapScrollZoom(m);
              }
            } catch (e) {}
          }

          function perbaruiAngka(map) {
            if (!map || !daftarAngka.length) return;

            for (const a of daftarAngka) {
              const el = a.penanda.getElement();
              if (el) el.classList.remove('peta-angka--bertumpuk');
            }

            const kotak = daftarAngka.map((a, urut) => {
              const el = a.penanda.getElement();
              const isi = el ? el.firstElementChild : null;
              const pusat = map.latLngToContainerPoint(a.titik);
              const d = a.kotakDeg;
              const ka = map.latLngToContainerPoint([d[3], d[0]]);
              const kb = map.latLngToContainerPoint([d[1], d[2]]);
              return {
                urut,
                x: pusat.x,
                y: pusat.y,
                w: (isi ? isi.offsetWidth : 0) + ANGKA_SELA,
                h: (isi ? isi.offsetHeight : 0) + ANGKA_SELA,
                luas: Math.abs(kb.x - ka.x) * Math.abs(kb.y - ka.y)
              };
            });

            kotak.sort((a, b) => b.luas - a.luas);
            const ditempatkan = [];
            for (const c of kotak) {
              const bertumpuk = ditempatkan.some(
                t => Math.abs(c.x - t.x) * 2 < c.w + t.w && Math.abs(c.y - t.y) * 2 < c.h + t.h
              );
              if (bertumpuk) {
                const el = daftarAngka[c.urut].penanda.getElement();
                if (el) el.classList.add('peta-angka--bertumpuk');
              } else {
                ditempatkan.push(c);
              }
            }
          }

          function renderAngka(map) {
            if (!map || typeof L === 'undefined') return;
            if (markersLayer) {
              markersLayer.clearLayers();
            } else {
              markersLayer = L.layerGroup([], { pane: 'angkaPane' }).addTo(map);
            }
            daftarAngka = [];

            for (const [nama, info] of Object.entries(CENTROIDS)) {
              const jumlah = currentJumlahLaporan[nama];
              if (typeof jumlah !== 'number') continue;

              const penanda = L.marker([info.titik[1], info.titik[0]], {
                pane: 'angkaPane',
                interactive: false,
                keyboard: false,
                icon: L.divIcon({
                  className: 'peta-angka',
                  iconSize: [0, 0],
                  html: '<span class="peta-angka__nilai" aria-hidden="true">' + jumlah.toLocaleString('id-ID') + '</span>'
                })
              }).addTo(markersLayer);

              daftarAngka.push({
                penanda,
                titik: [info.titik[1], info.titik[0]],
                kotakDeg: info.kotak
              });
            }

            setTimeout(() => perbaruiAngka(map), 50);
          }

          function renderLokasiku(map) {
            if (penandaLokasiku) {
              penandaLokasiku.remove();
              penandaLokasiku = null;
            }
            if (!map || !lokasiku || typeof L === 'undefined') return;
            penandaLokasiku = L.marker(lokasiku, {
              pane: 'angkaPane',
              interactive: false,
              keyboard: false,
              icon: L.divIcon({ className: 'lokasiku', iconSize: [16, 16] })
            }).addTo(map);
          }

          function initAdministrativeMap() {
            if (mapInitialized) return;
            if (!window.W || !window.W.map || !window.W.map.map || typeof L === 'undefined') return;

            const map = window.W.map.map;
            disableMapScrollZoom(map);
            // Di atas zoom 11 Windy menyembunyikan lapisan AQI dan berganti ke
            // peta Outdoor Mapy.com (lengkap dengan panel pemilih peta dasarnya)
            // — lapisan ini jadi kosong. Batasi zoom supaya warna kualitas udara
            // selalu tampil. Zoom Windy = zoom MapLibre + 1.
            try {
              if (typeof map.setMaxZoom === 'function') map.setMaxZoom(11);
              const mmlBatas = map._maplibreMap;
              if (mmlBatas && typeof mmlBatas.setMaxZoom === 'function') mmlBatas.setMaxZoom(10);
            } catch (e) {}
            if (KONSOL) matikanLacakResize();
            if (window.W && window.W.store && typeof window.W.store.set === 'function') {
              try {
                window.W.store.set('product', 'cams');
                window.W.store.set('overlay', 'aqi');
              } catch (e) {}
            }
            try {
              map.setView([parseFloat('${lat}'), parseFloat('${lon}')], ZOOM_AWAL);
            } catch (e) {}

            // Windy masih memosisikan ulang peta beberapa saat setelah siap (router + pemulihan posisi).
            // Terapkan ulang kamera yang sama dengan lapisan Aerosol / posisi awal sampai pengunjung menyentuh peta.
            ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function(jenis) {
              window.addEventListener(jenis, function() { interaksiPengguna = true; }, { capture: true, passive: true });
            });
            [400, 1200, 2500, 4500].forEach(function(jeda) {
              setTimeout(function() {
                if (interaksiPengguna) return;
                const k = kameraTarget || tampilanAwal;
                try { map.setView(k.pusat, k.zoom, { animate: false }); } catch (e) {}
              }, jeda);
            });

            // Buat tombol kontrol zoom kustom (+ / − / home).
            // Saat query bentang=1 (dipakai landing karhutla), tombol bentang
            // selayar dipasang sebagai anak pertama — posisi & perannya sama
            // dengan tombol bentang di tumpukan kendali lapisan Aerosol
            // (PetaAsap). Kliknya mengirim BUKA_SELAYAR ke halaman induk;
            // membuka selayar adalah keputusan halaman, bukan iframe.
            if (!document.getElementById('custom-zoom-controls')) {
              const zoomBox = document.createElement('div');
              zoomBox.id = 'custom-zoom-controls';
              zoomBox.className = '${temaAwal === "light" ? "tema-light" : "tema-dark"}';
              zoomBox.innerHTML = '${tombolBentang}' +
                '<button id="btn-zoom-in" type="button" aria-label="Perbesar peta" title="Perbesar peta"><svg viewBox="0 0 24 24" width="${ringkas ? "13" : "16"}" height="${ringkas ? "13" : "16"}" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></button>' +
                '<button id="btn-zoom-out" type="button" aria-label="Perkecil peta" title="Perkecil peta"><svg viewBox="0 0 24 24" width="${ringkas ? "13" : "16"}" height="${ringkas ? "13" : "16"}" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12" /></svg></button>' +
                '<button id="btn-zoom-home" type="button" aria-label="Fokus seluruh Nusantara" title="Fokus seluruh Nusantara"><svg viewBox="0 0 24 24" width="${ringkas ? "13" : "16"}" height="${ringkas ? "13" : "16"}" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg></button>' +
                '<button id="btn-lapisan" type="button" aria-label="Lapisan peta" title="Lapisan peta" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></svg><span class="lencana-hotspot"></span></button>';
              document.body.appendChild(zoomBox);
              // SET_HOTSPOT bisa tiba sebelum tombol ini ada.
              if (hotspotTertunda) document.getElementById('btn-lapisan')?.classList.add('ada-hotspot');

              document.getElementById('btn-bentang')?.addEventListener('click', function(e) {
                e.stopPropagation();
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({ type: 'BUKA_SELAYAR' }, '*');
                }
              });

              document.getElementById('btn-zoom-in')?.addEventListener('click', function(e) {
                e.stopPropagation();
                if (window.W && window.W.map && window.W.map.map) window.W.map.map.zoomIn(1);
              });

              document.getElementById('btn-zoom-out')?.addEventListener('click', function(e) {
                e.stopPropagation();
                if (window.W && window.W.map && window.W.map.map) window.W.map.map.zoomOut(1);
              });

              // Tombol Lapisan: panelnya hidup di halaman induk (peta.tsx) —
              // kirim kotak tombol supaya panel bisa dijangkarkan ke sini.
              document.getElementById('btn-lapisan')?.addEventListener('click', function(e) {
                e.stopPropagation();
                const r = this.getBoundingClientRect();
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({ type: 'ALIH_LAPISAN', kotak: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }, '*');
                }
              });

              document.getElementById('btn-zoom-home')?.addEventListener('click', function(e) {
                e.stopPropagation();
                if (window.W && window.W.map && window.W.map.map) {
                  const m = window.W.map.map;
                  const k = kameraTarget || tampilanAwal;
                  // Pada Leaflet/MapLibre wrapper Windy, flyTo meneruskan zoom langsung ke MapLibre tanpa -1
                  // (sedangkan getZoom() adalah maplibreZoom + 1). Oleh karena itu zoom dikurangi 1
                  // agar hasil flyTo mengembalikan peta tepat ke zoom target.
                  m.flyTo(k.pusat, k.zoom - 1, { duration: 1.2 });
                }
              });
            }

            // Buat pane khusus untuk wilayah dan angka
            try {
              if (!map.getPane('wilayahPane')) {
                map.createPane('wilayahPane');
                map.getPane('wilayahPane').style.zIndex = '420';
              }
              if (!map.getPane('angkaPane')) {
                map.createPane('angkaPane');
                const p = map.getPane('angkaPane');
                p.style.zIndex = '460';
                p.style.pointerEvents = 'none';
              }
            } catch (e) {}

            // Buat elemen tooltip mengambang khusus
            const tooltipEl = document.createElement('div');
            tooltipEl.id = 'provinsi-tooltip';
            tooltipEl.style.cssText = 'position:fixed;display:none;pointer-events:none;z-index:9999;background:rgba(20,16,15,0.94);border:1px solid rgba(255,255,255,0.25);color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.6);font-family:system-ui,-apple-system,sans-serif;';
            document.body.appendChild(tooltipEl);
            // Tooltip sedang berisi kartu hotspot (bukan nama provinsi).
            let tooltipHotspot = false;
            let titikTooltip = null;
            // Ikut kursor + 14px, dijepit agar tak keluar bingkai.
            function tampilkanTooltip(html, x, y) {
              tooltipEl.innerHTML = html;
              tooltipEl.style.display = 'block';
              posisikanTooltip(x, y);
            }
            function posisikanTooltip(x, y) {
              const lb = tooltipEl.offsetWidth;
              const tg = tooltipEl.offsetHeight;
              tooltipEl.style.left = Math.max(8, Math.min(x + 14, window.innerWidth - lb - 8)) + 'px';
              tooltipEl.style.top = Math.max(8, Math.min(y + 14, window.innerHeight - tg - 8)) + 'px';
            }
            function htmlProvinsi(nama) {
              const jml = currentJumlahLaporan[nama];
              const teksJml = typeof jml === 'number' && jml > 0
                ? '<span style="color:#ef4444;font-weight:700;">' + jml.toLocaleString('id-ID') + ' laporan karhutla</span>'
                : '<span style="color:rgba(255,255,255,0.65);">Tidak ada laporan karhutla</span>';
              return '<div style="font-weight:700;color:#f59e0b;margin-bottom:2px;">' + nama + '</div><div style="font-size:11px;">' + teksJml + '</div>';
            }
            // Kartu hasil ketukan tak ikut kursor — tutup begitu peta digeser.
            try {
              const pml = petaMapLibreWindy();
              if (pml) pml.on('movestart', function() {
                if (tooltipHotspot) {
                  tooltipHotspot = false;
                  tooltipEl.style.display = 'none';
                }
              });
            } catch (e) {}

            // Cegah error internal Leaflet di Windy terkait tooltips
            try {
              if (typeof L !== 'undefined' && L.Layer && L.Layer.prototype) {
                L.Layer.prototype._addTooltipFocusListeners = function() {};
              }
            } catch (e) {}

            // Tambahkan GeoJSON Poligon Provinsi
            geoLayer = L.geoJSON(GEO_DATA, {
              pane: 'wilayahPane',
              className: 'provinsi-layer',
              style: function() {
                return {
                  fillColor: '#ffffff',
                  fillOpacity: 0.04,
                  color: 'rgba(255, 255, 255, 0.70)',
                  weight: 1.5,
                  opacity: 0.95
                };
              },
              onEachFeature: function(feature, layer) {
                const nama = feature.properties.nama;
                const pulau = PROVINSI_PULAU[nama] || null;

                function saatPilih(e) {
                  const orig = e.originalEvent;
                  if (orig && orig.button !== undefined && orig.button !== 0) return;
                  if (orig && typeof orig.stopPropagation === 'function') {
                    orig.stopPropagation();
                  }
                  const asal = orig ? { x: orig.clientX, y: orig.clientY } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
                  if (tooltipEl) tooltipEl.style.display = 'none';
                  
                  // Kirim ke parent window untuk membuka popup laporan
                  if (window.parent) {
                    window.parent.postMessage({
                      type: 'PILIH_WILAYAH',
                      nama: nama,
                      pulau: pulau,
                      asal: asal
                    }, '*');
                  }
                }

                layer.on('click', saatPilih);
              }
            }).addTo(map);

            function tagAllPaths() {
              if (!geoLayer) return;
              geoLayer.eachLayer(function(l) {
                if (l.feature && l.feature.properties) {
                  const n = l.feature.properties.nama;
                  const p = PROVINSI_PULAU[n] || '';
                  const el = l.getElement ? l.getElement() : l._path;
                  if (el) {
                    el.setAttribute('data-nama', n);
                    el.setAttribute('data-pulau', p);
                    el.style.pointerEvents = 'auto';
                    el.style.cursor = 'pointer';
                  }
                }
              });
            }

            tagAllPaths();
            setTimeout(tagAllPaths, 150);
            setTimeout(tagAllPaths, 600);
            map.on('zoomend moveend resize', tagAllPaths);

            // Document-level capturing click listener guarantees click capture across all browser pointer engines
            document.addEventListener('click', function(e) {
              // Layar sentuh, peta sudah diperbesar, ketukan tepat di titik
              // hotspot (di atas provinsi atau kanvas peta, bukan tombol):
              // tampilkan kartunya alih-alih memilih provinsi. Mouse selalu
              // memilih provinsi — info titiknya sudah tampil saat kursor di atasnya.
              const diPeta = e.target && e.target.closest && (e.target.closest('path[data-nama]') || e.target.tagName === 'CANVAS');
              const pml = petaMapLibreWindy();
              if (diPeta && pml && dariSentuhan(e) && pml.getZoom() >= ZOOM_KETUK_HOTSPOT) {
                const titik = hotspotDiLayar(e.clientX, e.clientY, 12);
                if (titik) {
                  e.preventDefault();
                  e.stopPropagation();
                  tooltipHotspot = true;
                  tampilkanTooltip(kartuHotspot(titik), e.clientX, e.clientY);
                  return;
                }
              }
              const path = e.target && e.target.closest ? e.target.closest('path[data-nama], .provinsi-layer') : null;
              if (!path) return;
              const nama = path.getAttribute('data-nama');
              if (!nama) return;
              const pulau = path.getAttribute('data-pulau') || null;

              e.preventDefault();
              e.stopPropagation();

              if (tooltipEl) tooltipEl.style.display = 'none';

              if (window.parent) {
                window.parent.postMessage({
                  type: 'PILIH_WILAYAH',
                  nama: nama,
                  pulau: pulau,
                  asal: { x: e.clientX, y: e.clientY }
                }, '*');
              }
            }, true);

            // Document-level capturing hover listeners for tooltip
            document.addEventListener('mouseover', function(e) {
              const path = e.target && e.target.closest ? e.target.closest('path[data-nama], .provinsi-layer') : null;
              if (!path) return;
              const nama = path.getAttribute('data-nama');
              if (!nama || !tooltipEl || tooltipHotspot) return;
              tampilkanTooltip(htmlProvinsi(nama), e.clientX, e.clientY);
            }, true);

            // Kursor di atas titik hotspot: tooltip berisi kartunya; lepas dari
            // titik: kembali ke nama provinsi di bawah kursor (bila ada).
            document.addEventListener('mousemove', function(e) {
              if (!tooltipEl) return;
              const titik = dariSentuhan(e) ? null : hotspotDiLayar(e.clientX, e.clientY, 6);
              if (titik) {
                tooltipHotspot = true;
                if (titik !== titikTooltip) tampilkanTooltip(kartuHotspot(titik), e.clientX, e.clientY);
                else posisikanTooltip(e.clientX, e.clientY);
                titikTooltip = titik;
                return;
              }
              titikTooltip = null;
              if (tooltipHotspot) {
                tooltipHotspot = false;
                const path = e.target && e.target.closest ? e.target.closest('path[data-nama]') : null;
                const nama = path && path.getAttribute('data-nama');
                if (nama) tampilkanTooltip(htmlProvinsi(nama), e.clientX, e.clientY);
                else tooltipEl.style.display = 'none';
                return;
              }
              if (tooltipEl.style.display === 'block') posisikanTooltip(e.clientX, e.clientY);
            }, true);

            document.addEventListener('mouseout', function(e) {
              const fromPath = e.target && e.target.closest ? e.target.closest('path[data-nama], .provinsi-layer') : null;
              if (!fromPath || !tooltipEl || tooltipHotspot) return;
              const toPath = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('path[data-nama], .provinsi-layer') : null;
              // Jika kursor masih di dalam polygon provinsi yang sama, jangan sembunyikan tooltip
              if (fromPath === toPath) return;
              tooltipEl.style.display = 'none';
            }, true);

            renderAngka(map);
            renderLokasiku(map);

            map.on('zoomend moveend resize', function() {
              perbaruiAngka(map);
              // Induk (peta.tsx) menyamakan kamera Aerosol dari sini saat beralih
              // lapisan — ia tak bisa membaca W.map langsung (iframe di-sandbox).
              try {
                const c = map.getCenter();
                const mml = map._maplibreMap;
                const z = mml && typeof mml.getZoom === 'function' ? mml.getZoom() : map.getZoom() - 1;
                kirimInduk({ type: 'KAMERA_WINDY', lat: c.lat, lng: c.lng, zoom: z });
              } catch (e) {}
            });

            mapInitialized = true;
            if (hotspotTertunda) gambarHotspot(hotspotTertunda);

            // Pastikan logo Copernicus & logo Windy selalu hadir di DOM dan tampil
            function pastikanSemuaLogo() {
              // Pastikan interaksi sentuh geser/cubit selalu aktif di mobile
              pastikanSentuhMulus();
              // Lapisan udara tetap terpasang & lapisan AQI Windy tetap tersembunyi.
              jagaLapisanUdara();
              // 1. Copernicus: Windy di mobile tidak menyisipkan logo Copernicus (!C di script internalnya)
              var ci = document.querySelector('img[src*="copernicus"]');
              var wsp = document.querySelector('.rhpane__bottom-messages');
              if (!ci) {
                if (!wsp) {
                  wsp = document.createElement('div');
                  wsp.className = 'rhpane__bottom-messages';
                  document.body.appendChild(wsp);
                }
                wsp.innerHTML = '<a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noopener noreferrer" style="display:block;"><img src="https://www.windy.com/img/providers/copernicus-white.svg" alt="Copernicus" style="display:block;" /></a>';
              }

              // Pastikan rantai induk .rhpane__bottom-messages tidak tertutup display:none
              if (wsp) {
                wsp.style.setProperty('display', 'flex', 'important');
                wsp.style.setProperty('visibility', 'visible', 'important');
                wsp.style.setProperty('opacity', '1', 'important');
                var pw = wsp.parentElement;
                if (pw && pw !== document.body) {
                  pw.style.setProperty('display', 'block', 'important');
                  pw.style.setProperty('visibility', 'visible', 'important');
                  pw.style.setProperty('opacity', '1', 'important');
                }
              }

              // 2. Windy Logo: un-hide logo-wrapper & #logo dari aturan .on... dan container query
              var lw = document.getElementById('logo-wrapper');
              if (lw) {
                lw.style.setProperty('display', 'block', 'important');
                lw.style.setProperty('visibility', 'visible', 'important');
                lw.style.setProperty('opacity', '1', 'important');
              }
              var el = document.getElementById('logo');
              if (el) {
                el.style.setProperty('display', 'flex', 'important');
                el.style.setProperty('visibility', 'visible', 'important');
                el.style.setProperty('opacity', '0.95', 'important');
              }
            }

            pastikanSemuaLogo();
            setInterval(pastikanSemuaLogo, 500);

            // Tinggi bilah legenda AQI selebar layar (#legend-mobile) di dasar
            // iframe — hanya ada saat Windy memakai tampilan mobile/tablet; di
            // desktop legendanya kotak kecil kanan-bawah, jadi 0. Induk memakai
            // angka ini agar bilah waktunya duduk tepat di atas bilah tersebut.
            var selaLegendaTerkirim = -1;
            function kirimSelaLegenda() {
              var lm = document.getElementById('legend-mobile');
              var tinggi = 0;
              if (lm) {
                var r = lm.getBoundingClientRect();
                if (r.height > 0 && r.top < window.innerHeight) tinggi = Math.round(window.innerHeight - r.top);
              }
              if (tinggi === selaLegendaTerkirim || !window.parent) return;
              selaLegendaTerkirim = tinggi;
              window.parent.postMessage({ type: 'SELA_LEGENDA', tinggi: tinggi }, '*');
            }
            kirimSelaLegenda();
            setInterval(kirimSelaLegenda, 500);

            // Beri tahu parent bahwa map forecasting sudah siap
            if (window.parent) {
              window.parent.postMessage({ type: 'FORECASTING_READY' }, '*');
            }
            // Lapisan AQI + angin kita (lihat mesin lapisan udara di atas).
            mulaiLapisanUdara();
          }

          // Listener pesan dari parent Next.js
          window.addEventListener('message', function(event) {
            // Hanya induk yang membingkai iframe ini, bukan jendela lain.
            if (event.source !== window.parent) return;
            const data = event.data;
            if (!data || typeof data !== 'object') return;

            if (data.type === 'SET_JUMLAH') {
              if (data.jumlahLaporan) {
                currentJumlahLaporan = data.jumlahLaporan;
                if (window.W && window.W.map && window.W.map.map) {
                  renderAngka(window.W.map.map);
                }
              }
            } else if (data.type === 'SET_LOKASIKU') {
              // Aplikasi Laporin: titik lokasi pengguna, seperti mode peta lainnya.
              if (typeof data.lat === 'number' && typeof data.lng === 'number' && isFinite(data.lat) && isFinite(data.lng)) {
                lokasiku = [data.lat, data.lng];
                // Sebelum peta siap disimpan saja; initAdministrativeMap menggambarnya.
                if (mapInitialized) renderLokasiku(window.W.map.map);
              }
            } else if (data.type === 'FOCUS_WILAYAH') {
              const info = CENTROIDS[data.nama];
              if (info && window.W && window.W.map && window.W.map.map) {
                const map = window.W.map.map;
                map.flyTo([info.titik[1], info.titik[0]], 6, { duration: 1.2 });
              }
            } else if (data.type === 'SKALA_ZOOM') {
              // Konsol /peta: bingkai membesar/mengecil (rel dilipat). Parent
              // mengirim selisih zoom = log2(lebar baru / lebar lama) supaya
              // wilayah yang tampil tetap sama — Nusantara ikut membesar.
              // Selisihnya disimpan dulu dan diterapkan pada event resize iframe
              // (parent melepas ukuran iframe sesudah pesan ini) — zoom baru dan
              // ukuran baru tergambar di frame yang sama, tanpa kedipan.
              if (KONSOL && typeof data.delta === 'number' && isFinite(data.delta)) {
                deltaTertunda += data.delta;
                clearTimeout(penundaDelta);
                penundaDelta = setTimeout(terapkanDeltaTertunda, 300);
              }
            } else if (data.type === 'SET_KOLOM') {
              // shortcut: tombol zoom (zoomIn/zoomOut) tetap berpusat di tengah iframe,
              // kolom/2 px di barat tengah yang tampak; pakai setZoomAround bila terasa meleset.
              const kiri = Number(data.kiri) || 0;
              document.documentElement.style.setProperty('--kolom-kiri', kiri + 'px');
              // Panel dibentang/diciutkan: peta meluncur setengah selisihnya supaya
              // pusatnya tetap di tengah ruang yang tampak, bersama luncuran panel
              // (lapisan Aerosol: tutupKiri PetaAsap). Masuk/keluar selayar (0 ↔
              // kolom) tidak — kameranya datang lewat SET_KAMERA.
              if (kolomKiri && kiri && kiri !== kolomKiri) {
                const dx = (kolomKiri - kiri) / 2;
                // Kamera yang diterapkan ulang (penjaga awal sampai disentuh, tombol
                // rumah) ikut bergeser — tanpa ini ia menarik peta balik ke tengah lama.
                const geser = function(k) {
                  return k && { pusat: [k.pusat[0], k.pusat[1] + (dx * 360) / (256 * Math.pow(2, k.zoom))], zoom: k.zoom };
                };
                kameraTarget = geser(kameraTarget);
                tampilanAwal = geser(tampilanAwal);
                const m = window.W && window.W.map && window.W.map.map;
                // MapLibre di balik Leaflet Windy langsung: panBy pembungkusnya
                // meneruskan duration (detik) ke MapLibre (ms), jadi petanya melompat.
                const mml = m && m._maplibreMap;
                try {
                  if (mml && typeof mml.panBy === 'function') {
                    mml.panBy([dx, 0], { duration: kurangiGerak() ? 0 : 300, easing: function(t) { return 1 - Math.pow(1 - t, 4); } });
                  } else if (m) {
                    m.panBy([dx, 0], { animate: false });
                  }
                } catch (e) {}
              }
              kolomKiri = kiri;
            } else if (data.type === 'SET_KAMERA') {
              // Samakan kamera dengan lapisan Aerosol / Nusantara saat beralih mode atau masuk selayar.
              // Zoom sudah dalam skala Windy (Aerosol + 1).
              if (isFinite(data.lat) && isFinite(data.lon) && isFinite(data.zoom)) {
                kameraTarget = { pusat: [data.lat, data.lon], zoom: data.zoom };
                tampilanAwal = { pusat: [data.lat, data.lon], zoom: data.zoom };
                if (window.W && window.W.map && window.W.map.map) {
                  try {
                    window.W.map.map.setView(kameraTarget.pusat, kameraTarget.zoom, { animate: false });
                    const mml = window.W.map.map._maplibreMap;
                    if (mml && typeof mml.resize === 'function') mml.resize();
                  } catch (e) {}
                }
              }
            } else if (data.type === 'WINDY_ACTIVE') {
              if (window.W && window.W.store && typeof window.W.store.set === 'function') {
                try {
                  if (window.W.store.get('product') !== 'cams') {
                    window.W.store.set('product', 'cams');
                  }
                  if (window.W.store.get('overlay') !== 'aqi') {
                    window.W.store.set('overlay', 'aqi');
                  }
                } catch(e) {}
              }
              if (window.W && window.W.map && window.W.map.map) {
                try {
                  window.W.map.map.invalidateSize();
                } catch(e) {}
              }
              // Lapisan Angin tampil lagi: lanjutkan animasi (partikel & putar).
              udaraAktif = true;
              mintaGambarUdara();
            } else if (data.type === 'WINDY_NONAKTIF') {
              // Induk beralih ke lapisan Aerosol: iframe tersembunyi
              // (opacity 0), jadi loop animasi & partikel berhenti total.
              udaraAktif = false;
              hentikanPutaranUdara();
            } else if (data.type === 'PUTAR_UDARA') {
              if (data.laju === 1 || data.laju === 2) udaraLaju = data.laju;
              if (typeof data.putar === 'boolean') udaraMemutar = data.putar;
              mintaGambarUdara();
              laporWaktuUdara();
            } else if (data.type === 'SET_PROGRES') {
              // Lompat (tombol sebelum/berikut, slider) — putar tak dihentikan,
              // sama seperti bilah waktu Aerosol.
              if (typeof data.progres === 'number' && isFinite(data.progres)) {
                udaraProgresDariInduk = true;
                setelProgresUdara(data.progres);
              }
            } else if (data.type === 'GESER_UDARA') {
              // Slider sedang digeser: progres ditahan di tangan pengguna dan
              // peta digambar ulang tiap frame; dilepas → putar berlanjut.
              udaraGeser = !!data.geser;
              if (typeof data.progres === 'number' && isFinite(data.progres)) setelProgresUdara(data.progres);
              else {
                mintaGambarUdara();
                laporWaktuUdara();
              }
            } else if (data.type === 'SET_HOTSPOT') {
              hotspotTertunda = Array.isArray(data.titik) ? data.titik : null;
              provinsiHotspot = Array.isArray(data.provinsi) ? data.provinsi : [];
              document.getElementById('btn-lapisan')?.classList.toggle('ada-hotspot', !!hotspotTertunda);
              if (mapInitialized) gambarHotspot(hotspotTertunda);
            } else if (data.type === 'SET_LAPISAN') {
              // Sakelar panel Lapisan induk; kelas di <html> karena Windy menimpa kelas <body>.
              udaraTampil = data.angin !== false;
              const akar = document.documentElement.classList;
              akar.toggle('udara-mati', !udaraTampil);
              akar.toggle('poligon-mati', data.poligon === false);
              akar.toggle('angka-mati', data.angka === false);
              jagaLapisanUdara();
              mintaGambarUdara();
            } else if (data.type === 'FOKUS_LAPISAN') {
              // Esc menutup panel Lapisan induk: kembalikan fokus ke tombolnya.
              document.getElementById('btn-lapisan')?.focus();
            } else if (data.type === 'SET_TEMA') {
              const zb = document.getElementById('custom-zoom-controls');
              if (zb) {
                zb.classList.remove('tema-light', 'tema-dark');
                zb.classList.add(data.tema === 'light' ? 'tema-light' : 'tema-dark');
              }
              if (data.tema === 'light') {
                document.documentElement.classList.add('light');
                document.documentElement.classList.remove('dark');
              } else {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
              }
            }
          });

          // Intercept click container kosong agar tidak memicu popup bawaan Windy
          document.addEventListener('click', function(e) {
            if (e.target && (
              e.target.closest('.leaflet-wilayahPane-pane') ||
              e.target.closest('.leaflet-angkaPane-pane') ||
              e.target.closest('.provinsi-layer') ||
              e.target.closest('.leaflet-overlay-pane') ||
              e.target.closest('.leaflet-marker-pane') ||
              e.target.closest('.peta-angka') ||
              e.target.closest('#custom-zoom-controls') ||
              e.target.closest('#logo') ||
              e.target.closest('#plugin-rhbottom') ||
              e.target.closest('.rhpane__bottom-messages')
            )) {
              return;
            }
            if (e.target && (e.target.closest('#map-container') || e.target.tagName === 'CANVAS')) {
              e.stopImmediatePropagation();
            }
          }, true);

          // Tangkap event wheel: cegah zoom peta dan teruskan ke parent window agar halaman dapat di-scroll naik/turun
          window.addEventListener('wheel', function(e) {
            // Konsol /peta: biarkan peta Windy menangani roda sendiri (zoom biasa).
            if (KONSOL) return;
            // Jika pengguna menekan Ctrl atau Meta (Cmd), izinkan perbesaran peta
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              e.stopPropagation();
              if (window.W && window.W.map && window.W.map.map) {
                const map = window.W.map.map;
                if (e.deltaY < 0) {
                  map.zoomIn(0.5);
                } else {
                  map.zoomOut(0.5);
                }
              }
              return;
            }

            // Gulir biasa: cegah scrolling peramban bawaan ganda dan teruskan pergerakan scroll ke parent window (Lenis)
            e.preventDefault();
            e.stopPropagation();

            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: 'IFRAME_WHEEL',
                deltaY: e.deltaY,
                deltaX: e.deltaX,
                deltaMode: e.deltaMode
              }, '*');
            }
          }, { capture: true, passive: false });

          function checkAndInit() {
            enforceLatestAQI();
            if (!mapInitialized && window.W && window.W.map && window.W.map.map && typeof L !== 'undefined') {
              initAdministrativeMap();
            }
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkAndInit);
          } else {
            checkAndInit();
          }

          let checks = 0;
          const interval = setInterval(() => {
            checkAndInit();
            checks++;
            if (mapInitialized) {
              clearInterval(interval);
            }
          }, 350);
        })();
      </script>
    `;

    let modifiedHtml = html;
    if (modifiedHtml.includes("<head>")) {
      modifiedHtml = modifiedHtml.replace("<head>", `<head>${baseTag}${preInitScript}${customStyles}`);
    } else {
      modifiedHtml = baseTag + preInitScript + customStyles + modifiedHtml;
    }

    if (modifiedHtml.includes("</body>")) {
      modifiedHtml = modifiedHtml.replace("</body>", `${customScript}</body>`);
    } else {
      modifiedHtml += customScript;
    }

    return new Response(modifiedHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        // Boleh dibingkai siapa saja — ia bersarang di peta sematan
        // /<locale>/embed (lihat next.config.ts). sandbox tanpa
        // allow-same-origin: skrip Windy (pihak ketiga) berjalan di origin
        // buram, bukan origin kita — juga bila URL ini dibuka langsung.
        "Content-Security-Policy": "frame-ancestors *; sandbox allow-scripts allow-popups",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Error fetching Windy AQI: ${message}`, { status: 500 });
  }
}
