import * as maplibregl from "maplibre-gl";

/* Semua peta mengimpor maplibre-gl lewat modul ini supaya URL worker selalu
   terpasang: bawaannya diturunkan dari import.meta.url, yang di bundel tak
   menunjuk ke berkas worker. new URL(…, import.meta.url) membuat bundler
   memancarkan worker dari node_modules sebagai aset ber-hash di _next/static —
   versinya pasti sama dengan pustaka, dan aman di-cache selamanya.
   shortcut: public/assets/vendor/maplibre/ = worker maplibre 6.7 untuk tab yang
   dibuka sebelum deploy ini; hapus seminggu lebih sesudah deploy. */
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
}

export * from "maplibre-gl";
