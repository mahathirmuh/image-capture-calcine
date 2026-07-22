// Persistence helpers for user preferences and the saved directory handle.
// Preferences live in localStorage; the DirectoryHandle lives in IndexedDB
// because handles are structured-clone-able but not JSON-serializable.

import { PLANTS } from "./locations";

const PREFS_KEY = "capture-system:prefs:v2";
const IDB_NAME = "capture-system";
const IDB_STORE = "handles";
const IDB_KEY = "rootDir";

export type Prefs = {
  location: string;
  pattern: string;
  // Captures come straight from the camera as JPEG, so the extension is fixed.
  ext: "jpg";
  counter: number;
};

export const DEFAULT_PREFS: Prefs = {
  location: PLANTS[0],
  // e.g. "02 July 2026 17.00 CP BIN1" -> day, full month name, year, HH.mm,
  // location code (AP/CP), and the bin.
  pattern: "{DD} {MMMM} {YYYY} {HH}.{mm} {LOCATION} {SOURCE}",
  ext: "jpg",
  counter: 1,
};

export const FILENAME_PATTERN_TOKENS = [
  "DD",
  "MMMM",
  "MM",
  "YYYY",
  "HH",
  "mm",
  "ss",
  "LOCATION",
  "SOURCE",
  "INDEX",
  "TS",
] as const;

export type FilenamePatternToken = (typeof FILENAME_PATTERN_TOKENS)[number];

export type FilenamePatternAnalysis = {
  normalizedPattern: string;
  recognizedTokens: FilenamePatternToken[];
  unsupportedTokens: string[];
  errors: string[];
  warnings: string[];
  suggestions: string[];
  hasCollisionRisk: boolean;
  isValid: boolean;
};

export function analyzeFilenamePattern(pattern: string): FilenamePatternAnalysis {
  const normalizedPattern = pattern.trim();
  const tokenSet = new Set<FilenamePatternToken>(FILENAME_PATTERN_TOKENS);
  const rawTokens = Array.from(normalizedPattern.matchAll(/\{([^}]+)\}/g)).map(
    (match) => match[1] ?? "",
  );
  const recognizedTokens = Array.from(
    new Set(
      rawTokens.filter((token): token is FilenamePatternToken =>
        tokenSet.has(token as FilenamePatternToken),
      ),
    ),
  );
  const unsupportedTokens = Array.from(
    new Set(rawTokens.filter((token) => !tokenSet.has(token as FilenamePatternToken))),
  );

  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (normalizedPattern === "") {
    errors.push("Filename pattern tidak boleh kosong.");
  }

  if (unsupportedTokens.length > 0) {
    errors.push(
      `Token tidak dikenal: ${unsupportedTokens.map((token) => `{${token}}`).join(", ")}.`,
    );
  }

  if (rawTokens.length === 0) {
    warnings.push(
      "Pattern ini tidak memakai token dinamis; semua file akan mulai dari nama dasar yang sama.",
    );
  }

  const hasLocation = recognizedTokens.includes("LOCATION");
  const hasSource = recognizedTokens.includes("SOURCE");
  const hasIndex = recognizedTokens.includes("INDEX");
  const hasTimestamp = recognizedTokens.some((token) => token === "TS" || token === "ss");
  const hasCollisionRisk = !hasIndex && !hasTimestamp;

  if (!hasLocation) {
    suggestions.push("Tambahkan `{LOCATION}` agar file mudah diaudit per plant.");
  }
  if (!hasSource) {
    suggestions.push(
      "Tambahkan `{SOURCE}` agar operator bisa membedakan BIN 1 dan BIN 2 dari nama file.",
    );
  }
  if (hasCollisionRisk) {
    warnings.push(
      "Pattern ini berisiko menghasilkan nama ganda untuk capture yang berdekatan; aplikasi akan menambahkan suffix seperti `(2)` bila perlu.",
    );
    suggestions.push(
      "Tambahkan `{INDEX}`, `{ss}`, atau `{TS}` jika ingin nama file lebih unik tanpa suffix tambahan.",
    );
  }

  return {
    normalizedPattern,
    recognizedTokens,
    unsupportedTokens,
    errors,
    warnings,
    suggestions,
    hasCollisionRisk,
    isValid: errors.length === 0,
  };
}

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota errors */
  }
}

type DirHandle = FileSystemDirectoryHandle;
type FsHandle = FileSystemHandle;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirHandle(handle: DirHandle): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadDirHandle(): Promise<DirHandle | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  try {
    const db = await openDB();
    const handle = await new Promise<DirHandle | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

export async function clearDirHandle(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

// Verify or (re)request read/write permission on a stored handle. The
// browser drops the permission grant between sessions, so we can query
// silently but must call request() from a user gesture to escalate.
export async function verifyPermission(
  handle: FsHandle | null,
  request: boolean,
): Promise<boolean> {
  if (!handle) return false;
  const opts = { mode: "readwrite" as const };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  if (request && (await handle.requestPermission(opts)) === "granted") return true;
  return false;
}
