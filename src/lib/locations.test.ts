import { describe, expect, it } from "vitest";

import { BIN_SLOTS, PLANTS, toBinLabel, toBinSlot, toBinToken, toLocationToken } from "./locations";

describe("toBinLabel", () => {
  it("memakai TRAIN di Acid Plant dan BIN di Chloride Plant", () => {
    expect(toBinLabel("Acid Plant", 1)).toBe("TRAIN 1");
    expect(toBinLabel("Acid Plant", 2)).toBe("TRAIN 2");
    expect(toBinLabel("Chloride Plant", 1)).toBe("BIN 1");
    expect(toBinLabel("Chloride Plant", 2)).toBe("BIN 2");
  });

  it("memakai BIN untuk plant yang belum punya sebutan sendiri", () => {
    expect(toBinLabel("Pyrite Plant", 1)).toBe("BIN 1");
    expect(toBinLabel("Copper Cathode Plant", 2)).toBe("BIN 2");
  });

  // Nilai lokasi datang dari prefs tersimpan, jadi bisa saja berisi plant yang
  // sudah dihapus dari daftar. Label tetap harus terbentuk, bukan "undefined 1".
  it("jatuh ke BIN untuk plant yang tidak dikenal", () => {
    expect(toBinLabel("Plant Antah Berantah", 1)).toBe("BIN 1");
    expect(toBinLabel("", 2)).toBe("BIN 2");
  });
});

describe("toBinToken", () => {
  it("membuang spasi supaya aman dipakai di nama berkas", () => {
    expect(toBinToken("Acid Plant", 1)).toBe("TRAIN1");
    expect(toBinToken("Chloride Plant", 2)).toBe("BIN2");
  });

  it("tidak pernah menghasilkan spasi untuk plant mana pun", () => {
    for (const plant of PLANTS) {
      for (const slot of BIN_SLOTS) {
        expect(toBinToken(plant, slot)).not.toContain(" ");
      }
    }
  });
});

describe("toBinSlot", () => {
  // Inti gunanya: menyamakan capture lintas plant, dan lintas masa. Record
  // Acid Plant dari sebelum istilahnya ditukar masih tersimpan sebagai "BIN 1"
  // sementara yang baru "TRAIN 1" -- keduanya slot 1 dan harus tersaring
  // bersama, bukan jadi dua kelompok terpisah.
  it("membaca nomor slot dari kedua istilah", () => {
    expect(toBinSlot("BIN 1")).toBe(1);
    expect(toBinSlot("TRAIN 1")).toBe(1);
    expect(toBinSlot("BIN2")).toBe(2);
    expect(toBinSlot("train2")).toBe(2);
    expect(toBinSlot("  bin 2  ")).toBe(2);
  });

  it("mengembalikan null untuk nilai yang tidak dikenali", () => {
    expect(toBinSlot("BIN 1 / BIN 2")).toBeNull();
    expect(toBinSlot("SLOT 1")).toBeNull();
    expect(toBinSlot("BIN 3")).toBeNull();
    expect(toBinSlot("")).toBeNull();
    expect(toBinSlot(null)).toBeNull();
    expect(toBinSlot(undefined)).toBeNull();
  });
});

describe("toLocationToken", () => {
  it("memakai kode dua huruf yang sudah dipakai berkas lama", () => {
    expect(toLocationToken("Acid Plant")).toBe("AP");
    expect(toLocationToken("Chloride Plant")).toBe("CP");
    expect(toLocationToken("Copper Cathode Plant")).toBe("CC");
  });
});
