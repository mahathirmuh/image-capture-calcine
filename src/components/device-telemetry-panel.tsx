import { type DeviceTelemetry, telemetryCapacity, telemetryPercent } from "@/lib/device-telemetry";
export function DeviceTelemetryPanel({
  telemetry,
  loading,
  error,
}: {
  telemetry: DeviceTelemetry | null;
  loading: boolean;
  error: string | null;
}) {
  const rows = [
    ["CPU host", telemetryPercent(telemetry?.cpu.usagePercent)],
    ["RAM host", telemetryCapacity(telemetry?.memory)],
    ["Disk penyimpanan data", telemetryCapacity(telemetry?.disk)],
    [
      "Suhu CPU",
      telemetry?.temperature.celsius == null
        ? "Sensor tidak tersedia"
        : `${telemetry.temperature.celsius.toFixed(1)} °C`,
    ],
    [
      "Uptime host",
      telemetry?.uptimeSeconds == null
        ? "Tidak tersedia"
        : `${Math.floor(telemetry.uptimeSeconds / 86400)} hari ${Math.floor(telemetry.uptimeSeconds / 3600) % 24} jam`,
    ],
  ];
  return (
    <>
      <dl className="space-y-2 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="ml-auto text-right">
              {telemetry ? value : loading ? "Memuat..." : "Tidak tersedia"}
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
          Diukur: {new Date(telemetry.sampledAt).toLocaleString("id-ID")}. CPU rata-rata selama{" "}
          {telemetry.cpu.sampleWindowMs} ms. Disk adalah filesystem tempat data aplikasi disimpan.
        </p>
      )}
    </>
  );
}
