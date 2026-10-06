import { useEffect, useState } from "react";
import { FolderSync, Loader2 } from "lucide-react";

import { AppDatePicker } from "@/components/app-date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { failureText } from "@/i18n/errors";
import { shareSyncMessages as m } from "@/i18n/gallery";
import { useLocale, useT, type Message } from "@/lib/i18n";
import { toIsoDate } from "@/lib/iso-date";
import {
  SHARE_SYNC_MAX_NEW_FILES,
  SHARE_SYNC_MAX_RANGE_DAYS,
  syncShareFolder,
  validateShareSyncRange,
  type ShareSkipReason,
  type ShareSyncReport,
} from "@/lib/share-import";

const REASON_MESSAGES: Record<ShareSkipReason, Message> = {
  UNSUPPORTED_TYPE: m.reasonUnsupportedType,
  NO_DEVICE: m.reasonNoDevice,
  PATH_TOO_LONG: m.reasonPathTooLong,
};

/** Rentang bawaan: tujuh hari terakhir, termasuk hari ini. */
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  return { from: toIsoDate(start), to: toIsoDate(today) };
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold ${tone === "warn" && value > 0 ? "text-amber-600" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * "Sinkronkan folder" -- mendaftarkan foto yang ditaruh langsung di folder
 * jaringan supaya tampil di Gallery.
 *
 * Dua langkah, dan urutannya disengaja: PERIKSA dulu (tidak menulis apa pun),
 * baru DAFTARKAN. Mendaftarkan berarti menulis baris registry untuk berkas
 * yang tidak pernah dilihat aplikasi, jadi orangnya perlu melihat daftarnya
 * sebelum itu terjadi -- terutama saat ada yang menyalin satu folder penuh ke
 * tempat yang salah.
 */
export function ShareSyncDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dipanggil setelah ada berkas yang terdaftar, supaya Gallery memuat ulang. */
  onImported: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<"check" | "apply" | null>(null);
  const [report, setReport] = useState<ShareSyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const range = defaultRange();
    setFrom(range.from);
    setTo(range.to);
    setReport(null);
    setError(null);
  }, [open]);

  const rangeValid = validateShareSyncRange(from, to) === null;
  const timeFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  async function run(apply: boolean) {
    if (busy || !rangeValid) return;
    setBusy(apply ? "apply" : "check");
    setError(null);
    try {
      const result = await syncShareFolder({ data: { from, to, apply } });
      if (!result.ok) {
        setError(failureText(t, result, m.requestFailed));
        return;
      }
      setReport(result);
      if (apply && result.imported > 0) onImported();
    } catch {
      setError(t(m.requestFailed));
    } finally {
      setBusy(null);
    }
  }

  // Mengubah rentang membuat pratinjau yang tampil tidak lagi menggambarkan
  // apa yang akan didaftarkan, jadi pratinjaunya dibuang.
  function changeRange(next: { from?: string; to?: string }) {
    if (next.from !== undefined) setFrom(next.from);
    if (next.to !== undefined) setTo(next.to);
    setReport(null);
    setError(null);
  }

  const foldersFound = report?.folders.filter((folder) => folder.found).length ?? 0;
  const foldersNotFound = report?.folders.filter((folder) => !folder.found) ?? [];
  const canRegister = !!report && !report.applied && report.candidateCount > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Menutup di tengah pendaftaran tidak membatalkannya di server; yang
        // hilang hanya laporannya. Lebih baik ditahan sampai selesai.
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderSync className="h-4 w-4" /> {t(m.title)}
          </DialogTitle>
          <DialogDescription>{t(m.intro)}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t(m.from)}
            </label>
            <AppDatePicker
              value={from}
              onValueChange={(value) => changeRange({ from: value })}
              ariaLabel={t(m.from)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t(m.to)}
            </label>
            <AppDatePicker
              value={to}
              onValueChange={(value) => changeRange({ to: value })}
              ariaLabel={t(m.to)}
            />
          </div>
        </div>
        <p className={`text-xs ${rangeValid ? "text-muted-foreground" : "text-destructive"}`}>
          {rangeValid
            ? t(m.rangeHint, { max: SHARE_SYNC_MAX_RANGE_DAYS })
            : t(m.rangeInvalid, { max: SHARE_SYNC_MAX_RANGE_DAYS })}
        </p>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {report && (
          <div className="space-y-4 text-sm">
            {report.applied && (
              <div className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 font-medium">
                {report.imported > 0
                  ? t(m.doneImported, { count: report.imported })
                  : t(m.doneNone)}
              </div>
            )}

            <p className="text-muted-foreground">
              {t(m.summarySeen, { seen: report.filesSeen, folders: foldersFound })}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={t(m.statNew)} value={report.candidateCount} />
              <Stat label={t(m.statRegistered)} value={report.alreadyRegistered} />
              <Stat label={t(m.statSkipped)} value={report.skippedCount} tone="warn" />
              <Stat label={t(m.statMissing)} value={report.missingCount} tone="warn" />
            </div>

            {foldersNotFound.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t(m.foldersMissing, {
                  folders: foldersNotFound.map((folder) => folder.folder).join(", "),
                })}
              </p>
            )}

            {report.truncated && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                {t(m.truncated, { max: SHARE_SYNC_MAX_NEW_FILES })}
              </div>
            )}

            {!report.applied && report.candidateCount === 0 && (
              <p className="rounded-md border border-dashed py-4 text-center text-muted-foreground">
                {t(m.nothingNew)}
              </p>
            )}

            {report.candidates.length > 0 && !report.applied && (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground">
                  {t(m.newFilesTitle)}
                </h3>
                <div className="max-h-56 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                      <tr>
                        <th className="p-2">{t(m.colFile)}</th>
                        <th className="p-2">{t(m.colSession)}</th>
                        <th className="p-2">{t(m.colSlot)}</th>
                        <th className="p-2">{t(m.colTime)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.candidates.map((item) => (
                        <tr key={item.relativePath} className="border-t">
                          <td className="break-all p-2 font-mono">{item.relativePath}</td>
                          <td className="p-2">{item.session ?? "—"}</td>
                          <td className="p-2">{item.captureBin ?? "—"}</td>
                          <td className="whitespace-nowrap p-2">
                            {timeFormat.format(item.capturedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {report.candidateCount > report.candidates.length && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(m.moreRows, { count: report.candidateCount - report.candidates.length })}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{t(m.consequence)}</p>
              </section>
            )}

            {report.failed.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-destructive">
                  {t(m.failedTitle, { count: report.failed.length })}
                </h3>
                <ul className="max-h-32 space-y-1 overflow-auto rounded-md border p-2 text-xs">
                  {report.failed.map((item) => (
                    <li key={item.relativePath}>
                      <span className="break-all font-mono">{item.relativePath}</span>
                      <span className="text-muted-foreground"> — {item.message}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {report.skippedCount > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground">
                  {t(m.skippedTitle, { count: report.skippedCount })}
                </h3>
                <ul className="max-h-32 space-y-1 overflow-auto rounded-md border p-2 text-xs">
                  {report.skipped.map((item) => (
                    <li key={item.relativePath}>
                      <span className="break-all font-mono">{item.relativePath}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {t(REASON_MESSAGES[item.reason])}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {report.otherFolders.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground">
                  {t(m.otherFoldersTitle, { count: report.otherFolders.length })}
                </h3>
                <p className="mb-1 text-xs text-muted-foreground">{t(m.otherFoldersHint)}</p>
                <ul className="max-h-24 space-y-1 overflow-auto rounded-md border p-2 font-mono text-xs">
                  {report.otherFolders.map((folder) => (
                    <li key={folder} className="break-all">
                      {folder}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {report.missingCount > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground">
                  {t(m.missingTitle, { count: report.missingCount })}
                </h3>
                <p className="mb-1 text-xs text-muted-foreground">{t(m.missingHint)}</p>
                <ul className="max-h-24 space-y-1 overflow-auto rounded-md border p-2 font-mono text-xs">
                  {report.missing.map((item) => (
                    <li key={item.recordId} className="break-all">
                      {item.relativePath}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={!!busy}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {t(m.close)}
          </button>
          <button
            type="button"
            onClick={() => void run(false)}
            disabled={!!busy || !rangeValid}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {busy === "check" && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy === "check" ? t(m.checking) : t(m.check)}
          </button>
          {canRegister && (
            <button
              type="button"
              onClick={() => void run(true)}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy === "apply" && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy === "apply"
                ? t(m.registering)
                : t(m.register, { count: report.candidateCount })}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
