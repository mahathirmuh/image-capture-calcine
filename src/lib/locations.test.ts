import { describe, expect, it } from "vitest";

import { BIN_SLOTS, PLANTS, toBinLabel, toBinToken, toLocationToken } from "./locations";

describe("toBinLabel", () => {
  it("memakai BIN di Acid Plant dan TRAIN di Chloride Plant", () => {
    expect(toBinLabel("Acid Plant", 1)).toBe("BIN 1");
    expect(toBinLabel("Acid Plant", 2)).toBe("BIN 2");
    expect(toBinLabel("Chloride Plant", 1)).toBe("TRAIN 1");
    expect(toBinLabel("Chloride Plant", 2)).toBe("TRAIN 2");
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
    expect(toBinToken("Acid Plant", 1)).toBe("BIN1");
    expect(toBinToken("Chloride Plant", 2)).toBe("TRAIN2");
  });

  it("tidak pernah menghasilkan spasi untuk plant mana pun", () => {
    for (const plant of PLANTS) {
      for (const slot of BIN_SLOTS) {
        expect(toBinToken(plant, slot)).not.toContain(" ");
      }
    }
  });
});

describe("toLocationToken", () => {
  it("memakai kode dua huruf yang sudah dipakai berkas lama", () => {
    expect(toLocationToken("Acid Plant")).toBe("AP");
    expect(toLocationToken("Chloride Plant")).toBe("CP");
    expect(toLocationToken("Copper Cathode Plant")).toBe("CC");
  });
});
