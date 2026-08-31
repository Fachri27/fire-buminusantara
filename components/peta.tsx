"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as PetaLeaflet, GeoJSON, LayerGroup, Marker } from "leaflet";
import { tempatAngka } from "@/lib/geometri";
import {
  WMS_URL, WMS_LAYER, BATAS, BIDANG_NAMA, BIDANG_PULAU, getFeatureInfo,
} from "@/lib/wms";

/** Jarak bebas antar angka, piksel. */
const ANGKA_SELA = 3;

/** Nama provinsi di layer kadang beda ejaan dengan data lokal 34 provinsi. */
const ALIAS_LOKAL: Record<string, string> = { "Daerah Istimewa Yogyakarta": "DI Yogyakarta" };

type FiturProvinsi = {
  properties: { nama: string };
  geometry: { type: string; coordinates: unknown };
};

type Props = {
  jumlahLaporan: Record<string, number>;
  onPilihWilayah: (nama: string, pulau: string | null, asal: { x: number; y: number }) => void;
};

export function Peta({ jumlahLaporan, onPilihWilayah }: Props) {
  const kotakRef = useRef<HTMLDivElement | null>(null);
  const petaRef = useRef<PetaLeaflet | null>(null);
  const daftarAngka = useRef<{ penanda: Marker; titik: [number, number]; kotakDeg: number[] }[]>([]);
  const siapRef = useRef(false);
  const [kabar, setKabar] = useState(false);

  useEffect(() => {
    let batal = false;
    let bersihkan: (() => void) | undefined;

    (async () => {
      // Leaflet menyentuh window saat diimpor, jadi hanya dimuat di klien.
      // CSS-nya TIDAK diimpor di sini — lihat catatan urutan di globals.css.
      const L = (await import("leaflet")).default;
      const peta_ = await fetch("/data/peta-provinsi.json").then((r) => r.json());
      if (batal || !kotakRef.current || petaRef.current) return;

      const peta = L.map(kotakRef.current, {
        zoomControl: false, attributionControl: false,
        dragging: false, touchZoom: false, doubleClickZoom: false, boxZoom: false,
        keyboard: false,
        scrollWheelZoom: false, // roda tetikus milik guliran halaman
        zoomSnap: 0, maxBoundsViscosity: 1,
      });
      petaRef.current = peta;

      peta.createPane("wilayahPane");
      peta.getPane("wilayahPane")!.style.zIndex = "350";
      // Angka DI ATAS poligon provinsi (overlayPane 400) supaya tidak tertutup,
      // dan tembus klik supaya provinsi di bawahnya tetap bisa ditekan.
      peta.createPane("angkaPane");
      const paneAngka = peta.getPane("angkaPane")!;
      paneAngka.style.zIndex = "450";
      paneAngka.style.pointerEvents = "none";

      const lapisWilayah = L.tileLayer.wms(WMS_URL, {
        layers: WMS_LAYER, format: "image/png", transparent: true,
        version: "1.1.0", pane: "wilayahPane",
      }).addTo(peta);

      let tileTermuat = false, tileGagal = 0;
      lapisWilayah.on("tileload", () => { tileTermuat = true; });
      lapisWilayah.on("tileerror", () => {
        // Satu tile gagal bisa kebetulan; tiga tanpa satu pun berhasil tidak.
        if (!tileTermuat && ++tileGagal >= 3) setKabar(true);
      });

      const provinsi: GeoJSON = L.geoJSON(peta_, {
        style: () => ({ fillOpacity: 0, color: "transparent", weight: 0, opacity: 0 }),
        onEachFeature: (fitur, lapis) => {
          const nama = (fitur as FiturProvinsi).properties.nama;
          lapis.on("mousedown", async (e) => {
            const asli = (e as unknown as { originalEvent: MouseEvent }).originalEvent;
            if (asli?.button !== 0) return;
            asli.preventDefault();
            // Titik ini yang jadi jangkar animasi "tumbuh" pop-up. Koordinat
            // viewport, bukan koordinat peta: kanvas panggung diperkecil
            // transform, dan clientX sudah menghitungnya sedangkan titik peta
            // tidak.
            const asal = { x: asli.clientX, y: asli.clientY };
            const ll = (e as unknown as { latlng: { lat: number; lng: number } }).latlng;
            const uk = peta.getSize();
            const tp = peta.latLngToContainerPoint(ll);
            const fi = await getFeatureInfo({
              jenis: "peta", bbox: peta.getBounds().toBBoxString(),
              lebar: uk.x, tinggi: uk.y, x: Math.round(tp.x), y: Math.round(tp.y),
            });
            const dariLayer = fi?.properties?.[BIDANG_NAMA];
            onPilihWilayah(
              dariLayer ? String(dariLayer) : nama,
              fi?.properties?.[BIDANG_PULAU] ? String(fi.properties[BIDANG_PULAU]) : null,
              asal,
            );
          });
        },
      }).addTo(peta);

      // Satu angka per provinsi, di dalam daratan terbesarnya.
      const grup: LayerGroup = L.layerGroup([], { pane: "angkaPane" }).addTo(peta);
      daftarAngka.current = [];
      provinsi.eachLayer((lapis) => {
        const f = (lapis as unknown as { feature: FiturProvinsi }).feature;
        const nama = f.properties.nama;
        const jumlah = jumlahLaporan[ALIAS_LOKAL[nama] ?? nama];
        if (typeof jumlah !== "number") return;
        const tempat = tempatAngka(f.geometry);
        if (!tempat) return;

        const penanda = L.marker([tempat.titik[1], tempat.titik[0]], {
          pane: "angkaPane", interactive: false, keyboard: false,
          // Ukuran nol: Leaflet menulis transform pada elemen ikon untuk
          // memposisikannya, jadi elemen itu tidak bisa dipusatkan dengan
          // transform lagi — yang dipusatkan <span> di dalamnya.
          icon: L.divIcon({
            className: "peta-angka", iconSize: [0, 0],
            html: `<span class="peta-angka__nilai" aria-hidden="true">${jumlah.toLocaleString("id-ID")}</span>`,
          }),
        }).addTo(grup);

        daftarAngka.current.push({ penanda, titik: [tempat.titik[1], tempat.titik[0]], kotakDeg: tempat.kotak });
      });

      /** Sembunyikan angka yang BERTUMPUK dengan angka provinsi yang lebih
       *  luas. Yang diuji tumpukan, bukan ukuran wilayahnya: provinsi kecil
       *  yang punya banyak ruang kosong di sekelilingnya (Bali, Gorontalo)
       *  tetap boleh menampilkan angkanya. */
      const perbaruiAngka = () => {
        if (!siapRef.current || !daftarAngka.current.length) return;

        // Semua ditampilkan dulu: elemen ber-display:none tidak punya ukuran,
        // padahal ukurannya yang menentukan siapa yang boleh tampil.
        for (const a of daftarAngka.current) {
          a.penanda.getElement()?.classList.remove("peta-angka--bertumpuk");
        }

        // Fase baca, tanpa satu pun tulisan di sela-selanya.
        const kotak = daftarAngka.current.map((a, urut) => {
          const el = a.penanda.getElement();
          const isi = el?.firstElementChild as HTMLElement | null;
          const pusat = peta.latLngToContainerPoint(a.titik);
          const d = a.kotakDeg;
          const ka = peta.latLngToContainerPoint([d[3], d[0]]);
          const kb = peta.latLngToContainerPoint([d[1], d[2]]);
          return {
            urut, x: pusat.x, y: pusat.y,
            w: (isi?.offsetWidth ?? 0) + ANGKA_SELA,
            h: (isi?.offsetHeight ?? 0) + ANGKA_SELA,
            luas: Math.abs(kb.x - ka.x) * Math.abs(kb.y - ka.y),
          };
        });

        // Yang lebih luas menang: provinsi besar tanpa angka terlihat seperti
        // wilayah tanpa data, sedangkan yang kecil hanya tampak padat.
        kotak.sort((a, b) => b.luas - a.luas);
        const ditempatkan: typeof kotak = [];
        for (const c of kotak) {
          const bertumpuk = ditempatkan.some(
            (t) => Math.abs(c.x - t.x) * 2 < c.w + t.w && Math.abs(c.y - t.y) * 2 < c.h + t.h,
          );
          if (bertumpuk) daftarAngka.current[c.urut].penanda.getElement()?.classList.add("peta-angka--bertumpuk");
          else ditempatkan.push(c);
        }
      };

      const pas = () => {
        peta.setMinZoom(0); peta.setMaxZoom(20); peta.setMaxBounds(null as never);
        peta.invalidateSize({ animate: false });
        peta.fitBounds(BATAS, { padding: [6, 6], animate: false });
        siapRef.current = true; // sejak sini koordinat bisa diproyeksikan
        peta.setMinZoom(peta.getZoom());
        peta.setMaxZoom(peta.getZoom() + 3);
        peta.setMaxBounds(peta.getBounds().pad(0.08));
        perbaruiAngka();
      };

      pas();
      peta.on("zoomend moveend", perbaruiAngka);

      const pengamat = new ResizeObserver(() => pas());
      pengamat.observe(kotakRef.current);
      window.addEventListener("resize", pas);

      bersihkan = () => {
        pengamat.disconnect();
        window.removeEventListener("resize", pas);
        peta.remove();
        petaRef.current = null;
        siapRef.current = false;
      };
    })();

    return () => { batal = true; bersihkan?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={kotakRef} className="h-full w-full" />
      {kabar && (
        <div className="pointer-events-none absolute bottom-[10px] left-1/2 z-[900] max-w-[min(560px,calc(100%-20px))]
                        -translate-x-1/2 rounded-[10px] bg-[rgb(26_25_25/0.82)] p-[10px_14px] text-center
                        text-[length:var(--ukuran-catatan)] leading-[1.4] text-white">
          Warna per provinsi diambil dari layanan luar (aws.simontini.id) dan sekarang tidak terjangkau.
        </div>
      )}
    </div>
  );
}
