import { useRouter } from "@tanstack/react-router";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth";
import { useSessionUser } from "@/lib/use-session-user";
import { ROLE_LABELS, type UserRole } from "@/lib/user-admin";

function initialsOf(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * Identitas operator di topbar, menggantikan kartu sesi yang dulu menempel di
 * kaki sidebar. Ditaruh di sini karena topbar selalu terlihat, sementara kaki
 * sidebar ikut menyempit saat sidebar dilipat jadi mode ikon -- justru saat
 * layar sempit, di mana operator paling perlu memastikan ia login sebagai siapa.
 */
export function UserMenu() {
  const user = useSessionUser();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role as UserRole] ?? user.role;

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
      // invalidate() dulu: beforeLoad di root membaca sesi yang sudah kosong
      // dan menendang ke /login sendiri. Kalau urutannya dibalik, /login masih
      // melihat context.user lama dan memantulkan balik ke dashboard.
      await router.invalidate();
      // invalidate() sendiri sudah menendang ke /login lewat beforeLoad di root,
      // tapi dengan membawa ?redirect=<halaman tadi>. Navigasi ini menimpanya:
      // penandanya diganti loggedOut, dan redirect lama dibuang supaya operator
      // berikutnya yang login tidak ikut terlempar ke halaman milik orang tadi.
      await router.navigate({ to: "/login", search: { loggedOut: true }, replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? `Gagal keluar: ${error.message}` : "Gagal keluar dari sesi.",
      );
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto gap-2.5 px-2 py-1.5 hover:bg-accent"
          aria-label={`Akun ${user.fullName}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-brand-foreground">
            {initialsOf(user.fullName)}
          </span>
          <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
            <span className="max-w-[160px] truncate text-sm font-medium text-foreground">
              {user.fullName}
            </span>
            {/* Peran, bukan email atau username.
                Email boleh kosong, dan saat kosong baris ini jatuh ke username
                -- yang pada akun "admin" terbaca persis seperti sebutan peran
                dan menyesatkan. Peran selalu terisi, selalu pendek, dan tidak
                pernah bisa disalahartikan. Email dan username tetap terbaca
                lengkap di dalam dropdown-nya. */}
            <span className="max-w-[160px] truncate text-[11px] text-muted-foreground">
              {roleLabel}
            </span>
          </span>
          <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email ?? "Tanpa email"}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="opacity-100">
          <UserRound className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Username</span>
          <span className="ml-auto font-medium">{user.username}</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="opacity-100">
          <ShieldCheck className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Peran</span>
          <span className="ml-auto font-medium">{roleLabel}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            handleLogout();
          }}
          disabled={signingOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {signingOut ? "Keluar..." : "Keluar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
