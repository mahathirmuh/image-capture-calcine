import { useEffect, useMemo, useState } from "react";

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
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceListItem | null>(null);
  const [status, setStatus] = useState<DeviceStatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const devicesResponse = await listDevices(session);
        if (cancelled) return;
        onSessionUpdate(devicesResponse.session);

        const primary = pickPrimaryDevice(devicesResponse.data.devices, user.plant ?? null);
        setDevice(primary);

        if (!primary) {
          setStatus(null);
          return;
        }

        const statusResponse = await getDeviceStatus(devicesResponse.session, primary.code);
        if (cancelled) return;
        onSessionUpdate(statusResponse.session);
        setStatus(statusResponse.data);
      } catch (loadError) {
        if (cancelled) return;
        setError(errorMessageOf(loadError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onSessionUpdate, session, user.plant]);

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
          <span
            className="material-symbols-outlined top-app-bar__avatar"
            aria-hidden="true"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            account_circle
          </span>
          <span className="top-app-bar__label">{user.plant ?? "Operator Device"}</span>
        </div>

        <div className="top-app-bar__title">
          {device?.name ?? "Assigned Device"} | {device?.code ?? "Unavailable"}
        </div>

        <button className="icon-button" type="button" aria-label="Open settings">
          <span className="material-symbols-outlined" aria-hidden="true">
            settings
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
          <span>ID: {device?.code ?? "Unavailable"}</span>
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

      <button className="btn btn-primary device-diagnostics-button" type="button" disabled>
        <span className="material-symbols-outlined" aria-hidden="true">
          build
        </span>
        Diagnostics Pending
      </button>

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
