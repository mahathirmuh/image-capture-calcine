import { describe, expect, it } from "vitest";

import { fromStoredGalleryMeta, toStoredGalleryMeta, type GalleryItem } from "./gallery-store";

function makeItem(overrides: Partial<GalleryItem> = {}): GalleryItem {
  return {
    id: "abc-123",
    name: "14.00 Train 1.jpg",
    url: "blob:asli",
    blob: new Blob(["x"]),
    folder: "Acid Plant",
    bin: "TRAIN 1",
    fileHandle: null,
    parentDir: null,
    createdAt: 1_756_000_000_000,
    captureRecordId: 42,
    persistedPath: "/mnt/mti/ML/MTI/Acid Plant/2026/08/26/14.00 Train 1.jpg",
    saveMethod: "app-network",
    capturedBy: "Budi",
    ...overrides,
  };
}

describe("pemetaan penyimpanan galeri", () => {
  // Penjaga utamanya: jalur tulis dan jalur baca dulunya dua daftar field yang
  // ditulis tangan terpisah, dan `capturedBy` sempat hilang karena hanya ada di
  // salah satunya. Field opsional membuat TypeScript diam saja soal itu, jadi
  // tes inilah yang menahannya.
  it("mempertahankan setiap field yang bisa disimpan saat bolak-balik", () => {
    const item = makeItem();
    const blob = new Blob(["y"]);
    const restored = fromStoredGalleryMeta(toStoredGalleryMeta(item), blob, "blob:dimuat-ulang");

    expect(restored.id).toBe(item.id);
    expect(restored.name).toBe(item.name);
    expect(restored.folder).toBe(item.folder);
    expect(restored.bin).toBe(item.bin);
    expect(restored.createdAt).toBe(item.createdAt);
    expect(restored.captureRecordId).toBe(item.captureRecordId);
    expect(restored.persistedPath).toBe(item.persistedPath);
    expect(restored.saveMethod).toBe(item.saveMethod);
    expect(restored.capturedBy).toBe("Budi");
  });

  it("memakai blob dan url yang diberikan, bukan yang lama", () => {
    const blob = new Blob(["baru"]);
    const restored = fromStoredGalleryMeta(toStoredGalleryMeta(makeItem()), blob, "blob:baru");
    expect(restored.blob).toBe(blob);
    expect(restored.url).toBe("blob:baru");
  });

  // Handle direktori tidak bisa ikut tersimpan; yang tersisa cuma penandanya.
  // Memuat ulang harus mengembalikan null, bukan berpura-pura handle-nya ada.
  it("tidak mengembalikan handle direktori setelah dimuat ulang", () => {
    const meta = toStoredGalleryMeta(makeItem());
    expect(meta.hasFileHandle).toBe(false);
    const restored = fromStoredGalleryMeta(meta, new Blob(["z"]), "blob:x");
    expect(restored.fileHandle).toBeNull();
    expect(restored.parentDir).toBeNull();
  });

  // Item lama tersimpan sebelum atribusi operator ada. Memuatnya harus
  // menghasilkan null yang rapi, bukan undefined yang bocor ke tampilan.
  it("memperlakukan field yang belum ada pada item lama sebagai null", () => {
    const restored = fromStoredGalleryMeta(
      toStoredGalleryMeta(makeItem({ capturedBy: undefined, saveMethod: undefined })),
      new Blob(["z"]),
      "blob:x",
    );
    expect(restored.capturedBy).toBeNull();
    expect(restored.saveMethod).toBeNull();
  });
});
