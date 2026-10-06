import { useCallback, useEffect, useRef, useState } from "react";
import { failureText } from "@/i18n/errors";
import { galleryMessages as m } from "@/i18n/gallery";
import { getDeviceStatus, type DeviceStatus } from "@/lib/camera-api";
import { listRegisteredDevices, type RegisteredDevice } from "@/lib/device-registry";
import { useT } from "@/lib/i18n";
import {
  loadSelectedEdgeDevice,
  resolveSelectedEdgeDevice,
  saveSelectedEdgeDevice,
} from "@/lib/selected-edge-device";

export function useEdgeStatusSelection(enabled: boolean) {
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const requestId = useRef(0);
  // Lewat ref, bukan dependensi refresh(): mengganti bahasa tidak boleh
  // membuat refresh() baru, karena efek di bawah akan memeriksa ulang device.
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const refresh = useCallback(async (preferredCode = loadSelectedEdgeDevice()) => {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    setStatus(null);
    setCheckedAt(null);
    try {
      const registry = await listRegisteredDevices();
      if (current !== requestId.current) return;
      if (!registry.ok) throw new Error(failureText(tRef.current, registry));
      const active = registry.devices.filter((device) => device.isActive);
      setDevices(active);
      const code = resolveSelectedEdgeDevice(active, preferredCode);
      setSelectedCode(code);
      if (!code) return;
      const result = await getDeviceStatus({ data: { deviceCode: code } });
      if (current !== requestId.current) return;
      setStatus(result);
      setCheckedAt(new Date());
    } catch (cause) {
      if (current !== requestId.current) return;
      setError(cause instanceof Error ? cause.message : tRef.current(m.deviceStatusLoadFailed));
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (enabled) void refresh();
    return () => {
      requestId.current += 1;
    };
  }, [enabled, refresh]);
  function select(code: string) {
    saveSelectedEdgeDevice(code);
    setSelectedCode(code);
    void refresh(code);
  }
  return { devices, selectedCode, select, status, loading, error, checkedAt, refresh };
}
