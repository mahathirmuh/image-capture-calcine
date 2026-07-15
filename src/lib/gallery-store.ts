// Persistent gallery store. Captures are kept in IndexedDB so they survive
// reloads and navigation between routes. Object URLs are recreated on load.

const IDB_NAME = "capture-system";
const IDB_STORE = "gallery";
const IDB_BLOB_STORE = "gallery-blobs";

type DirHandle = any;
type FileHandle = any;

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
};

type StoredGalleryItem = {
  id: string;
  name: string;
  folder: string;
  bin?: string;
  createdAt: number;
  hasFileHandle: boolean;
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
      items.push({
        id: meta.id,
        name: meta.name,
        url: URL.createObjectURL(blob),
        blob,
        folder: meta.folder,
        bin: meta.bin,
        fileHandle: null,
        parentDir: null,
        createdAt: meta.createdAt,
      });
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
        const meta: StoredGalleryItem = {
          id: item.id,
          name: item.name,
          folder: item.folder,
          bin: item.bin,
          createdAt: item.createdAt,
          hasFileHandle: !!item.fileHandle,
        };
        store.put(meta, item.id);
        blobStore.put(item.blob, item.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
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
      const meta: StoredGalleryItem = {
        id: item.id,
        name: item.name,
        folder: item.folder,
        bin: item.bin,
        createdAt: item.createdAt,
        hasFileHandle: !!item.fileHandle,
      };
      tx.objectStore(IDB_STORE).put(meta, item.id);
      tx.objectStore(IDB_BLOB_STORE).put(item.blob, item.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
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
  } catch {
    /* ignore */
  }
}
