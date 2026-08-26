import { describe, expect, it } from "vitest";

import { isWindowsStyleRoot, joinNetworkPath, normalizeRelativeSegments } from "./network-path";

// Root UNC ditulis lewat konstanta supaya deretan backslash-nya hanya perlu
// dibaca benar sekali, bukan di setiap ekspektasi.
const UNC_ROOT = "\\\\10.1.1.44\\Data Analytics\\ML\\MTI";
const POSIX_ROOT = "/mnt/mti/ML/MTI";

describe("isWindowsStyleRoot", () => {
  it("mengenali UNC dan huruf drive", () => {
    expect(isWindowsStyleRoot(UNC_ROOT)).toBe(true);
    expect(isWindowsStyleRoot("C:\\captures")).toBe(true);
    expect(isWindowsStyleRoot("D:/captures")).toBe(true);
  });

  it("memperlakukan sisanya sebagai POSIX", () => {
    expect(isWindowsStyleRoot(POSIX_ROOT)).toBe(false);
    expect(isWindowsStyleRoot("/srv/captures")).toBe(false);
  });
});

describe("normalizeRelativeSegments", () => {
  it("memecah path bertanggal jadi segmen", () => {
    expect(normalizeRelativeSegments("2026/08/25/foto.jpg")).toEqual([
      "2026",
      "08",
      "25",
      "foto.jpg",
    ]);
  });

  // Segmen plant ("Acid Plant", "Chloride Plant") jadi folder pertama di bawah
  // targetRoot, dan namanya mengandung spasi. Spasi harus lolos apa adanya --
  // kalau ikut tersaring, seluruh capture mendarat di folder yang salah.
  it("mempertahankan spasi pada nama folder plant", () => {
    expect(normalizeRelativeSegments("Chloride Plant/2026/08/25/foto.jpg")).toEqual([
      "Chloride Plant",
      "2026",
      "08",
      "25",
      "foto.jpg",
    ]);
    expect(
      joinNetworkPath("/mnt/mti/ML/MTI/Foto Sampling", ["Acid Plant", "2026", "foto.jpg"]),
    ).toBe("/mnt/mti/ML/MTI/Foto Sampling/Acid Plant/2026/foto.jpg");
  });

  it("menerima backslash dan separator berulang", () => {
    expect(normalizeRelativeSegments("2026\\08//25\\foto.jpg")).toEqual([
      "2026",
      "08",
      "25",
      "foto.jpg",
    ]);
  });

  // Inti penjaganya: tidak ada masukan klien yang boleh keluar dari targetRoot.
  it("menolak traversal, path absolut, dan huruf drive", () => {
    expect(normalizeRelativeSegments("../../etc/passwd")).toBeNull();
    expect(normalizeRelativeSegments("2026/../../../etc/passwd")).toBeNull();
    expect(normalizeRelativeSegments("2026/./foto.jpg")).toBeNull();
    expect(normalizeRelativeSegments("C:\\Windows\\system32\\a.dll")).toBeNull();
  });

  it("menolak karakter terlarang dan masukan kosong", () => {
    expect(normalizeRelativeSegments("2026/08/fo:to.jpg")).toBeNull();
    expect(normalizeRelativeSegments("2026/08/fo*to.jpg")).toBeNull();
    expect(normalizeRelativeSegments("")).toBeNull();
    expect(normalizeRelativeSegments("///")).toBeNull();
  });

  // Path absolut POSIX kehilangan slash depannya dan menjadi relatif -- itu
  // disengaja: hasilnya tetap tersimpan di bawah targetRoot, tidak di /etc.
  it("meluruhkan slash depan jadi relatif", () => {
    expect(normalizeRelativeSegments("/2026/08/25/foto.jpg")).toEqual([
      "2026",
      "08",
      "25",
      "foto.jpg",
    ]);
  });
});

describe("joinNetworkPath", () => {
  it("memakai backslash untuk root UNC walau berjalan di Linux", () => {
    expect(joinNetworkPath(UNC_ROOT, ["2026", "08", "25", "foto.jpg"])).toBe(
      `${UNC_ROOT}\\2026\\08\\25\\foto.jpg`,
    );
  });

  it("memakai slash untuk root POSIX walau berjalan di Windows", () => {
    expect(joinNetworkPath(POSIX_ROOT, ["2026", "08", "25", "foto.jpg"])).toBe(
      "/mnt/mti/ML/MTI/2026/08/25/foto.jpg",
    );
  });

  it("membuang separator berlebih di ujung root", () => {
    expect(joinNetworkPath("/mnt/mti/ML/MTI/", ["foto.jpg"])).toBe("/mnt/mti/ML/MTI/foto.jpg");
    expect(joinNetworkPath("\\\\host\\share\\", ["foto.jpg"])).toBe("\\\\host\\share\\foto.jpg");
  });

  it("mengembalikan root apa adanya kalau tidak ada segmen", () => {
    expect(joinNetworkPath(POSIX_ROOT, [])).toBe(POSIX_ROOT);
  });
});
