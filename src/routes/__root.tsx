import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
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
import { SidebarProvider, SidebarTrigger, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NAV_ITEMS, SUB_PAGE_TITLES } from "@/lib/nav-items";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Halaman tidak ditemukan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Halaman yang Anda cari tidak tersedia atau sudah dipindahkan.
        </p>
        <div className="mt-6">
          <Link
            to="/capture"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Kembali ke Capture
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Halaman gagal dimuat
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Terjadi kendala di aplikasi. Coba muat ulang halaman ini atau kembali ke Capture.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Coba lagi
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ke Capture
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
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
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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

  return (
    <>
      <SidebarTrigger className="md:hidden" />
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
        title={collapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
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
  const section = NAV_ITEMS.find(
    (item) => currentPath === item.url || currentPath.startsWith(`${item.url}/`),
  );
  const subTitle = SUB_PAGE_TITLES[currentPath];

  if (!section) {
    return <span className="font-semibold tracking-tight">Capture App</span>;
  }

  const Icon = section.icon;
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      {subTitle ? (
        <>
          <Link to={section.url} className="truncate text-muted-foreground hover:text-foreground">
            {section.title}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          <span className="truncate font-semibold text-foreground">{subTitle}</span>
        </>
      ) : (
        <span className="truncate font-semibold text-foreground">{section.title}</span>
      )}
    </nav>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <div className="flex min-h-svh w-full">
          <AppSidebar />
          <SidebarInset className="transition-[width,margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
            <header className="flex h-14 items-center gap-2 border-b px-4">
              <SidebarToggle />
              <Breadcrumb />
            </header>
            <div className="flex-1 overflow-auto">
              <Outlet />
            </div>
          </SidebarInset>
        </div>
        <Toaster richColors />
      </SidebarProvider>
    </QueryClientProvider>
  );
}
