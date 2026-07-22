import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Camera,
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
import { toast } from "sonner";
import {
  PresetCompareTable,
  PresetExplorerGrid,
  PresetFilterBar,
  PresetTemplatePreview,
} from "@/components/preset-ui";
import { PLANTS } from "@/lib/locations";
import {
  APERTURE_OPTIONS,
  DEVICE_BINS,
  DEVICE_SCHEDULES,
  DEVICE_STATIONS,
  DEVICE_TEMPLATES,
  DEVICE_TIMEZONES,
  FOCUS_MODE_OPTIONS,
  ISO_OPTIONS,
  PRESET_FILTERS,
  PICTURE_STYLE_OPTIONS,
  SHUTTER_OPTIONS,
  WHITE_BALANCE_OPTIONS,
  createDefaultDeviceProfile,
  createProfileFromInput,
  filterTemplatesByTag,
  getTemplateById,
  getTemplateCameraSettings,
  loadDeviceProfile,
  loadPresetFilterPreference,
  saveDeviceProfile,
  savePresetFilterPreference,
  type CameraSettings,
  type PresetFilter,
} from "@/lib/device-config";
import { upsertRegisteredDeviceProfile } from "@/lib/device-registry";

export const Route = createFileRoute("/devices/register")({
  component: RegisterDevicePage,
  head: () => ({
    meta: [
      { title: "Daftarkan Device — Capture App" },
      { name: "description", content: "Daftarkan Mini PC dan kamera baru ke alur operasional." },
    ],
  }),
});

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
    body: "Pasang Capture Agent di Mini PC lalu hubungkan kameranya.",
  },
  {
    title: "Ambil Device Code",
    body: "Buka Capture Agent. Anda akan melihat Device Code yang unik.",
  },
  {
    title: "Daftarkan di Web UI",
    body: "Masukkan device code di halaman ini lalu selesaikan proses pendaftarannya.",
  },
  {
    title: "Sinkron & Siap",
    body: "Device akan menyelaraskan konfigurasi dari server lalu siap dipakai capture.",
  },
];

const WHAT_GETS_CONFIGURED = [
  "Template profil kamera dan default exposure manual",
  "Metadata plant, source bin, dan station",
  "Jadwal capture",
  "Timezone dan catatan operator",
  "Payload sinkronisasi untuk rollout edge-agent berikutnya",
];

function RegisterDevicePage() {
  const [deviceCode, setDeviceCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [plant, setPlant] = useState<string>(PLANTS[0]);
  const [bin, setBin] = useState<string>(DEVICE_BINS[0]);
  const [station, setStation] = useState<string>(DEVICE_STATIONS[0]);
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState(DEVICE_TEMPLATES[0].id);
  const [templateFilter, setTemplateFilter] = useState<PresetFilter>(PRESET_FILTERS[0]);
  const [compareTemplateId, setCompareTemplateId] = useState(
    DEVICE_TEMPLATES[1]?.id ?? DEVICE_TEMPLATES[0].id,
  );
  const [schedule, setSchedule] = useState<string>(DEVICE_SCHEDULES[1]);
  const [timezone, setTimezone] = useState<string>(DEVICE_TIMEZONES[0]);
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>(
    getTemplateCameraSettings(DEVICE_TEMPLATES[0].id),
  );

  const [howItWorksOpen, setHowItWorksOpen] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [lastSeen] = useState(formatNow());

  useEffect(() => {
    const existing = loadDeviceProfile();
    setTemplateFilter(loadPresetFilterPreference());
    if (!existing) return;
    setDeviceCode(existing.deviceCode);
    setDeviceName(existing.deviceName);
    setPlant(existing.plant);
    setBin(existing.bin);
    setStation(existing.station);
    setDescription(existing.description);
    setTemplateId(existing.templateId);
    setCompareTemplateId(
      DEVICE_TEMPLATES.find((template) => template.id !== existing.templateId)?.id ??
        existing.templateId,
    );
    setSchedule(existing.schedule);
    setTimezone(existing.timezone);
    setCameraSettings(existing.cameraSettings);
  }, []);

  useEffect(() => {
    savePresetFilterPreference(templateFilter);
  }, [templateFilter]);

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

  async function handleRegister() {
    const existing = loadDeviceProfile();
    const profile = createProfileFromInput({
      deviceCode: deviceCode.trim(),
      deviceName: deviceName.trim(),
      plant,
      bin,
      station,
      description: description.trim(),
      templateId,
      schedule,
      timezone,
      cameraSettings,
      registeredAt: existing?.registeredAt ?? createDefaultDeviceProfile().registeredAt,
    });

    setRegistering(true);
    const result = await upsertRegisteredDeviceProfile({
      data: {
        deviceCode: profile.deviceCode,
        deviceName: profile.deviceName,
        plant: profile.plant,
        bin: profile.bin,
        station: profile.station,
        description: profile.description,
        templateId: profile.templateId,
        schedule: profile.schedule,
        timezone: profile.timezone,
        cameraSettings: profile.cameraSettings,
      },
    });
    setRegistering(false);

    if (!result.ok) {
      toast.error("Gagal mendaftarkan device", {
        description: result.message,
      });
      return;
    }

    saveDeviceProfile(result.profile);
    setRegistered(true);
    toast.success("Device berhasil didaftarkan", {
      description: "Registry MSSQL dan profil lokal sudah sinkron.",
    });
  }

  function updateCameraSetting<K extends keyof CameraSettings>(key: K, value: CameraSettings[K]) {
    setCameraSettings((current) => ({ ...current, [key]: value }));
  }

  function selectTemplate(nextTemplateId: string) {
    setTemplateId(nextTemplateId);
    setCameraSettings(getTemplateCameraSettings(nextTemplateId));
  }

  function handleUseTemplate(nextTemplateId: string) {
    selectTemplate(nextTemplateId);
    const nextTemplate = getTemplateById(nextTemplateId);
    toast.success(`Preset aktif diubah ke "${nextTemplate.label}"`, {
      description: "Camera defaults telah mengikuti template terpilih.",
    });
  }

  const selectedTemplate = getTemplateById(templateId);
  const filteredTemplates = filterTemplatesByTag(templateFilter);
  const compareCandidates = filteredTemplates.filter((template) => template.id !== templateId);

  useEffect(() => {
    if (filteredTemplates.some((template) => template.id === compareTemplateId)) return;
    setCompareTemplateId(compareCandidates[0]?.id ?? templateId);
  }, [compareCandidates, compareTemplateId, filteredTemplates, templateId]);

  return (
    <div className="p-6">
      <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/devices" className="hover:underline">
          Devices
        </Link>
        <span>/</span>
        <span className="text-foreground">Daftarkan Device</span>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daftarkan Device Baru</h1>
          <p className="text-sm text-muted-foreground">
            Daftarkan Mini PC aktif lalu siapkan profil devicenya. Pengaturan kamera disimpan di
            aplikasi ini sekarang dan nantinya bisa disinkronkan ke edge agent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHowItWorksOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <Info className="h-4 w-4" /> Cara kerjanya
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${howItWorksOpen ? "rotate-180" : ""}`}
            />
          </button>
          <Link
            to="/devices"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Batal
          </Link>
        </div>
      </header>

      {/* Step indicator (visual only -- this is a mock, single-scroll form) */}
      <div className="mb-6 flex items-center justify-center gap-2 rounded-lg border bg-card px-6 py-4">
        {["Identifikasi Device", "Lokasi & Sumber", "Konfigurasi", "Tinjau & Selesai"].map(
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
          Device sudah tersimpan ke registry MSSQL dan profil aktif lokal sudah diperbarui.
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
                <h2 className="font-semibold">Identifikasi Device</h2>
                <p className="text-xs text-muted-foreground">
                  Masukkan device code yang tampil di Mini PC Capture Agent.
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
                  Device code ditampilkan oleh Capture Agent setelah proses instalasi.
                </p>

                <label className="mb-1 mt-4 block text-sm font-medium">
                  Nama Device <span className="text-destructive">*</span>
                </label>
                <input
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. MINIPC-004"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Gunakan nama unik agar device ini mudah dikenali operator.
                </p>
              </div>

              <div>
                {codeValid ? (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Device Code sudah valid
                    </div>
                    <p className="mb-3 text-xs text-emerald-700/80">
                      Device ditemukan dan siap didaftarkan.
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
                        <dt className="text-muted-foreground">Terakhir terlihat</dt>
                        <dd className="font-medium text-emerald-700">{lastSeen}</dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                    Masukkan device code untuk mulai pengecekan.
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
                <h2 className="font-semibold">Lokasi &amp; Sumber</h2>
                <p className="text-xs text-muted-foreground">
                  Tentukan lokasi plant dan sumber bin untuk device sampling ini.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Plant / Lokasi{" "}
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
                  <Package className="h-3.5 w-3.5 text-muted-foreground" /> Sumber (Bin){" "}
                  <span className="text-destructive">*</span>
                </label>
                <select
                  value={bin}
                  onChange={(e) => setBin(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {DEVICE_BINS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Station / Area (Opsional)</label>
                <select
                  value={station}
                  onChange={(e) => setStation(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {DEVICE_STATIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">Deskripsi (Opsional)</label>
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
                <h2 className="font-semibold">Konfigurasi &amp; Profil Kamera</h2>
                <p className="text-xs text-muted-foreground">
                  Pilih template, lalu rapikan default kamera yang akan menjadi bagian dari profil
                  device ini.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <Settings2 className="h-3.5 w-3.5 text-muted-foreground" /> Template Konfigurasi{" "}
                  <span className="text-destructive">*</span>
                </label>
                <select
                  value={templateId}
                  onChange={(e) => {
                    selectTemplate(e.target.value);
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {DEVICE_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
                <div className="mt-3">
                  <PresetTemplatePreview template={selectedTemplate} compact />
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Jadwal Capture{" "}
                  <span className="text-destructive">*</span>
                </label>
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {DEVICE_SCHEDULES.map((s) => (
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
                  {DEVICE_TIMEZONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Camera className="h-4 w-4" /> Default Kamera
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Pengaturan ini disimpan sebagai baseline profil device. Proses apply atau sync
                    ke hardware tetap mengikuti alur edge API pada halaman Devices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCameraSettings(getTemplateCameraSettings(templateId))}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Reset dari template
                </button>
              </div>

              <PresetTemplatePreview template={selectedTemplate} />

              <div className="mb-4 mt-4 rounded-md border bg-background/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Filter Preset</div>
                    <p className="text-xs text-muted-foreground">
                      Saring preset explorer berdasarkan skenario sebelum memilih template.
                    </p>
                  </div>
                </div>
                <PresetFilterBar value={templateFilter} onChange={setTemplateFilter} />
                <div className="mt-3">
                  <PresetExplorerGrid
                    templates={filteredTemplates}
                    selectedTemplateId={templateId}
                    onSelectTemplate={selectTemplate}
                    onUseTemplate={handleUseTemplate}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">ISO</label>
                  <select
                    value={cameraSettings.iso}
                    onChange={(e) =>
                      updateCameraSetting("iso", e.target.value as CameraSettings["iso"])
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {ISO_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Shutter Speed</label>
                  <select
                    value={cameraSettings.shutter}
                    onChange={(e) =>
                      updateCameraSetting("shutter", e.target.value as CameraSettings["shutter"])
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {SHUTTER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Aperture</label>
                  <select
                    value={cameraSettings.aperture}
                    onChange={(e) =>
                      updateCameraSetting("aperture", e.target.value as CameraSettings["aperture"])
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {APERTURE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">White Balance</label>
                  <select
                    value={cameraSettings.whiteBalance}
                    onChange={(e) =>
                      updateCameraSetting(
                        "whiteBalance",
                        e.target.value as CameraSettings["whiteBalance"],
                      )
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {WHITE_BALANCE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Picture Style</label>
                  <select
                    value={cameraSettings.pictureStyle}
                    onChange={(e) =>
                      updateCameraSetting(
                        "pictureStyle",
                        e.target.value as CameraSettings["pictureStyle"],
                      )
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {PICTURE_STYLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Focus Mode</label>
                  <select
                    value={cameraSettings.focusMode}
                    onChange={(e) =>
                      updateCameraSetting(
                        "focusMode",
                        e.target.value as CameraSettings["focusMode"],
                      )
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {FOCUS_MODE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <PresetCompareTable
                  title="Perbandingan Preset"
                  baseTemplate={selectedTemplate}
                  compareOptions={compareCandidates}
                  compareTemplateId={compareTemplateId}
                  onCompareTemplateChange={setCompareTemplateId}
                  onUseBaseTemplate={() => handleUseTemplate(templateId)}
                />
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                Tahap ini menyimpan profil device ke registry MSSQL dan profil lokal operator agar
                `/devices` bisa menjadi pusat kontrol default kamera. Mengirim nilai tersebut ke
                kamera fisik tetap mengikuti endpoint edge API.
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
                  <h2 className="font-semibold">Tinjau &amp; Selesai</h2>
                  <p className="text-xs text-muted-foreground">
                    Konfirmasi detail konfigurasi sebelum device didaftarkan.
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Device Code</dt>
                  <dd className="font-medium">{deviceCode || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Nama Device</dt>
                  <dd className="font-medium">{deviceName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Plant / Lokasi</dt>
                  <dd className="font-medium">{plant}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sumber (Bin)</dt>
                  <dd className="font-medium">{bin}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Station / Area</dt>
                  <dd className="font-medium">{station}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Template</dt>
                  <dd className="font-medium">{selectedTemplate.label}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Jadwal</dt>
                  <dd className="font-medium">{schedule}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Timezone</dt>
                  <dd className="font-medium">{timezone}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">ISO</dt>
                  <dd className="font-medium">{cameraSettings.iso}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Shutter</dt>
                  <dd className="font-medium">{cameraSettings.shutter}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Aperture</dt>
                  <dd className="font-medium">{cameraSettings.aperture}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">White Balance</dt>
                  <dd className="font-medium">{cameraSettings.whiteBalance}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Picture Style</dt>
                  <dd className="font-medium">{cameraSettings.pictureStyle}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Focus Mode</dt>
                  <dd className="font-medium">{cameraSettings.focusMode}</dd>
                </div>
              </dl>
            </section>
          )}

          <div className="flex justify-between">
            <Link
              to="/devices"
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Batal
            </Link>
            {!showReview ? (
              <button
                onClick={handleNext}
                disabled={!codeValid || !deviceName.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Lanjut <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => void handleRegister()}
                disabled={registered || registering}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Cpu className="h-4 w-4" />{" "}
                {registered
                  ? "Sudah didaftarkan"
                  : registering
                    ? "Mendaftarkan..."
                    : "Daftarkan Device"}
              </button>
            )}
          </div>
        </div>

        {/* Right info panel */}
        {howItWorksOpen && (
          <aside className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Cara Mendaftarkan Device</h3>
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
                            Siap didaftarkan
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Apa saja yang akan dikonfigurasi?</h3>
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
              <span>
                Semua pengaturan masih bisa diedit lagi setelah pendaftaran dari halaman detail
                device.
              </span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
