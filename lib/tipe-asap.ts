/** Bentuk respons /api/sebaran-asap?mode=metadata — dilayani geoplatform
 *  (lib/zarr-reader.ts di sana), dipanggil peramban langsung di GEO_URL. */
export interface ZarrTimestepMeta {
  index: number;
  timeChunk: number;
  timeInner: number;
  step: number;
  iso: string;
  waktu: number;
  labelUtc: string;
  labelWib: string;
  adalahPrediksi: boolean;
}

export interface ZarrMetadataResponse {
  latestModelRunIso: string;
  latestModelRunWib?: string;
  timesteps: ZarrTimestepMeta[];
  grid: {
    rows: number;
    cols: number;
    bounds: [[number, number], [number, number]];
  };
  isWarm?: boolean;
  cachedFramesCount?: number;
}
