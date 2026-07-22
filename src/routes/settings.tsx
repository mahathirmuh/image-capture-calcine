import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  HardDrive,
  KeyRound,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  analyzeFilenamePattern,
  clearDirHandle,
  DEFAULT_PREFS,
  loadDirHandle,
  loadPrefs,
  saveDirHandle,
  savePrefs,
  verifyPermission,
  type Prefs,
} from "@/lib/capture-prefs";
import { PLANTS, toLocationToken } from "@/lib/locations";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — Capture App" },
      { name: "description", content: "Application settings and preferences." },
      { property: "og:title", content: "Settings — Capture App" },
      { property: "og:description", content: "Application settings and preferences." },
    ],
  }),
});

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type DirHandle = FileSystemDirectoryHandle;
type DirStatus = "checking" | "unsupported" | "not-set" | "granted" | "needs-action";

function formatFilenamePreview(pattern: string, index: number, location: string, source: string) {
  const now = new Date();
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  const tokens: Record<string, string> = {
    YYYY: String(now.getFullYear()),
    MMMM: MONTH_NAMES[now.getMonth()],
    MM: pad(now.getMonth() + 1),
    DD: pad(now.getDate()),
    HH: pad(now.getHours()),
    mm: pad(now.getMinutes()),
    ss: pad(now.getSeconds()),
    INDEX: pad(index, 3),
    TS: String(Date.now()),
    LOCATION: location || "UNKNOWN",
    SOURCE: source,
  };
  let output = pattern;
  for (const [token, value] of Object.entries(tokens)) {
    output = output.replaceAll(`{${token}}`, value);
  }
  return output;
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: React.ReactNode;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [savedPrefs, setSavedPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [supportsFS, setSupportsFS] = useState(false);
  const [dirHandle, setDirHandle] = useState<DirHandle | null>(null);
  const [dirName, setDirName] = useState("");
  const [dirStatus, setDirStatus] = useState<DirStatus>("checking");
  const [busyAction, setBusyAction] = useState<"save" | "pick" | "permission" | "clear" | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const initialPrefs = loadPrefs();
    setPrefs(initialPrefs);
    setSavedPrefs(initialPrefs);
    setSupportsFS("showDirectoryPicker" in window);

    async function hydrateDirectory() {
      if (!("showDirectoryPicker" in window)) {
        if (!cancelled) setDirStatus("unsupported");
        return;
      }
      const storedHandle = await loadDirHandle();
      if (cancelled) return;
      if (!storedHandle) {
        setDirStatus("not-set");
        return;
      }
      const permissionGranted = await verifyPermission(storedHandle, false);
      if (cancelled) return;
      setDirHandle(storedHandle);
      setDirName(storedHandle.name);
      setDirStatus(permissionGranted ? "granted" : "needs-action");
    }

    void hydrateDirectory().finally(() => {
      if (!cancelled) setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const isDirty = JSON.stringify(prefs) !== JSON.stringify(savedPrefs);
  const filenamePreview = useMemo(
    () =>
      `${formatFilenamePreview(
        prefs.pattern,
        prefs.counter,
        toLocationToken(prefs.location),
        "BIN1",
      )}.${prefs.ext}`,
    [prefs.counter, prefs.ext, prefs.location, prefs.pattern],
  );
  const filenamePatternAnalysis = useMemo(
    () => analyzeFilenamePattern(prefs.pattern),
    [prefs.pattern],
  );
  const patternHealthLabel = !filenamePatternAnalysis.isValid
    ? "Invalid"
    : filenamePatternAnalysis.warnings.length > 0
      ? "Needs review"
      : "Ready";
  const dirStatusLabel =
    dirStatus === "granted"
      ? "Connected"
      : dirStatus === "needs-action"
        ? "Permission required"
        : dirStatus === "unsupported"
          ? "Unsupported"
          : dirStatus === "not-set"
            ? "Not set"
            : "Checking...";

  function updatePrefs<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((current) => ({ ...current, [key]: value }));
  }

  function persistCurrentPrefs() {
    if (!filenamePatternAnalysis.isValid) {
      toast.error("Pattern filename belum valid", {
        description: "Perbaiki token yang tidak dikenal atau pattern kosong sebelum menyimpan.",
      });
      return;
    }
    savePrefs(prefs);
    setSavedPrefs(prefs);
    toast.success("Preferences berhasil disimpan", {
      description: "Perubahan akan dipakai oleh halaman Capture pada sesi berikutnya.",
    });
  }

  function resetPrefsToDefault() {
    savePrefs(DEFAULT_PREFS);
    setPrefs(DEFAULT_PREFS);
    setSavedPrefs(DEFAULT_PREFS);
    toast.success("Preferences direset ke default", {
      description: "Pattern filename dan counter kembali ke konfigurasi standar.",
    });
  }

  function resetCounterToStart() {
    setPrefs((current) => ({ ...current, counter: 1 }));
    toast.success("Counter dikembalikan ke 001", {
      description: "Perubahan masih lokal sampai Anda menekan save preferences.",
    });
  }

  async function pickDirectory() {
    if (!supportsFS) return;
    setBusyAction("pick");
    try {
      // @ts-expect-error File System Access API
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      setDirHandle(handle);
      setDirName(handle.name);
      setDirStatus("granted");
      await saveDirHandle(handle);
      toast.success("Folder simpan berhasil dipilih", {
        description: `${handle.name} akan tersedia untuk halaman Capture.`,
      });
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error("Gagal memilih folder", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function reconnectDirectoryPermission() {
    if (!dirHandle) return;
    setBusyAction("permission");
    try {
      const granted = await verifyPermission(dirHandle, true);
      setDirStatus(granted ? "granted" : "needs-action");
      if (granted) {
        toast.success("Izin folder berhasil diperbarui", {
          description: `${dirName} siap dipakai kembali dari halaman Capture.`,
        });
      } else {
        toast.error("Izin folder belum diberikan", {
          description: "Browser masih menolak akses baca/tulis ke folder tersimpan.",
        });
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function forgetDirectoryPreference() {
    setBusyAction("clear");
    try {
      setDirHandle(null);
      setDirName("");
      setDirStatus("not-set");
      await clearDirHandle();
      toast.success("Folder simpan dilupakan", {
        description: "Capture akan kembali memakai folder picker atau fallback browser download.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Kelola preference operator, preview filename, dan akses folder simpan yang dipakai
            halaman Capture.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/capture"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open Capture
          </Link>
          <Link
            to="/storage"
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Review Storage
          </Link>
        </div>
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Save Folder"
          value={dirStatusLabel}
          description={dirName || "Belum ada folder browser yang disimpan"}
          icon={FolderOpen}
        />
        <SummaryCard
          title="Filename Preview"
          value={<span className="font-mono text-sm">{filenamePreview}</span>}
          description="Preview memakai lokasi aktif dan source contoh BIN1"
          icon={Settings2}
        />
        <SummaryCard
          title="Pattern Health"
          value={patternHealthLabel}
          description={
            !filenamePatternAnalysis.isValid
              ? "Ada token tidak valid atau pattern kosong"
              : filenamePatternAnalysis.warnings.length > 0
                ? "Pattern masih bisa dipakai, tetapi ada catatan operator"
                : "Pattern siap dipakai tanpa catatan tambahan"
          }
          icon={filenamePatternAnalysis.isValid ? CheckCircle2 : AlertTriangle}
        />
        <SummaryCard
          title="Counter Start"
          value={String(prefs.counter).padStart(3, "0")}
          description="Dipakai untuk token {INDEX} pada penamaan file"
          icon={RefreshCw}
        />
        <SummaryCard
          title="Storage Model"
          value="Browser + IndexedDB"
          description="Preference tersimpan lokal; handle folder disimpan via IndexedDB"
          icon={HardDrive}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Capture Preferences</h2>
                <p className="text-sm text-muted-foreground">
                  Ubah preference default yang akan dipakai operator saat membuka halaman Capture.
                </p>
              </div>
              <div className="rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
                {isDirty ? "Ada perubahan belum disimpan" : "Semua perubahan sudah tersimpan"}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Default Location
                </label>
                <select
                  value={prefs.location}
                  onChange={(event) => updatePrefs("location", event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PLANTS.map((plant) => (
                    <option key={plant} value={plant}>
                      {plant}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  File Extension
                </label>
                <input
                  value={prefs.ext.toUpperCase()}
                  disabled
                  className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm opacity-70"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Filename Pattern
                </label>
                <input
                  value={prefs.pattern}
                  onChange={(event) => updatePrefs("pattern", event.target.value)}
                  className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                    filenamePatternAnalysis.isValid
                      ? "border-input"
                      : "border-destructive/50 focus-visible:outline-destructive"
                  }`}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Tokens:{" "}
                  {"{DD} {MMMM} {MM} {YYYY} {HH} {mm} {ss} {LOCATION} {SOURCE} {INDEX} {TS}"}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Counter Start
                </label>
                <input
                  type="number"
                  min={1}
                  value={prefs.counter}
                  onChange={(event) =>
                    updatePrefs("counter", Math.max(1, Number(event.target.value) || 1))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={resetCounterToStart}
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                >
                  Reset counter to 001
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Location Token Preview
                </label>
                <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                  {toLocationToken(prefs.location)}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border bg-background p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Filename Preview
              </div>
              <div className="mt-2 break-all font-mono text-sm">{filenamePreview}</div>
              <p className="mt-2 text-xs text-muted-foreground">
                Preview menggunakan waktu saat ini, lokasi aktif, dan source contoh `BIN1`.
              </p>
            </div>

            <div className="mt-4 rounded-lg border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pattern Checks
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    !filenamePatternAnalysis.isValid
                      ? "bg-destructive/10 text-destructive"
                      : filenamePatternAnalysis.warnings.length > 0
                        ? "bg-amber-500/10 text-amber-700"
                        : "bg-emerald-500/10 text-emerald-700"
                  }`}
                >
                  {patternHealthLabel}
                </span>
              </div>

              {filenamePatternAnalysis.recognizedTokens.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {filenamePatternAnalysis.recognizedTokens.map((token) => (
                    <span
                      key={token}
                      className="rounded-full border border-input bg-card px-2.5 py-1 text-[11px]"
                    >
                      {`{${token}}`}
                    </span>
                  ))}
                </div>
              )}

              {filenamePatternAnalysis.errors.length > 0 && (
                <div className="space-y-2">
                  {filenamePatternAnalysis.errors.map((message) => (
                    <div
                      key={message}
                      className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                    >
                      {message}
                    </div>
                  ))}
                </div>
              )}

              {filenamePatternAnalysis.warnings.length > 0 && (
                <div className="mt-3 space-y-2">
                  {filenamePatternAnalysis.warnings.map((message) => (
                    <div
                      key={message}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800"
                    >
                      {message}
                    </div>
                  ))}
                </div>
              )}

              {filenamePatternAnalysis.suggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {filenamePatternAnalysis.suggestions.map((message) => (
                    <div
                      key={message}
                      className="rounded-lg border border-input bg-card p-3 text-sm text-muted-foreground"
                    >
                      {message}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={persistCurrentPrefs}
                disabled={
                  !loaded || !isDirty || busyAction === "save" || !filenamePatternAnalysis.isValid
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                Save preferences
              </button>
              <button
                type="button"
                onClick={resetPrefsToDefault}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <RefreshCw className="h-4 w-4" />
                Reset to default
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Saved Folder Access</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-background p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Current folder
                </div>
                <div className="mt-2 text-sm font-semibold">{dirName || "No folder selected"}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pilihan ini dipakai sebagai fallback save di browser bila auto-save tidak
                  tersedia.
                </p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Permission state
                </div>
                <div className="mt-2 text-sm font-semibold">{dirStatusLabel}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Browser bisa meminta ulang izin baca/tulis setelah restart sesi atau tab.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void pickDirectory()}
                disabled={!supportsFS || busyAction === "pick"}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FolderOpen className="h-4 w-4" />
                Choose folder
              </button>
              <button
                type="button"
                onClick={() => void reconnectDirectoryPermission()}
                disabled={!dirHandle || busyAction === "permission"}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                Reconnect permission
              </button>
              <button
                type="button"
                onClick={() => void forgetDirectoryPreference()}
                disabled={!dirHandle || busyAction === "clear"}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Forget folder
              </button>
            </div>

            {!supportsFS && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
                Browser ini tidak mendukung File System Access API. Capture akan mengandalkan
                network save atau browser download biasa.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">How Preferences Are Used</h2>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                `location`, `pattern`, dan `counter` dibaca halaman Capture untuk membentuk nama
                file saat save dilakukan.
              </li>
              <li>
                Folder tersimpan hanya berlaku di browser/operator ini karena permission dikelola
                oleh browser, bukan oleh backend.
              </li>
              <li>
                Jika folder tersimpan tidak lagi punya izin, operator harus menekan `Reconnect
                permission` atau memilih folder ulang.
              </li>
            </ul>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Operator Notes</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border bg-background p-3">
                Gunakan token `{"{INDEX}"}` bila Anda ingin urutan file tetap terlihat jelas saat
                ada banyak capture berurutan.
              </div>
              <div className="rounded-lg border bg-background p-3">
                Gunakan token `{"{LOCATION}"}` dan `{"{SOURCE}"}` untuk menjaga nama file tetap
                mudah diaudit per plant dan per bin.
              </div>
              <div className="rounded-lg border bg-background p-3">
                Untuk troubleshooting export jaringan, cek halaman `Storage` setelah mengganti
                folder atau environment.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
