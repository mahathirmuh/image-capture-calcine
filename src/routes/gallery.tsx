import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  LayoutGrid,
  List,
  Maximize2,
  MapPin,
  MoreVertical,
  Pencil,
  Package,
  User,
  X,
} from "lucide-react";
import { type GalleryItem, loadGallery, saveGallery, removeGalleryItem } from "@/lib/gallery-store";
import { getDeviceStatus, type DeviceStatus } from "@/lib/camera-api";
import { getImageDimensions, computeHistogram, type Histogram } from "@/lib/image-analysis";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
  head: () => ({
    meta: [
      { title: "Gallery — Capture App" },
      { name: "description", content: "Browse, review, and manage captured images." },
      { property: "og:title", content: "Gallery — Capture App" },
      { property: "og:description", content: "Browse, review, and manage captured images." },
    ],
  }),
});

type SortOption = "newest" | "oldest" | "name-asc" | "name-desc";

function formatDateTime(ts: number) {
  const date = new Date(ts);
  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} ${timePart}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function getFileFormat(name: string): string {
  const ext = name.includes(".") ? (name.split(".").pop() ?? "") : "";
  return ext ? ext.toUpperCase() : "—";
}

// Stored as the space-free "BIN1"/"BIN2" token; show it as "BIN 1"/"BIN 2".
function formatBin(bin?: string): string {
  return bin ? bin.replace(/^BIN/, "BIN ") : "—";
}

function HistogramChart({ histogram }: { histogram: Histogram }) {
  const width = 240;
  const height = 96;
  const max = Math.max(1, ...histogram.r, ...histogram.g, ...histogram.b);
  const toPoints = (arr: number[]) =>
    arr.map((v, i) => `${(i / 255) * width},${height - (v / max) * height}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full">
      <polyline
        points={toPoints(histogram.r)}
        fill="none"
        stroke="#ef4444"
        strokeWidth="1"
        opacity="0.85"
      />
      <polyline
        points={toPoints(histogram.g)}
        fill="none"
        stroke="#22c55e"
        strokeWidth="1"
        opacity="0.85"
      />
      <polyline
        points={toPoints(histogram.b)}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1"
        opacity="0.85"
      />
    </svg>
  );
}

function QcBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ${className}`}
    >
      Pending
    </span>
  );
}

function GalleryPage() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);

  const [detailItem, setDetailItem] = useState<GalleryItem | null>(null);
  const [detailDimensions, setDetailDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [detailHistogram, setDetailHistogram] = useState<Histogram | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterBin, setFilterBin] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    let cancelled = false;
    setHydrated(true);
    loadGallery().then((items) => {
      if (!cancelled) setGallery(items);
    });
    getDeviceStatus().then((result) => {
      if (!cancelled) setDeviceStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real values computed on demand for whichever item is open in the detail
  // panel -- dimensions + a histogram read straight from the pixels.
  useEffect(() => {
    if (!detailItem) {
      setDetailDimensions(null);
      setDetailHistogram(null);
      return;
    }
    let cancelled = false;
    setDetailDimensions(null);
    setDetailHistogram(null);
    getImageDimensions(detailItem.blob).then((dims) => {
      if (!cancelled) setDetailDimensions(dims);
    });
    computeHistogram(detailItem.blob).then((hist) => {
      if (!cancelled) setDetailHistogram(hist);
    });
    return () => {
      cancelled = true;
    };
  }, [detailItem]);

  async function persist(items: GalleryItem[]) {
    setGallery(items);
    await saveGallery(items);
  }

  async function deleteItem(item: GalleryItem) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      if (item.parentDir && item.fileHandle) {
        await item.parentDir.removeEntry(item.name);
      }
      URL.revokeObjectURL(item.url);
      const next = gallery.filter((x) => x.id !== item.id);
      await persist(next);
      await removeGalleryItem(item.id);
      if (detailItem?.id === item.id) setDetailItem(null);
      setSelectedIds((prev) => {
        if (!prev.has(item.id)) return prev;
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete");
    }
  }

  async function renameItem(item: GalleryItem) {
    const suggested = item.name;
    const nextName = prompt("New filename (include extension):", suggested);
    if (!nextName || nextName === item.name) return;
    try {
      let updated: GalleryItem = { ...item, name: nextName };
      if (item.parentDir && item.fileHandle) {
        const newHandle = await item.parentDir.getFileHandle(nextName, { create: true });
        const writable = await newHandle.createWritable();
        await writable.write(item.blob);
        await writable.close();
        await item.parentDir.removeEntry(item.name);
        updated = { ...updated, fileHandle: newHandle };
      }
      const next = gallery.map((x) => (x.id === item.id ? updated : x));
      await persist(next);
      if (detailItem?.id === item.id) setDetailItem(updated);
    } catch (e: any) {
      alert(e?.message ?? "Failed to rename");
    }
  }

  function downloadItem(item: GalleryItem) {
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.name;
    a.click();
  }

  function downloadSelected() {
    for (const item of gallery) {
      if (selectedIds.has(item.id)) downloadItem(item);
    }
  }

  function exportCSV() {
    if (gallery.length === 0) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ["filename", "extension", "file_size_bytes", "captured_at", "location"],
      ...gallery.map((item) => {
        const storage = item.fileHandle
          ? `saved/${item.folder}`.replace(/\/+$/, "")
          : `(downloaded)/${item.folder}`.replace(/\/+$/, "");
        const extension = item.name.includes(".") ? (item.name.split(".").pop() ?? "") : "";
        return [
          item.name,
          extension,
          String(item.blob.size),
          new Date(item.createdAt).toISOString(),
          storage,
        ];
      }),
    ];
    const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `capture-list-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setSearchQuery("");
    setFilterDate("");
    setFilterLocation("");
    setFilterBin("");
  }

  const uniqueLocations = Array.from(
    new Set(gallery.map((item) => item.folder).filter(Boolean)),
  ).sort();

  const sortedGallery = [...gallery].sort((a, b) => {
    switch (sortOption) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "oldest":
        return a.createdAt - b.createdAt;
      case "newest":
      default:
        return b.createdAt - a.createdAt;
    }
  });

  const filteredGallery = sortedGallery.filter((item) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesDate =
      filterDate === "" || new Date(item.createdAt).toISOString().slice(0, 10) === filterDate;
    const matchesLocation = filterLocation === "" || item.folder === filterLocation;
    const matchesBin = filterBin === "" || item.bin === filterBin;
    return matchesSearch && matchesDate && matchesLocation && matchesBin;
  });

  const totalPages = Math.max(1, Math.ceil(filteredGallery.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageStart = (clampedPage - 1) * pageSize;
  const pageItems = filteredGallery.slice(pageStart, pageStart + pageSize);
  const selectedItems = gallery.filter((item) => selectedIds.has(item.id));

  if (!hydrated) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gallery</h1>
            <p className="text-sm text-muted-foreground">
              Browse, review, and manage captured images.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompareOpen(true)}
              disabled={selectedIds.size < 2}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Columns2 className="h-4 w-4" /> Compare
            </button>
            <button
              onClick={downloadSelected}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Download
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-md border border-input bg-background p-2 hover:bg-accent">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCSV} disabled={gallery.length === 0}>
                  Export CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Filter bar */}
        <section className="mb-4 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Location</label>
            <select
              value={filterLocation}
              onChange={(e) => {
                setFilterLocation(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value="">All locations</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Source (Bin)
            </label>
            <select
              value={filterBin}
              onChange={(e) => {
                setFilterBin(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value="">All Bins</option>
              <option value="BIN1">BIN 1</option>
              <option value="BIN2">BIN 2</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Shift</label>
            <select
              disabled
              className="w-full rounded-md border border-input bg-muted px-2 py-1.5 text-xs opacity-60"
            >
              <option>All Shift</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              QC Status
            </label>
            <select
              disabled
              className="w-full rounded-md border border-input bg-muted px-2 py-1.5 text-xs opacity-60"
            >
              <option>All</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Clear Filter
            </button>
          </div>
          <div className="sm:col-span-3 lg:col-span-6">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Search file name
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. capture-001"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            />
          </div>
        </section>

        {/* Content header */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Total {filteredGallery.length} images</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <label className="text-muted-foreground">Sort by</label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name-asc">Name A → Z</option>
                <option value="name-desc">Name Z → A</option>
              </select>
            </div>
            <div className="flex overflow-hidden rounded-md border border-input">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 ${viewMode === "grid" ? "bg-accent" : "bg-background hover:bg-accent/50"}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 ${viewMode === "list" ? "bg-accent" : "bg-background hover:bg-accent/50"}`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {gallery.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            Saved captures will appear here.
          </div>
        ) : filteredGallery.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No captures match the current search or filters.
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pageItems.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-md border bg-background"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="absolute left-2 top-2 z-10 h-4 w-4 rounded"
                  aria-label={`Select ${item.name}`}
                />
                <QcBadge className="absolute right-2 top-2 z-10" />
                <button
                  onClick={() => setDetailItem(item)}
                  className="block aspect-square w-full overflow-hidden bg-muted"
                  title="Open"
                >
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </button>
                <div className="p-2">
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="h-2.5 w-2.5" /> {formatDateTime(item.createdAt)}
                  </div>
                  <div className="truncate text-xs font-medium" title={item.name}>
                    {item.name}
                  </div>
                  <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" /> {item.folder || "—"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-2.5 w-2.5" /> {formatBin(item.bin)}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-2.5 w-2.5" /> —
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-1 hover:bg-accent">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => downloadItem(item)}>
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => renameItem(item)}>Rename</DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteItem(item)}
                          className="text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-8 p-2"></th>
                  <th className="w-8 p-2"></th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Captured</th>
                  <th className="p-2">Location</th>
                  <th className="p-2">Bin</th>
                  <th className="p-2">QC</th>
                  <th className="w-8 p-2"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-accent/30">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Select ${item.name}`}
                      />
                    </td>
                    <td className="p-2">
                      <button
                        onClick={() => setDetailItem(item)}
                        className="block h-10 w-10 overflow-hidden rounded bg-muted"
                      >
                        <img
                          src={item.url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    </td>
                    <td className="max-w-xs truncate p-2 font-medium">{item.name}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{item.folder || "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">{formatBin(item.bin)}</td>
                    <td className="p-2">
                      <QcBadge />
                    </td>
                    <td className="p-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded p-1 hover:bg-accent">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => downloadItem(item)}>
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => renameItem(item)}>
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteItem(item)}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredGallery.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Showing {pageStart + 1} to {Math.min(pageStart + pageSize, filteredGallery.length)} of{" "}
              {filteredGallery.length} images
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={clampedPage <= 1}
                  className="rounded-md border border-input bg-background p-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="rounded-md border border-input px-2 py-1">{clampedPage}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={clampedPage >= totalPages}
                  className="rounded-md border border-input bg-background p-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-md border border-input bg-background px-2 py-1.5"
              >
                {[12, 24, 48, 96].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Detail side panel */}
      {detailItem && (
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l bg-card p-4 lg:block">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold" title={detailItem.name}>
              {detailItem.name}
            </span>
            <button
              onClick={() => setDetailItem(null)}
              className="shrink-0 rounded p-1 hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mb-4 overflow-hidden rounded-md border bg-muted">
            <img
              src={detailItem.url}
              alt={detailItem.name}
              className="aspect-video w-full object-contain"
            />
            <button
              onClick={() => setFullscreenUrl(detailItem.url)}
              className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 hover:bg-background"
              title="Fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Metadata</span>
              <button
                onClick={() => renameItem(detailItem)}
                className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] hover:bg-accent"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="text-right font-medium">{detailItem.folder || "—"}</dd>
              <dt className="text-muted-foreground">Source (Bin)</dt>
              <dd className="text-right font-medium">{formatBin(detailItem.bin)}</dd>
              <dt className="text-muted-foreground">Capture Time</dt>
              <dd className="text-right font-medium">{formatDateTime(detailItem.createdAt)}</dd>
              <dt className="text-muted-foreground">Operator</dt>
              <dd className="text-right font-medium">—</dd>
              <dt className="text-muted-foreground">Camera</dt>
              <dd className="text-right font-medium">{deviceStatus?.camera?.model ?? "—"}</dd>
              <dt className="text-muted-foreground">Mini PC</dt>
              <dd className="text-right font-medium">{deviceStatus?.deviceId ?? "—"}</dd>
              <dt className="text-muted-foreground">File Size</dt>
              <dd className="text-right font-medium">{formatBytes(detailItem.blob.size)}</dd>
              <dt className="text-muted-foreground">Image Size</dt>
              <dd className="text-right font-medium">
                {detailDimensions ? `${detailDimensions.width} x ${detailDimensions.height}` : "—"}
              </dd>
              <dt className="text-muted-foreground">File Format</dt>
              <dd className="text-right font-medium">{getFileFormat(detailItem.name)}</dd>
            </dl>
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Quality Check (QC)
              </span>
              <QcBadge />
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Focus Score</dt>
                <dd className="font-medium">—</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Lens Clean</dt>
                <dd className="font-medium">—</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Exposure</dt>
                <dd className="font-medium">—</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Resolution</dt>
                <dd className="font-medium">
                  {detailDimensions
                    ? `${detailDimensions.width} x ${detailDimensions.height}`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Lighting</dt>
                <dd className="font-medium">—</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Blur Level</dt>
                <dd className="font-medium">—</dd>
              </div>
            </dl>
          </div>

          <div className="mb-4">
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">
              Histogram
            </span>
            {detailHistogram ? (
              <HistogramChart histogram={detailHistogram} />
            ) : (
              <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                Computing…
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => downloadItem(detailItem)}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Download
            </button>
            <button
              onClick={() => toggleSelect(detailItem.id)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              {selectedIds.has(detailItem.id) ? "Deselect" : "Compare"}
            </button>
            <button
              onClick={() => deleteItem(detailItem)}
              className="flex-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20"
            >
              Delete
            </button>
          </div>
        </aside>
      )}

      {/* Fullscreen viewer */}
      {fullscreenUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setFullscreenUrl(null)}
        >
          <img src={fullscreenUrl} alt="" className="max-h-full max-w-full object-contain" />
          <button
            onClick={() => setFullscreenUrl(null)}
            className="absolute right-4 top-4 rounded-md bg-background/80 p-2 hover:bg-background"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Compare modal */}
      {compareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setCompareOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Compare ({selectedItems.length})</h2>
              <button onClick={() => setCompareOpen(false)} className="rounded p-1 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, selectedItems.length)}, minmax(0, 1fr))`,
              }}
            >
              {selectedItems.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-md border">
                  <img
                    src={item.url}
                    alt={item.name}
                    className="aspect-square w-full object-contain bg-muted"
                  />
                  <div className="truncate p-2 text-xs font-medium" title={item.name}>
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
