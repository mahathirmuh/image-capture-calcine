import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  createSession,
  getDeviceStatus,
  getPreviewFrame,
  releaseSession,
  renewSession,
  type DeviceStatus,
} from "@/lib/camera-api";
import {
  getDeviceStatusPollInterval,
  getRuntimeErrorCode,
  getSessionHeartbeatInterval,
  isCameraReadyForLiveOps,
  isIgnorableSessionFetchError,
  shouldRenewSession,
} from "@/lib/camera-runtime";

export type CameraSessionRef = { sessionId: string; leaseToken: string };
export type CameraSessionIssue = { code: string; message: string; updatedAt: number };

type UseCaptureCameraSessionArgs = {
  setError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string | null>>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// Release with `keepalive: true` so the request survives page teardown —
// used both when the user clicks "Stop camera" and on tab close, where a
// plain fetch would otherwise get cancelled and leak the session.
function releaseSessionKeepalive(session: CameraSessionRef) {
  return releaseSession({
    data: session,
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, keepalive: true }),
  }).catch((error) => {
    if (!isIgnorableSessionFetchError(error)) {
      console.warn("[capture-session] failed to release session", error);
    }
  });
}

export function useCaptureCameraSession({ setError, setStatus }: UseCaptureCameraSessionArgs) {
  const [cameraFrame, setCameraFrame] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [leaseToken, setLeaseToken] = useState<string | null>(null);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [previewFetching, setPreviewFetching] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [deviceStatusLoaded, setDeviceStatusLoaded] = useState(false);
  const [waitingForCamera, setWaitingForCamera] = useState(false);
  const [sessionIssue, setSessionIssue] = useState<CameraSessionIssue | null>(null);

  const startAttemptRef = useRef(0);
  const sessionRef = useRef<CameraSessionRef | null>(null);
  const cameraBusyRef = useRef(false);
  const startCameraRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    function releaseOnExit() {
      const session = sessionRef.current;
      if (!session) return;
      releaseSessionKeepalive(session);
    }

    window.addEventListener("beforeunload", releaseOnExit);
    return () => {
      window.removeEventListener("beforeunload", releaseOnExit);
      releaseOnExit();
    };
  }, []);

  useEffect(() => {
    if (!sessionId || !leaseToken) return;

    const session = { sessionId, leaseToken };
    const liveOpsReady = isCameraReadyForLiveOps(deviceStatus);
    let cancelled = false;
    let loopRunning = false;

    async function pollLoop() {
      if (loopRunning) return;
      loopRunning = true;

      while (!cancelled && document.visibilityState === "visible") {
        if (!liveOpsReady) {
          setPreviewFetching(false);
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }

        if (cameraBusyRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }

        setPreviewFetching(true);
        try {
          const res = await getPreviewFrame({ data: session });
          const blob = await res.blob();
          if (!cancelled) {
            setCameraFrame((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(blob);
            });
          }
        } catch (error) {
          // Preview can be transiently unavailable (mid-capture, or a camera
          // state 422) — one failed frame shouldn't kill the loop.
          if (
            !cancelled &&
            !isIgnorableSessionFetchError(error) &&
            getRuntimeErrorCode(error) === "INVALID_SESSION"
          ) {
            setSessionIssue({
              code: "INVALID_SESSION",
              message: error instanceof Error ? error.message : "Session kamera tidak lagi valid.",
              updatedAt: Date.now(),
            });
            setStatus("Session kamera terputus, mencoba menyambung ulang…");
            sessionRef.current = null;
            setSessionId(null);
            setLeaseToken(null);
            void startCameraRef.current();
            cancelled = true;
          }
        } finally {
          setPreviewFetching(false);
        }

        if (cancelled || document.visibilityState !== "visible") break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      loopRunning = false;
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") void pollLoop();
    }

    void pollLoop();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [deviceStatus, leaseToken, sessionId, setStatus]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastStatus: DeviceStatus | null = null;

    function scheduleNext(status: DeviceStatus | null) {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        void poll();
      }, getDeviceStatusPollInterval(status));
    }

    async function poll() {
      try {
        const status = await getDeviceStatus();
        lastStatus = status;
        if (!cancelled) {
          setDeviceStatus(status);
          setDeviceStatusLoaded(true);
        }
      } catch {
        /* keep last known status */
        if (!cancelled) setDeviceStatusLoaded(true);
      } finally {
        if (!cancelled) scheduleNext(lastStatus);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!sessionId || !leaseToken) return;

    const sid = sessionId;
    const tok = leaseToken;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function scheduleNextBeat() {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        void beat();
      }, getSessionHeartbeatInterval(deviceStatus));
    }

    async function beat() {
      if (cancelled || document.visibilityState !== "visible") return;
      if (!shouldRenewSession(deviceStatus)) {
        scheduleNextBeat();
        return;
      }

      const result = await renewSession({
        data: { sessionId: sid, leaseToken: tok, leaseSeconds: 120 },
      });
      if (cancelled) return;

      if (!result.ok) {
        if (result.code === "UNREACHABLE" && document.visibilityState !== "visible") {
          return;
        }
        setSessionIssue({
          code: result.code,
          message: result.message,
          updatedAt: Date.now(),
        });
        sessionRef.current = null;
        setSessionId(null);
        setLeaseToken(null);
        setStatus("Session kamera berakhir, mencoba menyambung ulang…");
        void startCameraRef.current();
        return;
      }

      scheduleNextBeat();
    }

    function onVisible() {
      if (document.visibilityState === "visible" && timeoutId === null) void beat();
    }

    void beat();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [deviceStatus, leaseToken, sessionId, setStatus]);

  async function startCameraImpl() {
    const attempt = ++startAttemptRef.current;
    setError(null);
    setSessionStarting(true);
    setWaitingForCamera(false);
    setSessionIssue(null);

    try {
      for (;;) {
        if (startAttemptRef.current !== attempt) return;

        let result;
        try {
          const ownerId = `web-${Math.random().toString(36).slice(2, 10)}`;
          result = await createSession({ data: { ownerId, leaseSeconds: 120 } });
        } catch (error: unknown) {
          if (isIgnorableSessionFetchError(error)) {
            return;
          }
          const message = getErrorMessage(error, "Gagal menjangkau service kamera");
          setSessionIssue({
            code: getRuntimeErrorCode(error) ?? "UNREACHABLE",
            message,
            updatedAt: Date.now(),
          });
          setError(message);
          return;
        }

        if (startAttemptRef.current !== attempt) return;
        if (result.ok) {
          const session = {
            sessionId: result.session.sessionId,
            leaseToken: result.session.leaseToken,
          };
          sessionRef.current = session;
          setSessionId(session.sessionId);
          setLeaseToken(session.leaseToken);
          setWaitingForCamera(false);
          setSessionIssue(null);
          setStatus(
            deviceStatus?.camera?.connected && deviceStatus.connectionState === "ready"
              ? "Session kamera terhubung"
              : "Session kamera didapatkan, menunggu kamera siap",
          );
          return;
        }

        if (result.code === "SESSION_CONFLICT") {
          setWaitingForCamera(true);
          setSessionStarting(false);
          setSessionIssue({
            code: result.code,
            message: result.message,
            updatedAt: Date.now(),
          });
          setError(null);
          await new Promise((resolve) => setTimeout(resolve, 4000));
          if (startAttemptRef.current === attempt) {
            setSessionStarting(true);
          }
          continue;
        }

        setSessionIssue({
          code: result.code,
          message: result.message,
          updatedAt: Date.now(),
        });
        setError(result.message);
        return;
      }
    } finally {
      if (startAttemptRef.current === attempt) setSessionStarting(false);
    }
  }

  startCameraRef.current = startCameraImpl;

  const startCamera = useCallback(() => startCameraRef.current(), []);

  const cancelStart = useCallback(() => {
    startAttemptRef.current++;
    setSessionStarting(false);
    setWaitingForCamera(false);
    setStatus(null);
    setError(null);
    setSessionIssue(null);
  }, [setError, setStatus]);

  const stopCamera = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setSessionId(null);
    setLeaseToken(null);
    setCameraFrame((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSessionIssue(null);
    setStatus("Session kamera dihentikan");

    if (session) {
      await releaseSessionKeepalive(session);
    }
  }, [setStatus]);

  const cameraOnline = !!(
    deviceStatus?.online &&
    deviceStatus.camera?.connected &&
    deviceStatus.connectionState === "ready"
  );
  const sessionActive = !!sessionId;
  const cameraUsable = sessionActive && (deviceStatus === null || cameraOnline);
  const cameraAsleep = sessionActive && deviceStatus !== null && !cameraOnline;

  return {
    cameraAsleep,
    cameraBusyRef,
    cameraFrame,
    cameraUsable,
    deviceStatus,
    deviceStatusLoaded,
    leaseToken,
    previewFetching,
    sessionId,
    sessionStarting,
    sessionIssue,
    startCamera,
    stopCamera,
    cancelStart,
    waitingForCamera,
  };
}
