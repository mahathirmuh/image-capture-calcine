import { CheckCircle2, Loader2, Plug, RefreshCw, Save, TriangleAlert, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listEdgeTargets,
  saveEdgeApiUrl,
  testEdgeConnection,
  type EdgeProbeResult,
  type EdgeTargetRow,
} from "@/lib/edge-targets";
import { failureText } from "@/i18n/errors";
import { edgeApiMessages as m } from "@/i18n/settings";
import { useRichT, useT } from "@/lib/i18n";

type ProbeState = Extract<EdgeProbeResult, { ok: true }> | null;

// Kegagalan memuat disimpan apa adanya, bukan sebagai teks jadi: teksnya baru
// dibentuk saat render, sehingga refresh() tidak bergantung pada bahasa dan
// mengganti bahasa tidak memuat ulang daftar (yang akan membuang alamat yang
// sedang diketik).
type LoadFailure = { code?: string | null; message: string | null };

/**
 * Daftar alamat Edge API per device.
 *
 * Ditaruh di Settings, bukan sebagai menu tersendiri: alamat API itu properti
 * sebuah device, dan menu terpisah akan menjadi daftar kedua berisi mesin yang
 * sama. Dua daftar untuk hal yang sama pasti berbeda isi cepat atau lambat.
 */
export function EdgeApiSettings() {
  const [devices, setDevices] = useState<EdgeTargetRow[] | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [tokenSet, setTokenSet] = useState(false);
  const [loadError, setLoadError] = useState<LoadFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useT();
  const rich = useRichT();

  const [draft, setDraft] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [probe, setProbe] = useState<Record<number, ProbeState>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listEdgeTargets();
      if (!result.ok) {
        setLoadError(result);
        setDevices(null);
        return;
      }
      setDevices(result.devices);
      setFallbackUrl(result.fallbackUrl);
      setTokenSet(result.tokenSet);
      setDraft(Object.fromEntries(result.devices.map((d) => [d.id, d.edgeApiUrl ?? ""])));
      setLoadError(null);
    } catch (error) {
      setLoadError({ message: error instanceof Error ? error.message : null });
      setDevices(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSave(device: EdgeTargetRow) {
    setBusyId(device.id);
    try {
      const result = await saveEdgeApiUrl({
        data: { deviceId: device.id, url: draft[device.id] ?? "" },
      });
      if (!result.ok) {
        toast.error(failureText(t, result));
        return;
      }
      toast.success(t(m.saved, { name: device.name }));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(m.saveFailed));
    } finally {
      setBusyId(null);
    }
  }

  async function handleTest(device: EdgeTargetRow) {
    setBusyId(device.id);
    try {
      const result = await testEdgeConnection({ data: { deviceId: device.id } });
      if (!result.ok) {
        toast.error(failureText(t, result));
        return;
      }
      setProbe((current) => ({ ...current, [device.id]: result }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(m.testFailed));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border bg-card shadow-sm p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Edge API</h2>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t(m.reload)}
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t(m.intro)}</p>

      {loadError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{failureText(t, loadError, m.serverNoResponse)}</span>
        </div>
      )}

      <div className="mb-4 rounded-lg border bg-background p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">{t(m.fallbackAddress)}</span>
          <code className="font-medium">{fallbackUrl || t(m.notSet)}</code>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">{t(m.sharedToken)}</span>
          <span className="font-medium">{tokenSet ? t(m.tokenSet) : t(m.tokenUnused)}</span>
        </div>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          {rich(m.envNote, { env: <code>.env</code> })}
        </p>
      </div>

      {loading && devices === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t(m.loading)}
        </p>
      ) : !devices || devices.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t(m.empty)}</p>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => {
            const hasil = probe[device.id];
            const berubah = (draft[device.id] ?? "") !== (device.edgeApiUrl ?? "");
            const sibuk = busyId === device.id;

            return (
              <div key={device.id} className="rounded-lg border bg-background p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{device.name}</span>
                  <code className="text-xs text-muted-foreground">{device.code}</code>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {device.plant ?? t(m.plantUnset)}
                  </Badge>
                  {!device.isActive && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {t(m.inactive)}
                    </Badge>
                  )}
                  {device.usesFallback && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {t(m.usesFallback)}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={draft[device.id] ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [device.id]: event.target.value }))
                    }
                    placeholder={fallbackUrl || "http://10.60.20.155:3000"}
                    spellCheck={false}
                    disabled={sibuk}
                    className="h-9 min-w-[16rem] flex-1 font-mono text-xs"
                    aria-label={t(m.addressLabel, { name: device.name })}
                  />
                  <Button size="sm" onClick={() => handleSave(device)} disabled={sibuk || !berubah}>
                    <Save className="mr-2 h-4 w-4" />
                    {t(m.save)}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest(device)}
                    disabled={sibuk || berubah}
                    title={berubah ? t(m.saveBeforeTest) : t(m.testThisAddress)}
                  >
                    {sibuk ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plug className="mr-2 h-4 w-4" />
                    )}
                    {t(m.test)}
                  </Button>
                </div>

                {hasil && (
                  <p
                    className={`mt-2 flex items-start gap-1.5 text-xs ${
                      hasil.reachable ? "text-emerald-700" : "text-destructive"
                    }`}
                  >
                    {hasil.reachable ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>
                      {hasil.detail}{" "}
                      <span className="text-muted-foreground">({hasil.latencyMs} ms)</span>
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
        {t(m.accessNote)}
      </p>
    </section>
  );
}
