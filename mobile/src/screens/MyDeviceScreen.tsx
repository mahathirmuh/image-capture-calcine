const DEVICE_ALERT = {
  title: "System Alert",
  message: "Device UNREACHABLE: Check uplink connection.",
};

const DEVICE_STATUS = {
  deviceName: "Lens Rig Alpha",
  deviceCode: "RIG-884-AX",
  telemetryId: "884-AX-9",
  healthState: "Online",
  reachability: "Excellent",
  lastCapture: "2023-10-27 14:02:11",
  uplink: "98 dBm",
  operatorId: "OPR-772-V",
  authLevel: "Yellow",
};

export function MyDeviceScreen() {
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
          <span className="top-app-bar__label">Zone 04 | Calcine-Alpha</span>
        </div>

        <div className="top-app-bar__title">
          {DEVICE_STATUS.deviceName} | {DEVICE_STATUS.deviceCode}
        </div>

        <button className="icon-button" type="button" aria-label="Open settings">
          <span className="material-symbols-outlined" aria-hidden="true">
            settings
          </span>
        </button>
      </header>

      <section className="device-alert-card" aria-label="System alert">
        <span className="material-symbols-outlined" aria-hidden="true">
          warning
        </span>
        <div>
          <strong>{DEVICE_ALERT.title}</strong>
          <p>{DEVICE_ALERT.message}</p>
        </div>
      </section>

      <section className="device-card">
        <div className="device-card__header">
          <h1>Core Telemetry</h1>
          <span>ID: {DEVICE_STATUS.telemetryId}</span>
        </div>

        <div className="device-card__body">
          <div className="device-card__summary">
            <div>
              <span className="device-card__label">Health State</span>
              <div className="device-card__state">
                <span className="device-card__pip" aria-hidden="true"></span>
                <strong>{DEVICE_STATUS.healthState}</strong>
              </div>
            </div>

            <div className="device-card__metric device-card__metric--right">
              <span className="device-card__label">Reachability</span>
              <strong>{DEVICE_STATUS.reachability}</strong>
            </div>
          </div>

          <div className="device-card__split">
            <div className="device-card__metric">
              <span className="device-card__label">Last Capture</span>
              <strong>{DEVICE_STATUS.lastCapture}</strong>
            </div>

            <div className="device-card__metric device-card__metric--right">
              <span className="device-card__label">Uplink</span>
              <strong>{DEVICE_STATUS.uplink}</strong>
            </div>
          </div>
        </div>
      </section>

      <button className="btn btn-primary device-diagnostics-button" type="button">
        <span className="material-symbols-outlined" aria-hidden="true">
          build
        </span>
        Run Diagnostics
      </button>

      <section className="device-operator-card">
        <div className="device-operator-card__identity">
          <div className="device-operator-card__avatar" aria-hidden="true">
            <span className="material-symbols-outlined">badge</span>
          </div>

          <div>
            <strong>{DEVICE_STATUS.operatorId}</strong>
            <p>Auth Level: {DEVICE_STATUS.authLevel}</p>
          </div>
        </div>

        <button className="btn btn-secondary device-operator-card__signout" type="button">
          Sign Out
        </button>
      </section>
    </main>
  );
}
