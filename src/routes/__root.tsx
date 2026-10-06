import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  redirect,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

/**
 * Lama toast tampil, dalam milidetik.
 *
 * Ditetapkan sekali di sini, bukan per pemanggilan. Sebelumnya tiap tempat
 * memilih angkanya sendiri (3s, 6s, 8s, 15s) dan yang terpanjang menutupi
 * kartu galeri cukup lama untuk mengganggu.
 */
const TOAST_DURATION_MS = 3000;
import { SidebarProvider, SidebarTrigger, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { canRoleOpenPath, findNavItem, SUB_PAGE_LABELS, VIEWER_HOME } from "@/lib/nav-items";
import { LanguageSwitch } from "@/components/language-switch";
import { UserMenu } from "@/components/user-menu";
import { commonMessages as c } from "@/i18n/common";
import { fetchCurrentUser, fetchUiLanguage, type SessionUser } from "@/lib/auth";
import { getClientLanguage, I18nProvider, useT, type Language } from "@/lib/i18n";

const LOGIN_PATH = "/login";

function NotFoundComponent() {
  const t = useT();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t(c.notFoundTitle)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t(c.notFoundBody)}</p>
        <div className="mt-6">
          <Link
            to="/capture"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t(c.backToCapture)}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const t = useT();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t(c.errorTitle)}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t(c.errorBody)}</p>
        {import.meta.env.DEV && (
          <pre className="mt-4 whitespace-pre-wrap text-xs">{error.message}</pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t(c.tryAgain)}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t(c.toCapture)}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: SessionUser | null;
  language: Language;
}>()({
  // Satu-satunya gerbang aplikasi. Ditaruh di root supaya rute baru ikut
  // terkunci begitu berkasnya dibuat -- tidak ada daftar rute terproteksi yang
  // bisa lupa diperbarui.
  beforeLoad: async ({ location }) => {
    // Bahasa dibaca bersama sesi. Di server sumbernya cookie permintaan; di
    // browser keadaannya sudah ada di memori dan tidak perlu satu RPC lagi.
    const [user, language] = await Promise.all([
      fetchCurrentUser(),
      typeof document === "undefined" ? fetchUiLanguage() : getClientLanguage(),
    ]);

    if (!user && location.pathname !== LOGIN_PATH) {
      throw redirect({ to: LOGIN_PATH, search: { redirect: location.href } });
    }

    // Viewer hanya punya Gallery. Dijaga di sini, bukan di tiap rute, supaya
    // rute baru otomatis tertutup untuk peran ini tanpa perlu diingat.
    if (
      user?.role === "viewer" &&
      location.pathname !== LOGIN_PATH &&
      !canRoleOpenPath(user.role, location.pathname)
    ) {
      throw redirect({ to: VIEWER_HOME });
    }

    return { user, language };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Capture — Capture App" },
      {
        name: "description",
        content:
          "Capture images from your camera, preview, and save to a chosen directory with custom filename formats.",
      },
      { property: "og:title", content: "Capture — Capture App" },
      {
        property: "og:description",
        content:
          "Capture images from your camera, preview, and save to a chosen directory with custom filename formats.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Capture — Capture App" },
      {
        name: "twitter:description",
        content:
          "Capture images from your camera, preview, and save to a chosen directory with custom filename formats.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Logo aplikasi berupa ilustrasi raster, jadi tidak ada varian SVG-nya:
      // .ico membawa 16/32/48 px sekaligus supaya browser memilih sendiri yang
      // paling pas untuk tab, bookmark, dan daftar riwayat. PNG 96 px melayani
      // layar hi-dpi yang meminta ukuran di atas isi .ico.
      { rel: "icon", href: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { rel: "icon", href: "/favicon-96.png", type: "image/png", sizes: "96x96" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SidebarToggle() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const t = useT();

  return (
    <>
      <SidebarTrigger className="md:hidden" />
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        onClick={toggleSidebar}
        aria-label={collapsed ? t(c.showSidebar) : t(c.hideSidebar)}
        title={collapsed ? t(c.showSidebar) : t(c.hideSidebar)}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
    </>
  );
}

// The sidebar already carries the "Capture App" brand mark, so the topbar's
// job is to say *where you are*, not repeat the brand name -- a breadcrumb
// derived from NAV_ITEMS (the same list the sidebar renders from, so they
// can't disagree) instead of the old static link.
function Breadcrumb() {
  const currentPath = useRouterState({ select: (router) => router.location.pathname });
  const section = findNavItem(currentPath);
  const subLabel = SUB_PAGE_LABELS[currentPath];
  const t = useT();

  if (!section) {
    return <span className="font-semibold tracking-tight">Capture App</span>;
  }

  const Icon = section.icon;
  return (
    <nav aria-label={t(c.breadcrumb)} className="flex min-w-0 items-center gap-1.5 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      {subLabel ? (
        <>
          <Link to={section.url} className="truncate text-muted-foreground hover:text-foreground">
            {t(section.label)}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          <span className="truncate font-semibold text-foreground">{t(subLabel)}</span>
        </>
      ) : (
        <span className="truncate font-semibold text-foreground">{t(section.label)}</span>
      )}
    </nav>
  );
}

function RootComponent() {
  const { queryClient, language } = Route.useRouteContext();
  const onLoginRoute = useRouterState({
    select: (router) => router.location.pathname === LOGIN_PATH,
  });

  // Layar login berdiri sendiri tanpa sidebar dan topbar: sebelum operator
  // masuk, tidak ada satu pun tujuan navigasi di sana yang bisa dibuka.
  if (onLoginRoute) {
    return (
      <I18nProvider ssrLanguage={language}>
        <QueryClientProvider client={queryClient}>
          <Outlet />
          <Toaster richColors duration={TOAST_DURATION_MS} />
        </QueryClientProvider>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider ssrLanguage={language}>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <div className="flex min-h-svh w-full">
            <AppSidebar />
            <SidebarInset className="transition-[width,margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
              {/* Topbar menempel di atas supaya identitas operator dan tombol
                lipat sidebar tetap terjangkau saat halaman panjang di-scroll --
                Gallery dan Devices keduanya jauh lebih tinggi dari satu layar. */}
              <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
                <SidebarToggle />
                <Breadcrumb />
                <div className="ml-auto flex items-center gap-1">
                  <LanguageSwitch />
                  <UserMenu />
                </div>
              </header>
              {/* Latar abu di sini, bukan di tiap halaman: kartu putih isi halaman
                baru terbaca sebagai permukaan kalau ada yang lebih gelap di
                belakangnya. */}
              <div className="flex-1 overflow-auto bg-muted/50">
                <Outlet />
              </div>
            </SidebarInset>
          </div>
          <Toaster richColors duration={TOAST_DURATION_MS} />
        </SidebarProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
