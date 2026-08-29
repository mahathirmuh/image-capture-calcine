import { describe, expect, it } from "vitest";

import {
  DEFAULT_GALLERY_IMAGE_QUALITY,
  GALLERY_PAGE_SIZE_OPTIONS,
  DEFAULT_GALLERY_VIEW_STATE,
  galleryViewStateMatchesSavedView,
  loadGalleryImageQuality,
  saveGalleryImageQuality,
  loadGallerySavedViewPreference,
  loadGalleryViewState,
  saveGallerySavedViewPreference,
  saveGalleryViewState,
} from "./gallery-preferences";

function createStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe("gallery-preferences", () => {
  it("persists the gallery view state", () => {
    const localStorage = createStorageMock();
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
    });

    saveGalleryViewState({
      sortOption: "oldest",
      viewMode: "list",
      pageSize: 48,
      searchQuery: "calcine",
      filterDate: "2026-07-21",
      filterLocation: "Acid Plant",
      filterBin: "BIN1",
    });

    expect(loadGalleryViewState()).toEqual({
      sortOption: "oldest",
      viewMode: "list",
      pageSize: 48,
      searchQuery: "calcine",
      filterDate: "2026-07-21",
      filterLocation: "Acid Plant",
      filterBin: "BIN1",
    });
  });

  it("falls back to the default view state when stored data is invalid", () => {
    const localStorage = createStorageMock();
    localStorage.setItem(
      "capture-system:gallery-view-state:v1",
      JSON.stringify({ sortOption: "broken-value" }),
    );
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
    });

    expect(loadGalleryViewState()).toEqual(DEFAULT_GALLERY_VIEW_STATE);
  });

  it("persists the selected gallery saved view", () => {
    const localStorage = createStorageMock();
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
    });

    saveGallerySavedViewPreference("compact-audit");

    expect(loadGallerySavedViewPreference()).toBe("compact-audit");
  });

  it("falls back to the default gallery saved view when the stored value is invalid", () => {
    const localStorage = createStorageMock();
    localStorage.setItem("capture-system:gallery-saved-view:v1", "invalid-view");
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
    });

    expect(loadGallerySavedViewPreference()).toBe("all-images");
  });

  it("detects whether the current view still matches the selected saved view", () => {
    expect(
      galleryViewStateMatchesSavedView(
        {
          sortOption: "oldest",
          viewMode: "list",
          pageSize: 48,
          searchQuery: "",
          filterDate: "",
          filterLocation: "",
          filterBin: "",
        },
        "compact-audit",
      ),
    ).toBe(true);

    expect(
      galleryViewStateMatchesSavedView(
        {
          sortOption: "oldest",
          viewMode: "list",
          pageSize: 48,
          searchQuery: "manual",
          filterDate: "",
          filterLocation: "",
          filterBin: "",
        },
        "compact-audit",
      ),
    ).toBe(false);
  });
});

describe("ukuran halaman", () => {
  it("bawaannya 10", () => {
    expect(DEFAULT_GALLERY_VIEW_STATE.pageSize).toBe(10);
  });

  it("10 memang salah satu pilihan yang sah", () => {
    // Bawaan yang tidak ada di daftar pilihan akan lolos TypeScript tapi
    // membuat dropdown-nya tampil kosong.
    expect(GALLERY_PAGE_SIZE_OPTIONS).toContain(10);
  });

  it("preferensi lama bernilai 12 jatuh ke bawaan, bukan meledak", () => {
    window.localStorage.setItem(
      "capture-system:gallery-view-state:v1",
      JSON.stringify({ ...DEFAULT_GALLERY_VIEW_STATE, pageSize: 12 }),
    );
    expect(loadGalleryViewState().pageSize).toBe(10);
  });
});

describe("preferensi kualitas gambar", () => {
  it("bawaannya hemat, bukan HD", () => {
    // Bukan sekadar selera: HD berarti ~11 MB per gambar lewat CIFS dari
    // 10.1.1.44. Bawaan yang salah di sini terasa di setiap klik operator.
    expect(DEFAULT_GALLERY_IMAGE_QUALITY).toBe("hemat");
  });

  it("mengembalikan bawaan kalau belum pernah disimpan", () => {
    window.localStorage.clear();
    expect(loadGalleryImageQuality()).toBe("hemat");
  });

  it("mengingat pilihan operator", () => {
    saveGalleryImageQuality("hd");
    expect(loadGalleryImageQuality()).toBe("hd");
    saveGalleryImageQuality("hemat");
    expect(loadGalleryImageQuality()).toBe("hemat");
  });

  it("jatuh ke bawaan kalau nilainya rusak", () => {
    window.localStorage.setItem("capture-system:gallery-image-quality:v1", "ultra");
    expect(loadGalleryImageQuality()).toBe("hemat");
  });
});
