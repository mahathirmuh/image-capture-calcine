import { useRouterState } from "@tanstack/react-router";
import { type LucideIcon, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { findNavItem } from "@/lib/nav-items";

/**
 * Bungkus isi halaman: jarak tepi dan lebar baca yang sama di seluruh aplikasi.
 *
 * Dipisah jadi komponen, bukan dibiarkan sebagai `div.p-6` yang disalin ke tiap
 * halaman, supaya mengubah jarak tepi nanti tidak berarti menyunting delapan
 * berkas dan melewatkan satu.
 */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1600px] p-4 sm:p-6", className)}>{children}</div>
  );
}

/**
 * Kepala halaman: eyebrow, judul, keterangan, lalu aksi di kanan.
 *
 * Eyebrow-nya diambil sendiri dari grup NAV_ITEMS milik rute yang sedang
 * terbuka, jadi setiap halaman otomatis menyebut keluarga menunya tanpa perlu
 * menuliskannya ulang -- dan tidak bisa menyebut yang salah setelah sebuah menu
 * dipindah antar grup.
 */
/**
 * Blok judul saja: eyebrow, judul, keterangan.
 *
 * Dipisah dari PageHeader supaya bisa disisipkan ke <header> yang sudah ada di
 * tiap halaman tanpa ikut memindahkan blok aksinya -- aksi tiap halaman
 * bentuknya berbeda-beda, dari tombol biasa sampai dropdown lokasi.
 */
export function PageTitle({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
}) {
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  const label = eyebrow ?? findNavItem(pathname)?.group;

  return (
    <div className="min-w-0">
      {label && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
      )}
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {description && (
        <div className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{description}</div>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title={title} description={description} eyebrow={eyebrow} />
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </header>
  );
}

/**
 * Permukaan putih tempat isi halaman duduk, di atas latar abu.
 *
 * `title` opsional: kalau diisi, kartunya mendapat pita kepala bergaris bawah
 * seperti panel-panel di aplikasi Operation Apps; kalau tidak, kartunya polos
 * dan isinya mengisi penuh.
 */
export function SurfaceCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-sm", className)}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
              {description && (
                <p className="truncate text-xs text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export type StatTone = "brand" | "success" | "warning" | "danger" | "neutral";

const TONE_STYLES: Record<StatTone, { rail: string; chip: string; value: string }> = {
  brand: { rail: "bg-brand", chip: "bg-brand/10 text-brand", value: "text-brand" },
  success: {
    rail: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-700",
    value: "text-emerald-700",
  },
  warning: {
    rail: "bg-amber-500",
    chip: "bg-amber-500/10 text-amber-700",
    value: "text-amber-700",
  },
  danger: {
    rail: "bg-destructive",
    chip: "bg-destructive/10 text-destructive",
    value: "text-destructive",
  },
  neutral: {
    rail: "bg-muted-foreground/40",
    chip: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
};

/**
 * Kartu angka ringkas dengan pita warna di tepi atas -- bentuk yang dipakai
 * deretan statistik di Operation Apps.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
}) {
  const style = TONE_STYLES[tone];

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card px-4 py-4 shadow-sm">
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", style.rail)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-2xl font-bold leading-tight tracking-tight", style.value)}>
            {value}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">{label}</p>
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              style.chip,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );
}
