const DB_NAME = "capture-calcine-media-cache";
const STORE_NAME = "media";
const DB_VERSION = 1;

export type MediaCacheKind = "capture-full" | "capture-thumb";

type MediaCacheEntry = {
  key: string;
  kind: MediaCacheKind;
  captureId: number;
  blob: Blob;
  updatedAt: number;
};

type MemoryEntry = {
  objectUrl: string;
};

const MEMORY_LIMITS: Record<MediaCacheKind, number> = {
  "capture-full": 8,
  "capture-thumb": 48,
};

const memoryCache = new Map<string, MemoryEntry>();

function cacheKey(kind: MediaCacheKind, captureId: number) {
  return `${kind}:${captureId}`;
}

function indexedDbAvailable() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function rememberObjectUrl(key: string, kind: MediaCacheKind, objectUrl: string) {
  const existing = memoryCache.get(key);
  if (existing) {
    memoryCache.delete(key);
    if (existing.objectUrl !== objectUrl) {
      URL.revokeObjectURL(existing.objectUrl);
    }
  }

  memoryCache.set(key, { objectUrl });

  const prefix = `${kind}:`;
  const keys = [...memoryCache.keys()].filter((value) => value.startsWith(prefix));
  while (keys.length > MEMORY_LIMITS[kind]) {
    const oldestKey = keys.shift();
    if (!oldestKey) break;
    const entry = memoryCache.get(oldestKey);
    memoryCache.delete(oldestKey);
    if (entry) {
      URL.revokeObjectURL(entry.objectUrl);
    }
  }
}

function readMemoryObjectUrl(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.objectUrl;
}

function openDb(): Promise<IDBDatabase | null> {
  if (!indexedDbAvailable()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE_NAME)) return;
      const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
      store.createIndex("by-kind-updatedAt", ["kind", "updatedAt"]);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function readEntry(
  db: IDBDatabase,
  key: string,
): Promise<MediaCacheEntry | null> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve((request.result as MediaCacheEntry | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

function writeEntry(db: IDBDatabase, entry: MediaCacheEntry): Promise<boolean> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

function deleteEntry(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

function listEntriesByKind(db: IDBDatabase, kind: MediaCacheKind): Promise<MediaCacheEntry[]> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("by-kind-updatedAt");
    const range = IDBKeyRange.bound([kind, 0], [kind, Number.MAX_SAFE_INTEGER]);
    const request = index.getAll(range);
    request.onsuccess = () => resolve((request.result as MediaCacheEntry[]) ?? []);
    request.onerror = () => resolve([]);
  });
}

async function enforcePersistentLimit(db: IDBDatabase, kind: MediaCacheKind) {
  const entries = await listEntriesByKind(db, kind);
  const overflow = entries.length - MEMORY_LIMITS[kind];
  if (overflow <= 0) return;

  const removable = entries
    .sort((left, right) => left.updatedAt - right.updatedAt)
    .slice(0, overflow);

  for (const entry of removable) {
    await deleteEntry(db, entry.key);
  }
}

export async function getCachedMediaObjectUrl(
  kind: MediaCacheKind,
  captureId: number,
): Promise<string | null> {
  const key = cacheKey(kind, captureId);
  const memoryUrl = readMemoryObjectUrl(key);
  if (memoryUrl) return memoryUrl;

  const db = await openDb();
  if (!db) return null;

  try {
    const entry = await readEntry(db, key);
    if (!entry) return null;

    const refreshed: MediaCacheEntry = { ...entry, updatedAt: Date.now() };
    await writeEntry(db, refreshed);
    const objectUrl = URL.createObjectURL(entry.blob);
    rememberObjectUrl(key, kind, objectUrl);
    return objectUrl;
  } finally {
    db.close();
  }
}

export async function persistMediaBlob(
  kind: MediaCacheKind,
  captureId: number,
  blob: Blob,
): Promise<string> {
  const key = cacheKey(kind, captureId);
  const objectUrl = URL.createObjectURL(blob);
  rememberObjectUrl(key, kind, objectUrl);

  const db = await openDb();
  if (!db) return objectUrl;

  try {
    await writeEntry(db, {
      key,
      kind,
      captureId,
      blob,
      updatedAt: Date.now(),
    });
    await enforcePersistentLimit(db, kind);
  } finally {
    db.close();
  }

  return objectUrl;
}

export async function createThumbnailBlob(
  source: Blob,
  maxEdge = 320,
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  const objectUrl = URL.createObjectURL(source);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error("Preview image failed to load for thumbnail rendering."));
      value.src = objectUrl;
    });

    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) return null;

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
