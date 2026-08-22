import { cn } from "@/lib/utils";
import { assessPassword, type PasswordScore } from "@/lib/password-strength";

const BAR_COLORS: Record<PasswordScore, string> = {
  0: "bg-destructive",
  1: "bg-destructive",
  2: "bg-amber-500",
  3: "bg-brand",
  4: "bg-emerald-500",
};

const TEXT_COLORS: Record<PasswordScore, string> = {
  0: "text-destructive",
  1: "text-destructive",
  2: "text-amber-700",
  3: "text-brand",
  4: "text-emerald-700",
};

/**
 * Empat ruas yang terisi mengikuti nilai, ditambah satu saran.
 *
 * Nilainya tidak pernah menghalangi tombol simpan. Meteran ini memberi tahu,
 * bukan memutuskan: admin yang sedang membuatkan akun untuk operator di depan
 * mesin kadang memang perlu password sementara yang gampang diketik, dan
 * memblokirnya hanya akan memindahkan password itu ke kertas tempel di monitor.
 */
export function PasswordStrengthMeter({
  password,
  username,
  fullName,
  className,
}: {
  password: string;
  username?: string;
  fullName?: string;
  className?: string;
}) {
  if (!password) return null;

  const { score, label, hint } = assessPassword(password, { username, fullName });

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((ruas) => (
            <span
              key={ruas}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                ruas < score ? BAR_COLORS[score] : "bg-muted",
              )}
            />
          ))}
        </div>
        <span className={cn("shrink-0 text-xs font-medium", TEXT_COLORS[score])}>{label}</span>
      </div>

      {/* Dibacakan pembaca layar saat nilainya berubah, tanpa merebut fokus dari
          kolom yang sedang diketik. */}
      <p aria-live="polite" className="min-h-[1rem] text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
