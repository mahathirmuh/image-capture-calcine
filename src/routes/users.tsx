import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import {
  KeyRound,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageTitle } from "@/components/page-shell";
import { PasswordStrengthMeter } from "@/components/password-strength-meter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createAppUser,
  createUserSchema,
  deleteAppUser,
  listAppUsers,
  MIN_PASSWORD_LENGTH,
  resetAppUserPassword,
  resetPasswordSchema,
  ROLE_LABELS,
  updateAppUser,
  updateUserSchema,
  USER_PLANT_ALL,
  USER_PLANT_OPTIONS,
  userPlantLabel,
  USER_ROLES,
  type AppUser,
  type UserRole,
} from "@/lib/user-admin";

export const Route = createFileRoute("/users")({
  // Penjaga tampilan. Yang mengikat sebenarnya ada di setiap serverFn di
  // user-admin.ts, yang membaca ulang peran dari database -- redirect ini hanya
  // supaya operator tidak mendarat di halaman kosong yang menolak semua aksinya.
  beforeLoad: ({ context }) => {
    if (context.user && context.user.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: UsersPage,
  head: () => ({
    meta: [
      { title: "Users — Capture App" },
      { name: "description", content: "Kelola akun operator dan Super Admin aplikasi." },
    ],
  }),
});

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const tanggal = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const jam = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${tanggal} ${jam}`;
}

type FormState = {
  username: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  plant: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  username: "",
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "operator",
  plant: USER_PLANT_ALL,
  isActive: true,
};

function UsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [actorId, setActorId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formTarget, setFormTarget] = useState<AppUser | "new" | null>(null);
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAppUsers();
      if (!result.ok) {
        setLoadError(result.message);
        setUsers(null);
        return;
      }
      setUsers(result.users);
      setActorId(result.actorId);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? `Server aplikasi tidak merespons: ${error.message}`
          : "Server aplikasi tidak merespons.",
      );
      setUsers(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const terlihat = useMemo(() => {
    if (!users) return [];
    const kata = search.trim().toLowerCase();
    if (!kata) return users;
    return users.filter((user) =>
      [user.username, user.fullName, user.email ?? "", user.role].some((nilai) =>
        nilai.toLowerCase().includes(kata),
      ),
    );
  }, [users, search]);

  const jumlahAdminAktif = useMemo(
    () => (users ?? []).filter((user) => user.role === "admin" && user.isActive).length,
    [users],
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const result = await deleteAppUser({ data: { id: deleteTarget.id } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Akun "${result.username}" dihapus`);
      setDeleteTarget(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Akun gagal dihapus.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageTitle
            title="Users"
            description="Kelola akun yang boleh masuk ke aplikasi, perannya, dan status aktifnya."
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat ulang
          </Button>
          <Button size="sm" onClick={() => setFormTarget("new")}>
            <UserPlus className="mr-2 h-4 w-4" />
            Tambah user
          </Button>
        </div>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Daftar akun tidak bisa dimuat</p>
            <p className="mt-0.5 text-destructive/90">{loadError}</p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari username, nama, atau email"
            className="pl-9"
            aria-label="Cari akun"
          />
        </div>
        {users && (
          <p className="text-xs text-muted-foreground">
            {terlihat.length} dari {users.length} akun · {jumlahAdminAktif} {ROLE_LABELS.admin}{" "}
            aktif
          </p>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Nama lengkap</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Login terakhir</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && users === null ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Memuat daftar akun...
                </TableCell>
              </TableRow>
            ) : terlihat.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  {users && users.length > 0
                    ? "Tidak ada akun yang cocok dengan pencarian itu."
                    : "Belum ada akun terdaftar."}
                </TableCell>
              </TableRow>
            ) : (
              terlihat.map((user) => {
                const diriSendiri = user.id === actorId;
                return (
                  <TableRow key={user.id} className={user.isActive ? "" : "opacity-60"}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {user.username}
                        {diriSendiri && (
                          <Badge variant="outline" className="text-[10px]">
                            Anda
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{user.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email ?? "—"}</TableCell>
                    <TableCell>
                      {user.role === "admin" ? (
                        <Badge className="gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {ROLE_LABELS.admin}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{ROLE_LABELS.operator}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {userPlantLabel(user.plant)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 text-sm ${
                          user.isActive ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            user.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"
                          }`}
                        />
                        {user.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setFormTarget(user)}
                          aria-label={`Ubah ${user.username}`}
                          title="Ubah"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setResetTarget(user)}
                          aria-label={`Reset password ${user.username}`}
                          title="Reset password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(user)}
                          disabled={diriSendiri}
                          aria-label={`Hapus ${user.username}`}
                          title={diriSendiri ? "Tidak bisa menghapus akun sendiri" : "Hapus"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <UserFormDialog
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={async (editedSelf) => {
          setFormTarget(null);
          await refresh();
          // Identitas di sidebar dibaca dari context router; setelah admin
          // mengubah akunnya sendiri, context itu perlu dibaca ulang.
          if (editedSelf) await router.invalidate();
        }}
        actorId={actorId}
      />

      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus akun &quot;{deleteTarget?.username}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun ini langsung kehilangan akses. Foto dan catatan capture yang sudah dibuatnya
              tetap ada. Tindakan ini tidak bisa dibatalkan &mdash; kalau ragu, nonaktifkan saja
              lewat tombol Ubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Menghapus..." : "Hapus akun"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserFormDialog({
  target,
  actorId,
  onClose,
  onSaved,
}: {
  target: AppUser | "new" | null;
  actorId: number | null;
  onClose: () => void;
  onSaved: (editedSelf: boolean) => void | Promise<void>;
}) {
  const mode = target === "new" ? "create" : "edit";
  const existing = target && target !== "new" ? target : null;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setError(null);
    setForm(
      existing
        ? {
            username: existing.username,
            fullName: existing.fullName,
            email: existing.email ?? "",
            password: "",
            confirmPassword: "",
            role: (existing.role === "admin" ? "admin" : "operator") as UserRole,
            plant: existing.plant,
            isActive: existing.isActive,
          }
        : EMPTY_FORM,
    );
  }, [target, existing]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    // Kecocokan dua kolom password diperiksa lebih dulu dari skema: skema tidak
    // tahu-menahu soal kolom ulangi -- kolom itu tidak pernah dikirim ke server,
    // gunanya semata menangkap salah ketik sebelum passwordnya tersimpan
    // ter-hash dan tidak bisa dibaca siapa pun lagi.
    if (!existing && form.password !== form.confirmPassword) {
      setError("Dua kolom password belum sama.");
      return;
    }

    // Divalidasi lebih dulu dengan skema yang sama seperti serverFn-nya. Kalau
    // dibiarkan sampai server, ZodError kembali sebagai JSON mentah dan itulah
    // yang terbaca operator di dalam dialog.
    const check = existing
      ? updateUserSchema.safeParse({
          id: existing.id,
          fullName: form.fullName,
          email: form.email,
          role: form.role,
          plant: form.plant,
          isActive: form.isActive,
        })
      : createUserSchema.safeParse({
          username: form.username,
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          plant: form.plant,
          isActive: form.isActive,
        });

    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Ada isian yang belum benar.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = existing
        ? await updateAppUser({
            data: {
              id: existing.id,
              fullName: form.fullName,
              email: form.email,
              role: form.role,
              plant: form.plant,
              isActive: form.isActive,
            },
          })
        : await createAppUser({
            data: {
              username: form.username,
              fullName: form.fullName,
              email: form.email,
              password: form.password,
              role: form.role,
              plant: form.plant,
              isActive: form.isActive,
            },
          });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      toast.success(
        existing
          ? `Akun "${result.user.username}" diperbarui`
          : `Akun "${result.user.username}" dibuat`,
      );
      await onSaved(existing?.id === actorId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Akun gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah user" : "Ubah user"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Akun langsung bisa dipakai masuk begitu disimpan."
              : "Username tidak bisa diubah karena dipakai sebagai identitas login dan di jejak audit."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={form.username}
              onChange={(event) => setForm((f) => ({ ...f, username: event.target.value }))}
              disabled={mode === "edit" || saving}
              autoComplete="off"
              spellCheck={false}
              placeholder="operator.bin1"
            />
            {mode === "create" && (
              <p className="text-xs text-muted-foreground">
                Huruf kecil, angka, titik, garis, atau underscore. Minimal 3 karakter.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nama lengkap</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(event) => setForm((f) => ({ ...f, fullName: event.target.value }))}
              disabled={saving}
              placeholder="Nama yang tampil di sidebar"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email (opsional)</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
              disabled={saving}
              autoComplete="off"
              placeholder="nama@mbma.co.id"
            />
            <p className="text-xs text-muted-foreground">
              Kalau diisi, operator boleh memakainya untuk masuk selain username.
            </p>
          </div>

          {mode === "create" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password awal</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))}
                  disabled={saving}
                  autoComplete="new-password"
                  placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
                />
                <PasswordStrengthMeter
                  password={form.password}
                  username={form.username}
                  fullName={form.fullName}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Ulangi password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, confirmPassword: event.target.value }))
                  }
                  disabled={saving}
                  autoComplete="new-password"
                  placeholder="Ketik ulang password yang sama"
                  aria-invalid={
                    form.confirmPassword !== "" && form.confirmPassword !== form.password
                      ? true
                      : undefined
                  }
                />
                {form.confirmPassword !== "" && form.confirmPassword !== form.password && (
                  <p className="text-xs text-destructive">Belum sama dengan kolom di atas.</p>
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="plant">Plant</Label>
            <Select
              value={form.plant}
              onValueChange={(value) => setForm((f) => ({ ...f, plant: value }))}
              disabled={saving}
            >
              <SelectTrigger id="plant">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_PLANT_OPTIONS.map((plant) => (
                  <SelectItem key={plant} value={plant}>
                    {userPlantLabel(plant)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Mengunci akses capture, preview, dan device ke plant ini. Akun dengan pilihan
              Semua Plant tetap bisa lintas-plant, termasuk Super Admin.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role">Peran</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm((f) => ({ ...f, role: value as UserRole }))}
                disabled={saving}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Hanya {ROLE_LABELS.admin} yang bisa membuka halaman ini.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="isActive">Status</Label>
              <div className="flex h-9 items-center gap-2.5">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                  disabled={saving}
                />
                <span className="text-sm">{form.isActive ? "Aktif" : "Nonaktif"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Akun nonaktif ditolak saat login, tanpa dihapus.
              </p>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Buat akun" : "Simpan perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ target, onClose }: { target: AppUser | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setPassword("");
    setConfirm("");
    setError(null);
  }, [target]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || saving) return;

    if (password !== confirm) {
      setError("Dua kolom password belum sama.");
      return;
    }

    const check = resetPasswordSchema.safeParse({ id: target.id, password });
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Password belum memenuhi syarat.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await resetAppUserPassword({ data: { id: target.id, password } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(`Password "${result.username}" diganti`, {
        description: "Beri tahu operatornya lewat jalur yang aman, bukan lewat grup chat.",
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Password baru untuk &quot;{target?.username}&quot;. Password lama tidak bisa dibaca
            siapa pun, termasuk Super Admin &mdash; yang tersimpan cuma hash-nya.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">Password baru</Label>
            <Input
              id="newPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={saving}
              autoComplete="new-password"
              autoFocus
              placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
            />
            <PasswordStrengthMeter
              password={password}
              username={target?.username}
              fullName={target?.fullName}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Ulangi password baru</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={saving}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ganti password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
