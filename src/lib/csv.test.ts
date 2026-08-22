import { describe, expect, it } from "vitest";

import { escapeCsvValue, fileTimestamp, toCsv } from "./csv";

describe("escapeCsvValue", () => {
  it("quotes every value, not just the ones that need it", () => {
    expect(escapeCsvValue("admin")).toBe('"admin"');
    expect(escapeCsvValue("")).toBe('""');
  });

  it("doubles embedded quotes instead of dropping them", () => {
    // Kolom detail log berbentuk: nama: "Budi" -> "Budi S"
    expect(escapeCsvValue('nama: "Budi" -> "Budi S"')).toBe('"nama: ""Budi"" -> ""Budi S"""');
  });

  it("leaves commas and newlines intact inside the quotes", () => {
    expect(escapeCsvValue("peran: Operator, status: aktif")).toBe(
      '"peran: Operator, status: aktif"',
    );
    expect(escapeCsvValue("baris satu\nbaris dua")).toBe('"baris satu\nbaris dua"');
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF so Excel on Windows sees separate rows", () => {
    const csv = toCsv([
      ["Waktu", "Aksi"],
      ["22 Aug 2026 09:14:30", "Berhasil masuk"],
    ]);

    expect(csv).toBe('"Waktu","Aksi"\r\n"22 Aug 2026 09:14:30","Berhasil masuk"');
    expect(csv.includes("\r\n")).toBe(true);
  });

  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});

describe("fileTimestamp", () => {
  it("pads every part so filenames sort chronologically as text", () => {
    expect(fileTimestamp(new Date(2026, 7, 5, 9, 4, 3))).toBe("2026-08-05_09-04-03");
  });

  it("uses local time, matching the clock the operator reads", () => {
    const now = new Date(2026, 11, 31, 23, 59, 59);
    expect(fileTimestamp(now)).toBe("2026-12-31_23-59-59");
  });
});
