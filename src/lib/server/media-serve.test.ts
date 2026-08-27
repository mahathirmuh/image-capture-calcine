import { describe, expect, it } from "vitest";

import { isInsideRoot, isMediaPath } from "./media-serve";

// Penjaga terakhir sebelum sebuah path dari database dibuka sebagai berkas.
// Path-nya memang bukan masukan pemakai, jadi ini bukan pertahanan utama --
// tapi tanpanya, satu baris registry yang path-nya keliru berubah jadi
// pembacaan berkas sewenang-wenang di app server.
describe("isInsideRoot", () => {
  const linuxRoot = "/mnt/mti/ML/MTI/Calcine Project/Calcine Sample Foto/Foto Sampling";

  it("menerima berkas di bawah root", async () => {
    expect(
      await isInsideRoot(`${linuxRoot}/Acid Plant/2026/08/27/11.00 Train 1.jpg`, linuxRoot),
    ).toBe(true);
  });

  it("menolak berkas di luar root", async () => {
    expect(await isInsideRoot("/etc/passwd", linuxRoot)).toBe(false);
    expect(await isInsideRoot("/mnt/mti/ML/MTI/lainnya/foto.jpg", linuxRoot)).toBe(false);
  });

  it("menolak penelusuran ke atas lewat ..", async () => {
    expect(await isInsideRoot(`${linuxRoot}/../../../../etc/passwd`, linuxRoot)).toBe(false);
  });

  // Tanpa pemisah di ujung root, "/mnt/mti-lain" akan lolos hanya karena
  // teksnya diawali "/mnt/mti".
  it("tidak tertipu folder tetangga yang namanya berawalan sama", async () => {
    expect(await isInsideRoot("/mnt/mti-lain/rahasia.jpg", "/mnt/mti")).toBe(false);
    expect(await isInsideRoot("/mnt/mti/foto.jpg", "/mnt/mti")).toBe(true);
  });

  it("menolak root itu sendiri, bukan hanya isinya", async () => {
    expect(await isInsideRoot(linuxRoot, linuxRoot)).toBe(false);
  });

  // Mesin dev Windows memakai bentuk UNC; app server produksi memakai path
  // mount Linux. Keduanya harus dinilai dengan aturan pemisah masing-masing.
  it("menangani root UNC Windows", async () => {
    const uncRoot = "\\\\10.1.1.44\\Data Analytics\\ML\\MTI";
    expect(await isInsideRoot("\\\\10.1.1.44\\Data Analytics\\ML\\MTI\\a\\foto.jpg", uncRoot)).toBe(
      true,
    );
    expect(await isInsideRoot("\\\\10.1.1.44\\Data Analytics\\lain\\foto.jpg", uncRoot)).toBe(
      false,
    );
  });

  // Persis yang terjadi saat mesin dev Windows membaca record yang ditulis app
  // server Linux: path-nya sah, tapi bukan untuk root di mesin ini.
  it("menolak path Linux terhadap root UNC", async () => {
    expect(
      await isInsideRoot(`${linuxRoot}/foto.jpg`, "\\\\10.1.1.44\\Data Analytics\\ML\\MTI"),
    ).toBe(false);
  });
});

describe("isMediaPath", () => {
  it("hanya mengenali awalan /media/", () => {
    expect(isMediaPath("/media/30")).toBe(true);
    expect(isMediaPath("/media/30?e=1&s=x")).toBe(true);
    expect(isMediaPath("/mediaX/30")).toBe(false);
    expect(isMediaPath("/gallery")).toBe(false);
  });
});
