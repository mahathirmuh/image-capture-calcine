/** Endpoint address only; this is not an operating-system hostname probe. */
export function deviceEndpointHost(url: string | null | undefined, registeredIp?: string | null) {
  if (url) {
    try {
      return new URL(url).host;
    } catch {
      return "Alamat Edge API tidak valid";
    }
  }
  return registeredIp || "Alamat belum diisi";
}
