import { describe, expect, it } from "vitest";

import { fitWithin, THUMBNAIL_MAX_EDGE } from "./thumbnail";

describe("fitWithin", () => {
  it("mengecilkan sampai sisi terpanjang pas di batas", () => {
    expect(fitWithin(6000, 4000, 640)).toEqual({ width: 640, height: 427 });
    expect(fitWithin(4000, 6000, 640)).toEqual({ width: 427, height: 640 });
  });

  // Memperbesar hanya menambah byte tanpa menambah satu pun detail, dan
  // menghasilkan thumbnail yang lebih besar dari fotonya sendiri.
  it("tidak memperbesar gambar yang sudah lebih kecil dari batas", () => {
    expect(fitWithin(320, 240, 640)).toEqual({ width: 320, height: 240 });
    expect(fitWithin(640, 480, 640)).toEqual({ width: 640, height: 480 });
  });

  // Pembulatan ke bawah pada gambar yang sangat panjang dan sempit bisa
  // menghasilkan 0, dan canvas berdimensi 0 melempar -- capture jadi gagal
  // gara-gara thumbnail.
  it("tidak pernah menghasilkan sisi nol pada rasio ekstrem", () => {
    const result = fitWithin(10000, 3, 640);
    expect(result.width).toBe(640);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it("menjaga rasio aspek", () => {
    const source = { width: 6000, height: 4000 };
    const result = fitWithin(source.width, source.height, 640);
    const sourceRatio = source.width / source.height;
    const resultRatio = result.width / result.height;
    expect(Math.abs(sourceRatio - resultRatio)).toBeLessThan(0.01);
  });

  it("menangani ukuran tidak masuk akal tanpa melempar", () => {
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(-5, 100)).toEqual({ width: 0, height: 0 });
  });

  it("memakai batas bawaan kalau tidak disebut", () => {
    expect(fitWithin(6000, 4000)).toEqual(fitWithin(6000, 4000, THUMBNAIL_MAX_EDGE));
  });
});
