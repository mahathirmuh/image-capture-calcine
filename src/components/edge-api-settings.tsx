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

type ProbeState = Extract<EdgeProbeResult, { ok: true }> | null;

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [probe, setProbe] = useState<Record<number, ProbeState>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listEdgeTargets();
      if (!result.ok) {
        setLoadError(result.message);
        setDevices(null);
        return;
      }
      setDevices(result.devices);
      setFallbackUrl(result.fallbackUrl);
      setTokenSet(result.tokenSet);
      setDraft(Object.fromEntries(result.devices.map((d) => [d.id, d.edgeApiUrl ?? ""])));
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Server tidak merespons.");
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
        toast.error(result.message);
        return;
      }
      toast.success(`Alamat "${device.name}" disimpan`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Alamat gagal disimpan.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTest(device: EdgeTargetRow) {
    setBusyId(device.id);
    try {
      const result = await testEdgeConnection({ data: { deviceId: device.id } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setProbe((current) => ({ ...current, [device.id]: result }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uji koneksi gagal.");
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
          Muat ulang
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Alamat service kamera untuk tiap device. Tiap device boleh memakai port berbeda &mdash;
        tulis URL utuhnya, portnya ikut di dalamnya.
      </p>

      {loadError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="mb-4 rounded-lg border bg-background p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">Alamat cadangan (CAMERA_API_URL)</span>
          <code className="font-medium">{fallbackUrl || "belum diisi"}</code>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">Token bersama (CAMERA_API_TOKEN)</span>
          <span className="font-medium">{tokenSet ? "terpasang" : "tidak dipakai"}</span>
        </div>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          Keduanya berasal dari berkas <code>.env</code> di server dan hanya bisa diubah di sana,
          bukan dari halaman ini &mdash; nilainya tidak pernah dikirim ke browser. Cadangan dipakai
          untuk device yang alamatnya dikosongkan.
        </p>
      </div>

      {loading && devices === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Memuat registry device...
        </p>
      ) : !devices || devices.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Belum ada device di registry. Daftarkan dulu lewat menu Devices.
        </p>
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
                    {device.plant ?? "Plant belum ditentukan"}
                  </Badge>
                  {!device.isActive && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      Nonaktif
                    </Badge>
                  )}
                  {device.usesFallback && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      Pakai cadangan
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
                    aria-label={`Alamat Edge API ${device.name}`}
                  />
                  <Button size="sm" onClick={() => handleSave(device)} disabled={sibuk || !berubah}>
                    <Save className="mr-2 h-4 w-4" />
                    Simpan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest(device)}
                    disabled={sibuk || berubah}
                    title={berubah ? "Simpan dulu sebelum menguji" : "Uji koneksi ke alamat ini"}
                  >
                    {sibuk ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plug className="mr-2 h-4 w-4" />
                    )}
                    Uji
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
        Akun yang dipasang ke plant tertentu hanya bisa memakai device dari plant itu. Hanya akun
        ber-plant Semua Plant yang bebas memakai device mana pun. Aturan itu ditegakkan di server
        pada tiap panggilan kamera, bukan dengan menyembunyikan pilihan di layar.
      </p>
    </section>
  );
}
