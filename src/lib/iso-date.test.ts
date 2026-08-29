import { describe, expect, it } from "vitest";

import { formatIsoDateLabel, fromIsoDate, toIsoDate } from "./iso-date";

describe("toIsoDate", () => {
  // Inti pengujian ini: JANGAN lewat UTC. toISOString() menggeser ke UTC lebih
  // dulu, dan di WITA (UTC+8) tanggal yang dipilih sebelum pukul 08.00 mundur
  // satu hari. Filter yang meleset sehari tidak pernah terlihat sebagai
  // kesalahan -- gejalanya cuma "kok fotonya tidak ada".
  it("memakai tanggal LOKAL, bukan UTC", () => {
    expect(toIsoDate(new Date(2026, 7, 29, 0, 0, 0))).toBe("2026-08-29");
    expect(toIsoDate(new Date(2026, 7, 29, 23, 59, 59))).toBe("2026-08-29");
  });

  it("memberi nol di depan untuk bulan dan tanggal satu digit", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("fromIsoDate", () => {
  it("bolak-balik tetap tanggal yang sama", () => {
    const d = fromIsoDate("2026-08-29");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(7);
    expect(d?.getDate()).toBe(29);
    expect(toIsoDate(d!)).toBe("2026-08-29");
  });

  it("undefined untuk kosong atau bentuk yang tidak dikenal", () => {
    // Kosong berarti "semua tanggal" -- keadaan sah, bukan Invalid Date.
    expect(fromIsoDate("")).toBeUndefined();
    expect(fromIsoDate("   ")).toBeUndefined();
    expect(fromIsoDate("29/08/2026")).toBeUndefined();
    expect(fromIsoDate("2026-8-9")).toBeUndefined();
  });
});

describe("formatIsoDateLabel", () => {
  it("menulis bulan dalam bahasa Indonesia", () => {
    expect(formatIsoDateLabel("2026-08-29")).toBe("29 Agustus 2026");
    expect(formatIsoDateLabel("2026-01-05")).toBe("5 Januari 2026");
  });

  it("null kalau nilainya tidak sah", () => {
    expect(formatIsoDateLabel("")).toBeNull();
  });
});
