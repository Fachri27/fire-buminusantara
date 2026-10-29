"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as PetaMaplibre, Marker as PenandaMaplibre, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/** Sama dengan peta-lokasi.tsx: ubin OSM raster, tanpa kunci API. */
const GAYA: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© Kontributor OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

/**
 * Titik pelapor yang sedang bersiaran — hanya dilihat, tidak bisa digeser.
 * Lokasinya diperbarui tiap beberapa detik: penanda ikut bergeser, tetapi peta
 * baru digeser bila titiknya keluar pandangan, supaya petugas yang sedang
 * menggeser/zum tidak terus ditarik balik. (iframe OSM ditolak CSP frame-src.)
 */
export function PetaSiaran({ lat, lng }: { lat: number; lng: number }) {
  const kotakRef = useRef<HTMLDivElement | null>(null);
  const petaRef = useRef<{ peta: PetaMaplibre; penanda: PenandaMaplibre } | null>(null);
  // Titik terbaru untuk pemasangan yang selesai belakangan (impor dinamis).
  const titikRef = useRef({ lat, lng });
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    titikRef.current = { lat, lng };
    const p = petaRef.current;
    if (!p) return;
    p.penanda.setLngLat([lng, lat]);
    if (!p.peta.getBounds().contains([lng, lat])) p.peta.easeTo({ center: [lng, lat] });
  }, [lat, lng]);

  useEffect(() => {
    let batal = false;
    let amati: ResizeObserver | null = null;
    (async () => {
      let maplibregl: typeof import("maplibre-gl");
      try {
        maplibregl = await import("maplibre-gl");
      } catch {
        if (!batal) setGagal(true);
        return;
      }
      const kotak = kotakRef.current;
      if (batal || !kotak) return;
      const { lat: a, lng: b } = titikRef.current;
      try {
        const peta = new maplibregl.Map({
          container: kotak, style: GAYA, center: [b, a], zoom: 14,
          scrollZoom: false, attributionControl: { compact: true },
        });
        peta.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
        // Rupa penanda sama dengan pemilih lokasi kejadian (.peta-lokasi-penanda di cms.css).
        const el = document.createElement("div");
        el.className = "peta-lokasi-penanda";
        el.innerHTML = '<span aria-hidden="true"></span>';
        const penanda = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([b, a]).addTo(peta);
        amati = new ResizeObserver(() => {
          try { peta.resize(); } catch {}
        });
        amati.observe(kotak);
        petaRef.current = { peta, penanda };
      } catch (e) {
        console.error("[PetaSiaran]", e);
        if (!batal) setGagal(true);
      }
    })();
    return () => {
      batal = true;
      amati?.disconnect();
      try { petaRef.current?.peta.remove(); } catch {}
      petaRef.current = null;
    };
  }, []);

  if (gagal) {
    return (
      <p className="grid h-[200px] place-items-center rounded-[var(--jari)] bg-[var(--rona)] px-4 text-center text-[12.5px] text-[var(--lirih)]">
        Peta tidak bisa dimuat. Koordinat dan tautan Google Maps di atas tetap bisa dipakai.
      </p>
    );
  }
  return <div ref={kotakRef} className="h-[200px] overflow-hidden rounded-[var(--jari)] bg-[var(--rona)]" />;
}
