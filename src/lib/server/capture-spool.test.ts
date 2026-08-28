import { describe, expect, it } from "vitest";

import { buildSpoolEntryId, compareSpoolEntryIds, decideFlushLog } from "./capture-spool";

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

// Peredam jejak antrean.
//
// Flush berjalan tiap 5 menit. Tanpa peredam, gangguan seperti 28 Agustus 2026
// -- root salah bentuk selama ~7 jam -- meninggalkan delapan puluh baris yang
// isinya sama persis, dan menenggelamkan setiap kejadian lain di sekitarnya.
describe("decideFlushLog", () => {
  const stalled = (reason: string, pending = 4) => ({
    forwarded: 0,
    pending,
    stoppedBecause: reason,
  });

  it("mencatat kegagalan pertama", () => {
    expect(decideFlushLog(stalled("TARGET_ROOT_MISSING"), null)).toEqual({
      kind: "failed",
      reason: "TARGET_ROOT_MISSING",
      pending: 4,
    });
  });

  it("DIAM saat sebabnya sama dengan yang sudah dicatat", () => {
    expect(decideFlushLog(stalled("TARGET_ROOT_MISSING"), "TARGET_ROOT_MISSING")).toEqual({
      kind: "none",
    });
  });

  it("mencatat lagi kalau sebabnya berganti", () => {
    // Sebab yang berubah adalah kabar baru: mount yang tadinya hilang kini ada
    // tapi ditolak izinnya, misalnya, dan itu menuntun ke perbaikan berbeda.
    expect(decideFlushLog(stalled("WRITE_FAILED"), "TARGET_ROOT_MISSING")).toEqual({
      kind: "failed",
      reason: "WRITE_FAILED",
      pending: 4,
    });
  });

  it("mencatat pulih hanya kalau sempat tercatat gagal", () => {
    const ok = { forwarded: 4, pending: 0, stoppedBecause: null };
    expect(decideFlushLog(ok, "TARGET_ROOT_MISSING")).toEqual({
      kind: "recovered",
      previous: "TARGET_ROOT_MISSING",
      forwarded: 4,
    });
    // Tanpa kegagalan sebelumnya, flush yang berhasil bukan kejadian.
    expect(decideFlushLog(ok, null)).toEqual({ kind: "none" });
  });

  it("diam untuk antrean yang memang dimatikan", () => {
    // Ini pilihan konfigurasi, bukan gangguan -- mencatatnya tiap 5 menit
    // akan mengubur jejak yang sebenarnya.
    for (const reason of ["SPOOL_NOT_CONFIGURED", "NETWORK_SAVE_NOT_CONFIGURED"]) {
      expect(decideFlushLog({ forwarded: 0, pending: 0, stoppedBecause: reason }, null)).toEqual({
        kind: "none",
      });
    }
  });

  it("diam saat tidak ada apa pun untuk dikirim", () => {
    expect(decideFlushLog({ forwarded: 0, pending: 0, stoppedBecause: null }, null)).toEqual({
      kind: "none",
    });
  });
});
