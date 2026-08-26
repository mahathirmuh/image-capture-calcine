import { describe, expect, it } from "vitest";

import { buildSpoolEntryId, compareSpoolEntryIds } from "./capture-spool";

describe("urutan antrean kirim", () => {
  // Seluruh keamanan antrean ini bergantung pada satu hal: urutan menurut nama
  // berkas HARUS sama dengan urutan antre. Flush menyortir nama, bukan membaca
  // setiap metadata dulu -- jadi kalau urutannya meleset, capture ulang bisa
  // terkirim sebelum capture aslinya dan tertimpa olehnya di share.
  it("mengurutkan entri sesuai waktu antre", () => {
    const older = buildSpoolEntryId(1_756_000_000_000, "aaaaaa");
    const newer = buildSpoolEntryId(1_756_000_060_000, "aaaaaa");
    expect(compareSpoolEntryIds(older, newer)).toBeLessThan(0);
    expect([newer, older].sort(compareSpoolEntryIds)).toEqual([older, newer]);
  });

  // Perbandingannya teks, bukan angka. Tanpa padding, "9999999999999" (13
  // digit) berurutan SEBELUM "10000000000000" (14 digit) -- entri baru akan
  // menyalip yang lama, persis kesalahan yang menimpa foto.
  it("tetap benar saat jumlah digit epoch bertambah", () => {
    const before = buildSpoolEntryId(9_999_999_999_999, "aaaaaa");
    const after = buildSpoolEntryId(10_000_000_000_000, "aaaaaa");
    expect(compareSpoolEntryIds(before, after)).toBeLessThan(0);
  });

  it("memisahkan entri pada milidetik yang sama", () => {
    const a = buildSpoolEntryId(1_756_000_000_000, "aaaaaa");
    const b = buildSpoolEntryId(1_756_000_000_000, "bbbbbb");
    expect(a).not.toBe(b);
    expect(compareSpoolEntryIds(a, b)).toBeLessThan(0);
  });

  it("memakai lebar tetap supaya perbandingan teksnya stabil", () => {
    const id = buildSpoolEntryId(1_756_000_000_000, "aaaaaa");
    expect(id.split("-")[0]).toHaveLength(14);
  });
});
