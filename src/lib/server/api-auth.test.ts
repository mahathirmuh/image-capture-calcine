import { describe, expect, it } from "vitest";

import { matchesAnyApiKey, parseApiKeys, timingSafeEqualString } from "./api-auth";

describe("parseApiKeys", () => {
  it("memisahkan beberapa kunci dan membuang spasi", () => {
    expect(parseApiKeys("satu, dua ,tiga")).toEqual(["satu", "dua", "tiga"]);
  });

  // Kalau string kosong ikut jadi kunci, permintaan TANPA header sama sekali
  // akan cocok dengannya dan API terbuka untuk siapa pun. Ini bukan kerapian
  // parsing -- ini pintu yang harus tetap tertutup.
  it("membuang entri kosong sehingga koma berlebih tidak membuka API", () => {
    expect(parseApiKeys("abc,,")).toEqual(["abc"]);
    expect(parseApiKeys(",")).toEqual([]);
    expect(parseApiKeys("   ")).toEqual([]);
  });

  it("menganggap nilai yang tidak diisi sebagai daftar kosong", () => {
    expect(parseApiKeys(undefined)).toEqual([]);
    expect(parseApiKeys(null)).toEqual([]);
    expect(parseApiKeys("")).toEqual([]);
  });
});

describe("timingSafeEqualString", () => {
  it("benar untuk nilai yang sama", () => {
    expect(timingSafeEqualString("kunci-rahasia", "kunci-rahasia")).toBe(true);
  });

  it("salah untuk isi maupun panjang yang berbeda", () => {
    expect(timingSafeEqualString("kunci-rahasia", "kunci-rahasi4")).toBe(false);
    expect(timingSafeEqualString("kunci", "kunci-rahasia")).toBe(false);
    expect(timingSafeEqualString("", "kunci")).toBe(false);
  });

  it("membandingkan seluruh panjang, bukan berhenti di beda pertama", () => {
    // Dua nilai yang berbeda hanya di karakter TERAKHIR tetap harus ditolak;
    // kalau perbandingannya pernah dioptimasi jadi berhenti lebih awal, kasus
    // inilah yang pertama lolos.
    expect(timingSafeEqualString("aaaaaaaaab", "aaaaaaaaaa")).toBe(false);
  });
});

describe("matchesAnyApiKey", () => {
  it("menerima kunci mana pun dari daftar", () => {
    expect(matchesAnyApiKey("dua", ["satu", "dua", "tiga"])).toBe(true);
  });

  it("menolak kunci yang tidak ada di daftar", () => {
    expect(matchesAnyApiKey("empat", ["satu", "dua"])).toBe(false);
  });

  it("menolak apa pun saat daftarnya kosong", () => {
    expect(matchesAnyApiKey("", [])).toBe(false);
    expect(matchesAnyApiKey("apa saja", [])).toBe(false);
  });
});
