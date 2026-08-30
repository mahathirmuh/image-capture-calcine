import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppLogo } from "../components/AppLogo";
import type { AuthSession, AuthUser } from "../lib/auth";
import { MobileAuthError } from "../lib/auth";
import {
  getDeviceStatus,
  listDevices,
  pickPrimaryDevice,
  type DeviceListItem,
  type DeviceStatusResponse,
} from "../lib/devices";

type MyDeviceScreenProps = {
  session: AuthSession;
  user: AuthUser;
  onSessionUpdate: (session: AuthSession) => void;
  onSignOut: () => void | Promise<void>;
};

function errorMessageOf(error: unknown) {
  if (error instanceof MobileAuthError) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to load device status.";
}

function formatDateTime(iso: string | null) {
  if (!iso) return "No capture yet";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function inferHealthState(device: DeviceListItem | null, status: DeviceStatusResponse | null) {
  if (!device) return { label: "Unavailable", reachability: "No Device", alert: "No eligible device was resolved for this operator scope." };

  const edge = status?.edge ?? {};
  const connected = edge.connected;
  const connectionState = typeof edge.connectionState === "string" ? edge.connectionState : null;
  const online = connected === true || connectionState === "ready";

  if (online) {
    return { label: "Online", reachability: "Excellent", alert: null };
  }

  if (device.isActive) {
    return { label: "Degraded", reachability: "Limited", alert: "Device is registered but the live edge state is not ready." };
  }

  return { label: "Offline", reachability: "Unavailable", alert: "Device is inactive in the registry." };
}

export function MyDeviceScreen({ session, user, onSessionUpdate, onSignOut }: MyDeviceScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceListItem | null>(null);
  const [status, setStatus] = useState<DeviceStatusResponse | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadDeviceState = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const devicesResponse = await listDevices(session);
        if (!mountedRef.current) return;
        onSessionUpdate(devicesResponse.session);

        const primary = pickPrimaryDevice(devicesResponse.data.devices, user.plant ?? null);
        setDevice(primary);

        if (!primary) {
          setStatus(null);
          setLastUpdatedAt(new Date().toISOString());
          return;
        }

        const statusResponse = await getDeviceStatus(devicesResponse.session, primary.code);
        if (!mountedRef.current) return;
        onSessionUpdate(statusResponse.session);
        setStatus(statusResponse.data);
        setLastUpdatedAt(new Date().toISOString());
      } catch (loadError) {
        if (mountedRef.current) {
          setError(errorMessageOf(loadError));
        }
      } finally {
        if (mountedRef.current) {
          if (mode === "initial") {
            setLoading(false);
          } else {
            setRefreshing(false);
          }
        }
      }
    },
    [onSessionUpdate, session, user.plant],
  );

  useEffect(() => {
    void loadDeviceState("initial");
  }, [loadDeviceState]);

  const health = useMemo(() => inferHealthState(device, status), [device, status]);
  const edge = status?.edge ?? {};
  const uplink =
    typeof edge.signal === "string"
      ? edge.signal
      : typeof edge.uplink === "string"
        ? edge.uplink
        : "Not Reported";

  return (
    <main className="app-page-shell app-page-shell--with-nav my-device-screen">
      <header className="top-app-bar">
        <div className="top-app-bar__side">
          <AppLogo className="app-logo--topbar" alt="" />
          <span className="top-app-bar__label">{user.plant ?? "Operator Device"}</span>
        </div>

        <div className="top-app-bar__title">
          {device?.name ?? "Assigned Device"} | {device?.code ?? "Unavailable"}
        </div>

        <button
          className="icon-button"
          type="button"
          aria-label="Refresh device status"
          onClick={() => void loadDeviceState("refresh")}
          disabled={loading || refreshing}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            refresh
          </span>
        </button>
      </header>

      {loading ? (
        <section className="device-alert-card" aria-label="Device loading state">
          <span className="material-symbols-outlined" aria-hidden="true">
            hourglass_top
          </span>
          <div>
            <strong>Loading device status</strong>
            <p>Resolving the primary device and fetching live edge status.</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="device-alert-card" aria-label="Device error state">
          <span className="material-symbols-outlined" aria-hidden="true">
            warning
          </span>
          <div>
            <strong>System Alert</strong>
            <p>{error}</p>
          </div>
        </section>
      ) : null}

      {!loading && !error && health.alert ? (
        <section className="device-alert-card" aria-label="System alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            warning
          </span>
          <div>
            <strong>System Alert</strong>
            <p>{health.alert}</p>
          </div>
        </section>
      ) : null}

      <section className="device-card">
        <div className="device-card__header">
          <h1>Core Telemetry</h1>
          <span>{refreshing ? "Refreshing..." : `ID: ${device?.code ?? "Unavailable"}`}</span>
        </div>

        <div className="device-card__body">
          <div className="device-card__summary">
            <div>
              <span className="device-card__label">Health State</span>
              <div className="device-card__state">
                <span className="device-card__pip" aria-hidden="true"></span>
                <strong>{health.label}</strong>
              </div>
            </div>

            <div className="device-card__metric device-card__metric--right">
              <span className="device-card__label">Reachability</span>
              <strong>{health.reachability}</strong>
            </div>
          </div>

          <div className="device-card__split">
            <div className="device-card__metric">
              <span className="device-card__label">Last Capture</span>
              <strong>{formatDateTime(device?.lastCapturedAt ?? null)}</strong>
            </div>

            <div className="device-card__metric device-card__metric--right">
              <span className="device-card__label">Uplink</span>
              <strong>{uplink}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="device-diagnostics-card">
        <div className="device-diagnostics-card__header">
          <div>
            <p className="device-diagnostics-card__kicker">Diagnostics</p>
            <h2 className="device-diagnostics-card__title">Read-only operator view</h2>
          </div>
          <span className="device-diagnostics-card__badge">
            {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "Waiting"}
          </span>
        </div>

        <p className="device-diagnostics-card__body">
          Mobile operators can review health state, uplink, and last capture from this screen.
          Remote diagnostics and repair actions stay on the admin workflow in this phase.
        </p>

        <button
          className="btn btn-primary device-diagnostics-button"
          type="button"
          onClick={() => void loadDeviceState("refresh")}
          disabled={loading || refreshing}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            refresh
          </span>
          {refreshing ? "Refreshing..." : "Refresh Status"}
        </button>
      </section>

      <section className="device-operator-card">
        <div className="device-operator-card__identity">
          <div className="device-operator-card__avatar" aria-hidden="true">
            <span className="material-symbols-outlined">badge</span>
          </div>

          <div>
            <strong>{user.username}</strong>
            <p>
              Auth Level: {user.role} {device?.plant ? `• ${device.plant}` : user.plant ? `• ${user.plant}` : ""}
            </p>
          </div>
        </div>

        <button
          className="btn btn-secondary device-operator-card__signout"
          type="button"
          onClick={() => void onSignOut()}
        >
          Sign Out
        </button>
      </section>
    </main>
  );
}
