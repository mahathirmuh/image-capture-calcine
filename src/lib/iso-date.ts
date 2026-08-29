// Konversi tanggal <-> "YYYY-MM-DD" untuk filter dan preferensi.
//
// Dipisahkan dari komponen pemilih tanggalnya supaya bisa diuji apa adanya:
// mengimpor komponennya akan menarik react-day-picker dan React ke lingkungan
// uji, padahal yang perlu dipastikan di sini murni aritmetika kalender.

/**
 * Tanggal lokal -> "YYYY-MM-DD", TANPA lewat UTC.
 *
 * `toISOString()` menggeser ke UTC lebih dulu, dan di WITA (UTC+8) itu membuat
 * tanggal yang dipilih sebelum pukul 08.00 mundur satu hari. Filter tanggal
 * yang meleset sehari tidak pernah terlihat sebagai kesalahan -- gejalanya
 * hanya "kok fotonya tidak ada".
 */
export function toIsoDate(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * "YYYY-MM-DD" -> Date lokal, atau `undefined` kalau kosong atau tidak sah.
 *
 * String kosong berarti "semua tanggal" dan itu keadaan yang sah, jadi ia
 * menghasilkan `undefined` -- bukan Invalid Date yang akan menular ke seluruh
 * perhitungan sesudahnya.
 */
export function fromIsoDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** "2026-08-29" -> "29 Agustus 2026". `null` kalau nilainya tidak sah. */
export function formatIsoDateLabel(value: string): string | null {
  const date = fromIsoDate(value);
  if (!date) return null;
  return `${date.getDate()} ${BULAN[date.getMonth()]} ${date.getFullYear()}`;
}
