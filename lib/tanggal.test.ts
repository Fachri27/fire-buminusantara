import test from "node:test";
import assert from "node:assert/strict";
import { waktuTeks } from "./tanggal.ts";

// Pemformat yang sama dengan tanggalPerBahasa di lib/events.ts.
const opsi = { day: "numeric", month: "long", year: "numeric" } as const;

test("waktuTeks membaca tanggal id-ID dan en-US menjadi waktu yang sama", () => {
  for (let bulan = 0; bulan < 12; bulan++) {
    const tgl = new Date(Date.UTC(2026, bulan, 13));
    const id = new Intl.DateTimeFormat("id-ID", { ...opsi, timeZone: "UTC" }).format(tgl);
    const en = new Intl.DateTimeFormat("en-US", { ...opsi, timeZone: "UTC" }).format(tgl);
    assert.equal(waktuTeks(id), tgl.getTime(), id);
    assert.equal(waktuTeks(en), tgl.getTime(), en);
  }
});

test("waktuTeks mengembalikan null untuk teks tak terbaca", () => {
  assert.equal(waktuTeks(null), null);
  assert.equal(waktuTeks("kemarin"), null);
  assert.equal(waktuTeks("13 Foo 2026"), null);
});
