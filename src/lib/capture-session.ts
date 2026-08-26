// Jadwal sesi sampling: delapan sesi per hari, jarak tetap tiga jam.
//
// Sesi menentukan dua hal sekaligus -- nama berkas ("02.00 Train 1.jpg") dan
// folder tanggal tempat berkas itu mendarat. Keduanya diturunkan dari sesi,
// BUKAN dari jam dinding, karena sesi 23.00 melewati tengah malam: capture
// pukul 00.30 milik sesi 23.00 dan harus masuk folder tanggal kemarin, bukan
// hari ini. Tanpa itu, satu sesi terbelah di dua folder.
//
// Waktu asli capture tetap tersimpan terpisah di kolom `captured_at`, jadi
// pilihan sesi yang keliru tidak pernah menghapus kebenaran -- lihat
// `recordCaptureResult`.
export const CAPTURE_SESSION_HOURS = [2, 5, 8, 11, 14, 17, 20, 23] as const;

export type CaptureSessionHour = (typeof CAPTURE_SESSION_HOURS)[number];

export type CaptureSession = {
  /** Jam sesi, 0-23. */
  hour: number;
  /** "02.00" -- dipakai di nama berkas dan disimpan sebagai data. */
  label: string;
  /** Awal sesi sebagai waktu lokal. Tanggalnya bisa berbeda dari jam dinding. */
  startsAt: Date;
};

/** "02.00", "23.00" -- titik, bukan titik dua, yang terlarang di nama berkas Windows. */
export function formatSessionLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}.00`;
}

function sessionAt(reference: Date, dayOffset: number, hour: number): Date {
  const at = new Date(reference);
  at.setDate(at.getDate() + dayOffset);
  at.setHours(hour, 0, 0, 0);
  return at;
}

function toSession(startsAt: Date): CaptureSession {
  return { hour: startsAt.getHours(), label: formatSessionLabel(startsAt.getHours()), startsAt };
}

/**
 * Sesi yang paling dekat dengan `now`, termasuk sesi hari sebelum dan sesudah.
 *
 * Terdekat, bukan sesi yang sedang berjalan: operator yang datang lima menit
 * sebelum sesi 05.00 sedang mengerjakan sesi itu, bukan sesi 02.00 yang sudah
 * lewat tiga jam. Memakai "sesi berjalan" akan menamai capture itu 02.00 --
 * salah, dan salahnya tidak terlihat sampai ada yang mengaudit.
 *
 * Kalau jaraknya seri (tepat di tengah dua sesi, mis. pukul 00.30), yang
 * DIPILIH YANG LEBIH AWAL: sampling lebih sering telat daripada kepagian.
 */
export function resolveNearestSession(now: Date = new Date()): CaptureSession {
  let best: Date | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const dayOffset of [-1, 0, 1]) {
    for (const hour of CAPTURE_SESSION_HOURS) {
      const startsAt = sessionAt(now, dayOffset, hour);
      const distance = Math.abs(startsAt.getTime() - now.getTime());
      // `<` saja sudah cukup untuk aturan seri: kandidat ditelusuri dari yang
      // paling awal, jadi yang lebih baru tidak pernah menggeser yang seri.
      if (distance < bestDistance) {
        bestDistance = distance;
        best = startsAt;
      }
    }
  }

  // `best` selalu terisi -- daftar kandidatnya tidak pernah kosong.
  return toSession(best ?? sessionAt(now, 0, CAPTURE_SESSION_HOURS[0]));
}

/**
 * Sesi yang layak ditawarkan di dropdown: dari `hoursBefore` jam sebelum `now`
 * sampai `hoursAfter` jam sesudahnya, terbaru dulu.
 *
 * Jendelanya condong ke belakang karena itu kebutuhan nyatanya -- operator
 * menyusul sesi yang terlewat jauh lebih sering daripada menyiapkan sesi yang
 * masih lama. Jendela ke depan tetap ada secukupnya supaya sesi berikutnya
 * bisa dipilih saat persiapan.
 */
export function listSelectableSessions(
  now: Date = new Date(),
  hoursBefore = 12,
  hoursAfter = 3,
): CaptureSession[] {
  const earliest = now.getTime() - hoursBefore * 3_600_000;
  const latest = now.getTime() + hoursAfter * 3_600_000;
  const sessions: CaptureSession[] = [];

  for (const dayOffset of [-1, 0, 1]) {
    for (const hour of CAPTURE_SESSION_HOURS) {
      const startsAt = sessionAt(now, dayOffset, hour);
      const time = startsAt.getTime();
      if (time >= earliest && time <= latest) sessions.push(toSession(startsAt));
    }
  }

  return sessions.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
}

/**
 * Segmen folder "YYYY/MM/DD" dari TANGGAL SESI, bukan jam dinding.
 *
 * Inilah yang menjaga sesi 23.00 tetap utuh dalam satu folder walau
 * capture-nya terjadi setelah tengah malam.
 */
export function sessionPathSegment(session: CaptureSession): string {
  const at = session.startsAt;
  const yyyy = String(at.getFullYear());
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  const dd = String(at.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

/** Apakah tanggal sesi berbeda dari tanggal hari ini -- dipakai untuk memberi label di dropdown. */
export function isSessionOnAnotherDay(session: CaptureSession, now: Date = new Date()): boolean {
  return session.startsAt.toDateString() !== now.toDateString();
}
