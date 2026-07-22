import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  HardDrive,
  LayoutGrid,
  List,
  Maximize2,
  MapPin,
  MoreVertical,
  Pencil,
  Package,
  Search,
  User,
  Wifi,
  X,
} from "lucide-react";
import { type GalleryItem, loadGallery, saveGallery, removeGalleryItem } from "@/lib/gallery-store";
import { getDeviceStatus, type DeviceStatus } from "@/lib/camera-api";
import { listCaptureRecords, type CaptureRecordView } from "@/lib/capture-records";
import {
  DEFAULT_GALLERY_VIEW_STATE,
  GALLERY_PAGE_SIZE_OPTIONS,
  GALLERY_SAVED_VIEWS,
  type GallerySavedViewPreference,
  type GallerySortOption,
  type GalleryViewState,
  galleryViewStateMatchesSavedView,
  getGallerySavedViewById,
  loadGallerySavedViewPreference,
  loadGalleryViewState,
  saveGallerySavedViewPreference,
  saveGalleryViewState,
} from "@/lib/gallery-preferences";
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
      {
        name: "description",
        content: "Telusuri, review, dan kelola hasil capture yang tersimpan lokal.",
      },
      { property: "og:title", content: "Gallery — Capture App" },
      {
        property: "og:description",
        content: "Telusuri, review, dan kelola hasil capture yang tersimpan lokal.",
      },
    ],
  }),
});

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

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

function formatBin(bin?: string): string {
  if (!bin) return "—";
  const normalized = bin.trim().toUpperCase();
  if (normalized === "BIN1" || normalized === "BIN 1") return "BIN 1";
  if (normalized === "BIN2" || normalized === "BIN 2") return "BIN 2";
  if (normalized === "BIN 1 / BIN 2" || normalized === "BIN1/BIN2") return "BIN 1 / BIN 2";
  return bin;
}

function formatCaptureRecordStatus(status: string): string {
  return status === "downloaded"
    ? "Diunduh lokal"
    : status === "saved"
      ? "Tersimpan"
      : status || "—";
}

function formatSaveMethodLabel(method: CaptureRecordView["saveMethod"]): string {
  return method === "edge-network"
    ? "Edge -> network"
    : method === "browser-folder"
      ? "Browser -> folder"
      : method === "browser-download"
        ? "Browser download"
        : "—";
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
      Menunggu
    </span>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function GalleryPage() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [captureRecords, setCaptureRecords] = useState<CaptureRecordView[]>([]);
  const [captureRecordsError, setCaptureRecordsError] = useState<string | null>(null);

  const [detailItem, setDetailItem] = useState<GalleryItem | null>(null);
  const [detailDimensions, setDetailDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [detailHistogram, setDetailHistogram] = useState<Histogram | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  const [sortOption, setSortOption] = useState<GallerySortOption>(
    DEFAULT_GALLERY_VIEW_STATE.sortOption,
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterBin, setFilterBin] = useState("");
  const [savedViewPreference, setSavedViewPreference] =
    useState<GallerySavedViewPreference>("all-images");
  const [galleryViewLoaded, setGalleryViewLoaded] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    let cancelled = false;
    setHydrated(true);
    const savedViewState = loadGalleryViewState();
    const savedView = loadGallerySavedViewPreference();
    setSortOption(savedViewState.sortOption);
    setViewMode(savedViewState.viewMode);
    setPageSize(savedViewState.pageSize);
    setSearchQuery(savedViewState.searchQuery);
    setFilterDate(savedViewState.filterDate);
    setFilterLocation(savedViewState.filterLocation);
    setFilterBin(savedViewState.filterBin);
    setSavedViewPreference(savedView);
    setGalleryViewLoaded(true);
    loadGallery().then((items) => {
      if (!cancelled) setGallery(items);
    });
    listCaptureRecords({ data: { limit: 200 } }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setCaptureRecordsError(result.message);
        setCaptureRecords([]);
        return;
      }
      setCaptureRecordsError(null);
      setCaptureRecords(result.records);
    });
    getDeviceStatus().then((result) => {
      if (!cancelled) setDeviceStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentViewState = useMemo<GalleryViewState>(
    () => ({
      sortOption,
      viewMode,
      pageSize,
      searchQuery,
      filterDate,
      filterLocation,
      filterBin,
    }),
    [filterBin, filterDate, filterLocation, pageSize, searchQuery, sortOption, viewMode],
  );

  useEffect(() => {
    if (!galleryViewLoaded) return;
    saveGalleryViewState(currentViewState);
  }, [currentViewState, galleryViewLoaded]);

  useEffect(() => {
    if (!galleryViewLoaded) return;
    saveGallerySavedViewPreference(savedViewPreference);
  }, [galleryViewLoaded, savedViewPreference]);

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
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Gagal menghapus item"));
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
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Gagal mengubah nama file"));
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
    setPage(1);
  }

  function applyViewState(viewState: GalleryViewState) {
    setSortOption(viewState.sortOption);
    setViewMode(viewState.viewMode);
    setPageSize(viewState.pageSize);
    setSearchQuery(viewState.searchQuery);
    setFilterDate(viewState.filterDate);
    setFilterLocation(viewState.filterLocation);
    setFilterBin(viewState.filterBin);
    setPage(1);
  }

  function selectSavedView(savedViewId: GallerySavedViewPreference) {
    setSavedViewPreference(savedViewId);
    applyViewState(getGallerySavedViewById(savedViewId).state);
  }

  const uniqueLocations = Array.from(
    new Set(
      [
        ...gallery.map((item) => item.folder),
        ...captureRecords.map((item) => item.plant ?? ""),
      ].filter(Boolean),
    ),
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
  const filteredCaptureRecords = captureRecords.filter((item) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.fileName.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesDate = filterDate === "" || item.capturedAt.slice(0, 10) === filterDate;
    const matchesLocation = filterLocation === "" || item.plant === filterLocation;
    const matchesBin = filterBin === "" || formatBin(item.captureBin) === formatBin(filterBin);
    return matchesSearch && matchesDate && matchesLocation && matchesBin;
  });
  const recentCaptureRecords = filteredCaptureRecords.slice(0, 8);

  const clampedPage = Math.min(page, totalPages);
  const pageStart = (clampedPage - 1) * pageSize;
  const pageItems = filteredGallery.slice(pageStart, pageStart + pageSize);
  const selectedItems = gallery.filter((item) => selectedIds.has(item.id));
  const totalBytes = gallery.reduce((sum, item) => sum + item.blob.size, 0);
  const filteredBytes = filteredGallery.reduce((sum, item) => sum + item.blob.size, 0);
  const selectedBytes = selectedItems.reduce((sum, item) => sum + item.blob.size, 0);
  const cameraStateLabel = deviceStatus?.online
    ? deviceStatus.camera?.connected
      ? "Kamera terhubung"
      : "Edge online"
    : "Offline";
  const activeFilters = [
    filterLocation
      ? {
          key: "location",
          label: `Lokasi: ${filterLocation}`,
          clear: () => setFilterLocation(""),
        }
      : null,
    filterBin
      ? {
          key: "bin",
          label: `Bin: ${formatBin(filterBin)}`,
          clear: () => setFilterBin(""),
        }
      : null,
    filterDate
      ? {
          key: "date",
          label: `Tanggal: ${filterDate}`,
          clear: () => setFilterDate(""),
        }
      : null,
    searchQuery.trim()
      ? {
          key: "search",
          label: `Cari: ${searchQuery.trim()}`,
          clear: () => setSearchQuery(""),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;
  const selectedSavedView = getGallerySavedViewById(savedViewPreference);
  const isCustomView = !galleryViewStateMatchesSavedView(currentViewState, savedViewPreference);
  const detailRecord =
    detailItem === null
      ? null
      : (captureRecords.find((record) => {
          if (record.fileName !== detailItem.name) return false;
          return Math.abs(new Date(record.capturedAt).getTime() - detailItem.createdAt) < 120_000;
        }) ?? null);

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
              Telusuri, review, dan kelola hasil capture yang tersimpan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompareOpen(true)}
              disabled={selectedIds.size < 2}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Columns2 className="h-4 w-4" /> Bandingkan
            </button>
            <button
              onClick={downloadSelected}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Unduh
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-md border border-input bg-background p-2 hover:bg-accent">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCSV} disabled={gallery.length === 0}>
                  Ekspor CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <OverviewCard
            icon={Search}
            label="Hasil Tersaring"
            value={filteredGallery.length}
            hint={`${gallery.length} total image tersimpan lokal`}
          />
          <OverviewCard
            icon={CheckSquare}
            label="Item Terpilih"
            value={selectedIds.size}
            hint={
              selectedIds.size > 0
                ? `${formatBytes(selectedBytes)} siap compare/download`
                : "Belum ada item dipilih"
            }
          />
          <OverviewCard
            icon={HardDrive}
            label="Storage Terlihat"
            value={formatBytes(filteredBytes)}
            hint={`${formatBytes(totalBytes)} total browser storage`}
          />
          <OverviewCard
            icon={Wifi}
            label="Status Device"
            value={cameraStateLabel}
            hint={deviceStatus?.deviceId ?? "Device status belum tersedia"}
          />
          <OverviewCard
            icon={Package}
            label="Log Registry"
            value={filteredCaptureRecords.length}
            hint={`${captureRecords.length} record capture di MSSQL`}
          />
        </section>

        <section className="mb-4 rounded-lg border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Riwayat Registry DB
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Menampilkan metadata capture yang tercatat di MSSQL. Preview gambar tetap berasal
                dari browser gallery lokal.
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              {filteredCaptureRecords.length} record cocok filter
            </span>
          </div>

          {captureRecordsError ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-700">
              Gagal memuat capture_records dari MSSQL: {captureRecordsError}
            </div>
          ) : recentCaptureRecords.length === 0 ? (
            <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
              Belum ada metadata capture di MSSQL yang cocok dengan filter saat ini.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2">Nama File</th>
                    <th className="p-2">Waktu</th>
                    <th className="p-2">Lokasi</th>
                    <th className="p-2">Bin</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Metode</th>
                    <th className="p-2">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCaptureRecords.map((record) => (
                    <tr key={record.id} className="border-t">
                      <td className="max-w-xs truncate p-2 font-medium" title={record.fileName}>
                        {record.fileName}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {formatDateTime(new Date(record.capturedAt).getTime())}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{record.plant ?? "—"}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {formatBin(record.captureBin ?? undefined)}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {formatCaptureRecordStatus(record.status)}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {formatSaveMethodLabel(record.saveMethod)}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {record.deviceName ?? record.deviceCode ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mb-4 rounded-lg border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                View Tersimpan
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Filter, sort, mode tampilan, dan page size terakhir akan tersimpan di browser ini.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  isCustomView ? "bg-amber-500/10 text-amber-700" : "bg-primary/10 text-primary"
                }`}
              >
                {isCustomView ? "View kustom" : selectedSavedView.label}
              </span>
              {isCustomView && (
                <button
                  type="button"
                  onClick={() => selectSavedView(savedViewPreference)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Terapkan ulang view tersimpan
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {GALLERY_SAVED_VIEWS.map((savedView) => {
              const isActive = savedView.id === savedViewPreference && !isCustomView;
              const isSelected = savedView.id === savedViewPreference;
              return (
                <button
                  key={savedView.id}
                  type="button"
                  onClick={() => selectSavedView(savedView.id)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : isSelected
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "bg-background hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{savedView.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : isSelected
                            ? "bg-amber-500/10 text-amber-700"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isActive ? "Aktif" : isSelected ? "Dipilih" : "Preset"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{savedView.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filter bar */}
        <section className="mb-4 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Lokasi</label>
            <select
              value={filterLocation}
              onChange={(e) => {
                setFilterLocation(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value="">Semua lokasi</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Sumber (Bin)
            </label>
            <select
              value={filterBin}
              onChange={(e) => {
                setFilterBin(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value="">Semua Bin</option>
              <option value="BIN1">BIN 1</option>
              <option value="BIN2">BIN 2</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tanggal</label>
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
              <option>Semua Shift</option>
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
              <option>Semua</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Bersihkan Filter
            </button>
          </div>
          <div className="sm:col-span-3 lg:col-span-6">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Cari nama file
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="mis. capture-001"
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            />
          </div>
        </section>

        {activeFilters.length > 0 && (
          <section className="mb-4 rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Filter Aktif
              </span>
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => {
                    filter.clear();
                    setPage(1);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-input bg-background px-2.5 py-1 text-xs hover:bg-accent"
                >
                  <span>{filter.label}</span>
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setPage(1);
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Reset semua
              </button>
            </div>
          </section>
        )}

        {selectedIds.size > 0 && (
          <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div>
              <div className="text-sm font-semibold">
                {selectedIds.size} gambar dipilih untuk tindakan batch
              </div>
              <div className="text-xs text-muted-foreground">
                Gunakan compare untuk review visual, atau download batch untuk export lokal.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCompareOpen(true)}
                disabled={selectedIds.size < 2}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                <Columns2 className="h-3.5 w-3.5" />
                Bandingkan pilihan
              </button>
              <button
                onClick={downloadSelected}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh pilihan
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
                Bersihkan pilihan
              </button>
            </div>
          </section>
        )}

        {/* Content header */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Total {filteredGallery.length} gambar</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <label className="text-muted-foreground">Urutkan</label>
              <select
                value={sortOption}
                onChange={(e) => {
                  setSortOption(e.target.value as GallerySortOption);
                  setPage(1);
                }}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              >
                <option value="newest">Terbaru dulu</option>
                <option value="oldest">Terlama dulu</option>
                <option value="name-asc">Nama A → Z</option>
                <option value="name-desc">Nama Z → A</option>
              </select>
            </div>
            <div className="flex overflow-hidden rounded-md border border-input">
              <button
                onClick={() => {
                  setViewMode("grid");
                  setPage(1);
                }}
                className={`p-1.5 ${viewMode === "grid" ? "bg-accent" : "bg-background hover:bg-accent/50"}`}
                title="Mode grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setViewMode("list");
                  setPage(1);
                }}
                className={`p-1.5 ${viewMode === "list" ? "bg-accent" : "bg-background hover:bg-accent/50"}`}
                title="Mode list"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {gallery.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            <p>Hasil capture tersimpan akan muncul di sini.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link
                to="/capture"
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Buka Capture
              </Link>
              <Link
                to="/storage"
                className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
              >
                Cek Alur Storage
              </Link>
            </div>
          </div>
        ) : filteredGallery.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            Tidak ada capture yang cocok dengan pencarian atau filter saat ini.
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
                  aria-label={`Pilih ${item.name}`}
                />
                <QcBadge className="absolute right-2 top-2 z-10" />
                <button
                  onClick={() => setDetailItem(item)}
                  className="block aspect-square w-full overflow-hidden bg-muted"
                  title="Buka"
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
                          Unduh
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => renameItem(item)}>
                          Ubah nama
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteItem(item)}
                          className="text-destructive"
                        >
                          Hapus
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
                  <th className="p-2">Nama</th>
                  <th className="p-2">Waktu Capture</th>
                  <th className="p-2">Lokasi</th>
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
                        aria-label={`Pilih ${item.name}`}
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
                            Unduh
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => renameItem(item)}>
                            Ubah nama
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteItem(item)}
                            className="text-destructive"
                          >
                            Hapus
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
              Menampilkan {pageStart + 1} sampai{" "}
              {Math.min(pageStart + pageSize, filteredGallery.length)} dari {filteredGallery.length}{" "}
              gambar
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
                  setPageSize(Number(e.target.value) as (typeof GALLERY_PAGE_SIZE_OPTIONS)[number]);
                  setPage(1);
                }}
                className="rounded-md border border-input bg-background px-2 py-1.5"
              >
                {GALLERY_PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / halaman
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
              title="Layar penuh"
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
              <dt className="text-muted-foreground">Lokasi</dt>
              <dd className="text-right font-medium">{detailItem.folder || "—"}</dd>
              <dt className="text-muted-foreground">Source (Bin)</dt>
              <dd className="text-right font-medium">{formatBin(detailItem.bin)}</dd>
              <dt className="text-muted-foreground">Waktu Capture</dt>
              <dd className="text-right font-medium">{formatDateTime(detailItem.createdAt)}</dd>
              <dt className="text-muted-foreground">Operator</dt>
              <dd className="text-right font-medium">—</dd>
              <dt className="text-muted-foreground">Status DB</dt>
              <dd className="text-right font-medium">
                {detailRecord ? formatCaptureRecordStatus(detailRecord.status) : "Belum tercatat"}
              </dd>
              <dt className="text-muted-foreground">Metode Simpan</dt>
              <dd className="text-right font-medium">
                {detailRecord ? formatSaveMethodLabel(detailRecord.saveMethod) : "—"}
              </dd>
              <dt className="text-muted-foreground">Kamera</dt>
              <dd className="text-right font-medium">{deviceStatus?.camera?.model ?? "—"}</dd>
              <dt className="text-muted-foreground">Mini PC</dt>
              <dd className="text-right font-medium">
                {detailRecord?.deviceName ??
                  detailRecord?.deviceCode ??
                  deviceStatus?.deviceId ??
                  "—"}
              </dd>
              <dt className="text-muted-foreground">Ukuran File</dt>
              <dd className="text-right font-medium">{formatBytes(detailItem.blob.size)}</dd>
              <dt className="text-muted-foreground">Path Simpan</dt>
              <dd className="truncate text-right font-medium" title={detailRecord?.filePath ?? "—"}>
                {detailRecord?.filePath ?? "—"}
              </dd>
              <dt className="text-muted-foreground">Ukuran Gambar</dt>
              <dd className="text-right font-medium">
                {detailDimensions ? `${detailDimensions.width} x ${detailDimensions.height}` : "—"}
              </dd>
              <dt className="text-muted-foreground">Format File</dt>
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
                <dt className="text-muted-foreground">Kebersihan Lensa</dt>
                <dd className="font-medium">—</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Exposure</dt>
                <dd className="font-medium">—</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Resolusi</dt>
                <dd className="font-medium">
                  {detailDimensions
                    ? `${detailDimensions.width} x ${detailDimensions.height}`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Pencahayaan</dt>
                <dd className="font-medium">—</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Level Blur</dt>
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
                Menghitung...
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => downloadItem(detailItem)}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Unduh
            </button>
            <button
              onClick={() => toggleSelect(detailItem.id)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              {selectedIds.has(detailItem.id) ? "Batalkan pilih" : "Bandingkan"}
            </button>
            <button
              onClick={() => deleteItem(detailItem)}
              className="flex-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20"
            >
              Hapus
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
              <h2 className="text-lg font-semibold">Bandingkan ({selectedItems.length})</h2>
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
