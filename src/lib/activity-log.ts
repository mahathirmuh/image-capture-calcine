import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { logMessages as m } from "@/i18n/log";
import type { Message } from "@/lib/i18n";

export const ACTIVITY_ACTIONS = [
  "login.success",
  "login.failed",
  "login.blocked",
  "logout",
  "user.created",
  "user.updated",
  "user.deleted",
  "user.password_reset",
  // Tiga aksi yang MENGUBAH BERKAS atau tujuan penyimpanan, bukan sekadar
  // akun. Sampai sebelum ini jejaknya hanya mencatat urusan login dan user --
  // artinya seseorang bisa menghapus foto sampling secara permanen dari
  // \\10.1.1.44 tanpa meninggalkan catatan apa pun tentang siapa dan kapan.
  "capture.deleted",
  "capture.renamed",
  "storage.target_changed",
  // Kejadian sistem, tanpa pelaku manusia. Dicatat karena kegagalan kirim
  // antrean tidak punya tempat lain untuk terlihat: ia terjadi di latar
  // belakang tiap 5 menit, dan tanpa jejak ini satu-satunya gejalanya adalah
  // capture yang menumpuk berjam-jam tanpa penjelasan.
  "storage.forward_failed",
  "storage.forward_recovered",
  // Perubahan konfigurasi perangkat. Detail lengkapnya (before/after) tetap di
  // device_config_history; yang dicatat di sini hanya SIAPA mengubah APA, supaya
  // /log tetap bisa dibaca sebagai satu garis waktu tanpa menenggelamkannya
  // dengan JSON.
  "device.updated",
  "camera.settings_applied",
  // Capture itu sendiri. Volumenya paling besar di antara semua aksi (~64 per
  // hari), jadi ia memang akan mendominasi daftar -- itulah gunanya penyaring
  // aksi di halaman /log. Severity-nya yang membedakan: capture yang mendarat
  // di folder jaringan berstatus info, yang jatuh ke unduhan browser berstatus
  // warning, karena yang kedua menyisakan pekerjaan manual.
  "capture.created",
  "storage.flush_manual",
  // Berkas yang ditaruh langsung di folder jaringan lalu didaftarkan lewat
  // "Sinkronkan folder". Satu baris per kali jalan, bukan per berkas.
  "capture.imported",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];
export type ActivitySeverity = "info" | "warning";

// Nilainya pesan tiga bahasa, bukan teks jadi: halaman /log merendernya dengan
// t(ACTION_LABELS[aksi]), dan ekspor CSV mengambil `.id` supaya isi berkasnya
// tetap Indonesia apa pun bahasa antarmukanya.
export const ACTION_LABELS: Record<ActivityAction, Message> = {
  "login.success": m.actionLoginSuccess,
  "login.failed": m.actionLoginFailed,
  "login.blocked": m.actionLoginBlocked,
  logout: m.actionLogout,
  "user.created": m.actionUserCreated,
  "user.updated": m.actionUserUpdated,
  "user.deleted": m.actionUserDeleted,
  "user.password_reset": m.actionUserPasswordReset,
  "capture.deleted": m.actionCaptureDeleted,
  "capture.renamed": m.actionCaptureRenamed,
  "storage.target_changed": m.actionStorageTargetChanged,
  "storage.forward_failed": m.actionStorageForwardFailed,
  "storage.forward_recovered": m.actionStorageForwardRecovered,
  "device.updated": m.actionDeviceUpdated,
  "camera.settings_applied": m.actionCameraSettingsApplied,
  "capture.created": m.actionCaptureCreated,
  "storage.flush_manual": m.actionStorageFlushManual,
  "capture.imported": m.actionCaptureImported,
};

export type ActivityEntry = {
  id: number;
  occurredAt: string;
  action: ActivityAction;
  severity: ActivitySeverity;
  actorUsername: string | null;
  targetUsername: string | null;
  detail: string | null;
  ipAddress: string | null;
};

// 10 sebagai bawaan. Jejak ini dibaca untuk menjawab pertanyaan tertentu
// ("siapa menghapus foto itu?"), bukan digulir dari atas ke bawah -- dan sejak
// capture ikut tercatat, seratus baris pertama bisa habis oleh satu shift saja.
export const ACTIVITY_PAGE_SIZES = [10, 25, 50, 100] as const;
export type ActivityPageSize = (typeof ACTIVITY_PAGE_SIZES)[number];

// Ekspor mengambil seluruh baris yang cocok dengan penyaring, bukan hanya yang
// sedang tampil -- "500 dari 12.000" di dalam berkas audit menyesatkan. Tetap
// dibatasi supaya satu klik tidak menarik tabel seumur hidup ke dalam memori
// browser; kalau tersentuh, halamannya memberi tahu bahwa hasilnya terpotong.
export const ACTIVITY_EXPORT_LIMIT = 10_000;

const listInputSchema = z.object({
  action: z.enum(ACTIVITY_ACTIONS).nullable().default(null),
  search: z.string().trim().max(200).nullable().default(null),
  limit: z.number().int().min(1).max(ACTIVITY_EXPORT_LIMIT).default(ACTIVITY_PAGE_SIZES[0]),
  offset: z.number().int().min(0).default(0),
});

export type ListActivityInput = z.input<typeof listInputSchema>;

export type ActivityResult =
  { ok: true; entries: ActivityEntry[]; total: number } | { ok: false; message: string };

/**
 * Jejak aktivitas hanya boleh dibaca Super Admin, dan perannya dibaca ulang dari
 * database seperti di user-admin.ts -- log ini memuat siapa mencoba masuk dari
 * alamat mana, dan itu bukan bacaan untuk operator biasa.
 */
async function requireAdmin() {
  const [{ isCardDbConfigured }, { isSessionConfigured, getAppSession }] = await Promise.all([
    import("./carddb"),
    import("./server/session"),
  ]);

  if (!isSessionConfigured() || !isCardDbConfigured()) {
    return {
      ok: false as const,
      code: "SERVER_NOT_CONFIGURED" as const,
      message: "Konfigurasi server aplikasi belum lengkap.",
    };
  }

  let userId: number | undefined;
  try {
    const session = await getAppSession();
    userId = session.data.user?.id;
  } catch {
    userId = undefined;
  }

  if (userId === undefined) {
    return {
      ok: false as const,
      message: "Sesi Anda sudah berakhir. Masuk ulang untuk melanjutkan.",
    };
  }

  const { findUserById } = await import("./server/users");
  const current = await findUserById(userId);

  if (!current || !current.isActive || current.role !== "admin") {
    return { ok: false as const, message: "Hanya Super Admin yang boleh membuka jejak aktivitas." };
  }

  return { ok: true as const };
}

export const listActivityLog = createServerFn({ method: "POST" })
  .validator(listInputSchema)
  .handler(async ({ data }): Promise<ActivityResult> => {
    const gate = await requireAdmin();
    if (!gate.ok) return gate;

    try {
      const { listActivity } = await import("./server/activity");
      const { entries, total } = await listActivity(data);
      return { ok: true, entries, total };
    } catch (error) {
      return {
        ok: false,
        message: `Jejak aktivitas tidak bisa dibaca: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  });

/**
 * Menyusun ringkasan perubahan akun dalam satu kalimat.
 *
 * Hanya kolom yang benar-benar berubah yang disebut. Mencatat seluruh isian
 * setiap kali membuat jejak audit penuh baris yang tidak mengubah apa pun, dan
 * yang penting justru tenggelam di antaranya.
 */
export function describeUserChange(
  sebelum: {
    fullName: string;
    email: string | null;
    role: string;
    plant: string;
    isActive: boolean;
  },
  sesudah: {
    fullName: string;
    email: string | null;
    role: string;
    plant: string;
    isActive: boolean;
  },
  labelPeran: (role: string) => string,
  labelPlant: (plant: string) => string = (plant) => plant,
): string | null {
  const berubah: string[] = [];

  if (sebelum.fullName !== sesudah.fullName) {
    berubah.push(`nama: "${sebelum.fullName}" -> "${sesudah.fullName}"`);
  }
  if ((sebelum.email ?? "") !== (sesudah.email ?? "")) {
    berubah.push(`email: ${sebelum.email ?? "kosong"} -> ${sesudah.email ?? "kosong"}`);
  }
  if (sebelum.role !== sesudah.role) {
    berubah.push(`peran: ${labelPeran(sebelum.role)} -> ${labelPeran(sesudah.role)}`);
  }
  if (sebelum.plant !== sesudah.plant) {
    berubah.push(`plant: ${labelPlant(sebelum.plant)} -> ${labelPlant(sesudah.plant)}`);
  }
  if (sebelum.isActive !== sesudah.isActive) {
    berubah.push(
      `status: ${sebelum.isActive ? "aktif" : "nonaktif"} -> ${sesudah.isActive ? "aktif" : "nonaktif"}`,
    );
  }

  return berubah.length > 0 ? berubah.join("; ") : null;
}
