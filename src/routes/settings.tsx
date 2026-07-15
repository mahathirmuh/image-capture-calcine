import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — Capture App" },
      { name: "description", content: "Application settings and preferences." },
      { property: "og:title", content: "Settings — Capture App" },
      { property: "og:description", content: "Application settings and preferences." },
    ],
  }),
});

function SettingsPage() {
  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Application preferences and saved directory options are managed from the Capture page.
        </p>
      </header>
      <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        No global settings available yet. Use the Capture page to choose your save folder,
        filename format, and file format.
      </section>
    </div>
  );
}
