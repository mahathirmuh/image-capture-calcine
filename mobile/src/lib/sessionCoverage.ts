import { requestWithSession, type AuthSession } from "./auth";

export type SessionCoverageResponse = {
  date: string;
  plants: Array<{
    plant: string;
    sessions: Array<{
      session: string;
      hour: number;
      slots: Array<{
        slot: 1 | 2;
        label: string;
        captured: boolean;
        record: {
          id: number;
          capturedAt: string;
          status: "saved" | "pending" | "downloaded";
          fileName?: string | null;
          captureSession?: string | null;
          captureBin?: string | null;
          plant?: string | null;
        } | null;
      }>;
    }>;
    summary: {
      expected: number;
      captured: number;
      missing: number;
    };
  }>;
  summary: {
    expected: number;
    captured: number;
    missing: number;
  };
};

export type TodaySessionStatus = "completed" | "missing" | "upcoming";

export type TodaySessionItem = {
  key: string;
  plant: string;
  session: string;
  hour: number;
  slot: number;
  location: string;
  displayTime: string;
  status: TodaySessionStatus;
  trailing: string | null;
  recordId: number | null;
};

export type TodaySessionsView = {
  date: string;
  plantLabel: string;
  summary: {
    completed: number;
    missing: number;
    upcoming: number;
  };
  items: TodaySessionItem[];
};

function buildQuery(params: { date?: string; plant?: string | null }) {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.plant && params.plant !== "ALL") query.set("plant", params.plant);
  const rendered = query.toString();
  return rendered ? `?${rendered}` : "";
}

function displayTime(sessionLabel: string) {
  return sessionLabel.replace(".", ":");
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCapturedTime(iso: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function inferStatus(date: string, hour: number, captured: boolean): TodaySessionStatus {
  if (captured) return "completed";

  const today = new Date();
  const todayKey = localDateKey(today);
  if (date < todayKey) return "missing";
  if (date > todayKey) return "upcoming";

  const currentMinutes = today.getHours() * 60 + today.getMinutes();
  const sessionMinutes = hour * 60;
  return currentMinutes >= sessionMinutes ? "missing" : "upcoming";
}

export function mapSessionCoverageToView(payload: SessionCoverageResponse): TodaySessionsView {
  const items = payload.plants
    .flatMap((plantCoverage) =>
      plantCoverage.sessions.flatMap((sessionCoverage) =>
        sessionCoverage.slots.map((slotCoverage) => {
          const status = inferStatus(
            payload.date,
            sessionCoverage.hour,
            slotCoverage.captured && !!slotCoverage.record,
          );
          const location =
            payload.plants.length > 1
              ? `${slotCoverage.label} • ${plantCoverage.plant}`
              : slotCoverage.label;

          return {
            key: `${plantCoverage.plant}-${sessionCoverage.session}-${slotCoverage.slot}`,
            plant: plantCoverage.plant,
            session: sessionCoverage.session,
            hour: sessionCoverage.hour,
            slot: slotCoverage.slot,
            location,
            displayTime: displayTime(sessionCoverage.session),
            status,
            trailing: slotCoverage.record?.capturedAt
              ? formatCapturedTime(slotCoverage.record.capturedAt)
              : null,
            recordId: slotCoverage.record?.id ?? null,
          } satisfies TodaySessionItem;
        }),
      ),
    )
    .sort((left, right) => left.hour - right.hour || left.slot - right.slot || left.plant.localeCompare(right.plant));

  const summary = items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { completed: 0, missing: 0, upcoming: 0 },
  );

  return {
    date: payload.date,
    plantLabel:
      payload.plants.length === 1
        ? payload.plants[0]?.plant ?? "Unknown Plant"
        : `${payload.plants.length} Plants`,
    summary,
    items,
  };
}

export async function getSessionCoverage(
  session: AuthSession,
  options: { date?: string; plant?: string | null } = {},
): Promise<{ session: AuthSession; data: SessionCoverageResponse }> {
  return requestWithSession<SessionCoverageResponse>(
    session,
    `/sessions${buildQuery(options)}`,
    { method: "GET" },
  );
}
