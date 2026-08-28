// Perhitungan path untuk tujuan simpan jaringan, dipisahkan dari I/O supaya
// bisa diuji tanpa share sungguhan dan tanpa berpura-pura jadi Windows.
//
// Sengaja TIDAK memakai `node:path`. Modul ini dipakai dari sisi server yang
// menulis berkas, tetapi tetangganya (`network-save.ts`) ikut ter-bundle ke
// klien sebagai stub RPC, dan import `node:*` di level modul merusak build itu
// -- pola yang sudah dipakai `camera-api.ts` dan `storage-diagnostics.ts`.
// Selain itu `path.join` memilih separator dari platform yang SEDANG berjalan,
// padahal di sini yang menentukan adalah bentuk `targetRoot`: app server Linux
// yang menulis ke root UNC butuh backslash, bukan slash.

/**
 * Root bergaya Windows: UNC (`\\host\share`) atau berhuruf drive (`C:\`).
 * Selebihnya diperlakukan POSIX.
 */
export function isWindowsStyleRoot(targetRoot: string): boolean {
  return targetRoot.startsWith("\\\\") || /^[A-Za-z]:[\\/]/.test(targetRoot);
}

// Karakter yang tidak boleh muncul di satu segmen nama. Daftar Windows dipakai
// untuk semua platform: rootnya bisa saja UNC, dan nama yang lolos di Linux
// tapi ditolak Windows hanya akan gagal di kemudian hari.
//
// Karakter kontrol memang yang sedang dicari di sini, bukan tersasar masuk:
// nama yang menyelipkannya ditolak Windows dan mengotori log, jadi justru
// harus terdeteksi.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_SEGMENT_CHARS = /[<>:"|?*\u0000-\u001f]/;

/**
 * Pecah path relatif dari klien menjadi segmen yang aman dipakai, atau `null`
 * kalau tidak layak. Ini penjaga traversal: `..`, path absolut, huruf drive,
 * dan karakter terlarang semuanya ditolak di sini, sebelum menyentuh disk.
 * Menolak lebih awal jauh lebih mudah dibaca daripada menyusun path dulu lalu
 * memeriksa apakah hasilnya masih di dalam root.
 */
export function normalizeRelativeSegments(relativePath: string): string[] | null {
  if (typeof relativePath !== "string") return null;
  const segments = relativePath
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");
  if (segments.length === 0) return null;
  for (const segment of segments) {
    if (segment === "." || segment === "..") return null;
    if (FORBIDDEN_SEGMENT_CHARS.test(segment)) return null;
  }
  return segments;
}

/**
 * Nama berkas yang aman dipakai sebagai SATU segmen.
 *
 * Dipakai saat mengubah nama capture: nama barunya datang dari `prompt()` di
 * browser dan sekarang benar-benar mengubah nama berkas di folder jaringan,
 * jadi pemisah path di dalamnya akan memindahkan berkas keluar dari foldernya.
 *
 * Sengaja menumpang `normalizeRelativeSegments` alih-alih menyusun daftar
 * karakter terlarang kedua: dua daftar yang berdiri sendiri pasti akan
 * menyimpang, dan yang lebih longgar di antaranya yang akan menentukan.
 *
 * Spasi dan titik justru wajib lolos -- nama bakunya "02.00 Train 1.jpg".
 */
export function isSafeFileName(name: string): boolean {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  const segments = normalizeRelativeSegments(trimmed);
  return segments !== null && segments.length === 1 && segments[0] === trimmed;
}

/**
 * Root bergaya Windows di atas platform POSIX -- salah konfigurasi yang PASTI,
 * bukan sekadar kemungkinan.
 *
 * Kasus nyatanya: `.env` produksi terisi bentuk UNC `\\10.1.1.44\...`
 * padahal app berjalan di container Linux. Di sana UNC bukan path yang bisa
 * di-stat, jadi antrean kirim berhenti dengan TARGET_ROOT_MISSING -- pesan yang
 * menyiratkan share belum ter-mount, dan membuat orang memeriksa mount yang
 * sebenarnya baik-baik saja. Capture menumpuk berjam-jam tanpa ada yang tahu
 * sebabnya.
 *
 * Dibedakan supaya pesannya menyebut sebab yang sesungguhnya. Padanannya:
 *
 *   \\10.1.1.44\Data Analytics\ML\MTI   ==   /mnt/mti/ML/MTI
 */
export function isPlatformMismatchedRoot(targetRoot: string, platform: string): boolean {
  return platform !== "win32" && isWindowsStyleRoot(targetRoot);
}

/** Sambung `targetRoot` dengan segmen memakai separator yang cocok dengan root. */
export function joinNetworkPath(targetRoot: string, segments: string[]): string {
  const separator = isWindowsStyleRoot(targetRoot) ? "\\" : "/";
  const root = targetRoot.replace(/[\\/]+$/, "");
  if (segments.length === 0) return root;
  return `${root}${separator}${segments.join(separator)}`;
}
