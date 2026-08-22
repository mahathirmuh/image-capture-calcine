/**
 * Setiap nilai dikutip, bukan hanya yang mengandung koma.
 *
 * Isi log memuat kalimat detail berkoma dan bertanda kutip -- misalnya
 * `nama: "Budi" -> "Budi S"` -- dan mengutip semuanya membuat aturannya satu,
 * bukan dua aturan yang harus ditebak per nilai. Tanda kutip di dalam nilai
 * digandakan, sesuai RFC 4180.
 */
export function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Menyusun baris jadi teks CSV.
 *
 * Pemisah barisnya CRLF, bukan LF: Excel di Windows -- yang membuka berkas ini
 * di sini -- memperlakukan LF tunggal sebagai satu baris panjang.
 */
export function toCsv(rows: Array<Array<string>>) {
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

/**
 * Membungkus CSV jadi Blob siap unduh.
 *
 * BOM di depan wajib: tanpa itu Excel membaca berkasnya sebagai ANSI, dan nama
 * berbahasa Indonesia beraksen maupun tanda panah di kolom detail berubah jadi
 * karakter sampah.
 */
export function csvBlob(csv: string) {
  return new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
}

/**
 * Memicu unduhan sebuah Blob di browser.
 *
 * URL objeknya dicabut lagi setelah diklik supaya blob-nya tidak menahan memori
 * sampai tab ditutup -- pada ekspor ribuan baris itu bukan jumlah yang sepele.
 */
export function downloadBlobFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Cap waktu aman untuk nama berkas: 2026-08-22_09-14-30. */
export function fileTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}
