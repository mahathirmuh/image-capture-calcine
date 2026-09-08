import { useCallback, useEffect, useRef, useState } from "react";
import { getDeviceTelemetry } from "../lib/camera-api";
import type { DeviceTelemetry } from "../lib/device-telemetry";

/** Poll host telemetry only; never poll gphoto2 or acquire camera sessions. */
export function useDeviceTelemetry(
  deviceId: number | undefined,
  active: boolean,
  endpoint?: string | null,
) {
  const key = `${deviceId}:${endpoint ?? ""}:${active}`;
  const request = useRef(0);
  const running = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const [state, setState] = useState<{
    key: string;
    data: DeviceTelemetry | null;
    error: string | null;
    loading: boolean;
  }>({ key, data: null, error: null, loading: false });
  const refresh = useCallback((): Promise<void> => {
    if (running.current?.key === key) return running.current.promise;
    const serial = ++request.current;
    if (!active || !deviceId) {
      setState({ key, data: null, error: null, loading: false });
      return Promise.resolve();
    }
    setState((current) => ({
      key,
      data: current.key === key ? current.data : null,
      error: null,
      loading: true,
    }));
    const promise = Promise.resolve().then(async () => {
      try {
        const response = await getDeviceTelemetry({ data: { deviceId } });
        if (serial !== request.current) return;
        setState({
          key,
          data: response.ok ? response.telemetry : null,
          error: response.ok ? null : response.message,
          loading: false,
        });
      } catch {
        if (serial === request.current)
          setState({
            key,
            data: null,
            error: "Telemetri gagal dimuat. Coba refresh kembali.",
            loading: false,
          });
      } finally {
        if (serial === request.current) running.current = null;
      }
    });
    running.current = { key, promise };
    return promise;
  }, [key, active, deviceId]);
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    poll();
    const interval = setInterval(poll, 30000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
      request.current += 1;
      running.current = null;
    };
  }, [refresh]);
  const current =
    state.key === key && active ? state : { data: null, error: null, loading: active };
  return { telemetry: current.data, error: current.error, loading: current.loading, refresh };
}
