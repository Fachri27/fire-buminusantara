import { test } from "node:test";
import assert from "node:assert/strict";
import { bentukKomentar, emailAkunDihapus, POLA_EMAIL, susunKomentar } from "./komentar.ts";

const baris = (id: number, parent: number | null, menit: number, user_id: bigint | null = null) => ({
  id: BigInt(id), name: `n${id}`, body: `isi ${id}`, mention_name: null,
  parent_id: parent === null ? null : BigInt(parent), created_at: new Date(Date.UTC(2026, 0, 1, 0, menit)),
  user_id, email: null,
});

test("susunKomentar: balasan di bawah komentar tersembunyi menempel ke leluhur yang tampil", () => {
  // 1 tampil ← 2 tersembunyi ← 3 tampil
  const utas = susunKomentar([baris(1, null, 0), baris(3, 2, 2)], [{ id: BigInt(2), parent_id: BigInt(1) }]);
  assert.deepEqual(utas.map((k) => k.id), [1]);
  assert.deepEqual(utas[0].balasan?.map((k) => k.id), [3]);
});

test("susunKomentar: tanpa leluhur yang tampil, balasan menjadi akar", () => {
  const utas = susunKomentar([baris(3, 2, 2)], [{ id: BigInt(2), parent_id: BigInt(1) }, { id: BigInt(1), parent_id: null }]);
  assert.deepEqual(utas.map((k) => k.id), [3]);
});

test("susunKomentar: akar terbaru dulu, balasan terlama dulu", () => {
  const utas = susunKomentar([baris(1, null, 0), baris(2, null, 5), baris(4, 1, 9), baris(3, 1, 1)], []);
  assert.deepEqual(utas.map((k) => k.id), [2, 1]);
  assert.deepEqual(utas[1].balasan?.map((k) => k.id), [3, 4]);
});

test("penulis: tetap sama setelah akunnya dihapus, dan beda antar akun terhapus", () => {
  const sebelum = bentukKomentar(baris(1, null, 0, BigInt(7))).penulis;
  const sesudah = (u: bigint) => bentukKomentar({ ...baris(1, null, 0), email: emailAkunDihapus(u) }).penulis;
  assert.equal(sesudah(BigInt(7)), sebelum);
  assert.notEqual(sesudah(BigInt(8)), sebelum);
});

test("penulis: komentar web tanpa akun dikunci per komentar, bukan email ketikan", () => {
  const web = (id: number, email: string) => bentukKomentar({ ...baris(id, null, 0), email }).penulis;
  assert.notEqual(web(1, "korban@contoh.id"), web(2, "korban@contoh.id"), "email sama ≠ penulis sama");
  assert.equal(web(1, "korban@contoh.id"), web(1, "lain@contoh.id"), "email tidak ikut menentukan penanda");
  const akun = bentukKomentar(baris(3, null, 0, BigInt(7))).penulis;
  assert.equal(bentukKomentar(baris(4, null, 0, BigInt(7))).penulis, akun, "akun tetap satu penanda");
});

test("POLA_EMAIL: bentuk wajar lolos, yang rusak ditolak", () => {
  for (const e of ["a@b.co", "x.y+z@sub.domain.id"]) assert.ok(POLA_EMAIL.test(e), e);
  for (const e of ["a@b", "@b.co", "a@.b", "a@b..c", "a@b.c.", "a b@c.d", "a@b@c.d"]) assert.ok(!POLA_EMAIL.test(e), e);
});

test("POLA_EMAIL: masukan patologis 100 ribu karakter selesai seketika (tanpa backtracking kuadratik)", () => {
  for (const s of ["a@" + ".".repeat(100_000) + "@", "a@" + "b.".repeat(50_000) + "@", "a".repeat(100_000)]) {
    const mulai = performance.now();
    POLA_EMAIL.test(s);
    assert.ok(performance.now() - mulai < 50, `${s.slice(0, 6)}… makan ${performance.now() - mulai} ms`);
  }
});
