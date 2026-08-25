// Single source of truth for the plant/location taxonomy, shared between the
// Capture page (operator picks which plant they're sampling for) and the
// Devices > Register Device wizard (mock plant assignment for a new device).

// Ejaannya dipertahankan bergaya "<Nama> Plant" mengikuti dua nilai yang sudah
// lebih dulu tersimpan di 18 baris tabel locations dan di device_assignments.
// Menyeragamkannya jadi huruf besar semua akan menuntut migrasi kedua tabel itu
// sekaligus membuat token nama berkas lama tidak lagi cocok.
export const PLANTS = [
  "Acid Plant",
  "Chloride Plant",
  "Pyrite Plant",
  "Copper Cathode Plant",
] as const;
export type Plant = (typeof PLANTS)[number];

// Short location codes used in filenames: Acid Plant -> AP, Chloride Plant -> CP.
//
// Ditulis eksplisit, tidak diturunkan dari inisial: "Copper Cathode Plant" akan
// menghasilkan "CCP" kalau dihitung otomatis, sementara berkas yang sudah ada
// memakai pola dua huruf.
const LOCATION_CODES: Record<Plant, string> = {
  "Acid Plant": "AP",
  "Chloride Plant": "CP",
  "Pyrite Plant": "PY",
  "Copper Cathode Plant": "CC",
};

// Sebutan untuk dua slot capture, berbeda per plant. Acid Plant menyebutnya
// TRAIN, Chloride Plant menyebutnya BIN -- itu istilah lapangan masing-masing
// plant, bukan sinonim yang boleh dipertukarkan di layar operator.
//
// Plant yang belum punya sebutan sendiri tetap memakai BIN. Ditulis eksplisit
// per plant, bukan lewat default diam-diam, supaya menambah plant baru memaksa
// keputusan sadar tentang istilah mana yang dipakai di sana.
const BIN_TERMS: Record<Plant, string> = {
  "Acid Plant": "TRAIN",
  "Chloride Plant": "BIN",
  "Pyrite Plant": "BIN",
  "Copper Cathode Plant": "BIN",
};

/** Slot capture: dua per plant, dibedakan hanya oleh nomornya. */
export type BinSlot = 1 | 2;

export const BIN_SLOTS: readonly BinSlot[] = [1, 2];

function toBinTerm(plant: string): string {
  return plant in BIN_TERMS ? BIN_TERMS[plant as Plant] : "BIN";
}

/**
 * Label yang dilihat operator dan yang tersimpan sebagai `captureBin`:
 * "TRAIN 1" di Acid Plant, "BIN 1" di Chloride Plant.
 */
export function toBinLabel(plant: string, slot: BinSlot): string {
  return `${toBinTerm(plant)} ${slot}`;
}

/**
 * Nomor slot dari label apa pun: "BIN 1", "BIN1", "TRAIN 1", "train2".
 *
 * Dipakai untuk membandingkan capture lintas plant. Satu galeri bisa memuat
 * record Acid Plant ("TRAIN 1") dan Chloride Plant ("BIN 1") sekaligus, dan
 * keduanya menunjuk slot yang sama -- membandingkan teksnya akan memisahkan
 * yang seharusnya satu kelompok. Mengembalikan null kalau tidak dikenali.
 */
export function toBinSlot(value: string | null | undefined): BinSlot | null {
  if (!value) return null;
  const match = value
    .trim()
    .toUpperCase()
    .match(/^(?:BIN|TRAIN)\s*([12])$/);
  return match ? (Number(match[1]) as BinSlot) : null;
}

/**
 * Bentuk tanpa spasi untuk token `{SOURCE}` di nama berkas: "BIN1", "TRAIN1".
 * Sengaja dipisah dari label supaya nama berkas tidak pernah mengandung spasi
 * yang tidak disengaja.
 */
export function toBinToken(plant: string, slot: BinSlot): string {
  return `${toBinTerm(plant)}${slot}`;
}

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
