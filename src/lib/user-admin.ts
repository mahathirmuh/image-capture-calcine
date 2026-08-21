import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { SessionUser } from "./auth";

export const USER_ROLES = ["admin", "operator"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  operator: "Operator",
};

// Sama dengan ambang di scripts/create-user.mjs, supaya akun yang dibuat lewat
// halaman ini dan lewat baris perintah tunduk pada aturan yang sama.
export const MIN_PASSWORD_LENGTH = 8;

export type AppUser = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminResult<T> = ({ ok: true } & T) | { ok: false; message: string };

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username minimal 3 karakter")
  .max(100, "Username maksimal 100 karakter")
  // Username ikut jadi identitas login dan muncul di jejak audit; membatasinya
  // ke bentuk yang tidak ambigu mencegah dua akun yang terlihat sama.
  .regex(
    /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/,
    "Gunakan huruf kecil, angka, titik, garis, underscore",
  );

const emailSchema = z
  .string()
  .trim()
  .email("Format email tidak valid")
  .max(200, "Email maksimal 200 karakter");

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password minimal ${MIN_PASSWORD_LENGTH} karakter`)
  .max(200, "Password maksimal 200 karakter");

const roleSchema = z.enum(USER_ROLES);

export const createUserSchema = z.object({
  username: usernameSchema,
  fullName: z.string().trim().min(1, "Nama lengkap wajib diisi").max(200),
  email: z.union([emailSchema, z.literal("")]).transform((value) => value || null),
  password: passwordSchema,
  role: roleSchema,
  isActive: z.boolean(),
});

export const updateUserSchema = z.object({
  id: z.number().int().positive(),
  fullName: z.string().trim().min(1, "Nama lengkap wajib diisi").max(200),
  email: z.union([emailSchema, z.literal("")]).transform((value) => value || null),
  role: roleSchema,
  isActive: z.boolean(),
});

export const resetPasswordSchema = z.object({
  id: z.number().int().positive(),
  password: passwordSchema,
});

const deleteUserSchema = z.object({ id: z.number().int().positive() });

// Skema di atas sengaja diekspor supaya form di halaman Users memakai aturan
// yang sama persis dengan validator serverFn. Tanpa itu, kesalahan isian baru
// tertangkap di server dan kembali sebagai JSON ZodError mentah -- pesan yang
// tidak layak ditunjukkan ke operator.
export type CreateUserInput = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.input<typeof updateUserSchema>;

/**
 * Menolak perubahan yang akan mengunci sistem atau mengunci pelakunya sendiri.
 *
 * Dipisah sebagai fungsi murni supaya aturannya bisa diuji tanpa database, dan
 * supaya seluruh alasan penolakan berada di satu tempat, bukan tersebar di
 * antara query.
 */
export function guardUserUpdate(input: {
  actorId: number;
  target: { id: number; username: string; role: string; isActive: boolean };
  next: { role: string; isActive: boolean };
  otherActiveAdmins: number;
}): string | null {
  const { actorId, target, next, otherActiveAdmins } = input;

  if (target.id === actorId && !next.isActive) {
    return "Anda tidak bisa menonaktifkan akun Anda sendiri. Minta admin lain yang melakukannya.";
  }

  if (target.id === actorId && next.role !== "admin") {
    return "Anda tidak bisa melepas peran admin dari akun Anda sendiri. Minta admin lain yang melakukannya.";
  }

  const tadinyaAdminAktif = target.role === "admin" && target.isActive;
  const tetapAdminAktif = next.role === "admin" && next.isActive;
  if (tadinyaAdminAktif && !tetapAdminAktif && otherActiveAdmins === 0) {
    return `"${target.username}" satu-satunya admin aktif. Angkat admin lain dulu, kalau tidak tidak ada yang bisa mengelola akun lagi.`;
  }

  return null;
}

export function guardUserDeletion(input: {
  actorId: number;
  target: { id: number; username: string; role: string; isActive: boolean };
  otherActiveAdmins: number;
}): string | null {
  const { actorId, target, otherActiveAdmins } = input;

  if (target.id === actorId) {
    return "Anda tidak bisa menghapus akun Anda sendiri.";
  }

  if (target.role === "admin" && target.isActive && otherActiveAdmins === 0) {
    return `"${target.username}" satu-satunya admin aktif. Menghapusnya membuat sistem tidak punya admin sama sekali.`;
  }

  return null;
}

type AdminGate = { ok: true; actor: SessionUser } | { ok: false; message: string };

/**
 * Peran dibaca ulang dari database, bukan dari cookie sesi.
 *
 * Sesi disegel saat login dan isinya tidak berubah sampai login berikutnya --
 * jadi admin yang perannya dicabut atau akunnya dinonaktifkan tetap membawa
 * cookie bertuliskan "admin" sampai ia keluar. Membaca ulang menutup celah itu
 * dengan ongkos satu query per aksi.
 */
async function requireAdmin(): Promise<AdminGate> {
  const [{ isCardDbConfigured }, { isSessionConfigured, getAppSession }] = await Promise.all([
    import("./carddb"),
    import("./server/session"),
  ]);

  if (!isSessionConfigured() || !isCardDbConfigured()) {
    return { ok: false, message: "Konfigurasi server aplikasi belum lengkap." };
  }

  let sessionUser: SessionUser | undefined;
  try {
    const session = await getAppSession();
    sessionUser = session.data.user;
  } catch {
    sessionUser = undefined;
  }

  if (!sessionUser) {
    return { ok: false, message: "Sesi Anda sudah berakhir. Masuk ulang untuk melanjutkan." };
  }

  const { findUserById } = await import("./server/users");
  const current = await findUserById(sessionUser.id);

  if (!current || !current.isActive) {
    return { ok: false, message: "Akun Anda sudah tidak aktif. Hubungi admin lain." };
  }

  if (current.role !== "admin") {
    return { ok: false, message: "Hanya admin yang boleh mengelola akun." };
  }

  return { ok: true, actor: { ...sessionUser, role: current.role } };
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const listAppUsers = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminResult<{ users: AppUser[]; actorId: number }>> => {
    const gate = await requireAdmin();
    if (!gate.ok) return gate;

    try {
      const { listUsers } = await import("./server/users");
      return { ok: true, users: await listUsers(), actorId: gate.actor.id };
    } catch (error) {
      return { ok: false, message: `Database tidak bisa dibaca: ${messageOf(error)}` };
    }
  },
);

export const createAppUser = createServerFn({ method: "POST" })
  .validator(createUserSchema)
  .handler(async ({ data }): Promise<AdminResult<{ user: AppUser }>> => {
    const gate = await requireAdmin();
    if (!gate.ok) return gate;

    try {
      const [{ usernameExists, emailExists, insertUser }, { hashPassword }] = await Promise.all([
        import("./server/users"),
        import("./server/password"),
      ]);

      if (await usernameExists(data.username)) {
        return { ok: false, message: `Username "${data.username}" sudah dipakai.` };
      }

      if (data.email && (await emailExists(data.email))) {
        return { ok: false, message: `Email "${data.email}" sudah dipakai akun lain.` };
      }

      const user = await insertUser({
        username: data.username,
        fullName: data.fullName,
        email: data.email,
        passwordHash: await hashPassword(data.password),
        role: data.role,
        isActive: data.isActive,
      });

      return { ok: true, user };
    } catch (error) {
      return { ok: false, message: `Akun gagal dibuat: ${messageOf(error)}` };
    }
  });

export const updateAppUser = createServerFn({ method: "POST" })
  .validator(updateUserSchema)
  .handler(async ({ data }): Promise<AdminResult<{ user: AppUser }>> => {
    const gate = await requireAdmin();
    if (!gate.ok) return gate;

    try {
      const { findUserById, countOtherActiveAdmins, emailExists, updateUserProfile } =
        await import("./server/users");

      const target = await findUserById(data.id);
      if (!target) return { ok: false, message: "Akun tidak ditemukan. Muat ulang daftarnya." };

      const blocked = guardUserUpdate({
        actorId: gate.actor.id,
        target,
        next: { role: data.role, isActive: data.isActive },
        otherActiveAdmins: await countOtherActiveAdmins(target.id),
      });
      if (blocked) return { ok: false, message: blocked };

      if (data.email && (await emailExists(data.email, data.id))) {
        return { ok: false, message: `Email "${data.email}" sudah dipakai akun lain.` };
      }

      const user = await updateUserProfile(data);
      if (!user) return { ok: false, message: "Akun tidak ditemukan. Muat ulang daftarnya." };

      // Sesi menyimpan salinan identitas dari saat login. Kalau admin mengubah
      // akunnya sendiri, salinan itu ikut disegarkan -- tanpa ini namanya di
      // sidebar tetap yang lama sampai ia keluar dan masuk lagi.
      if (data.id === gate.actor.id) {
        const { getAppSession } = await import("./server/session");
        const session = await getAppSession();
        await session.update({
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
          },
        });
      }

      return { ok: true, user };
    } catch (error) {
      return { ok: false, message: `Akun gagal diperbarui: ${messageOf(error)}` };
    }
  });

export const resetAppUserPassword = createServerFn({ method: "POST" })
  .validator(resetPasswordSchema)
  .handler(async ({ data }): Promise<AdminResult<{ username: string }>> => {
    const gate = await requireAdmin();
    if (!gate.ok) return gate;

    try {
      const [{ findUserById, updateUserPassword }, { hashPassword }] = await Promise.all([
        import("./server/users"),
        import("./server/password"),
      ]);

      const target = await findUserById(data.id);
      if (!target) return { ok: false, message: "Akun tidak ditemukan. Muat ulang daftarnya." };

      const changed = await updateUserPassword(data.id, await hashPassword(data.password));
      if (!changed) return { ok: false, message: "Password gagal disimpan." };

      return { ok: true, username: target.username };
    } catch (error) {
      return { ok: false, message: `Password gagal direset: ${messageOf(error)}` };
    }
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .validator(deleteUserSchema)
  .handler(async ({ data }): Promise<AdminResult<{ username: string }>> => {
    const gate = await requireAdmin();
    if (!gate.ok) return gate;

    try {
      const { findUserById, countOtherActiveAdmins, deleteUser } = await import("./server/users");

      const target = await findUserById(data.id);
      if (!target) return { ok: false, message: "Akun tidak ditemukan. Muat ulang daftarnya." };

      const blocked = guardUserDeletion({
        actorId: gate.actor.id,
        target,
        otherActiveAdmins: await countOtherActiveAdmins(target.id),
      });
      if (blocked) return { ok: false, message: blocked };

      const removed = await deleteUser(data.id);
      if (!removed) return { ok: false, message: "Akun tidak ditemukan. Muat ulang daftarnya." };

      return { ok: true, username: target.username };
    } catch (error) {
      return { ok: false, message: `Akun gagal dihapus: ${messageOf(error)}` };
    }
  });
