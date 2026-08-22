import { useRouteContext } from "@tanstack/react-router";

import type { SessionUser } from "./auth";

/**
 * Operator yang sedang login, dibaca dari context router yang diisi beforeLoad
 * di __root.
 *
 * Dibungkus jadi hook supaya pemanggilan `useRouteContext({ from: "__root__" })`
 * tidak tersalin ke setiap komponen yang butuh -- string "__root__" itu tidak
 * diperiksa TypeScript sampai runtime, dan satu salah ketik di salah satu
 * salinan baru ketahuan saat halamannya dibuka.
 */
export function useSessionUser(): SessionUser | null {
  return useRouteContext({ from: "__root__", select: (context) => context.user });
}

/**
 * Apakah yang login berperan Super Admin.
 *
 * Hanya untuk menentukan apa yang DITAMPILKAN. Menyembunyikan tautan tidak
 * menghalangi siapa pun mengetik URL-nya, jadi setiap halaman dan serverFn yang
 * dibatasi tetap wajib punya penjaganya sendiri.
 */
export function useIsAdmin(): boolean {
  return useSessionUser()?.role === "admin";
}
