import { NextRequest, NextResponse } from "next/server";
import petaProvinsi from "@/public/data/peta-provinsi.json";
import { inferPulau } from "@/lib/wilayah";

// Centroid daratan terbesar dan kotak batas untuk tiap provinsi (dihitung dari lib/geometri.ts tempatAngka)
const PUSAT_WILAYAH: Record<string, { titik: [number, number]; kotak: [number, number, number, number] }> = {
  "Aceh": { titik: [96.9394, 4.2832], kotak: [95.1951, 2.146, 98.2863, 5.6572] },
  "Bali": { titik: [115.1178, -8.3541], kotak: [114.438, -8.8474, 115.7163, -8.0589] },
  "Banten": { titik: [106.12, -6.4553], kotak: [105.2182, -6.9952, 106.7759, -5.8854] },
  "Bengkulu": { titik: [102.3655, -3.5383], kotak: [101.0278, -4.9224, 103.7773, -2.2802] },
  "DI Yogyakarta": { titik: [110.444, -7.8914], kotak: [110.0118, -8.2029, 110.8361, -7.5366] },
  "DKI Jakarta": { titik: [106.8355, -6.2047], kotak: [106.6888, -6.3669, 106.9729, -6.0893] },
  "Gorontalo": { titik: [122.3771, 0.6909], kotak: [121.1686, 0.3259, 123.5272, 1.0453] },
  "Jambi": { titik: [102.7271, -1.697], kotak: [101.1258, -2.7667, 104.5152, -0.7552] },
  "Jawa Barat": { titik: [107.6047, -6.9212], kotak: [106.3709, -7.8227, 108.8293, -5.9114] },
  "Jawa Tengah": { titik: [110.2095, -7.2609], kotak: [108.5564, -8.2104, 111.6946, -6.4066] },
  "Jawa Timur": { titik: [112.6168, -7.8178], kotak: [110.9045, -8.7807, 114.5913, -6.7529] },
  "Kalimantan Barat": { titik: [111.158, -0.0686], kotak: [108.8406, -3.0395, 114.2205, 2.065] },
  "Kalimantan Selatan": { titik: [115.3871, -2.9714], kotak: [114.3471, -4.1719, 116.5589, -1.315] },
  "Kalimantan Tengah": { titik: [113.4235, -1.6051], kotak: [110.7345, -3.539, 115.847, 0.7775] },
  "Kalimantan Timur": { titik: [116.4594, 0.4699], kotak: [113.8417, -2.4052, 118.989, 2.6263] },
  "Kalimantan Utara": { titik: [116.1563, 2.867], kotak: [114.5896, 1.0619, 117.9859, 4.4082] },
  "Kepulauan Bangka Belitung": { titik: [105.9854, -2.2515], kotak: [105.1067, -3.1122, 106.7983, -1.5187] },
  "Kepulauan Riau": { titik: [108.2051, 3.9144], kotak: [107.9619, 3.6306, 108.4101, 4.2304] },
  "Lampung": { titik: [105.0218, -4.9145], kotak: [103.5982, -5.9373, 105.9129, -3.7291] },
  "Maluku": { titik: [129.4589, -3.1992], kotak: [127.866, -3.8767, 130.8796, -2.779] },
  "Maluku Utara": { titik: [128.0103, 0.8698], kotak: [127.3987, -0.8872, 128.8473, 2.2041] },
  "Nusa Tenggara Barat": { titik: [117.755, -8.6772], kotak: [116.7278, -9.1128, 119.1626, -8.0802] },
  "Nusa Tenggara Timur": { titik: [121.1522, -8.6045], kotak: [119.7994, -8.9596, 123.0215, -8.0651] },
  "Papua": { titik: [138.7266, -4.5461], kotak: [134.2052, -9.1183, 141.0118, -1.4586] },
  "Papua Barat": { titik: [133.1416, -2.0976], kotak: [130.9314, -4.2528, 135.2577, -0.3433] },
  "Riau": { titik: [101.7596, 0.4464], kotak: [100.0537, -1.1211, 103.8117, 2.5295] },
  "Sulawesi Barat": { titik: [119.3396, -2.4596], kotak: [118.7567, -3.5703, 119.9092, -0.8609] },
  "Sulawesi Selatan": { titik: [120.1575, -3.6273], kotak: [119.3539, -5.702, 121.8006, -1.8845] },
  "Sulawesi Tengah": { titik: [121.3787, -1.1778], kotak: [119.431, -3.2711, 123.4521, 1.3485] },
  "Sulawesi Tenggara": { titik: [121.8307, -3.7935], kotak: [120.8588, -4.8947, 122.9044, -2.7102] },
  "Sulawesi Utara": { titik: [124.2694, 0.8843], kotak: [123.1173, 0.3126, 125.2425, 1.7548] },
  "Sumatera Barat": { titik: [100.6486, -0.7005], kotak: [99.162, -2.4822, 101.8785, 0.9057] },
  "Sumatera Selatan": { titik: [104.1746, -3.2086], kotak: [102.0668, -4.9228, 106.0786, -1.628] },
  "Sumatera Utara": { titik: [99.1596, 2.3049], kotak: [97.8032, 0.2318, 100.4553, 4.291] },
};

// Pemetaan nama provinsi ke pulau
const PROVINSI_PULAU: Record<string, string> = {};
for (const feature of petaProvinsi.features) {
  const nama = feature.properties.nama;
  const pulau = inferPulau(nama);
  if (pulau) PROVINSI_PULAU[nama] = pulau;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat") || "0.200";
  const lon = searchParams.get("lon") || "118.000";
  const zoom = searchParams.get("zoom") || "5";

  const targetUrl = `https://www.windy.com/-Air-quality-index-aqi?cams,aqi,${lat},${lon},${zoom}`;

  try {
    const resWindy = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
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
          // (account.windy.com, capalerts, forecast/fragment).
          // Endpoint-endpoint ini hanya mengizinkan Access-Control-Allow-Origin:
          // https://www.windy.com, sehingga memicu galat CORS merah di console
          // saat dijalankan dari origin web kita. Kita cegat SEBELUM ke jaringan
          // dan balas respons kosong/JSON-sukses agar peta berjalan mulus tanpa CORS error.
          var _windyBungkam = function(u) {
            try { u = String(u); } catch(e) { return false; }
            return (u.indexOf('node.windy.com') !== -1 && (u.indexOf('/ga/') !== -1 || u.indexOf('/capalerts/') !== -1 || u.indexOf('/forecast/fragment/') !== -1)) ||
                   (u.indexOf('account.windy.com') !== -1);
          };
          try {
            var _fetchAsli = window.fetch;
            window.fetch = function(input, init) {
              var url = (input && typeof input === 'object' && input.url) ? input.url : input;
              if (_windyBungkam(url)) {
                var urlStr = String(url);
                var isJson = urlStr.indexOf('account.windy.com') !== -1 || urlStr.indexOf('/capalerts/') !== -1 || urlStr.indexOf('/forecast/fragment/') !== -1;
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
              this.__windyIsJson = urlStr.indexOf('account.windy.com') !== -1 || urlStr.indexOf('/capalerts/') !== -1 || urlStr.indexOf('/forecast/fragment/') !== -1;
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
          // iframe peta (konteks ini hanya Windy + skrip peta kita).
          window.addEventListener('unhandledrejection', function(ev) {
            try {
              var m = ev && ev.reason && (ev.reason.message || String(ev.reason));
              if (m && m.indexOf('Failed to fetch') !== -1) { ev.preventDefault(); }
            } catch(e) {}
          });

          // A. Wrap history methods to prevent cross-origin SecurityError caused by <base href>
          var _origReplace = window.history.replaceState;
          window.history.replaceState = function(state, title, url) {
            try {
              if (typeof url === 'string') {
                url = url.replace(/^https?:\\/\\/[^\\/]+/, '');
              }
              return _origReplace.call(window.history, state, title, url);
            } catch(e) {}
          };
          var _origPush = window.history.pushState;
          window.history.pushState = function(state, title, url) {
            try {
              if (typeof url === 'string') {
                url = url.replace(/^https?:\\/\\/[^\\/]+/, '');
              }
              return _origPush.call(window.history, state, title, url);
            } catch(e) {}
          };

          // B. Pre-seed URL path & search before router parses window.location
          var targetPath = '/-Air-quality-index-aqi';
          var targetSearch = '?cams,aqi,${lat},${lon},${zoom}';
          try {
            if (!window.location.pathname.includes('Air-quality-index') || !window.location.search.includes('aqi')) {
              window.history.replaceState(null, '', targetPath + targetSearch);
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

          // E. Hook window.W.store safely to seed cams & aqi on boot without breaking internal dictionary lookups
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
              }
            }
          });

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

        .rhpane__bottom-messages {
          position: fixed !important;
          bottom: 16px !important;
          left: 20px !important;
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
          left: 151px !important;
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

        /* E2. Mobile: tampilkan logo Copernicus & Windy berdampingan di kiri-bawah di atas bilah legenda */
        @media (max-width: 640px) {
          .rhpane__bottom-messages {
            left: 14px !important;
            bottom: 40px !important;
            width: 120px !important;
            z-index: 1002 !important;
          }
          .rhpane__bottom-messages img,
          img[src*="copernicus"] {
            width: 120px !important;
            max-width: 120px !important;
          }
          #logo,
          #logo-wrapper #logo,
          [class*="on"] #logo-wrapper #logo,
          #device-mobile #logo,
          #device-tablet #logo {
            left: 144px !important;
            right: auto !important;
            bottom: 40px !important;
            transform: scale(0.6) !important;
            transform-origin: left bottom !important;
            z-index: 1002 !important;
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
          background-color: #0a0f18 !important;
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

        .leaflet-pane.leaflet-wilayah-pane path:hover,
        .provinsi-layer:hover,
        path.provinsi-layer:hover {
          stroke: #ffffff !important;
          stroke-width: 2.5px !important;
          fill: #ffffff !important;
          fill-opacity: 0.18 !important;
        }

        /* J. Number Badges (.peta-angka) */
        .peta-angka {
          width: 0;
          height: 0;
          overflow: visible;
          pointer-events: none;
        }

        .peta-angka__nilai {
          position: absolute;
          top: 0;
          left: 0;
          transform: translate(-50%, -50%);
          white-space: nowrap;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          color: #ffffff;
          text-shadow:
            0 0 3px rgb(26 25 25 / 0.85),
            1px 1px 0 rgb(26 25 25 / 0.7),
            -1px 1px 0 rgb(26 25 25 / 0.7),
            1px -1px 0 rgb(26 25 25 / 0.7),
            -1px -1px 0 rgb(26 25 25 / 0.7);
          pointer-events: none;
          user-select: none;
        }

        .peta-angka--bertumpuk {
          display: none !important;
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

        /* Tombol kontrol zoom kustom */
        #custom-zoom-controls {
          position: fixed;
          right: 20px;
          top: 86px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          z-index: 999;
          pointer-events: auto;
        }
        #custom-zoom-controls button {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(20, 16, 15, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: #ffffff;
          font-size: 20px;
          line-height: 1;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
          transition: background 0.15s ease, transform 0.15s ease;
          user-select: none;
        }
        #custom-zoom-controls button:hover {
          background: rgba(45, 38, 35, 0.9);
          transform: scale(1.05);
        }
        #custom-zoom-controls button:active {
          transform: scale(0.95);
        }

        /* MOBILE: satu jari menggulir HALAMAN, cubit untuk zoom peta.
           Tanpa ini, sapuan vertikal satu jari ditelan peta (geser peta) dan
           pengunjung tidak bisa kembali ke beranda. touch-action pan-x pan-y
           menyerahkan sapuan satu jari ke peramban (scroll halaman), sementara
           pinch-zoom tetap ditangani peta. Diperkuat oleh JS di bawah yang
           mematikan dragging/dragPan satu jari di perangkat sentuh. */
        @media (pointer: coarse) {
          #map-container, #map, #leaflet-map,
          .leaflet-container, .leaflet-pane, .leaflet-pane canvas {
            touch-action: pan-x pan-y pinch-zoom !important;
          }
        }
      </style>
    `;

    // 3. Custom Script: Setup Leaflet Administrative Polygons, sync time, and postMessage Bridge
    const geoDataJson = JSON.stringify(petaProvinsi);
    const centroidsJson = JSON.stringify(PUSAT_WILAYAH);
    const pulauJson = JSON.stringify(PROVINSI_PULAU);

    const customScript = `
      <script>
        (function() {
          const GEO_DATA = ${geoDataJson};
          const CENTROIDS = ${centroidsJson};
          const PROVINSI_PULAU = ${pulauJson};
          const ANGKA_SELA = 4;

          let currentJumlahLaporan = {};
          let geoLayer = null;
          let markersLayer = null;
          let daftarAngka = [];
          let hasSyncedTime = false;
          let mapInitialized = false;
          // Tampilan awal peta: disinkronkan dengan zoom/center asli Windy sampai pengguna berinteraksi
          let tampilanAwal = { pusat: [parseFloat('${lat}'), parseFloat('${lon}')], zoom: parseInt('${zoom}', 10) };
          let interaksiPengguna = false;

          function disableMapScrollZoom(map) {
            if (!map) return;
            try {
              if (map.scrollWheelZoom && typeof map.scrollWheelZoom.disable === 'function') {
                map.scrollWheelZoom.disable();
              }
            } catch (e) {}
            try {
              if (map._maplibreMap && map._maplibreMap.scrollZoom && typeof map._maplibreMap.scrollZoom.disable === 'function') {
                map._maplibreMap.scrollZoom.disable();
              }
            } catch (e) {}
            // MOBILE cubit-untuk-zoom: matikan geser SATU jari supaya sapuan
            // vertikal menggulir halaman (kembali ke beranda), bukan peta.
            // Cubit (touchZoom/touchZoomRotate) dan tap (klik provinsi) tetap
            // hidup — yang dimatikan hanya dragging/dragPan satu jari.
            if (modeSentuh()) {
              try {
                if (map.dragging && typeof map.dragging.disable === 'function') {
                  map.dragging.disable();
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
                  if (ml.dragPan && typeof ml.dragPan.disable === 'function') {
                    ml.dragPan.disable();
                  }
                  if (ml.touchZoomRotate && typeof ml.touchZoomRotate.enable === 'function') {
                    ml.touchZoomRotate.enable();
                  } else if (ml.touchZoom && typeof ml.touchZoom.enable === 'function') {
                    ml.touchZoom.enable();
                  }
                }
              } catch (e) {}
            }
          }

          // true di perangkat sentuh (ponsel/tablet), false di desktop.
          // Laptop layar sentuh tidak ikut: pointer utamanya fine, dan layarnya
          // besar — hanya layar kecil + sentuh yang dianggap mobile.
          var _modeSentuh = null;
          function modeSentuh() {
            if (_modeSentuh !== null) return _modeSentuh;
            var hasil = false;
            try {
              if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
                hasil = true;
              }
            } catch (e) {}
            if (!hasil) {
              try {
                var layarKecil = Math.min(window.screen.width, window.screen.height) < 820;
                var adaSentuh = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
                if (layarKecil && adaSentuh) hasil = true;
              } catch (e) {}
            }
            _modeSentuh = hasil;
            return hasil;
          }

          // Windy bisa mengaktifkan ulang handler geser setelah interaksi —
          // kunci ulang mode cubit-untuk-zoom. Ringan (tanpa alokasi) supaya
          // aman dipanggil tiap 600 ms dari interval logo di bawah.
          function kunciGeserSentuh() {
            if (!modeSentuh()) return;
            try {
              var m = window.W && window.W.map && window.W.map.map;
              if (!m) return;
              if (m.dragging && m.dragging.enabled && m.dragging.enabled()) {
                m.dragging.disable();
              }
              var mml = m._maplibreMap;
              if (mml && mml.dragPan && mml.dragPan.enabled && mml.dragPan.enabled()) {
                mml.dragPan.disable();
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

          function initAdministrativeMap() {
            if (mapInitialized) return;
            if (!window.W || !window.W.map || !window.W.map.map || typeof L === 'undefined') return;

            const map = window.W.map.map;
            disableMapScrollZoom(map);
            if (window.W && window.W.store && typeof window.W.store.set === 'function') {
              try {
                window.W.store.set('product', 'cams');
                window.W.store.set('overlay', 'aqi');
              } catch (e) {}
            }
            try {
              map.setView([parseFloat('${lat}'), parseFloat('${lon}')], parseInt('${zoom}', 10));
            } catch (e) {}

            // Buat tombol kontrol zoom kustom (+ / − / home)
            if (!document.getElementById('custom-zoom-controls')) {
              const zoomBox = document.createElement('div');
              zoomBox.id = 'custom-zoom-controls';
              zoomBox.innerHTML = '<button id="btn-zoom-in" type="button" aria-label="Perbesar peta"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></button><button id="btn-zoom-out" type="button" aria-label="Perkecil peta"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg></button><button id="btn-zoom-home" type="button" aria-label="Kembali ke tampilan awal peta"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H4a1 1 0 0 1-1-1v-9.5z" /></svg></button>';
              document.body.appendChild(zoomBox);

              document.getElementById('btn-zoom-in')?.addEventListener('click', function(e) {
                e.stopPropagation();
                if (window.W && window.W.map && window.W.map.map) window.W.map.map.zoomIn(1);
              });

              document.getElementById('btn-zoom-out')?.addEventListener('click', function(e) {
                e.stopPropagation();
                if (window.W && window.W.map && window.W.map.map) window.W.map.map.zoomOut(1);
              });

              document.getElementById('btn-zoom-home')?.addEventListener('click', function(e) {
                e.stopPropagation();
                if (window.W && window.W.map && window.W.map.map) {
                  const m = window.W.map.map;
                  // Pada Leaflet/MapLibre wrapper Windy, flyTo meneruskan zoom langsung ke MapLibre tanpa -1
                  // (sedangkan getZoom() adalah maplibreZoom + 1). Oleh karena itu tampilanAwal.zoom dikurangi 1
                  // agar hasil flyTo mengembalikan peta tepat ke default zoom (level 5).
                  m.flyTo(tampilanAwal.pusat, tampilanAwal.zoom - 1, { duration: 1.2 });
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

            // Cegah error internal Leaflet di Windy terkait tooltips
            try {
              if (typeof L !== 'undefined' && L.Layer && L.Layer.prototype) {
                L.Layer.prototype._addTooltipFocusListeners = function() {};
              }
            } catch (e) {}

            // Tambahkan GeoJSON Poligon Provinsi (Transparan agar peta bersih, tapi tetap bisa diklik)
            geoLayer = L.geoJSON(GEO_DATA, {
              pane: 'wilayahPane',
              className: 'provinsi-layer',
              style: function() {
                return {
                  fillColor: 'transparent',
                  fillOpacity: 0.02,
                  color: 'rgba(255, 255, 255, 0.45)',
                  weight: 1.2,
                  opacity: 0.9
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
              if (!nama || !tooltipEl) return;

              const jml = currentJumlahLaporan[nama];
              const teksJml = typeof jml === 'number' ? jml.toLocaleString('id-ID') + ' laporan' : '';
              tooltipEl.innerHTML = '<div>' + nama + (teksJml ? '<br><span style="font-size:11px;opacity:0.85;font-weight:400">' + teksJml + '</span>' : '') + '</div>';
              tooltipEl.style.display = 'block';
              tooltipEl.style.left = (e.clientX + 14) + 'px';
              tooltipEl.style.top = (e.clientY + 14) + 'px';
            }, true);

            document.addEventListener('mousemove', function(e) {
              if (tooltipEl && tooltipEl.style.display === 'block') {
                tooltipEl.style.left = (e.clientX + 14) + 'px';
                tooltipEl.style.top = (e.clientY + 14) + 'px';
              }
            }, true);

            document.addEventListener('mouseout', function(e) {
              const fromPath = e.target && e.target.closest ? e.target.closest('path[data-nama], .provinsi-layer') : null;
              if (!fromPath || !tooltipEl) return;
              const toPath = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('path[data-nama], .provinsi-layer') : null;
              // Jika kursor masih di dalam polygon provinsi yang sama, jangan sembunyikan tooltip
              if (fromPath === toPath) return;
              tooltipEl.style.display = 'none';
            }, true);

            renderAngka(map);

            map.on('zoomend moveend resize', function() {
              perbaruiAngka(map);
            });

            mapInitialized = true;

            // Pastikan logo Copernicus & logo Windy selalu hadir di DOM dan tampil
            function pastikanSemuaLogo() {
              // Kunci ulang mode cubit-untuk-zoom: Windy bisa mengaktifkan
              // ulang handler geser satu jari setelah interaksi.
              kunciGeserSentuh();
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

            // Beri tahu parent bahwa map forecasting sudah siap
            if (window.parent) {
              window.parent.postMessage({ type: 'FORECASTING_READY' }, '*');
            }
          }

          // Listener pesan dari parent Next.js
          window.addEventListener('message', function(event) {
            const data = event.data;
            if (!data || typeof data !== 'object') return;

            if (data.type === 'SET_JUMLAH') {
              if (data.jumlahLaporan) {
                currentJumlahLaporan = data.jumlahLaporan;
                if (window.W && window.W.map && window.W.map.map) {
                  renderAngka(window.W.map.map);
                }
              }
            } else if (data.type === 'FOCUS_WILAYAH') {
              const info = CENTROIDS[data.nama];
              if (info && window.W && window.W.map && window.W.map.map) {
                const map = window.W.map.map;
                map.flyTo([info.titik[1], info.titik[0]], 6, { duration: 1.2 });
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
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Error fetching Windy AQI: ${message}`, { status: 500 });
  }
}
