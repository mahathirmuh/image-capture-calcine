import { mkdir, readFile, open, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "../env";
import { PLANTS } from "../locations";
import {
  defaultSchedule,
  scheduleValidation,
  plantToday,
  zonedClock,
  validateCaptureContext,
  type ScheduleSnapshot,
  type ScheduleVersion,
} from "../capture-schedule";

function directory() {
  const root = getServerEnv().CAPTURE_SPOOL_DIR;
  if (!root)
    throw new Error("SCHEDULE_STORAGE_UNAVAILABLE: CAPTURE_SPOOL_DIR belum dikonfigurasi.");
  return join(root, "schedules");
}
export async function readScheduleSnapshot(): Promise<ScheduleSnapshot> {
  const fallback = { revision: 0, versions: PLANTS.map(defaultSchedule), serverNow: Date.now() };
  if (!getServerEnv().CAPTURE_SPOOL_DIR) return fallback;
  try {
    const parsed = JSON.parse(await readFile(join(directory(), "versions.json"), "utf8"));
    if (
      !Number.isInteger(parsed.revision) ||
      parsed.revision < 0 ||
      !Array.isArray(parsed.versions) ||
      !parsed.versions.length ||
      parsed.versions.some(
        (v: ScheduleVersion) =>
          !(PLANTS as readonly string[]).includes(v.plant) || scheduleValidation(v) || !v.id,
      )
    )
      throw new Error("SCHEDULE_STORAGE_INVALID: Data jadwal tidak valid; periksa backup.");
    return { ...parsed, serverNow: Date.now() };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}
export async function saveScheduleVersion(
  input: Omit<ScheduleVersion, "id" | "createdAt" | "createdBy"> & { expectedRevision: number },
  actorId: number,
): Promise<ScheduleSnapshot> {
  if (!(PLANTS as readonly string[]).includes(input.plant)) throw new Error("Plant tidak valid.");
  const invalid = scheduleValidation(input);
  if (invalid) throw new Error(invalid);
  const dir = directory();
  await mkdir(dir, { recursive: true });
  let lock;
  try {
    lock = await open(join(dir, "write.lock"), "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error("Jadwal sedang disimpan. Muat ulang dan coba lagi.");
    throw error;
  }
  const temp = join(dir, `versions-${randomUUID()}.tmp`);
  try {
    const snapshot = await readScheduleSnapshot();
    if (snapshot.revision !== input.expectedRevision)
      throw new Error("Jadwal telah berubah. Muat ulang sebelum menyimpan.");
    const today = plantToday(snapshot.versions, input.plant, Date.now());
    if (
      input.effectiveDate <= today ||
      input.effectiveDate <= zonedClock(Date.now(), input.timezone).date
    )
      throw new Error(
        "Perubahan hanya boleh berlaku mulai besok; riwayat hari ini tetap dipertahankan.",
      );
    const { expectedRevision: _revision, ...values } = input;
    const next = {
      revision: snapshot.revision + 1,
      versions: [
        ...snapshot.versions,
        { ...values, id: randomUUID(), createdAt: new Date().toISOString(), createdBy: actorId },
      ],
    };
    const file = await open(temp, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(next, null, 2));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temp, join(dir, "versions.json"));
    return { ...next, serverNow: Date.now() };
  } finally {
    await unlink(temp).catch(() => undefined);
    await lock.close();
    await unlink(join(dir, "write.lock"));
  }
}
export async function checkScheduledCapture(
  plant: string,
  input?: {
    sessionDate?: string;
    captureSession?: string;
    recovery?: boolean;
  },
) {
  if (!(PLANTS as readonly string[]).includes(plant))
    throw new Error("INVALID_SESSION: Plant tidak valid.");
  const snapshot = await readScheduleSnapshot();
  return validateCaptureContext(snapshot.versions, plant, Date.now(), input);
}
type Receipt = {
  userId: number;
  deviceId: number | null;
  plant: string;
  sessionDate: string;
  captureSession: string;
  capturedAt: number;
  jobId: string;
};
function signature(body: string) {
  const secret = getServerEnv().SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET belum dikonfigurasi.");
  return createHmac("sha256", secret)
    .update("capture-receipt:" + body)
    .digest("base64url");
}
export function issueCaptureReceipt(receipt: Receipt) {
  const body = Buffer.from(JSON.stringify(receipt)).toString("base64url");
  return `${body}.${signature(body)}`;
}
export function verifyCaptureReceipt(token: string, userId: number): Receipt {
  try {
    const [body, supplied, extra] = token.split(".");
    if (!body || !supplied || extra) throw new Error();
    const expected = Buffer.from(signature(body));
    const actual = Buffer.from(supplied);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error();
    const value = JSON.parse(Buffer.from(body, "base64url").toString());
    if (
      value.userId !== userId ||
      !Number.isFinite(value.capturedAt) ||
      value.capturedAt > Date.now() ||
      Date.now() - value.capturedAt > 3600000
    )
      throw new Error();
    return value;
  } catch {
    throw new Error(
      "INVALID_CAPTURE_RECEIPT: Capture receipt tidak valid atau kedaluwarsa. Ambil foto kembali.",
    );
  }
}
