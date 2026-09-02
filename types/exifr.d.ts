declare module "exifr" {
  export function gps(
    input: ArrayBuffer | Uint8Array | Buffer | Blob | string,
  ): Promise<{ latitude: number; longitude: number } | undefined>;
  export function parse(
    input: ArrayBuffer | Uint8Array | Buffer | Blob | string,
    options?: unknown,
  ): Promise<Record<string, unknown> | undefined>;
  const exifr: {
    gps: typeof gps;
    parse: typeof parse;
  };
  export default exifr;
}
