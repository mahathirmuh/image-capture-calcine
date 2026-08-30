import {
  requestResponseWithSession,
  requestWithSession,
  type AuthSession,
} from "./auth";
import {
  createThumbnailBlob,
  getCachedMediaObjectUrl,
  persistMediaBlob,
} from "./mediaCache";

type CachedMediaResult = {
  session: AuthSession;
  objectUrl: string;
  fromCache: boolean;
};

const captureImageRequests = new Map<number, Promise<CachedMediaResult>>();
const captureThumbRequests = new Map<number, Promise<CachedMediaResult>>();

export type ApiCaptureStatus = "pending" | "saved" | "downloaded";

export type ApiCaptureRecord = {
  id: number;
  deviceCode: string | null;
  deviceName: string | null;
  plant: string | null;
  captureBin: string | null;
  captureSession: string | null;
  capturedBy: string | null;
  station: string | null;
  fileName: string;
  filePath: string;
  capturedAt: string;
  status: ApiCaptureStatus;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  saveMethod?: string | null;
  assetId?: string | null;
  createdAt: string;
};

type CapturesPageResponse = {
  items: ApiCaptureRecord[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

export type CaptureHistoryTone = "verified" | "succeeded" | "retake";

export type CaptureHistoryItem = {
  id: number;
  title: string;
  capturedTime: string;
  capturedDateTime: string;
  session: string;
  plant: string;
  stationBin: string;
  statusLabel: string;
  statusTone: CaptureHistoryTone;
  fileName: string;
  device: string;
};

function buildQuery(params: {
  plant?: string | null;
  session?: string | null;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params.plant && params.plant !== "ALL") query.set("plant", params.plant);
  if (params.session) query.set("session", params.session);
  if (params.limit) query.set("limit", `${params.limit}`);
  if (params.offset) query.set("offset", `${params.offset}`);
  const rendered = query.toString();
  return rendered ? `?${rendered}` : "";
}

function statusPresentation(status: ApiCaptureStatus): {
  label: string;
  tone: CaptureHistoryTone;
} {
  switch (status) {
    case "downloaded":
      return { label: "Downloaded", tone: "verified" };
    case "saved":
      return { label: "Saved", tone: "succeeded" };
    case "pending":
      return { label: "Pending", tone: "retake" };
  }
}

function formatDateTime(iso: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return { time: iso, dateTime: iso };
  }

  return {
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(value),
    dateTime: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value),
  };
}

export function mapCaptureRecordToHistoryItem(record: ApiCaptureRecord): CaptureHistoryItem {
  const formatted = formatDateTime(record.capturedAt);
  const presentation = statusPresentation(record.status);
  const session = record.captureSession ?? "No Session";
  const stationBin = record.captureBin ?? record.station ?? "Unassigned Slot";

  return {
    id: record.id,
    title: record.captureSession && record.captureBin
      ? `${record.captureSession} • ${record.captureBin}`
      : `Capture #${record.id}`,
    capturedTime: formatted.time,
    capturedDateTime: formatted.dateTime,
    session,
    plant: record.plant ?? "Unassigned Plant",
    stationBin,
    statusLabel: presentation.label,
    statusTone: presentation.tone,
    fileName: record.fileName,
    device: record.deviceName ?? record.deviceCode ?? "Unassigned Device",
  };
}

export async function listCaptures(
  session: AuthSession,
  options: {
    plant?: string | null;
    session?: string | null;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ session: AuthSession; data: CapturesPageResponse }> {
  return requestWithSession<CapturesPageResponse>(
    session,
    `/captures${buildQuery(options)}`,
    { method: "GET" },
  );
}

export async function getCapture(
  session: AuthSession,
  id: number,
): Promise<{ session: AuthSession; data: ApiCaptureRecord }> {
  return requestWithSession<ApiCaptureRecord>(session, `/captures/${id}`, {
    method: "GET",
  });
}

export async function getCaptureImage(
  session: AuthSession,
  id: number,
): Promise<CachedMediaResult> {
  const cachedObjectUrl = await getCachedMediaObjectUrl("capture-full", id);
  if (cachedObjectUrl) {
    return {
      session,
      objectUrl: cachedObjectUrl,
      fromCache: true,
    };
  }

  const inFlight = captureImageRequests.get(id);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const { session: freshSession, response } = await requestResponseWithSession(
      session,
      `/captures/${id}/image`,
      { method: "GET" },
    );
    const blob = await response.blob();
    const objectUrl = await persistMediaBlob("capture-full", id, blob);

    // Simpan thumb lokal juga sebagai fallback kalau server belum punya
    // thumbnail untuk record ini.
    const existingThumb = await getCachedMediaObjectUrl("capture-thumb", id);
    if (!existingThumb) {
      const thumb = await createThumbnailBlob(blob, 320);
      if (thumb) {
        await persistMediaBlob("capture-thumb", id, thumb);
      }
    }

    return {
      session: freshSession,
      objectUrl,
      fromCache: false,
    };
  })();

  captureImageRequests.set(id, request);

  try {
    return await request;
  } finally {
    captureImageRequests.delete(id);
  }
}

export async function getCaptureThumb(
  session: AuthSession,
  id: number,
): Promise<CachedMediaResult> {
  const cachedObjectUrl = await getCachedMediaObjectUrl("capture-thumb", id);
  if (cachedObjectUrl) {
    return {
      session,
      objectUrl: cachedObjectUrl,
      fromCache: true,
    };
  }

  const inFlight = captureThumbRequests.get(id);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const { session: freshSession, response } = await requestResponseWithSession(
      session,
      `/captures/${id}/thumb`,
      { method: "GET" },
    );
    const blob = await response.blob();
    const objectUrl = await persistMediaBlob("capture-thumb", id, blob);

    return {
      session: freshSession,
      objectUrl,
      fromCache: false,
    };
  })();

  captureThumbRequests.set(id, request);

  try {
    return await request;
  } finally {
    captureThumbRequests.delete(id);
  }
}

async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  const queue = [...items];
  const parallelism = Math.max(1, limit);

  await Promise.all(
    Array.from({ length: Math.min(parallelism, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item === undefined) return;
        await worker(item);
      }
    }),
  );
}

export async function prefetchCaptureThumbs(
  session: AuthSession,
  options: {
    plant?: string | null;
    pageSize?: number;
    maxRecords?: number;
    concurrency?: number;
  } = {},
): Promise<AuthSession> {
  let currentSession = session;
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 100);
  const maxRecords = Math.max(options.maxRecords ?? 200, 1);
  const concurrency = Math.max(options.concurrency ?? 4, 1);
  let offset = 0;
  let processed = 0;
  let hasMore = true;

  while (hasMore && processed < maxRecords) {
    const remaining = maxRecords - processed;
    const response = await listCaptures(currentSession, {
      plant: options.plant,
      limit: Math.min(pageSize, remaining),
      offset,
    });

    currentSession = response.session;
    const ids = response.data.items.map((item) => item.id);

    await runWithConcurrency(ids, concurrency, async (id) => {
      try {
        const thumb = await getCaptureThumb(currentSession, id);
        currentSession = thumb.session;
      } catch {
        // Thumbnail yang gagal tetap dibiarkan on-demand. Warm-up ini
        // sebaiknya tidak memecahkan flow utama aplikasi.
      }
    });

    processed += ids.length;
    offset += ids.length;
    hasMore = response.data.pagination.hasMore && ids.length > 0;
  }

  return currentSession;
}
