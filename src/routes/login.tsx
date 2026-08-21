import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import {
  Camera,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  History,
  Images,
  LayoutDashboard,
  Loader2,
  Lock,
  Mail,
  Network,
  Settings,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginInputSchema, loginWithPassword, toSafeRedirect } from "@/lib/auth";

const loginSearchSchema = z.object({
  // `.catch` supaya query string yang diacak-acak tidak memunculkan error page
  // di depan operator -- redirect-nya cukup diabaikan.
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.user) {
      throw redirect({ href: toSafeRedirect(search.redirect) });
    }
  },
  component: LoginPage,
});

type ModuleHighlight = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
};

// Enam modul yang sama dengan isi sidebar setelah login, supaya operator baru
// tahu apa yang menunggu di balik layar ini.
const MODULES: ModuleHighlight[] = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    subtitle: "Ringkasan Operasi",
    description: "Volume capture, status edge device, dan tren sampling harian dalam satu layar.",
  },
  {
    icon: Camera,
    title: "Capture",
    subtitle: "Ambil Foto Sampel",
    description: "Live preview, kontrol kamera Canon, dan simpan BIN 1 / BIN 2 dalam satu alur.",
  },
  {
    icon: Images,
    title: "Gallery",
    subtitle: "Arsip Hasil Capture",
    description: "Telusuri foto per tanggal, plant, dan station lengkap dengan metadatanya.",
  },
  {
    icon: Network,
    title: "Devices",
    subtitle: "Registry Kamera",
    description: "Daftarkan Mini PC dan kamera, atur preset ISO, shutter, serta white balance.",
  },
  {
    icon: HardDrive,
    title: "Storage",
    subtitle: "Tujuan Simpan",
    description: "Pantau share jaringan dan diagnosa kegagalan penyimpanan otomatis.",
  },
  {
    icon: Settings,
    title: "Settings",
    subtitle: "Preferensi Aplikasi",
    description: "Pola penamaan berkas, jadwal pengambilan, dan zona waktu operasional.",
  },
];

// Latar bergantian. Menambah foto cukup menaruh berkasnya di public/ lalu
// menambah satu baris di sini -- tidak ada kode lain yang perlu tahu jumlahnya.
const BACKDROP_PHOTOS = ["/login-bg-ore.webp", "/login-bg-calcine.webp"];

const SLIDE_INTERVAL_MS = 7000;

const PILLARS = [
  { icon: ShieldCheck, title: "Sampel Terekam", subtitle: "Tiap BIN Terdokumentasi" },
  { icon: ClipboardCheck, title: "Metadata Lengkap", subtitle: "Waktu, Plant, Station" },
  { icon: HardDrive, title: "Simpan Otomatis", subtitle: "Langsung ke Share" },
  { icon: History, title: "Riwayat Terlacak", subtitle: "Audit per Operator" },
];

function LoginPage() {
  const router = useRouter();
  const search = Route.useSearch();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const parsed = loginInputSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Lengkapi username dan password.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await loginWithPassword({ data: parsed.data });

      if (!result.ok) {
        setError(result.message);
        setPassword("");
        return;
      }

      toast.success(`Selamat datang, ${result.user.fullName}`);

      // invalidate() dulu supaya beforeLoad di root membaca ulang sesi yang
      // baru dibuat; tanpa itu halaman tujuan masih melihat context.user null
      // dan langsung memantulkan balik ke sini.
      await router.invalidate();
      await router.navigate({ href: toSafeRedirect(search.redirect), replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `Server aplikasi tidak merespons: ${caught.message}`
          : "Server aplikasi tidak merespons.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-svh w-full overflow-hidden bg-slate-100">
      <BackdropLayers />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[1680px] flex-col gap-10 px-5 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] lg:items-stretch lg:gap-14 lg:px-12 lg:py-10">
        <BrandPanel />

        <div className="flex items-center justify-center lg:py-2">
          <div className="w-full max-w-[430px] rounded-2xl border border-white/70 bg-white/95 p-6 shadow-[0_24px_60px_-20px_rgb(15_23_42/0.35)] backdrop-blur-sm sm:p-8">
            <div className="flex justify-end">
              {/* Aplikasi ini berbahasa Indonesia sepenuhnya. Slot bahasa tetap
                  ditampilkan sebagai penanda, bukan dropdown palsu yang tidak
                  mengubah apa pun saat diklik. */}
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600">
                <Globe className="h-3.5 w-3.5" />
                Bahasa Indonesia
              </span>
            </div>

            <div className="mt-5 flex justify-center">
              <GroupLogos />
            </div>

            <div className="mt-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Selamat Datang
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Masuk untuk mulai mendokumentasikan sampel calcine.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-slate-700">
                  Username atau email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    spellCheck={false}
                    autoCapitalize="none"
                    placeholder="operator.bin1"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    disabled={submitting}
                    aria-invalid={error ? true : undefined}
                    className="h-11 border-slate-200 bg-slate-50 pl-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Password akun operator"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={submitting}
                    aria-invalid={error ? true : undefined}
                    className="h-11 border-slate-200 bg-slate-50 pl-10 pr-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="text-sm font-medium text-blue-700 underline-offset-4 transition-colors hover:text-blue-900 hover:underline"
                >
                  Lupa password?
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="h-11 w-full bg-primary text-base font-semibold hover:bg-primary/90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memeriksa...
                  </>
                ) : (
                  "Masuk"
                )}
              </Button>
            </form>

            <SsoSection />
            <HelpSection open={helpOpen} onToggle={() => setHelpOpen((value) => !value)} />

            <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
              &copy; {new Date().getFullYear()} Capture Calcine &middot; Operasional Plant
              <br />
              Penggunaan akun dicatat untuk keperluan audit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Latar halaman adalah slideshow foto operasional yang saling menyilang halus.
 *
 * Dua lapis putih di atas foto bukan hiasan: seluruh teks brand panel duduk
 * langsung di atas foto yang ramai, dan tanpa scrim itu kontrasnya jatuh.
 * Kalau foto terasa terlalu pucat atau terlalu ramai, dua nilai inilah yang
 * diatur, bukan berkas fotonya.
 */
function BackdropLayers() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (BACKDROP_PHOTOS.length < 2) return;

    // Operator yang menyetel "reduce motion" di OS-nya tidak dipaksa menonton
    // latar berganti-ganti -- foto pertama dibiarkan diam.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % BACKDROP_PHOTOS.length);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Warna dasar sebelum foto selesai termuat, supaya tidak ada kedipan
          putih kosong di koneksi plant yang lambat. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-blue-100"
      />

      {BACKDROP_PHOTOS.map((photo, index) => (
        <div
          key={photo}
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-[1500ms] ease-in-out ${
            index === activeIndex ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url('${photo}')` }}
        />
      ))}

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-white/55" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/75 via-white/25 to-white/70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(148_163_184/0.35)_1.5px,transparent_1.6px)] bg-[length:14px_14px]"
      />
    </>
  );
}

/**
 * Logo grup dipasang sebagai satu berkas, bukan tiga: ketiganya sudah punya
 * jarak dan perbandingan ukuran yang benar relatif satu sama lain di dalam
 * artwork aslinya, dan memecahnya jadi tiga <img> akan mengundang jarak yang
 * meleset saat kartunya menyempit.
 */
function GroupLogos({ className }: { className?: string }) {
  return (
    <img
      src="/merdeka-group-logo.png"
      // Nama ketiganya dieja supaya pembaca layar tidak hanya mendengar "logo".
      alt="Merdeka Copper Gold, Merdeka Battery Materials, dan Merdeka Gold Resources"
      // Dimensi asli dicantumkan supaya browser memesan ruangnya lebih dulu dan
      // kartu login tidak melompat saat gambarnya selesai termuat.
      width={1140}
      height={140}
      className={`h-auto w-full max-w-[300px] ${className ?? ""}`}
    />
  );
}

function BrandPanel() {
  return (
    <div className="flex flex-col justify-between gap-8">
      <div>
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-slate-900/20">
            <Camera className="h-6 w-6" />
          </span>
          <div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Capture <span className="text-blue-700">Calcine</span>
            </p>
            <p className="mt-1 text-[13px] leading-snug text-slate-500">
              Dokumentasi Sampling Calcine
              <br />
              Cepat, Konsisten, dan Terlacak
            </p>
          </div>
        </div>

        <div className="mt-5 h-1 w-16 rounded-full bg-blue-700" />

        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-600">
          Platform terpadu untuk mengambil, menyimpan, dan menelusuri foto sampel calcine dari
          seluruh plant &mdash; satu alur kerja dari kamera di lapangan sampai arsip di share
          jaringan.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((module) => (
            <ModuleCard key={module.title} {...module} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-700/40 shadow-lg lg:grid-cols-4">
        {PILLARS.map((pillar) => (
          <div key={pillar.title} className="flex items-center gap-2.5 bg-primary px-4 py-3.5">
            <pillar.icon className="h-5 w-5 shrink-0 text-primary-foreground/70" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-tight text-primary-foreground">
                {pillar.title}
              </p>
              <p className="truncate text-[11px] leading-tight text-primary-foreground/60">
                {pillar.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModuleCard({ icon: Icon, title, subtitle, description }: ModuleHighlight) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 text-[15px] font-semibold leading-tight text-slate-900">{title}</p>
      <p className="mt-0.5 text-[13px] font-medium leading-tight text-blue-700">{subtitle}</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

function SsoSection() {
  // Tombol SSO sengaja mati: belum ada tenant OAuth yang terdaftar untuk app
  // ini. Dibiarkan terlihat supaya tata letaknya sudah siap saat IT menyediakan
  // client ID, dan `disabled` supaya operator tidak menunggu sesuatu yang tidak
  // akan terjadi.
  const notReady = "SSO belum tersedia - masuk dengan username dan password.";

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">atau masuk dengan SSO</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          disabled
          title={notReady}
          className="h-11 border-slate-200 bg-white text-slate-600"
        >
          <GoogleMark className="mr-2 h-4 w-4" />
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled
          title={notReady}
          className="h-11 border-slate-200 bg-white text-slate-600"
        >
          <MicrosoftMark className="mr-2 h-4 w-4" />
          Microsoft
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">{notReady}</p>
    </div>
  );
}

function HelpSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-blue-100 bg-blue-50/70">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-100/60"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
          ?
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium leading-tight text-slate-700">
            Butuh bantuan masuk?
          </span>
          <span className="block text-[13px] font-semibold leading-tight text-blue-700">
            Panduan Login
          </span>
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-blue-700" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-blue-700" />
        )}
      </button>

      {open && (
        <div className="border-t border-blue-100 px-4 py-3 text-[12.5px] leading-relaxed text-slate-600">
          <ul className="space-y-1.5">
            <li>
              Pakai username operator yang didaftarkan admin, misalnya{" "}
              <code className="rounded bg-white px-1 py-0.5 text-[11.5px]">operator.bin1</code>.
              Email kantor juga diterima di kolom yang sama.
            </li>
            <li>Password salah berulang kali? Berhenti menebak dan hubungi admin.</li>
            <li>
              Reset password dan pembuatan akun baru dilakukan admin lewat database Capture-Calcine,
              bukan dari halaman ini.
            </li>
            <li>
              Kalau muncul pesan database tidak bisa dihubungi, itu kendala server, bukan akun Anda.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

function MicrosoftMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10.2v10.2H1z" />
      <path fill="#7FBA00" d="M12.8 1H23v10.2H12.8z" />
      <path fill="#00A4EF" d="M1 12.8h10.2V23H1z" />
      <path fill="#FFB900" d="M12.8 12.8H23V23H12.8z" />
    </svg>
  );
}
