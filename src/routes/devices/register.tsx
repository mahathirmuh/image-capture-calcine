import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Info,
  Lightbulb,
  MapPin,
  Package,
  Settings2,
} from "lucide-react";
import { PLANTS } from "@/lib/locations";

export const Route = createFileRoute("/devices/register")({
  component: RegisterDevicePage,
  head: () => ({
    meta: [
      { title: "Register Device — Capture App" },
      { name: "description", content: "Register a new Mini PC and camera to the system." },
    ],
  }),
});

// This page is a UI/UX preview of a future multi-device registration flow.
// There is no device registry, pairing protocol, or Capture Agent behind it
// yet -- this app only ever talks to one edge device (CAMERA_API_URL).
// Nothing here writes to a real backend; "Register Device" just shows a
// mock confirmation.

const BINS = ["Bin 1 / Bin 2", "Bin 1", "Bin 2"];
const STATIONS = ["Main Area", "Secondary Area", "Loading Bay"];
const TEMPLATES = ["Default - Calcine Sampling (R50)", "High-Res Sampling (R50)", "Manual Only"];
const SCHEDULES = ["Every Hour", "Every 3 Hours", "Every 6 Hours", "Manual only"];
const TIMEZONES = ["Asia/Makassar (WITA)", "Asia/Jakarta (WIB)", "Asia/Jayapura (WIT)"];

function formatNow() {
  const date = new Date();
  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-GB", { hour12: false });
  return `${datePart} ${timePart}`;
}

const HOW_IT_WORKS = [
  {
    title: "Install Capture Agent",
    body: "Install the Capture Agent on the Mini PC and connect the camera.",
  },
  { title: "Get Device Code", body: "Open the Capture Agent. You will see a unique Device Code." },
  {
    title: "Register in Web UI",
    body: "Enter the device code here and complete the registration.",
  },
  {
    title: "Sync & Ready",
    body: "The device will sync configuration from the server and be ready to capture.",
  },
];

const WHAT_GETS_CONFIGURED = [
  "Camera settings (ISO, Shutter, Aperture, etc.)",
  "File naming format",
  "Capture schedule",
  "Save directory (local)",
  "Upload destination (shared folder)",
  "Network & API settings",
  "Fallback connection settings",
];

function RegisterDevicePage() {
  const [deviceCode, setDeviceCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [plant, setPlant] = useState<string>(PLANTS[0]);
  const [bin, setBin] = useState(BINS[0]);
  const [station, setStation] = useState(STATIONS[0]);
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [schedule, setSchedule] = useState(SCHEDULES[1]);
  const [timezone, setTimezone] = useState(TIMEZONES[0]);

  const [howItWorksOpen, setHowItWorksOpen] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [lastSeen] = useState(formatNow());

  const codeValid = deviceCode.trim().length >= 4;
  const mockHostname = codeValid
    ? `minipc-${deviceCode
        .trim()
        .slice(-3)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "0")}`
    : "";

  function handleNext() {
    setShowReview(true);
  }

  function handleRegister() {
    setRegistered(true);
  }

  return (
    <div className="p-6">
      <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/devices" className="hover:underline">
          Devices
        </Link>
        <span>/</span>
        <span className="text-foreground">Register Device</span>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Register New Device</h1>
          <p className="text-sm text-muted-foreground">
            Register a new Mini PC and camera to the system. The device will be synchronized with
            the server configuration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHowItWorksOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <Info className="h-4 w-4" /> How it works
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${howItWorksOpen ? "rotate-180" : ""}`}
            />
          </button>
          <Link
            to="/devices"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </Link>
        </div>
      </header>

      {/* Step indicator (visual only -- this is a mock, single-scroll form) */}
      <div className="mb-6 flex items-center justify-center gap-2 rounded-lg border bg-card px-6 py-4">
        {["Device Identification", "Location & Source", "Configuration", "Review & Finish"].map(
          (label, i) => {
            const stepNum = i + 1;
            const active = showReview ? stepNum === 4 : stepNum === 1;
            const complete = showReview && stepNum < 4;
            return (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      complete
                        ? "bg-primary text-primary-foreground"
                        : active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : stepNum}
                  </span>
                  <span className="hidden text-[11px] text-muted-foreground sm:block">{label}</span>
                </div>
                {stepNum < 4 && <div className="h-px flex-1 bg-border" />}
              </div>
            );
          },
        )}
      </div>

      {registered && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Device registered (demo only — this preview isn't connected to a real device registry
          yet).
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Step 1 */}
          <section className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                1
              </span>
              <div>
                <h2 className="font-semibold">Device Identification</h2>
                <p className="text-xs text-muted-foreground">
                  Enter the device code displayed on the Mini PC Capture Agent.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Device Code <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    value={deviceCode}
                    onChange={(e) => setDeviceCode(e.target.value)}
                    placeholder="e.g. A72F-8812"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm font-mono"
                  />
                  {codeValid && (
                    <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  The device code is shown on the Capture Agent after installation.
                </p>

                <label className="mb-1 mt-4 block text-sm font-medium">
                  Device Name <span className="text-destructive">*</span>
                </label>
                <input
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. MINIPC-004"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  A unique name to identify this device.
                </p>
              </div>

              <div>
                {codeValid ? (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Device Code Valid
                    </div>
                    <p className="mb-3 text-xs text-emerald-700/80">
                      Device found and ready to register.
                    </p>
                    <dl className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Agent Version</dt>
                        <dd className="font-medium">1.2.3</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">OS</dt>
                        <dd className="font-medium">Windows 11 IoT</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Hostname</dt>
                        <dd className="font-medium">{mockHostname}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">IP Address</dt>
                        <dd className="font-medium">10.10.30.16</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Last Seen</dt>
                        <dd className="font-medium text-emerald-700">{lastSeen}</dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                    Enter a device code to look it up.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                2
              </span>
              <div>
                <h2 className="font-semibold">Location &amp; Source</h2>
                <p className="text-xs text-muted-foreground">
                  Set the location (plant) and source (bin) for this sampling device.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Plant / Location{" "}
                  <span className="text-destructive">*</span>
                </label>
                <select
                  value={plant}
                  onChange={(e) => setPlant(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PLANTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" /> Source (Bin){" "}
                  <span className="text-destructive">*</span>
                </label>
                <select
                  value={bin}
                  onChange={(e) => setBin(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {BINS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Station / Area (Optional)</label>
                <select
                  value={station}
                  onChange={(e) => setStation(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {STATIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">Description (Optional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Calcine sampling station - ${plant}`}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </section>

          {/* Step 3 */}
          <section className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                3
              </span>
              <div>
                <h2 className="font-semibold">Configuration (from server template)</h2>
                <p className="text-xs text-muted-foreground">
                  Select a configuration template to apply to this device.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <Settings2 className="h-3.5 w-3.5 text-muted-foreground" /> Configuration Template{" "}
                  <span className="text-destructive">*</span>
                </label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TEMPLATES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Capture Schedule{" "}
                  <span className="text-destructive">*</span>
                </label>
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {SCHEDULES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Timezone{" "}
                  <span className="text-destructive">*</span>
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TIMEZONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                The selected template includes camera settings, naming format, folder paths, and
                upload configuration. You can customize these settings later from the device detail
                page.
              </span>
            </div>
          </section>

          {/* Step 4: Review */}
          {showReview && (
            <section className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  4
                </span>
                <div>
                  <h2 className="font-semibold">Review &amp; Finish</h2>
                  <p className="text-xs text-muted-foreground">
                    Confirm the details before registering.
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Device Code</dt>
                  <dd className="font-medium">{deviceCode || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Device Name</dt>
                  <dd className="font-medium">{deviceName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Plant / Location</dt>
                  <dd className="font-medium">{plant}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Source (Bin)</dt>
                  <dd className="font-medium">{bin}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Station / Area</dt>
                  <dd className="font-medium">{station}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Template</dt>
                  <dd className="font-medium">{template}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Schedule</dt>
                  <dd className="font-medium">{schedule}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Timezone</dt>
                  <dd className="font-medium">{timezone}</dd>
                </div>
              </dl>
            </section>
          )}

          <div className="flex justify-between">
            <Link
              to="/devices"
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </Link>
            {!showReview ? (
              <button
                onClick={handleNext}
                disabled={!codeValid || !deviceName.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleRegister}
                disabled={registered}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Cpu className="h-4 w-4" /> {registered ? "Registered" : "Register Device"}
              </button>
            )}
          </div>
        </div>

        {/* Right info panel */}
        {howItWorksOpen && (
          <aside className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">How to Register a Device</h3>
              <ol className="space-y-3">
                {HOW_IT_WORKS.map((step, i) => (
                  <li key={step.title} className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-xs font-medium">{step.title}</div>
                      <div className="text-xs text-muted-foreground">{step.body}</div>
                      {i === 1 && (
                        <div className="mt-2 rounded-md border bg-muted p-2">
                          <div className="text-[10px] text-muted-foreground">Device Code</div>
                          <div className="font-mono text-sm font-semibold text-emerald-600">
                            A72F-8812
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Status:
                            Ready to register
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">What will be configured?</h3>
              <ul className="space-y-1.5">
                {WHAT_GETS_CONFIGURED.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs">
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>You can edit all settings after registration from the device detail page.</span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
