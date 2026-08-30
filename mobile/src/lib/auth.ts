import { Preferences } from "@capacitor/preferences";

const STORAGE_KEY = "capture-calcine.auth-session";
const ACCESS_REFRESH_SKEW_MS = 5 * 60_000;

export type AuthUser = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  plant?: string | null;
};

export type AuthSession = {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  user: AuthUser;
};

type LoginResponse = {
  token: string;
  tokenType: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  user: AuthUser;
};

type MeResponse = {
  user: AuthUser;
  token: {
    issuedAt: string;
    expiresAt: string;
  };
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class MobileAuthError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status = 500, code: string | null = null) {
    super(message);
    this.name = "MobileAuthError";
    this.status = status;
    this.code = code;
  }
}

function configuredApiBaseUrl(): string {
  const raw =
    import.meta.env.VITE_API_BASE_URL?.trim() || __MOBILE_DEFAULT_API_BASE_URL__?.trim();
  if (!raw) {
    throw new MobileAuthError(
      "API base URL untuk mobile belum diisi. Set MOBILE_API_BASE_URL atau API_BASE_URL di root .env, atau override dengan VITE_API_BASE_URL di folder mobile.",
      500,
      "MOBILE_API_URL_MISSING",
    );
  }
  const normalized = raw.replace(/\/+$/, "");
  return normalized.endsWith("/api/v1") ? normalized : `${normalized}/api/v1`;
}

function loginApiKey(): string {
  const key = import.meta.env.VITE_API_KEY?.trim() || __MOBILE_DEFAULT_API_KEY__?.trim();
  if (!key) {
    throw new MobileAuthError(
      "API key untuk login mobile belum diisi. Set MOBILE_API_KEY di root .env, isi API_KEYS, atau override dengan VITE_API_KEY di folder mobile.",
      500,
      "MOBILE_API_KEY_MISSING",
    );
  }
  return key;
}

function mapAuthSession(payload: LoginResponse): AuthSession {
  return {
    accessToken: payload.token,
    accessExpiresAt: payload.expiresAt,
    refreshToken: payload.refreshToken,
    refreshExpiresAt: payload.refreshExpiresAt,
    user: payload.user,
  };
}

function isExpiringSoon(iso: string, skewMs = ACCESS_REFRESH_SKEW_MS): boolean {
  const expiresAt = Date.parse(iso);
  if (Number.isNaN(expiresAt)) return true;
  return expiresAt - Date.now() <= skewMs;
}

function isExpired(iso: string): boolean {
  const expiresAt = Date.parse(iso);
  if (Number.isNaN(expiresAt)) return true;
  return expiresAt <= Date.now();
}

async function readStoredSession(): Promise<AuthSession | null> {
  const stored = await Preferences.get({ key: STORAGE_KEY });
  if (!stored.value) return null;
  try {
    return JSON.parse(stored.value) as AuthSession;
  } catch {
    await Preferences.remove({ key: STORAGE_KEY });
    return null;
  }
}

export async function persistSession(session: AuthSession): Promise<void> {
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(session) });
}

export async function clearPersistedSession(): Promise<void> {
  await Preferences.remove({ key: STORAGE_KEY });
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${configuredApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as T | ApiErrorPayload)
    : null;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error?.message
        ? payload.error.message
        : `Request gagal dengan status ${response.status}.`;
    const code =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error?.code
        ? payload.error.code
        : null;
    throw new MobileAuthError(message, response.status, code);
  }

  return payload as T;
}

async function fetchMe(accessToken: string): Promise<MeResponse> {
  return requestJson<MeResponse>("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function login(identifier: string, password: string): Promise<AuthSession> {
  const response = await requestJson<LoginResponse>("/auth/login", {
    method: "POST",
    headers: {
      "X-API-Key": loginApiKey(),
    },
    body: JSON.stringify({ identifier, password }),
  });
  const session = mapAuthSession(response);
  await persistSession(session);
  return session;
}

export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  const response = await requestJson<LoginResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  const session = mapAuthSession(response);
  await persistSession(session);
  return session;
}

export async function logout(session: AuthSession): Promise<void> {
  try {
    await requestJson<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
  } finally {
    await clearPersistedSession();
  }
}

export async function restoreSession(): Promise<AuthSession | null> {
  const stored = await readStoredSession();
  if (!stored) return null;

  try {
    if (!isExpired(stored.refreshExpiresAt) && isExpiringSoon(stored.accessExpiresAt)) {
      return await refreshSession(stored.refreshToken);
    }

    const me = await fetchMe(stored.accessToken);
    const refreshed = {
      ...stored,
      accessExpiresAt: me.token.expiresAt,
      user: me.user,
    };
    await persistSession(refreshed);
    return refreshed;
  } catch (error) {
    if (
      error instanceof MobileAuthError &&
      error.status === 401 &&
      !isExpired(stored.refreshExpiresAt)
    ) {
      try {
        return await refreshSession(stored.refreshToken);
      } catch {
        await clearPersistedSession();
        return null;
      }
    }

    await clearPersistedSession();
    return null;
  }
}

export async function ensureFreshSession(session: AuthSession): Promise<AuthSession> {
  if (!isExpiringSoon(session.accessExpiresAt)) return session;
  if (isExpired(session.refreshExpiresAt)) {
    await clearPersistedSession();
    throw new MobileAuthError("Sesi mobile sudah habis. Login lagi.", 401, "REFRESH_EXPIRED");
  }
  return refreshSession(session.refreshToken);
}

export function msUntilRefresh(accessExpiresAt: string): number {
  const expiresAt = Date.parse(accessExpiresAt);
  if (Number.isNaN(expiresAt)) return 0;
  return Math.max(0, expiresAt - Date.now() - ACCESS_REFRESH_SKEW_MS);
}
