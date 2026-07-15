// Single source of truth for the plant/location taxonomy, shared between the
// Capture page (operator picks which plant they're sampling for) and the
// Devices > Register Device wizard (mock plant assignment for a new device).

export const PLANTS = ["Acid Plant", "Chloride Plant"] as const;
export type Plant = (typeof PLANTS)[number];

// Short location codes used in filenames: Acid Plant -> AP, Chloride Plant -> CP.
const LOCATION_CODES: Record<Plant, string> = {
  "Acid Plant": "AP",
  "Chloride Plant": "CP",
};

export function toLocationToken(plant: string): string {
  if (plant in LOCATION_CODES) return LOCATION_CODES[plant as Plant];
  // Fallback for any unexpected value: initials of each word (e.g. "Acid
  // Plant" -> "AP"), so a filename never ends up with an empty location.
  const initials = plant
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "XX";
}
