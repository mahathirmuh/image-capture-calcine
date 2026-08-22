import { describe, expect, it } from "vitest";

import { assessPassword } from "./password-strength";

describe("assessPassword", () => {
  it("scores an empty password as nothing, without a complaint", () => {
    const hasil = assessPassword("");
    expect(hasil.score).toBe(0);
    expect(hasil.hint).toBeNull();
  });

  it("rewards length above symbol variety", () => {
    // Memenuhi semua kotak centang klasik, tetapi pendek.
    const pendekRumit = assessPassword("P@ss1!aB");
    // Empat kata biasa, tidak ada simbol sama sekali.
    const panjangSederhana = assessPassword("kucing meja hujan lampu");

    expect(panjangSederhana.score).toBeGreaterThan(pendekRumit.score);
  });

  it("caps anything on the first-guess list at zero, however long", () => {
    expect(assessPassword("password").score).toBe(0);
    expect(assessPassword("merdeka").score).toBe(0);
    // Awalan pun tertangkap -- menempelkan angka di belakang tidak menolong.
    expect(assessPassword("admin123456789!").score).toBe(0);
    expect(assessPassword("password").hint).toMatch(/daftar tebakan pertama/i);
  });

  it("caps a password containing the username, however complex", () => {
    const hasil = assessPassword("Xk!9operator.bin1Zq#4", { username: "operator.bin1" });

    expect(hasil.score).toBeLessThanOrEqual(1);
    expect(hasil.hint).toMatch(/username/i);
  });

  it("caps a password containing any word from the full name", () => {
    const hasil = assessPassword("Rahmawati#2026!xyz", { fullName: "Siti Rahmawati" });

    expect(hasil.score).toBeLessThanOrEqual(1);
    expect(hasil.hint).toMatch(/nama sendiri/i);
  });

  it("ignores name fragments too short to mean anything", () => {
    // "Si" tidak boleh membuat setiap password yang memuat "si" jadi lemah.
    const hasil = assessPassword("konstruksi jembatan panjang", { fullName: "Si Budi" });
    expect(hasil.score).toBeGreaterThanOrEqual(3);
  });

  it("penalises repeated runs and straight sequences", () => {
    expect(assessPassword("kelapaaaa muda segar").score).toBeLessThan(
      assessPassword("kelapa muda segar tinggi").score,
    );
    expect(assessPassword("jembatan abcd panjang").score).toBeLessThan(
      assessPassword("jembatan kayu panjang tua").score,
    );
  });

  it("asks for length first while the password is still short", () => {
    expect(assessPassword("Ab3!xY9z").hint).toMatch(/panjang/i);
  });

  it("stops complaining once the password is long and mixed", () => {
    const hasil = assessPassword("Tambang Kalsin 2026 biru");
    expect(hasil.score).toBe(4);
    expect(hasil.hint).toBeNull();
  });

  it("never returns a score outside 0..4", () => {
    for (const kandidat of ["a", "aaaa", "password", "x".repeat(80), "Aa1!".repeat(20)]) {
      const { score } = assessPassword(kandidat);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
    }
  });
});
