import { createFileRoute, Link, redirect } from "@tanstack/react-router";
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
import { CaptureScheduleSettings } from "@/components/capture-schedule-settings";
import { EdgeApiSettings } from "@/components/edge-api-settings";
import { PageTitle } from "@/components/page-shell";
import { commonMessages as c } from "@/i18n/common";
import { settingsMessages as m } from "@/i18n/settings";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/settings")({
  // Pola filename dan counter menentukan bentuk nama seluruh berkas foto yang
  // dihasilkan aplikasi ini, jadi mengubahnya berdampak ke arsip semua orang,
  // bukan ke satu operator saja.
  //
  // Akses folder simpan TIDAK ikut terkunci: halaman Capture punya pemilih
  // foldernya sendiri, jadi operator tetap bisa memberi izin folder di mesinnya
  // tanpa memanggil Super Admin.
  beforeLoad: ({ context }) => {
    if (context.user && context.user.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
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
    <div className="rounded-xl border bg-card shadow-sm p-4">
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
  const t = useT();
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
    () => analyzeFilenamePattern(prefs.pattern, t),
    [prefs.pattern, t],
  );
  const patternHealthLabel = !filenamePatternAnalysis.isValid
    ? t(m.patternInvalid)
    : filenamePatternAnalysis.warnings.length > 0
      ? t(m.patternNeedsReview)
      : t(m.patternReady);
  const dirStatusLabel =
    dirStatus === "granted"
      ? t(m.dirConnected)
      : dirStatus === "needs-action"
        ? t(m.dirPermissionRequired)
        : dirStatus === "unsupported"
          ? t(m.dirUnsupported)
          : dirStatus === "not-set"
            ? t(m.dirNotSet)
            : t(m.dirChecking);

  function updatePrefs<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((current) => ({ ...current, [key]: value }));
  }

  function persistCurrentPrefs() {
    if (!filenamePatternAnalysis.isValid) {
      toast.error(t(m.toastPatternInvalid), {
        description: t(m.toastPatternInvalidBody),
      });
      return;
    }
    savePrefs(prefs);
    setSavedPrefs(prefs);
    toast.success(t(m.toastSaved), {
      description: t(m.toastSavedBody),
    });
  }

  function resetPrefsToDefault() {
    savePrefs(DEFAULT_PREFS);
    setPrefs(DEFAULT_PREFS);
    setSavedPrefs(DEFAULT_PREFS);
    toast.success(t(m.toastReset), {
      description: t(m.toastResetBody),
    });
  }

  function resetCounterToStart() {
    setPrefs((current) => ({ ...current, counter: 1 }));
    toast.success(t(m.toastCounterReset), {
      description: t(m.toastCounterResetBody),
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
      toast.success(t(m.toastFolderPicked), {
        description: t(m.toastFolderPickedBody, { name: handle.name }),
      });
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error(t(m.toastPickFailed), {
          description: error instanceof Error ? error.message : t(m.unknownError),
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
        toast.success(t(m.toastPermissionRenewed), {
          description: t(m.toastPermissionRenewedBody, { name: dirName }),
        });
      } else {
        toast.error(t(m.toastPermissionDenied), {
          description: t(m.toastPermissionDeniedBody),
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
      toast.success(t(m.toastFolderForgotten), {
        description: t(m.toastFolderForgottenBody),
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageTitle title={t(c.navSettings)} description={t(m.description)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/capture"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t(m.openCapture)}
          </Link>
          <Link
            to="/storage"
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            {t(m.reviewStorage)}
          </Link>
        </div>
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title={t(m.saveFolder)}
          value={dirStatusLabel}
          description={dirName || t(m.noBrowserFolder)}
          icon={FolderOpen}
        />
        <SummaryCard
          title={t(m.filenamePreview)}
          value={<span className="font-mono text-sm">{filenamePreview}</span>}
          description={t(m.filenamePreviewCardHint)}
          icon={Settings2}
        />
        <SummaryCard
          title={t(m.patternHealth)}
          value={patternHealthLabel}
          description={
            !filenamePatternAnalysis.isValid
              ? t(m.patternHealthInvalid)
              : filenamePatternAnalysis.warnings.length > 0
                ? t(m.patternHealthWarnings)
                : t(m.patternHealthReady)
          }
          icon={filenamePatternAnalysis.isValid ? CheckCircle2 : AlertTriangle}
        />
        <SummaryCard
          title={t(m.counterStart)}
          value={String(prefs.counter).padStart(3, "0")}
          description={t(m.counterStartHint, { token: "{INDEX}" })}
          icon={RefreshCw}
        />
        <SummaryCard
          title={t(m.storageModel)}
          value={t(m.storageModelValue)}
          description={t(m.storageModelHint)}
          icon={HardDrive}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="rounded-xl border bg-card shadow-sm p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{t(m.capturePreferences)}</h2>
                <p className="text-sm text-muted-foreground">{t(m.capturePreferencesHint)}</p>
              </div>
              <div className="rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
                {isDirty ? t(m.unsavedChanges) : t(m.allSaved)}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t(m.defaultLocation)}
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
                  {t(m.fileExtension)}
                </label>
                <input
                  value={prefs.ext.toUpperCase()}
                  disabled
                  className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm opacity-70"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t(m.filenamePattern)}
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
                  {t(m.tokens, {
                    tokens:
                      "{DD} {MMMM} {MM} {YYYY} {HH} {mm} {ss} {LOCATION} {SOURCE} {INDEX} {TS}",
                  })}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t(m.counterStart)}
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
                  {t(m.resetCounter)}
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t(m.locationTokenPreview)}
                </label>
                <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                  {toLocationToken(prefs.location)}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border bg-background p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(m.filenamePreview)}
              </div>
              <div className="mt-2 break-all font-mono text-sm">{filenamePreview}</div>
              <p className="mt-2 text-xs text-muted-foreground">{t(m.filenamePreviewHint)}</p>
            </div>

            <div className="mt-4 rounded-lg border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(m.patternChecks)}
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
                {t(m.savePreferences)}
              </button>
              <button
                type="button"
                onClick={resetPrefsToDefault}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <RefreshCw className="h-4 w-4" />
                {t(m.resetToDefault)}
              </button>
            </div>
          </div>

          <CaptureScheduleSettings />
          <EdgeApiSettings />

          <div className="rounded-xl border bg-card shadow-sm p-5">
            <div className="mb-4 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">{t(m.savedFolderAccess)}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-background p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(m.currentFolder)}
                </div>
                <div className="mt-2 text-sm font-semibold">{dirName || t(m.noFolderSelected)}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t(m.currentFolderHint)}</p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(m.permissionState)}
                </div>
                <div className="mt-2 text-sm font-semibold">{dirStatusLabel}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t(m.permissionStateHint)}</p>
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
                {t(m.chooseFolder)}
              </button>
              <button
                type="button"
                onClick={() => void reconnectDirectoryPermission()}
                disabled={!dirHandle || busyAction === "permission"}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                {t(m.reconnectPermission)}
              </button>
              <button
                type="button"
                onClick={() => void forgetDirectoryPreference()}
                disabled={!dirHandle || busyAction === "clear"}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {t(m.forgetFolder)}
              </button>
            </div>

            {!supportsFS && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
                {t(m.fsUnsupported)}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-xl border bg-card shadow-sm p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">{t(m.howUsed)}</h2>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>{t(m.howUsedNaming)}</li>
              <li>{t(m.howUsedFolder)}</li>
              <li>{t(m.howUsedPermission)}</li>
            </ul>
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-5">
            <div className="mb-4 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">{t(m.operatorNotes)}</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border bg-background p-3">
                {t(m.noteIndex, { token: "{INDEX}" })}
              </div>
              <div className="rounded-lg border bg-background p-3">
                {t(m.noteLocationSource, { location: "{LOCATION}", source: "{SOURCE}" })}
              </div>
              <div className="rounded-lg border bg-background p-3">{t(m.noteStorage)}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
