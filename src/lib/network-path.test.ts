import { describe, expect, it } from "vitest";

import {
  isPlatformMismatchedRoot,
  isSafeFileName,
  isWindowsStyleRoot,
  joinNetworkPath,
  normalizeRelativeSegments,
} from "./network-path";

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

// Kejadian produksi 28 Agustus 2026: .env container Linux terisi bentuk UNC,
// dan antrean kirim berhenti dengan TARGET_ROOT_MISSING -- pesan yang menuduh
// mount, padahal mountnya sehat. Capture 11.00 dan 14.00 menumpuk berjam-jam.
describe("isPlatformMismatchedRoot", () => {
  it("menangkap root UNC di Linux", () => {
    expect(isPlatformMismatchedRoot(UNC_ROOT, "linux")).toBe(true);
    expect(isPlatformMismatchedRoot("C:\\captures", "linux")).toBe(true);
  });

  it("membiarkan root UNC di Windows -- di sana justru itu yang benar", () => {
    expect(isPlatformMismatchedRoot(UNC_ROOT, "win32")).toBe(false);
    expect(isPlatformMismatchedRoot("C:\\captures", "win32")).toBe(false);
  });

  it("membiarkan path POSIX di mana pun", () => {
    expect(isPlatformMismatchedRoot(POSIX_ROOT, "linux")).toBe(false);
    expect(isPlatformMismatchedRoot(POSIX_ROOT, "win32")).toBe(false);
    expect(isPlatformMismatchedRoot(POSIX_ROOT, "darwin")).toBe(false);
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

// Nama ini dipakai untuk mengubah nama berkas SUNGGUHAN di folder jaringan,
// jadi yang diuji di sini bukan kerapian teks melainkan penjaga traversal.
describe("isSafeFileName", () => {
  it("menerima nama baku sesi capture", () => {
    expect(isSafeFileName("02.00 Train 1.jpg")).toBe(true);
    expect(isSafeFileName("23.00 Bin 2.jpg")).toBe(true);
    // Spasi di ujung dirapikan, bukan jadi alasan menolak.
    expect(isSafeFileName("  11.00 Train 1.jpg  ")).toBe(true);
  });

  it("menolak pemisah path supaya berkas tidak pindah folder", () => {
    expect(isSafeFileName("sub/foto.jpg")).toBe(false);
    expect(isSafeFileName("sub\\foto.jpg")).toBe(false);
    expect(isSafeFileName("/mnt/mti/foto.jpg")).toBe(false);
  });

  it("menolak traversal ke atas", () => {
    expect(isSafeFileName("..")).toBe(false);
    expect(isSafeFileName(".")).toBe(false);
    expect(isSafeFileName("../../etc/passwd")).toBe(false);
  });

  it("menolak nama kosong", () => {
    expect(isSafeFileName("")).toBe(false);
    expect(isSafeFileName("   ")).toBe(false);
  });

  it("menolak karakter terlarang Windows dan karakter kontrol", () => {
    expect(isSafeFileName('foto".jpg')).toBe(false);
    expect(isSafeFileName("foto:1.jpg")).toBe(false);
    expect(isSafeFileName("foto*.jpg")).toBe(false);
    expect(isSafeFileName("foto?.jpg")).toBe(false);
    expect(isSafeFileName("foto|.jpg")).toBe(false);
    // Ditulis sebagai escape, bukan byte mentah: karakter kontrol yang
    // diketik langsung ke berkas sumber tidak terlihat saat dibaca dan
    // membuat git memperlakukan berkasnya sebagai biner.
    expect(isSafeFileName("foto\u0000.jpg")).toBe(false);
    expect(isSafeFileName("foto\u001f.jpg")).toBe(false);
  });
});
