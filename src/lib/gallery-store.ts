// Persistent gallery store. Captures are kept in IndexedDB so they survive
// reloads and navigation between routes. Object URLs are recreated on load.

const IDB_NAME = "capture-system";
const IDB_STORE = "gallery";
const IDB_BLOB_STORE = "gallery-blobs";

type DirHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;

export type GalleryItem = {
  id: string;
  name: string;
  url: string;
  blob: Blob;
  folder: string;
  bin?: string;
  fileHandle: FileHandle | null;
  parentDir: DirHandle | null;
  createdAt: number;
  captureRecordId?: number | null;
  persistedPath?: string | null;
  saveMethod?: "app-network" | "edge-network" | "browser-folder" | "browser-download" | null;
  // Untuk ditampilkan di kartu galeri. Salinan tampilan saja -- yang berwenang
  // ada di metadata record MSSQL, distempel server dari cookie sesi.
  capturedBy?: string | null;
};

type StoredGalleryItem = {
  id: string;
  name: string;
  folder: string;
  bin?: string;
  createdAt: number;
  hasFileHandle: boolean;
  captureRecordId?: number | null;
  persistedPath?: string | null;
  saveMethod?: "app-network" | "edge-network" | "browser-folder" | "browser-download" | null;
  // Untuk ditampilkan di kartu galeri. Salinan tampilan saja -- yang berwenang
  // ada di metadata record MSSQL, distempel server dari cookie sesi.
  capturedBy?: string | null;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // v3: blobs moved into their own out-of-line-keyed store. Storing them
    // in the "gallery" store alongside metadata under an in-line "id"
    // keyPath doesn't work — put() rejects an explicit key on such a store.
    const req = indexedDB.open(IDB_NAME, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(IDB_STORE)) {
        db.deleteObjectStore(IDB_STORE);
      }
      db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains(IDB_BLOB_STORE)) {
        db.createObjectStore(IDB_BLOB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Pemberitahuan perubahan isi galeri.
//
// Sidebar menampilkan jumlah capture, tapi ia hidup di layout dan tidak pernah
// di-mount ulang saat operator berpindah halaman -- tanpa ini angkanya membeku
// pada nilai saat tab dibuka, dan capture baru baru terlihat setelah reload.
//
// Sengaja sesederhana ini: satu set callback, tanpa pustaka state global.
// Yang perlu diketahui pelanggannya hanya "isinya berubah, baca ulang".
type GalleryChangeListener = () => void;

const galleryListeners = new Set<GalleryChangeListener>();

/** Mengembalikan fungsi untuk berhenti berlangganan. */
export function subscribeGalleryChange(listener: GalleryChangeListener): () => void {
  galleryListeners.add(listener);
  return () => galleryListeners.delete(listener);
}

function notifyGalleryChange() {
  for (const listener of galleryListeners) listener();
}

// Pemetaan antara item galeri dan bentuk tersimpannya, dikumpulkan di satu
// tempat.
//
// Sebelumnya daftar field-nya ditulis tangan di TIGA tempat: dua jalur tulis
// (saveGallery, addGalleryItem) dan satu jalur baca (loadGallery). Menambah
// satu field menuntut ketiganya diubah, dan yang terlewat tidak menghasilkan
// error apa pun -- field-nya opsional, jadi TypeScript tidak keberatan; nilainya
// hanya lenyap diam-diam saat dibaca kembali. Persis itu yang terjadi pada
// `capturedBy`: tersimpan dengan benar, hilang saat dimuat.
//
// Sekarang keduanya pasangan yang bisa diuji tanpa IndexedDB.
export function toStoredGalleryMeta(item: GalleryItem): StoredGalleryItem {
  return {
    id: item.id,
    name: item.name,
    folder: item.folder,
    bin: item.bin,
    createdAt: item.createdAt,
    hasFileHandle: !!item.fileHandle,
    captureRecordId: item.captureRecordId ?? null,
    persistedPath: item.persistedPath ?? null,
    saveMethod: item.saveMethod ?? null,
    capturedBy: item.capturedBy ?? null,
  };
}

export function fromStoredGalleryMeta(
  meta: StoredGalleryItem,
  blob: Blob,
  url: string,
): GalleryItem {
  return {
    id: meta.id,
    name: meta.name,
    url,
    blob,
    folder: meta.folder,
    bin: meta.bin,
    // Handle direktori tidak bisa bertahan di IndexedDB bersama metadata ini;
    // yang tersimpan cuma penandanya (`hasFileHandle`).
    fileHandle: null,
    parentDir: null,
    createdAt: meta.createdAt,
    captureRecordId: meta.captureRecordId ?? null,
    persistedPath: meta.persistedPath ?? null,
    saveMethod: meta.saveMethod ?? null,
    capturedBy: meta.capturedBy ?? null,
  };
}

export async function loadGallery(): Promise<GalleryItem[]> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return [];
  try {
    const db = await openDB();
    const stored: StoredGalleryItem[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });

    const items: GalleryItem[] = [];
    for (const meta of stored) {
      const blob: Blob | undefined = await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_BLOB_STORE, "readonly");
        const req = tx.objectStore(IDB_BLOB_STORE).get(meta.id);
        req.onsuccess = () => resolve(req.result ?? undefined);
        req.onerror = () => reject(req.error);
      });
      if (!blob) continue;
      items.push(fromStoredGalleryMeta(meta, blob, URL.createObjectURL(blob)));
    }
    db.close();
    return items.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function saveGallery(items: GalleryItem[]): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([IDB_STORE, IDB_BLOB_STORE], "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const blobStore = tx.objectStore(IDB_BLOB_STORE);
      store.clear();
      blobStore.clear();
      for (const item of items) {
        store.put(toStoredGalleryMeta(item), item.id);
        blobStore.put(item.blob, item.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    notifyGalleryChange();
  } catch {
    /* ignore */
  }
}

export async function addGalleryItem(item: GalleryItem): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([IDB_STORE, IDB_BLOB_STORE], "readwrite");
      tx.objectStore(IDB_STORE).put(toStoredGalleryMeta(item), item.id);
      tx.objectStore(IDB_BLOB_STORE).put(item.blob, item.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    notifyGalleryChange();
  } catch {
    /* ignore */
  }
}

export async function removeGalleryItem(id: string): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([IDB_STORE, IDB_BLOB_STORE], "readwrite");
      tx.objectStore(IDB_STORE).delete(id);
      tx.objectStore(IDB_BLOB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    notifyGalleryChange();
  } catch {
    /* ignore */
  }
}
