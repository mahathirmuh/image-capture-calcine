import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
async function currentUser() {
  const { getAppSession } = await import("./server/session");
  const { findUserById } = await import("./server/users");
  const session = await getAppSession();
  const id = session.data.user?.id;
  const user = id ? await findUserById(id) : null;
  if (!user?.isActive) throw new Error("Sesi Anda sudah berakhir. Silakan login kembali.");
  return user;
}
export const fetchCaptureSchedules = createServerFn({ method: "GET" }).handler(async () => {
  await currentUser();
  const { readScheduleSnapshot } = await import("./server/capture-schedules");
  return readScheduleSnapshot();
});
export const updateCaptureSchedule = createServerFn({ method: "POST" })
  .validator(
    z.object({
      plant: z.string(),
      startHour: z.number().int(),
      intervalHours: z.number().int(),
      windowMinutes: z.number().int(),
      timezone: z.string(),
      effectiveDate: z.string(),
      expectedRevision: z.number().int(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await currentUser();
    if (user.role !== "admin") throw new Error("Hanya Super Admin yang boleh mengubah jadwal.");
    const { saveScheduleVersion } = await import("./server/capture-schedules");
    return saveScheduleVersion(data, user.id);
  });
