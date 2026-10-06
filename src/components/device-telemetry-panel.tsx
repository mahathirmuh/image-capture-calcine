import { deviceTelemetryMessages as m } from "@/i18n/devices";
import { type DeviceTelemetry, telemetryCapacity, telemetryPercent } from "@/lib/device-telemetry";
import { useNativeLocale, useT, type Message } from "@/lib/i18n";
export function DeviceTelemetryPanel({
  telemetry,
  loading,
  error,
}: {
  telemetry: DeviceTelemetry | null;
  loading: boolean;
  error: string | null;
}) {
  const t = useT();
  const locale = useNativeLocale();
  const rows: Array<[Message, string]> = [
    [m.cpuHost, telemetryPercent(telemetry?.cpu.usagePercent, t)],
    [m.ramHost, telemetryCapacity(telemetry?.memory, t)],
    [m.dataDisk, telemetryCapacity(telemetry?.disk, t)],
    [
      m.cpuTemperature,
      telemetry?.temperature.celsius == null
        ? t(m.sensorUnavailable)
        : `${telemetry.temperature.celsius.toFixed(1)} °C`,
    ],
    [
      m.hostUptime,
      telemetry?.uptimeSeconds == null
        ? t(m.notAvailable)
        : t(m.uptimeValue, {
            days: Math.floor(telemetry.uptimeSeconds / 86400),
            hours: Math.floor(telemetry.uptimeSeconds / 3600) % 24,
          }),
    ],
  ];
  return (
    <>
      <dl className="space-y-2 text-xs">
        {rows.map(([label, value]) => (
          <div key={label.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">{t(label)}</dt>
            <dd className="ml-auto text-right">
              {telemetry ? value : loading ? t(m.loading) : t(m.notAvailable)}
            </dd>
          </div>
        ))}
      </dl>
      {error && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {error}
        </p>
      )}
      {telemetry && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t(m.measuredNote, {
            when: new Date(telemetry.sampledAt).toLocaleString(locale),
            window: telemetry.cpu.sampleWindowMs,
          })}
        </p>
      )}
    </>
  );
}
