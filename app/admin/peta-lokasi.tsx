"use client";

import { useEffect, useRef, useState } from "react";
import type { LeafletMouseEvent, Map as PetaLeaflet, Marker } from "leaflet";

/** Pusat Indonesia — dipakai saat koordinatnya belum diisi. */
const PUSAT: [number, number] = [-2.4, 118];

/**
 * Penanda titik lokasi, digambar sendiri lewat divIcon — titik merah berbingkai
 * putih. Ikon bawaan Leaflet sengaja tidak dipakai: URL gambarnya rusak saat
 * diresolusi lewat bundel, sedangkan bentuk ini hanya HTML dan CSS, jadi selalu
 * tampil apa pun hasil bundlenya.
 */
function buatPenanda(
  L: typeof import("leaflet"),
  titik: [number, number],
  saatDigerakkan: (lat: number, lng: number) => void,
) {
  const penanda = L.marker(titik, {
    draggable: true,
    icon: L.divIcon({
      className: "peta-lokasi-penanda",
      html: '<span aria-hidden="true"></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    }),
  });
  penanda.on("dragend", (e) => {
    const p = (e.target as Marker).getLatLng();
    saatDigerakkan(p.lat, p.lng);
  });
  return penanda;
}

type Props = {
  lat: string;
  lng: string;
  onPilih: (lat: number, lng: number) => void;
};

/**
 * Pemilih titik lokasi untuk form kejadian.
 *
 * Tekan peta untuk menaruh penanda (bisa digeser), dan koordinat yang berubah
 * dari luar peta — hasil pencarian lokasi maupun isian manual — menggerakkan
 * penandanya balik. Leaflet diimpor dinamis seperti di komponen peta publik;
 * CSS-nya sudah dimuat globals.css.
 */
export function PetaLokasi({ lat, lng, onPilih }: Props) {
  const kotakRef = useRef<HTMLDivElement | null>(null);
  const petaRef = useRef<PetaLeaflet | null>(null);
  const penandaRef = useRef<Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  // onPilih ditampung di ref supaya efek pemasangan (yang berjalan sekali)
  // selalu memanggil versi terbaru tanpa perlu dipasang ulang.
  const pilihRef = useRef(onPilih);
  // Baru true setelah peta selesai dipasang — efek sinkron di bawah menunggu
  // penanda ini, supaya koordinat yang diubah saat Leaflet masih diunduh tidak
  // lewat begitu saja.
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    pilihRef.current = onPilih;
  }, [onPilih]);

  /* Pemasangan sekali: peta, tile, dan reaksi tekanan. */
  useEffect(() => {
    let batal = false;
    let bersihkan: (() => void) | undefined;

    (async () => {
      const L = (await import("leaflet")).default;
      if (batal || !kotakRef.current || petaRef.current) return;
      leafletRef.current = L;

      const a = Number(lat);
      const b = Number(lng);
      const sah = lat.trim() !== "" && lng.trim() !== ""
        && Number.isFinite(a) && Number.isFinite(b);

      const peta = L.map(kotakRef.current, {
        // Roda tetikus milik guliran halaman; zum cukup lewat tombolnya.
        scrollWheelZoom: false,
      }).setView(sah ? [a, b] : PUSAT, sah ? 13 : 5);
      petaRef.current = peta;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
      }).addTo(peta);

      const taruh = (titik: [number, number]) => {
        if (penandaRef.current) {
          penandaRef.current.setLatLng(titik);
          return;
        }
        const penanda = buatPenanda(L, titik, pilihRef.current);
        penanda.addTo(peta);
        penandaRef.current = penanda;
      };

      if (sah) taruh([a, b]);

      peta.on("click", (e: LeafletMouseEvent) => {
        taruh([e.latlng.lat, e.latlng.lng]);
        pilihRef.current(e.latlng.lat, e.latlng.lng);
      });

      // Form bisa saja belum selesai menata letak saat peta dipasang;
      // ukurannya dipastikan pada frame berikutnya.
      setTimeout(() => peta.invalidateSize(), 0);

      bersihkan = () => {
        peta.remove();
        petaRef.current = null;
        penandaRef.current = null;
        leafletRef.current = null;
      };

      setSiap(true);
    })();

    return () => { batal = true; bersihkan?.(); };
    // Nilai awal koordinat sengaja hanya dibaca sekali di pemasangan;
    // perubahannya ditangani efek sinkron di bawah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Koordinat yang berubah dari luar peta — hasil pencarian lokasi atau isian
     manual — menggerakkan penanda dan pandangannya. Perubahan yang berasal
     dari peta sendiri dikenali dari posisi penanda yang sudah sama, jadi tidak
     saling memicu. */
  useEffect(() => {
    const peta = petaRef.current;
    const L = leafletRef.current;
    const a = Number(lat);
    const b = Number(lng);
    if (!peta || !L || lat.trim() === "" || lng.trim() === ""
        || !Number.isFinite(a) || !Number.isFinite(b)) return;

    const penanda = penandaRef.current;
    if (penanda) {
      const kini = penanda.getLatLng();
      if (Math.abs(kini.lat - a) < 1e-9 && Math.abs(kini.lng - b) < 1e-9) return;
      penanda.setLatLng([a, b]);
    } else {
      const baru = buatPenanda(L, [a, b], pilihRef.current);
      baru.addTo(peta);
      penandaRef.current = baru;
    }
    // Pandangan ikut diperbesar minimal 13: memilih hasil pencarian dari
    // pandangan seluruh Indonesia tanpa ini hanya menggeser, dan titiknya
    // tetap tak terbaca.
    peta.setView([a, b], Math.max(peta.getZoom(), 13));
    // `siap`: jalankan ulang setelah peta selesai dipasang — koordinat bisa
    // saja berubah selama Leaflet masih diunduh.
  }, [lat, lng, siap]);

  return (
    /* isolate: z-index panel Leaflet (ratusan) tidak boleh lolos keluar dan
       menutupi menu & bilah aksi sticky milik CMS. */
    <div className="isolate h-[320px] w-full">
      <div ref={kotakRef} className="h-full w-full" />
    </div>
  );
}
