import { useEffect, useMemo, useState } from "react";
import { FolderArchive, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { failureText } from "@/i18n/errors";
import { bulkDownloadMessages as m } from "@/i18n/gallery";
import type { CaptureTrack } from "@/lib/capture-schedule";
import { useT } from "@/lib/i18n";
import { createCaptureZipRequest } from "@/lib/media-access";
import { zipArchiveName, zipDateFolder } from "@/lib/zip-store";

/** Batas satu arsip; sama dengan batas serverFn dan batas muat galeri. */
export const BULK_DOWNLOAD_MAX = 1000;

export type BulkDownloadPhoto = {
  /** Null untuk salinan yang hanya ada di browser ini -- tidak bisa diarsipkan server. */
  recordId: number | null;
  filePath: string | null;
  capturedAt: number;
  plant: string | null;
  track: CaptureTrack;
  sizeBytes: number | null;
};

type Scope = "selected" | "filtered";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Arsipnya dimulai lewat form POST ke iframe tersembunyi, bukan `fetch`.
 *
 * `fetch` akan menampung seluruh arsip -- bisa beberapa GB -- di memori tab
 * sebelum bisa disimpan. Form membuat browser menanganinya sebagai unduhan
 * biasa: langsung ke disk, dengan kemajuan di daftar unduhan, dan tetap
 * berjalan walau dialog ini ditutup. iframe-nya menjaga halaman galeri tidak
 * ikut berpindah kalau server menjawab dengan pesan galat.
 *
 * Unduhan yang berhasil TIDAK memuat apa pun ke iframe -- browser langsung
 * menyimpannya. Jadi iframe yang ternyata memuat sebuah dokumen berarti server
 * menolak, dan teks dokumen itu adalah alasannya. Tanpa pemeriksaan ini dialog
 * akan mengumumkan "unduhan dimulai" untuk permintaan yang ditolak.
 */
function submitDownloadForm(
  action: string,
  fields: Record<string, string>,
  onRejected: (reason: string) => void,
) {
  // iframe baru setiap kali, dan yang lama dibiarkan: unduhan sebelumnya bisa
  // saja masih mengalir, dan tidak ada untungnya mengusik bingkainya.
  const frameName = `bulk-download-frame-${Date.now()}`;
  const frame = document.createElement("iframe");
  frame.name = frameName;
  frame.hidden = true;
  document.body.appendChild(frame);
  frame.addEventListener("load", () => {
    let reason = "";
    try {
      reason = frame.contentDocument?.body?.innerText.trim() ?? "";
    } catch {
      // Dokumen dari asal lain tidak bisa dibaca; itu bukan jawaban server ini.
    }
    // about:blank milik iframe baru juga memicu "load", dengan isi kosong.
    if (reason) onRejected(reason.slice(0, 300));
  });
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.target = frameName;
  form.hidden = true;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

/**
 * Unduhan massal: satu arsip ZIP, di dalamnya satu folder per tanggal.
 *
 * Dialognya ada untuk SATU hal -- memperlihatkan seberapa besar yang akan
 * ditarik sebelum ditarik. Satu foto ~11 MB dari folder jaringan; "semua hasil
 * filter" bisa berarti beberapa GB, dan itu layak diketahui sebelum menekan.
 */
export function BulkDownloadDialog({
  open,
  onOpenChange,
  selected,
  filtered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: BulkDownloadPhoto[];
  filtered: BulkDownloadPhoto[];
}) {
  const t = useT();
  const [scope, setScope] = useState<Scope>("filtered");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<{ count: number; skipped: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    // Yang dicentang adalah niat yang paling jelas; tanpa centang, seluruh
    // hasil filter.
    setScope(selected.length > 0 ? "selected" : "filtered");
    setError(null);
    setStarted(null);
    // Hanya saat dialog dibuka: mencentang ulang di belakang dialog tidak boleh
    // memindahkan pilihan yang sedang dilihat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const photos = scope === "selected" ? selected : filtered;
  const summary = useMemo(() => {
    const downloadable = photos.filter((photo) => photo.recordId != null);
    const perDate = new Map<string, number>();
    for (const photo of downloadable) {
      const date = zipDateFolder({
        filePath: photo.filePath ?? "",
        capturedAt: photo.capturedAt,
        plant: photo.plant,
      });
      perDate.set(date, (perDate.get(date) ?? 0) + 1);
    }
    const dates = [...perDate.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const known = downloadable.filter((photo) => photo.sizeBytes != null);
    return {
      ids: downloadable.map((photo) => photo.recordId as number),
      localOnly: photos.length - downloadable.length,
      dates,
      archiveName: zipArchiveName(dates.map(([date]) => date)),
      bytes: known.reduce((total, photo) => total + (photo.sizeBytes ?? 0), 0),
      sizeComplete: known.length === downloadable.length,
    };
  }, [photos]);

  const tooMany = summary.ids.length > BULK_DOWNLOAD_MAX;
  const canDownload = summary.ids.length > 0 && !tooMany && !busy;

  async function start() {
    if (!canDownload) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createCaptureZipRequest({ data: { recordIds: summary.ids } });
      if (!result.ok) {
        setError(failureText(t, result, m.requestFailed));
        return;
      }
      setStarted({ count: result.count, skipped: result.skipped });
      submitDownloadForm(result.action, result.fields, (reason) => {
        setStarted(null);
        setError(t(m.startFailed, { reason }));
      });
    } catch {
      setError(t(m.requestFailed));
    } finally {
      setBusy(false);
    }
  }

  const scopeOption = (value: Scope, label: string, count: number) => (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        scope === value ? "border-primary bg-primary/5" : "border-input"
      } ${count === 0 ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input
        type="radio"
        name="bulk-download-scope"
        value={value}
        checked={scope === value}
        disabled={count === 0 || busy}
        onChange={() => {
          setScope(value);
          setStarted(null);
          setError(null);
        }}
      />
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted-foreground">{t(m.photoCount, { count })}</span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderArchive className="h-4 w-4" /> {t(m.title)}
          </DialogTitle>
          <DialogDescription>{t(m.intro)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {scopeOption("selected", t(m.scopeSelected), selected.length)}
          {scopeOption("filtered", t(m.scopeFiltered), filtered.length)}
        </div>

        {summary.ids.length === 0 ? (
          <p className="rounded-md border border-dashed py-4 text-center text-sm text-muted-foreground">
            {t(m.nothing)}
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border bg-card px-3 py-2">
                <div className="text-[11px] text-muted-foreground">{t(m.statPhotos)}</div>
                <div className="text-lg font-semibold">{summary.ids.length}</div>
              </div>
              <div className="rounded-md border bg-card px-3 py-2">
                <div className="text-[11px] text-muted-foreground">{t(m.statFolders)}</div>
                <div className="text-lg font-semibold">{summary.dates.length}</div>
              </div>
              <div className="rounded-md border bg-card px-3 py-2">
                <div className="text-[11px] text-muted-foreground">{t(m.statSize)}</div>
                <div className="text-lg font-semibold">
                  {summary.bytes > 0
                    ? `${summary.sizeComplete ? "" : "≥ "}${formatSize(summary.bytes)}`
                    : "—"}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">
                {t(m.structureTitle)}
              </div>
              <div className="max-h-44 overflow-auto rounded-md border p-2 font-mono text-xs">
                <div className="font-semibold">{summary.archiveName}</div>
                {summary.dates.map(([date, count]) => (
                  <div key={date} className="flex justify-between gap-3 pl-4">
                    <span>{date}/</span>
                    <span className="text-muted-foreground">{t(m.photoCount, { count })}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t(m.structureHint)}</p>
            </div>

            {summary.localOnly > 0 && (
              <p className="text-xs text-muted-foreground">
                {t(m.localOnlySkipped, { count: summary.localOnly })}
              </p>
            )}
            {tooMany && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                {t(m.tooMany, { max: BULK_DOWNLOAD_MAX })}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {started && (
          <div className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm">
            <div className="font-medium">{t(m.started, { count: started.count })}</div>
            <div className="text-xs text-muted-foreground">{t(m.startedHint)}</div>
            {started.skipped > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {t(m.serverSkipped, { count: started.skipped })}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {t(m.close)}
          </button>
          <button
            type="button"
            onClick={() => void start()}
            disabled={!canDownload || !!started}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? t(m.preparing) : t(m.download)}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
