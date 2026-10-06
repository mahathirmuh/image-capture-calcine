import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  Loader2,
  Plug,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
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
  getTemplateLabel,
  loadPresetFilterPreference,
  saveDeviceProfile,
  savePresetFilterPreference,
  type CameraSettings,
  type PresetFilter,
} from "@/lib/device-config";
import { getRegisteredDevice, upsertRegisteredDeviceProfile } from "@/lib/device-registry";
import { testEdgeConnection } from "@/lib/edge-targets";
import { PageTitle } from "@/components/page-shell";
import { commonMessages as c } from "@/i18n/common";
import { deviceRegisterMessages as m } from "@/i18n/device-register";
import { failureText } from "@/i18n/errors";
import { useT, type Message } from "@/lib/i18n";

export const Route = createFileRoute("/devices/register")({
  // Registry kamera dan tujuan simpan itu konfigurasi yang berlaku untuk semua
  // orang, bukan pengaturan per operator. Penjaga tampilan; entri sidebarnya
  // ikut disaring, tapi keduanya tidak menghalangi siapa pun mengetik URL-nya.
  beforeLoad: ({ context }) => {
    if (context.user && context.user.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  validateSearch: z.object({ deviceId: z.coerce.number().int().positive().optional() }),
  component: RegisterDevicePage,
  head: () => ({
    meta: [
      { title: "Daftarkan Device — Capture App" },
      { name: "description", content: "Daftarkan Mini PC dan kamera baru ke alur operasional." },
    ],
  }),
});

const HOW_IT_WORKS = [
  {
    title: m.howStepInstallTitle,
    body: m.howStepInstallBody,
  },
  {
    title: m.howStepAddressTitle,
    body: m.howStepAddressBody,
  },
  {
    title: m.howStepRegisterTitle,
    body: m.howStepRegisterBody,
  },
  {
    title: m.howStepSyncTitle,
    body: m.howStepSyncBody,
  },
];

const WHAT_GETS_CONFIGURED = [
  m.configuredTemplate,
  m.configuredMetadata,
  m.configuredSchedule,
  m.configuredTimezone,
  m.configuredSyncPayload,
];

function RegisterDevicePage() {
  const { deviceId } = Route.useSearch();
  const t = useT();
  const [loadError, setLoadError] = useState<string | Message | null>(null);
  const [hydrating, setHydrating] = useState(!!deviceId);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [deviceCode, setDeviceCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [plant, setPlant] = useState<string>(PLANTS[0]);
  const [bin, setBin] = useState<string>(DEVICE_BINS[0]);
  const [station, setStation] = useState<string>(DEVICE_STATIONS[0]);
  const [description, setDescription] = useState("");
  const [edgeApiUrl, setEdgeApiUrl] = useState("");
  const [probe, setProbe] = useState<{ reachable: boolean; detail: string } | null>(null);
  const probeRequest = useRef(0);
  const [verifiedUrl, setVerifiedUrl] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    probeRequest.current += 1;
    setVerifiedUrl(null);
    setTemplateFilter(loadPresetFilterPreference());
    setRegistered(false);
    setShowReview(false);
    setHydrating(!!deviceId);
    setLoadError(null);
    setProbe(null);
    if (!deviceId) {
      setDeviceCode("");
      setDeviceName("");
      setEdgeApiUrl("");
      setDescription("");
      setPlant(PLANTS[0]);
      setBin(DEVICE_BINS[0]);
      setStation(DEVICE_STATIONS[0]);
      setTemplateId(DEVICE_TEMPLATES[0].id);
      setSchedule(DEVICE_SCHEDULES[1]);
      setTimezone(DEVICE_TIMEZONES[0]);
      setCameraSettings(getTemplateCameraSettings(DEVICE_TEMPLATES[0].id));
      return;
    }
    void getRegisteredDevice({ data: { deviceId } })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) throw new Error(result.message);
        const existing = result.device;
        setDeviceCode(existing.deviceCode);
        setDeviceName(existing.deviceName);
        setPlant(existing.plant);
        setBin(existing.bin);
        setStation(existing.station);
        setDescription(existing.description);
        setEdgeApiUrl(existing.edgeApiUrl ?? "");
        setVerifiedUrl(existing.edgeApiUrl ?? "");
        setTemplateId(existing.templateId);
        setSchedule(existing.schedule);
        setTimezone(existing.timezone);
        setCameraSettings(existing.cameraSettings);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : m.loadFailed);
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId, loadAttempt]);

  useEffect(() => {
    savePresetFilterPreference(templateFilter);
  }, [templateFilter]);

  const codeValid = deviceCode.trim().length > 0 && verifiedUrl === edgeApiUrl.trim();
  function handleNext() {
    setShowReview(true);
  }

  /**
   * Menguji alamat sebelum devicenya ada di registry.
   *
   * Menguji SETELAH menyimpan akan menyisakan baris device yang alamatnya
   * salah di registry sampai ada yang membetulkannya -- dan sampai saat itu
   * resolver akan mengarahkan operator ke mesin yang tidak menjawab.
   */
  async function handleProbe() {
    const request = ++probeRequest.current;
    const url = edgeApiUrl.trim();
    setProbing(true);
    setProbe(null);
    setVerifiedUrl(null);
    try {
      const result = await testEdgeConnection({ data: { url } });
      if (request !== probeRequest.current) return;
      if (!result.ok) {
        setProbe({ reachable: false, detail: failureText(t, result, m.probeFailed) });
        return;
      }
      if (!result.reachable || !result.deviceCode) {
        setProbe({
          reachable: false,
          detail: result.reachable ? t(m.probeNoIdentity) : result.detail,
        });
        return;
      }
      if (deviceId && result.deviceCode !== deviceCode) {
        setProbe({
          reachable: false,
          detail: t(m.probeIdentityMismatch),
        });
        return;
      }
      setDeviceCode(result.deviceCode);
      setDeviceName((current) => (current.trim() ? current : result.deviceCode!));
      setVerifiedUrl(url);
      setProbe({ reachable: true, detail: result.detail });
    } catch (error) {
      if (request !== probeRequest.current) return;
      setProbe({
        reachable: false,
        detail: error instanceof Error ? error.message : t(m.probeFailed),
      });
    } finally {
      if (request === probeRequest.current) setProbing(false);
    }
  }

  async function handleRegister() {
    const profile = createProfileFromInput({
      ...createDefaultDeviceProfile(),
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
      registeredAt: createDefaultDeviceProfile().registeredAt,
    });

    if (registering || hydrating || loadError || !codeValid) return;
    setRegistering(true);
    try {
      const result = await upsertRegisteredDeviceProfile({
        data: {
          deviceId,
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
          edgeApiUrl,
        },
      });

      if (!result.ok) {
        toast.error(t(m.registerFailed), {
          description: failureText(t, result),
        });
        return;
      }

      saveDeviceProfile(result.profile);
      setRegistered(true);
      toast.success(deviceId ? t(m.deviceUpdated) : t(m.deviceRegistered), {
        description: t(m.registrySynced),
      });
    } catch (error) {
      toast.error(t(m.saveFailed), {
        description: error instanceof Error ? error.message : t(m.tryAgainHint),
      });
    } finally {
      setRegistering(false);
    }
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
    toast.success(t(m.presetChanged, { label: nextTemplate.label }), {
      description: t(m.presetChangedDetail),
    });
  }

  const selectedTemplate = getTemplateById(templateId);
  const filteredTemplates = filterTemplatesByTag(templateFilter);
  const compareCandidates = filteredTemplates.filter((template) => template.id !== templateId);

  useEffect(() => {
    if (filteredTemplates.some((template) => template.id === compareTemplateId)) return;
    setCompareTemplateId(compareCandidates[0]?.id ?? templateId);
  }, [compareCandidates, compareTemplateId, filteredTemplates, templateId]);

  if (hydrating || loadError)
    return (
      <main className="p-6 space-y-4">
        <p role={loadError ? "alert" : "status"}>
          {loadError === null
            ? t(m.loadingDevice)
            : typeof loadError === "string"
              ? loadError
              : t(loadError)}
        </p>
        {loadError && (
          <button
            type="button"
            className="rounded-md border px-3 py-2"
            onClick={() => setLoadAttempt((value) => value + 1)}
          >
            {t(c.tryAgain)}
          </button>
        )}
        <Link to="/devices" className="block underline">
          {t(m.backToDevices)}
        </Link>
      </main>
    );
  return (
    <div className="p-6">
      <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/devices" className="hover:underline">
          {t(c.navDevices)}
        </Link>
        <span>/</span>
        <span className="text-foreground">{deviceId ? t(m.editDevice) : t(m.registerDevice)}</span>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageTitle
            title={deviceId ? t(m.editDevice) : t(m.registerNewDevice)}
            description={t(m.pageDescription)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHowItWorksOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <Info className="h-4 w-4" /> {t(m.howItWorks)}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${howItWorksOpen ? "rotate-180" : ""}`}
            />
          </button>
          <Link
            to="/devices"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            {t(m.cancel)}
          </Link>
        </div>
      </header>

      {/* Step indicator (visual only -- this is a mock, single-scroll form) */}
      <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border bg-card shadow-sm px-6 py-4">
        {[m.stepIdentify, m.stepLocation, m.stepConfig, m.stepReview].map((label, i) => {
          const stepNum = i + 1;
          const active = showReview ? stepNum === 4 : stepNum === 1;
          const complete = showReview && stepNum < 4;
          return (
            <div key={label.id} className="flex flex-1 items-center gap-2">
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
                <span className="hidden text-[11px] text-muted-foreground sm:block">
                  {t(label)}
                </span>
              </div>
              {stepNum < 4 && <div className="h-px flex-1 bg-border" />}
            </div>
          );
        })}
      </div>

      {registered && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t(m.savedBanner)}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Step 1 */}
          <section className="rounded-xl border bg-card shadow-sm p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                1
              </span>
              <div>
                <h2 className="font-semibold">{t(m.stepIdentify)}</h2>
                <p className="text-xs text-muted-foreground">{t(m.identifyHint)}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t(m.deviceCode)} <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    value={deviceCode}
                    readOnly
                    placeholder={t(m.deviceCodePlaceholder)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm font-mono"
                  />
                  {codeValid && (
                    <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t(m.deviceCodeHint)}</p>

                <label className="mb-1 mt-4 block text-sm font-medium">
                  {t(m.deviceName)} <span className="text-destructive">*</span>
                </label>
                <input
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder={t(m.deviceNamePlaceholder)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t(m.deviceNameHint)}</p>
              </div>

              <div>
                {codeValid ? (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> {t(m.identityVerified)}
                    </div>
                    <p className="mb-3 text-xs text-emerald-700/80">
                      {t(m.identityVerifiedDetail)}
                    </p>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                    {t(m.identityPending)}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section className="rounded-xl border bg-card shadow-sm p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                2
              </span>
              <div>
                <h2 className="font-semibold">{t(m.stepLocation)}</h2>
                <p className="text-xs text-muted-foreground">{t(m.locationHint)}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {t(m.plantLocation)}{" "}
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
              <div className="sm:col-span-2">
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <Plug className="h-3.5 w-3.5 text-muted-foreground" /> {t(m.edgeApiAddress)}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={edgeApiUrl}
                    onChange={(e) => {
                      setEdgeApiUrl(e.target.value);
                      setProbe(null);
                      setVerifiedUrl(null);
                      probeRequest.current += 1;
                      setProbing(false);
                      if (!deviceId) setDeviceCode("");
                    }}
                    onBlur={() => {
                      if (edgeApiUrl.trim() && verifiedUrl !== edgeApiUrl.trim())
                        void handleProbe();
                    }}
                    spellCheck={false}
                    placeholder="http://10.60.20.155:3000"
                    className="min-w-[14rem] flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleProbe}
                    disabled={probing || edgeApiUrl.trim() === ""}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                  >
                    {probing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plug className="h-4 w-4" />
                    )}
                    {t(m.testConnection)}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t(m.edgeApiAddressHint)}</p>
                {probe && (
                  <p
                    className={`mt-1 text-xs ${probe.reachable ? "text-emerald-700" : "text-destructive"}`}
                  >
                    {probe.detail}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" /> {t(m.sourceBin)}{" "}
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
                <label className="mb-1 block text-sm font-medium">{t(m.stationAreaOptional)}</label>
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
              <label className="mb-1 block text-sm font-medium">{t(m.descriptionOptional)}</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(m.descriptionPlaceholder, { plant })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </section>

          {/* Step 3 */}
          <section className="rounded-xl border bg-card shadow-sm p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                3
              </span>
              <div>
                <h2 className="font-semibold">{t(m.configTitle)}</h2>
                <p className="text-xs text-muted-foreground">{t(m.configHint)}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <Settings2 className="h-3.5 w-3.5 text-muted-foreground" /> {t(m.configTemplate)}{" "}
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
                      {getTemplateLabel(template, t)}
                    </option>
                  ))}
                </select>
                <div className="mt-3">
                  <PresetTemplatePreview template={selectedTemplate} compact />
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {t(m.captureSchedule)}{" "}
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
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {t(m.timezone)}{" "}
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
                    <Camera className="h-4 w-4" /> {t(m.cameraDefaults)}
                  </h3>
                  <p className="text-xs text-muted-foreground">{t(m.cameraDefaultsHint)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCameraSettings(getTemplateCameraSettings(templateId))}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  {t(m.resetFromTemplate)}
                </button>
              </div>

              <PresetTemplatePreview template={selectedTemplate} />

              <div className="mb-4 mt-4 rounded-md border bg-background/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{t(m.presetFilter)}</div>
                    <p className="text-xs text-muted-foreground">{t(m.presetFilterHint)}</p>
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
                  <label className="mb-1 block text-sm font-medium">{t(m.shutterSpeed)}</label>
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
                  <label className="mb-1 block text-sm font-medium">{t(m.aperture)}</label>
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
                  <label className="mb-1 block text-sm font-medium">{t(m.whiteBalance)}</label>
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
                  <label className="mb-1 block text-sm font-medium">{t(m.pictureStyle)}</label>
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
                  <label className="mb-1 block text-sm font-medium">{t(m.focusMode)}</label>
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
                  title={t(m.presetComparison)}
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
              <span>{t(m.configNote)}</span>
            </div>
          </section>

          {/* Step 4: Review */}
          {showReview && (
            <section className="rounded-xl border bg-card shadow-sm p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  4
                </span>
                <div>
                  <h2 className="font-semibold">{t(m.stepReview)}</h2>
                  <p className="text-xs text-muted-foreground">{t(m.reviewHint)}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.deviceCode)}</dt>
                  <dd className="font-medium">{deviceCode || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.deviceName)}</dt>
                  <dd className="font-medium">{deviceName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.plantLocation)}</dt>
                  <dd className="font-medium">{plant}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.sourceBin)}</dt>
                  <dd className="font-medium">{bin}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.stationArea)}</dt>
                  <dd className="font-medium">{station}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.template)}</dt>
                  <dd className="font-medium">{getTemplateLabel(selectedTemplate, t)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.schedule)}</dt>
                  <dd className="font-medium">{schedule}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.timezone)}</dt>
                  <dd className="font-medium">{timezone}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">ISO</dt>
                  <dd className="font-medium">{cameraSettings.iso}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.shutter)}</dt>
                  <dd className="font-medium">{cameraSettings.shutter}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.aperture)}</dt>
                  <dd className="font-medium">{cameraSettings.aperture}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.whiteBalance)}</dt>
                  <dd className="font-medium">{cameraSettings.whiteBalance}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.pictureStyle)}</dt>
                  <dd className="font-medium">{cameraSettings.pictureStyle}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t(m.focusMode)}</dt>
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
              {t(m.cancel)}
            </Link>
            {!showReview ? (
              <button
                onClick={handleNext}
                disabled={!codeValid || !deviceName.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {t(m.next)} <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => void handleRegister()}
                disabled={registered || registering || !codeValid || probing}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Cpu className="h-4 w-4" />{" "}
                {registered
                  ? t(m.alreadySaved)
                  : registering
                    ? t(m.registering)
                    : deviceId
                      ? t(m.saveChanges)
                      : t(m.registerDevice)}
              </button>
            )}
          </div>
        </div>

        {/* Right info panel */}
        {howItWorksOpen && (
          <aside className="space-y-4">
            <div className="rounded-xl border bg-card shadow-sm p-4">
              <h3 className="mb-3 text-sm font-semibold">{t(m.howToRegister)}</h3>
              <ol className="space-y-3">
                {HOW_IT_WORKS.map((step, i) => (
                  <li key={step.title.id} className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-xs font-medium">{t(step.title)}</div>
                      <div className="text-xs text-muted-foreground">{t(step.body)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl border bg-card shadow-sm p-4">
              <h3 className="mb-3 text-sm font-semibold">{t(m.whatGetsConfigured)}</h3>
              <ul className="space-y-1.5">
                {WHAT_GETS_CONFIGURED.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-xs">
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> {t(item)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>{t(m.editableLater)}</span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
