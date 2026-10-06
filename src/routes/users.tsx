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
import type { ZodIssue } from "zod";

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
  updateAppUser,
  updateUserSchema,
  USER_PLANT_ALL,
  USER_PLANT_OPTIONS,
  USER_ROLES,
  type AppUser,
  type UserRole,
} from "@/lib/user-admin";
import { commonMessages as c } from "@/i18n/common";
import { failureText } from "@/i18n/errors";
import { usersMessages as m } from "@/i18n/users";
import { useLocale, useT, type Message, type Translator } from "@/lib/i18n";

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

function formatDateTime(iso: string | null, locale: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const tanggal = date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const jam = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${tanggal} ${jam}`;
}

// Sebutan peran dan plant untuk TAMPILAN. ROLE_LABELS dan userPlantLabel di
// user-admin.ts tetap berbahasa Indonesia karena dipakai server untuk jejak
// aktivitas, jadi halaman ini tidak memakainya.
const ROLE_MESSAGES: Record<UserRole, Message> = {
  admin: c.roleAdmin,
  operator: c.roleOperator,
  viewer: c.roleViewer,
};

function plantLabel(value: string, t: Translator) {
  return value === USER_PLANT_ALL ? t(c.allPlants) : value;
}

// Pesan skema di user-admin.ts berbahasa Indonesia karena juga menjadi pesan
// validasi di server. Di halaman ini kegagalannya dikenali dari kolom dan kode
// isunya; yang tidak dikenal menampilkan pesan skemanya apa adanya.
const VALIDATION_MESSAGES: Record<string, Message> = {
  "username:too_small": m.usernameTooShort,
  "username:too_big": m.usernameTooLong,
  "username:invalid_string": m.usernameFormat,
  "fullName:too_small": m.fullNameRequired,
  "email:invalid_string": m.emailInvalid,
  "email:too_big": m.emailTooLong,
  "password:too_small": m.passwordTooShort,
  "password:too_big": m.passwordTooLong,
};

function validationText(issue: ZodIssue | undefined, t: Translator, fallback: Message) {
  if (!issue) return t(fallback);
  const known = VALIDATION_MESSAGES[`${String(issue.path[0])}:${issue.code}`];
  return known ? t(known, { min: MIN_PASSWORD_LENGTH }) : issue.message;
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
  const t = useT();
  const locale = useLocale();

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
        setLoadError(failureText(t, result));
        setUsers(null);
        return;
      }
      setUsers(result.users);
      setActorId(result.actorId);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? t(m.serverNoResponseWith, { reason: error.message })
          : t(m.serverNoResponse),
      );
      setUsers(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        toast.error(failureText(t, result));
        return;
      }
      toast.success(t(m.deleted, { username: result.username }));
      setDeleteTarget(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(m.deleteFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageTitle title={t(c.navUsers)} description={t(m.description)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t(m.reload)}
          </Button>
          <Button size="sm" onClick={() => setFormTarget("new")}>
            <UserPlus className="mr-2 h-4 w-4" />
            {t(m.addUser)}
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
            <p className="font-medium">{t(m.loadFailedTitle)}</p>
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
            placeholder={t(m.searchPlaceholder)}
            className="pl-9"
            aria-label={t(m.searchLabel)}
          />
        </div>
        {users && (
          <p className="text-xs text-muted-foreground">
            {t(m.summary, {
              shown: terlihat.length,
              total: users.length,
              admins: jumlahAdminAktif,
              role: t(ROLE_MESSAGES.admin),
            })}
          </p>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t(m.username)}</TableHead>
              <TableHead>{t(m.fullName)}</TableHead>
              <TableHead>{t(m.email)}</TableHead>
              <TableHead>{t(m.role)}</TableHead>
              <TableHead>{t(m.plant)}</TableHead>
              <TableHead>{t(m.status)}</TableHead>
              <TableHead>{t(m.lastLogin)}</TableHead>
              <TableHead className="text-right">{t(m.actions)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && users === null ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t(m.loading)}
                </TableCell>
              </TableRow>
            ) : terlihat.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  {users && users.length > 0 ? t(m.noMatch) : t(m.empty)}
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
                            {t(m.you)}
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
                          {t(ROLE_MESSAGES.admin)}
                        </Badge>
                      ) : user.role === "viewer" ? (
                        <Badge variant="outline">{t(ROLE_MESSAGES.viewer)}</Badge>
                      ) : (
                        <Badge variant="secondary">{t(ROLE_MESSAGES.operator)}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {plantLabel(user.plant, t)}
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
                        {user.isActive ? t(m.active) : t(m.inactive)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(user.lastLoginAt, locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setFormTarget(user)}
                          aria-label={t(m.editNamed, { username: user.username })}
                          title={t(m.edit)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setResetTarget(user)}
                          aria-label={t(m.resetPasswordNamed, { username: user.username })}
                          title={t(m.resetPassword)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(user)}
                          disabled={diriSendiri}
                          aria-label={t(m.deleteNamed, { username: user.username })}
                          title={diriSendiri ? t(m.cannotDeleteSelf) : t(m.delete)}
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
            <AlertDialogTitle>
              {t(m.deleteTitle, { username: deleteTarget?.username ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t(m.deleteBody)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t(m.cancel)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? t(m.deleting) : t(m.deleteAccount)}
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
  const t = useT();

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
            role: (USER_ROLES as readonly string[]).includes(existing.role)
              ? (existing.role as UserRole)
              : "operator",
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
      setError(t(m.passwordsMismatch));
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
      setError(validationText(check.error.issues[0], t, m.formInvalid));
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
        setError(failureText(t, result));
        return;
      }

      toast.success(
        existing
          ? t(m.updated, { username: result.user.username })
          : t(m.created, { username: result.user.username }),
      );
      await onSaved(existing?.id === actorId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t(m.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t(m.addUser) : t(m.editUser)}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? t(m.createHint) : t(m.editHint)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="username">{t(m.username)}</Label>
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
              <p className="text-xs text-muted-foreground">{t(m.usernameHint)}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fullName">{t(m.fullName)}</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(event) => setForm((f) => ({ ...f, fullName: event.target.value }))}
              disabled={saving}
              placeholder={t(m.fullNamePlaceholder)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">{t(m.emailOptional)}</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
              disabled={saving}
              autoComplete="off"
              placeholder={t(m.emailPlaceholder)}
            />
            <p className="text-xs text-muted-foreground">{t(m.emailHint)}</p>
          </div>

          {mode === "create" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t(m.initialPassword)}</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))}
                  disabled={saving}
                  autoComplete="new-password"
                  placeholder={t(m.passwordMinPlaceholder, { min: MIN_PASSWORD_LENGTH })}
                />
                <PasswordStrengthMeter
                  password={form.password}
                  username={form.username}
                  fullName={form.fullName}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">{t(m.repeatPassword)}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, confirmPassword: event.target.value }))
                  }
                  disabled={saving}
                  autoComplete="new-password"
                  placeholder={t(m.repeatPasswordPlaceholder)}
                  aria-invalid={
                    form.confirmPassword !== "" && form.confirmPassword !== form.password
                      ? true
                      : undefined
                  }
                />
                {form.confirmPassword !== "" && form.confirmPassword !== form.password && (
                  <p className="text-xs text-destructive">{t(m.notSameAsAbove)}</p>
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="plant">{t(m.plant)}</Label>
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
                    {plantLabel(plant, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(m.plantHint)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role">{t(m.role)}</Label>
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
                      {t(ROLE_MESSAGES[role])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t(m.roleHint, {
                  admin: t(ROLE_MESSAGES.admin),
                  viewer: t(ROLE_MESSAGES.viewer),
                })}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="isActive">{t(m.status)}</Label>
              <div className="flex h-9 items-center gap-2.5">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                  disabled={saving}
                />
                <span className="text-sm">{form.isActive ? t(m.active) : t(m.inactive)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t(m.inactiveHint)}</p>
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
              {t(m.cancel)}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? t(m.createAccount) : t(m.saveChanges)}
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
  const t = useT();

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
      setError(t(m.passwordsMismatch));
      return;
    }

    const check = resetPasswordSchema.safeParse({ id: target.id, password });
    if (!check.success) {
      setError(validationText(check.error.issues[0], t, m.passwordInvalid));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await resetAppUserPassword({ data: { id: target.id, password } });
      if (!result.ok) {
        setError(failureText(t, result));
        return;
      }
      toast.success(t(m.passwordChanged, { username: result.username }), {
        description: t(m.passwordChangedHint),
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t(m.passwordSaveFailed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(m.resetPassword)}</DialogTitle>
          <DialogDescription>
            {t(m.resetBody, { username: target?.username ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">{t(m.newPassword)}</Label>
            <Input
              id="newPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={saving}
              autoComplete="new-password"
              autoFocus
              placeholder={t(m.passwordMinPlaceholder, { min: MIN_PASSWORD_LENGTH })}
            />
            <PasswordStrengthMeter
              password={password}
              username={target?.username}
              fullName={target?.fullName}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t(m.repeatNewPassword)}</Label>
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
              {t(m.cancel)}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t(m.changePassword)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
