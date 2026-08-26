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
  // Each preview frame is a real USB round trip (~1s, see
  // CAMERA_PREVIEW_POLLING.md), so the loop stays off until the operator asks
  // for it -- an idle tab should not keep the camera working for nobody.
  livePreview: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  location: PLANTS[0],
  // e.g. "02.00 Train 1" -> jam sesi sampling, lalu slotnya.
  //
  // Tanggal dan plant sengaja TIDAK ikut: keduanya sudah menjadi folder
  // (.../Acid Plant/2026/08/25/), jadi mengulanginya di nama berkas hanya
  // memanjangkan tanpa menambah keterangan. Waktu capture yang sebenarnya
  // tetap tersimpan di kolom captured_at, bukan di nama berkas.
  pattern: "{SESSION} {SLOT}",
  ext: "jpg",
  counter: 1,
  livePreview: false,
};

// Pola bawaan sebelum skema sesi dipakai. Disimpan supaya migrasi di
// loadPrefs() bisa mengenali operator yang tidak pernah menyesuaikan polanya.
const LEGACY_DEFAULT_PATTERN = "{DD} {MMMM} {YYYY} {HH}.{mm} {LOCATION} {SOURCE}";

export const FILENAME_PATTERN_TOKENS = [
  "SESSION",
  "SLOT",
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
  const hasSession = recognizedTokens.includes("SESSION");
  // {SLOT} dan {SOURCE} sama-sama membedakan kedua slot; yang pertama berbentuk
  // "Train 1", yang kedua "TRAIN1". Cukup salah satu.
  const hasSource = recognizedTokens.includes("SOURCE") || recognizedTokens.includes("SLOT");
  const hasIndex = recognizedTokens.includes("INDEX");
  const hasTimestamp = recognizedTokens.some((token) => token === "TS" || token === "ss");
  const hasCollisionRisk = !hasIndex && !hasTimestamp;

  // Plant sudah menjadi folder tersendiri di tujuan simpan, jadi {LOCATION}
  // hanya perlu disarankan untuk pola yang tidak memakai skema sesi -- pada
  // pola sesi ia cuma pengulangan yang memanjangkan nama.
  if (!hasLocation && !hasSession) {
    suggestions.push("Tambahkan `{LOCATION}` agar file mudah diaudit per plant.");
  }
  if (!hasSource) {
    suggestions.push(
      "Tambahkan `{SLOT}` agar operator bisa membedakan kedua slot capture dari nama file.",
    );
  }
  if (hasCollisionRisk && hasSession && hasSource) {
    // Pada skema sesi, nama ganda itu DISENGAJA: satu sesi memang hanya punya
    // satu berkas per slot. Capture ulang untuk sesi yang sama akan menjadi
    // "(2)" -- keduanya tersimpan, dan yang mana yang dipakai ditentukan dari
    // waktu capture di Gallery, bukan dari nama berkas.
    warnings.push(
      "Capture ulang pada sesi dan slot yang sama akan tersimpan sebagai `(2)`; keduanya disimpan, tidak ada yang tertimpa.",
    );
  } else if (hasCollisionRisk) {
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
    const stored = { ...DEFAULT_PREFS, ...JSON.parse(raw) } as Prefs;

    // Naikkan pola bawaan lama ke skema sesi. Preferensi tersimpan per browser,
    // jadi mengganti DEFAULT_PREFS saja tidak menyentuh operator yang sudah
    // pernah membuka halaman Capture -- mereka akan tetap memakai pola lama
    // tanpa pernah tahu ada yang berubah.
    //
    // Hanya pola yang PERSIS bawaan lama yang diganti. Pola yang pernah
    // disesuaikan sendiri dibiarkan: itu pilihan sadar seseorang, dan
    // menimpanya diam-diam lebih buruk daripada tidak seragam.
    if (stored.pattern === LEGACY_DEFAULT_PATTERN) {
      return { ...stored, pattern: DEFAULT_PREFS.pattern };
    }
    return stored;
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
