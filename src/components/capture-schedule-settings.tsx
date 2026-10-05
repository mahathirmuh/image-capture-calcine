import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PLANTS } from "@/lib/locations";
import { fetchCaptureSchedules, updateCaptureSchedule } from "@/lib/capture-schedules";
import {
  scheduleForDate,
  scheduleHours,
  scheduleValidation,
  shiftDate,
  plantToday,
  SCHEDULE_INTERVALS,
  SCHEDULE_TIMEZONES,
  type ScheduleSnapshot,
  type ScheduleVersion,
} from "@/lib/capture-schedule";
import {
  Select as ScheduleSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CaptureScheduleSettings() {
  const [snapshot, setSnapshot] = useState<ScheduleSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [plant, setPlant] = useState<string>(PLANTS[0]);
  const [draft, setDraft] = useState<ScheduleVersion | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const generation = useRef(0);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    fetchCaptureSchedules()
      .then((data) => {
        if (!cancelled) {
          setSnapshot(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);
  useEffect(() => {
    if (!snapshot || dirty) return;
    const tomorrow = shiftDate(plantToday(snapshot.versions, plant, snapshot.serverNow), 1);
    setDraft((current) => {
      const date =
        current?.plant === plant && current.effectiveDate >= tomorrow
          ? current.effectiveDate
          : tomorrow;
      return { ...scheduleForDate(snapshot.versions, plant, date), effectiveDate: date };
    });
    setDirty(false);
  }, [snapshot, plant, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const update = (values: Partial<ScheduleVersion>) => {
    setDraft((d) => (d ? { ...d, ...values } : d));
    setDirty(true);
  };
  const hours = draft && !scheduleValidation(draft) ? scheduleHours(draft) : [];
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !snapshot || saving || loading) return;
    const invalid = scheduleValidation(draft);
    if (invalid) {
      setError(invalid);
      setTimeout(() => {
        const target = document.getElementById(
          draft.windowMinutes < 1 || draft.windowMinutes > draft.intervalHours * 60
            ? "schedule-window"
            : "schedule-date",
        );
        target?.focus();
      }, 0);
      return;
    }
    const token = ++generation.current;
    setSaving(true);
    setError(null);
    try {
      const next = await updateCaptureSchedule({
        data: {
          plant,
          startHour: draft.startHour,
          intervalHours: draft.intervalHours,
          windowMinutes: draft.windowMinutes,
          timezone: draft.timezone,
          effectiveDate: draft.effectiveDate,
          expectedRevision: snapshot.revision,
        },
      });
      if (token === generation.current) {
        setDirty(false);
        setSnapshot(next);
        toast.success("Jadwal capture disimpan");
      }
    } catch (e) {
      if (token === generation.current) {
        setError((e as Error).message);
        setTimeout(() => errorRef.current?.focus(), 0);
      }
    } finally {
      if (token === generation.current) setSaving(false);
    }
  }
  return (
    <section
      className="rounded-xl border bg-card shadow-sm p-5"
      aria-labelledby="capture-schedule-title"
    >
      <h2 id="capture-schedule-title" className="text-base font-semibold">
        Jadwal capture per plant
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Atur sesi sampling manual. Perubahan berlaku mulai tanggal yang dipilih; jadwal historis
        tetap disimpan.
      </p>
      {error && (
        <p
          id="schedule-error"
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {error && snapshot && (
        <button
          type="button"
          onClick={() => setReload((value) => value + 1)}
          disabled={saving || loading}
          className="mt-3 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          Muat ulang jadwal
        </button>
      )}
      {loading && snapshot && (
        <p role="status" className="mt-3 text-sm">
          Memuat ulang jadwal…
        </p>
      )}
      {!snapshot ? (
        <div className="mt-3" role="status">
          {error ? (
            <button
              type="button"
              onClick={() => setReload((x) => x + 1)}
              className="rounded-md border px-3 py-2"
            >
              Muat ulang jadwal
            </button>
          ) : (
            "Memuat jadwal…"
          )}
        </div>
      ) : (
        draft && (
          <form noValidate onSubmit={save} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label id="schedule-plant-label" className="text-sm font-medium">
                  Plant
                </label>
                <ScheduleSelect
                  value={plant}
                  onValueChange={setPlant}
                  disabled={saving || loading || dirty}
                >
                  <SelectTrigger aria-labelledby="schedule-plant-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANTS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </ScheduleSelect>
                {dirty && (
                  <p className="text-xs text-muted-foreground">
                    Simpan atau batalkan sebelum pindah plant.
                  </p>
                )}
              </div>
              <div>
                <label id="schedule-start-label" className="text-sm font-medium">
                  Jam mulai
                </label>
                <ScheduleSelect
                  value={String(draft.startHour)}
                  onValueChange={(v) => update({ startHour: Number(v) })}
                  disabled={saving || loading}
                >
                  <SelectTrigger aria-labelledby="schedule-start-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </ScheduleSelect>
              </div>
              <div>
                <label id="schedule-interval-label" className="text-sm font-medium">
                  Interval sesi
                </label>
                <ScheduleSelect
                  value={String(draft.intervalHours)}
                  onValueChange={(v) =>
                    update({
                      intervalHours: Number(v),
                      windowMinutes: Math.min(draft.windowMinutes, Number(v) * 60),
                    })
                  }
                  disabled={saving || loading}
                >
                  <SelectTrigger aria-labelledby="schedule-interval-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_INTERVALS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        Setiap {h} jam
                      </SelectItem>
                    ))}
                  </SelectContent>
                </ScheduleSelect>
              </div>
              <div>
                <label htmlFor="schedule-window" className="text-sm font-medium">
                  Jendela capture (menit)
                </label>
                <input
                  id="schedule-window"
                  aria-invalid={
                    draft.windowMinutes < 1 || draft.windowMinutes > draft.intervalHours * 60
                  }
                  aria-describedby={error ? "schedule-error" : undefined}
                  type="number"
                  min={1}
                  max={draft.intervalHours * 60}
                  value={draft.windowMinutes}
                  disabled={saving || loading}
                  onChange={(e) => update({ windowMinutes: Number(e.target.value) })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label id="schedule-zone-label" className="text-sm font-medium">
                  Timezone plant
                </label>
                <ScheduleSelect
                  value={draft.timezone}
                  onValueChange={(v) => update({ timezone: v })}
                  disabled={saving || loading}
                >
                  <SelectTrigger aria-labelledby="schedule-zone-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_TIMEZONES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </ScheduleSelect>
              </div>
              <div>
                <label htmlFor="schedule-date" className="text-sm font-medium">
                  Mulai berlaku (YYYY-MM-DD)
                </label>
                <input
                  id="schedule-date"
                  aria-describedby={error ? "schedule-error" : undefined}
                  type="text"
                  inputMode="numeric"
                  placeholder="YYYY-MM-DD"
                  value={draft.effectiveDate}
                  disabled={saving || loading}
                  onChange={(e) => update({ effectiveDate: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3" aria-live="polite">
              <p className="text-sm font-medium">
                Preview: {hours.length} sesi · {hours.length * 2} foto per hari
              </p>
              <p className="mt-1 text-sm">
                {hours.map((h) => `${String(h).padStart(2, "0")}:00`).join(" · ") ||
                  "Perbaiki pengaturan untuk melihat preview."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Jam ditampilkan sesuai timezone plant. Jendela yang melewati tengah malam tetap
                milik tanggal awal sesi.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || loading || !dirty}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Menyimpan…" : "Simpan jadwal"}
              </button>
              <button
                type="button"
                disabled={saving || loading || !dirty}
                onClick={() => {
                  const date = shiftDate(
                    plantToday(snapshot.versions, plant, snapshot.serverNow),
                    1,
                  );
                  setDraft({
                    ...scheduleForDate(snapshot.versions, plant, date),
                    effectiveDate: date,
                  });
                  setDirty(false);
                  setError(null);
                }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                Batalkan perubahan
              </button>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                Riwayat jadwal ({snapshot.versions.filter((v) => v.plant === plant).length})
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {snapshot.versions
                  .filter((v) => v.plant === plant)
                  .map((v) => (
                    <li key={v.id}>
                      {v.effectiveDate} — setiap {v.intervalHours} jam, mulai{" "}
                      {String(v.startHour).padStart(2, "0")}:00, jendela {v.windowMinutes} menit ·{" "}
                      {v.timezone}
                    </li>
                  ))}
              </ul>
            </details>
          </form>
        )
      )}
    </section>
  );
}
