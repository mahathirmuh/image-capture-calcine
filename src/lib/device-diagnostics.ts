import { deviceTelemetryMessages as m } from "@/i18n/devices";
import { translateId, type Translator } from "@/lib/i18n";

/** Endpoint address only; this is not an operating-system hostname probe. */
export function deviceEndpointHost(
  url: string | null | undefined,
  registeredIp?: string | null,
  t: Translator = translateId,
) {
  if (url) {
    try {
      return new URL(url).host;
    } catch {
      return t(m.invalidEdgeAddress);
    }
  }
  return registeredIp || t(m.addressNotSet);
}
