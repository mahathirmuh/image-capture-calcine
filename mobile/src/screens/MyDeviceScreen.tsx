import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppLogo } from "../components/AppLogo";
import type { AuthSession, AuthUser } from "../lib/auth";
import { dateLocale, describeError, roleLabel, translate, useT } from "../lib/i18n";
import { canAccessCapturePlant } from "../lib/camera";
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
  selectedPlant?: string | null;
  onOpenSessions?: () => void;
  onSessionUpdate: (session: AuthSession) => void;
  onSignOut: () => void | Promise<void>;
};

function formatDateTime(iso: string | null) {
  if (!iso) return translate("device.noCapture");
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  return new Intl.DateTimeFormat(dateLocale(), {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function inferHealthState(device: DeviceListItem | null, status: DeviceStatusResponse | null) {
  if (!device)
    return {
      label: translate("common.unavailable"),
      reachability: translate("device.reach.noDevice"),
      alert: translate("device.alert.noDevice"),
    };

  const edge = status?.edge ?? {};
  const connected = edge.connected;
  const connectionState = typeof edge.connectionState === "string" ? edge.connectionState : null;
  const online = connected === true || connectionState === "ready";

  if (online) {
    return {
      label: translate("device.health.online"),
      reachability: translate("device.reach.excellent"),
      alert: null,
    };
  }

  if (device.isActive) {
    return {
      label: translate("device.health.degraded"),
      reachability: translate("device.reach.limited"),
      alert: translate("device.alert.notReady"),
    };
  }

  return {
    label: translate("device.health.offline"),
    reachability: translate("common.unavailable"),
    alert: translate("device.alert.inactive"),
  };
}

export function MyDeviceScreen({
  session,
  user,
  selectedPlant,
  onOpenSessions,
  onSessionUpdate,
  onSignOut,
}: MyDeviceScreenProps) {
  const t = useT();
  const devicePlant = user.plant === "ALL" ? (selectedPlant ?? null) : (user.plant ?? null);
  const needsSelection = user.plant === "ALL" && !canAccessCapturePlant(user.plant, devicePlant);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceListItem | null>(null);
  const [status, setStatus] = useState<DeviceStatusResponse | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  const loadDeviceState = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const requestId = ++requestRef.current;
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      setDevice(null);
      setStatus(null);

      try {
        if (needsSelection) return;
        const devicesResponse = await listDevices(session);
        if (!mountedRef.current || requestId !== requestRef.current) return;
        onSessionUpdate(devicesResponse.session);

        const primary = pickPrimaryDevice(devicesResponse.data.devices, devicePlant);
        setDevice(primary);

        if (!primary) {
          setStatus(null);
          setLastUpdatedAt(new Date().toISOString());
          return;
        }

        const statusResponse = await getDeviceStatus(devicesResponse.session, primary.code);
        if (!mountedRef.current || requestId !== requestRef.current) return;
        onSessionUpdate(statusResponse.session);
        setStatus(statusResponse.data);
        setLastUpdatedAt(new Date().toISOString());
      } catch (loadError) {
        if (mountedRef.current && requestId === requestRef.current) {
          setError(describeError(loadError, "device.loadError"));
        }
      } finally {
        if (mountedRef.current && requestId === requestRef.current) {
          if (mode === "initial") {
            setLoading(false);
          } else {
            setRefreshing(false);
          }
        }
      }
    },
    [onSessionUpdate, session, devicePlant, needsSelection],
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
        : t("device.notReported");

  return (
    <main className="app-page-shell app-page-shell--with-nav my-device-screen">
      <header className="top-app-bar">
        <div className="top-app-bar__side">
          <AppLogo className="app-logo--topbar" alt="" />
          <span className="top-app-bar__label">{devicePlant ?? t("device.operatorDevice")}</span>
        </div>

        <div className="top-app-bar__title">
          {device?.name ?? t("device.assigned")} | {device?.code ?? t("common.unavailable")}
        </div>

        <button
          className="icon-button"
          type="button"
          aria-label={t("device.refreshAria")}
          onClick={() => void loadDeviceState("refresh")}
          disabled={loading || refreshing}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            refresh
          </span>
        </button>
      </header>

      {needsSelection ? (
        <section className="device-alert-card" aria-label={t("device.selectAria")}>
          <div>
            <strong>{t("device.selectTitle")}</strong>
            <p>{t("device.selectBody")}</p>
            <button type="button" className="btn btn-primary" onClick={onOpenSessions}>
              {t("device.openSessions")}
            </button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <section className="device-alert-card" aria-label={t("device.loadingAria")}>
          <span className="material-symbols-outlined" aria-hidden="true">
            hourglass_top
          </span>
          <div>
            <strong>{t("device.loadingTitle")}</strong>
            <p>{t("device.loadingBody")}</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="device-alert-card" aria-label={t("device.errorAria")}>
          <span className="material-symbols-outlined" aria-hidden="true">
            warning
          </span>
          <div>
            <strong>{t("device.systemAlert")}</strong>
            <p>{error}</p>
          </div>
        </section>
      ) : null}

      {!needsSelection && !loading && !error && health.alert ? (
        <section className="device-alert-card" aria-label={t("device.alertAria")}>
          <span className="material-symbols-outlined" aria-hidden="true">
            warning
          </span>
          <div>
            <strong>{t("device.systemAlert")}</strong>
            <p>{health.alert}</p>
          </div>
        </section>
      ) : null}

      <section className="device-card">
        <div className="device-card__header">
          <h1>{t("device.telemetry")}</h1>
          <span>
            {refreshing
              ? t("common.refreshing")
              : t("device.id", { code: device?.code ?? t("common.unavailable") })}
          </span>
        </div>

        <div className="device-card__body">
          <div className="device-card__summary">
            <div>
              <span className="device-card__label">{t("device.healthState")}</span>
              <div className="device-card__state">
                <span className="device-card__pip" aria-hidden="true"></span>
                <strong>{health.label}</strong>
              </div>
            </div>

            <div className="device-card__metric device-card__metric--right">
              <span className="device-card__label">{t("device.reachability")}</span>
              <strong>{health.reachability}</strong>
            </div>
          </div>

          <div className="device-card__split">
            <div className="device-card__metric">
              <span className="device-card__label">{t("device.lastCapture")}</span>
              <strong>{formatDateTime(device?.lastCapturedAt ?? null)}</strong>
            </div>

            <div className="device-card__metric device-card__metric--right">
              <span className="device-card__label">{t("device.uplink")}</span>
              <strong>{uplink}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="device-diagnostics-card">
        <div className="device-diagnostics-card__header">
          <div>
            <p className="device-diagnostics-card__kicker">{t("device.diagnostics")}</p>
            <h2 className="device-diagnostics-card__title">{t("device.readOnly")}</h2>
          </div>
          <span className="device-diagnostics-card__badge">
            {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : t("device.waiting")}
          </span>
        </div>

        <p className="device-diagnostics-card__body">{t("device.diagnosticsBody")}</p>

        <button
          className="btn btn-primary device-diagnostics-button"
          type="button"
          onClick={() => void loadDeviceState("refresh")}
          disabled={loading || refreshing}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            refresh
          </span>
          {refreshing ? t("common.refreshing") : t("device.refreshStatus")}
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
              {t("device.authLevel", { role: roleLabel(user.role) })}{" "}
              {device?.plant ? `• ${device.plant}` : user.plant ? `• ${user.plant}` : ""}
            </p>
          </div>
        </div>

        <button
          className="btn btn-secondary device-operator-card__signout"
          type="button"
          onClick={() => void onSignOut()}
        >
          {t("common.signOut")}
        </button>
      </section>
    </main>
  );
}
