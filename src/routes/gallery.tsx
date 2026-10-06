import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  FolderArchive,
  FolderSync,
  HardDrive,
  ImageOff,
  LayoutGrid,
  List,
  Loader2,
  Maximize2,
  MapPin,
  MoreVertical,
  Pencil,
  Package,
  RefreshCw,
  Search,
  User,
  Wifi,
  X,
} from "lucide-react";
import { type GalleryItem, loadGallery, saveGallery, removeGalleryItem } from "@/lib/gallery-store";
import { useEdgeStatusSelection } from "@/hooks/use-edge-status-selection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCaptureMediaUrl,
  createCaptureThumbUrls,
  saveCaptureThumbnail,
} from "@/lib/media-access";
import { blobToBase64, createThumbnailBlob } from "@/lib/thumbnail";
import { toBinLabel, toBinSlot, type BinSlot } from "@/lib/locations";
import { filterGalleryCache, type GalleryScope } from "@/lib/gallery-access";
import {
  CAPTURE_RECORDS_MAX_LIMIT,
  deleteCaptureRecord,
  isLocalOnlySave,
  listCaptureRecords,
  renameCaptureRecord,
  type CaptureRecordView,
} from "@/lib/capture-records";
import {
  DEFAULT_GALLERY_IMAGE_QUALITY,
  DEFAULT_GALLERY_VIEW_STATE,
  GALLERY_PAGE_SIZE_OPTIONS,
  GALLERY_SAVED_VIEWS,
  type GalleryImageQuality,
  loadGalleryImageQuality,
  saveGalleryImageQuality,
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
import { AppDatePicker } from "@/components/app-date-picker";
import { AppSelect } from "@/components/app-select";
import { PageTitle } from "@/components/page-shell";
import { BulkDownloadDialog, type BulkDownloadPhoto } from "@/components/bulk-download-dialog";
import { ShareSyncDialog } from "@/components/share-sync-dialog";
import { commonMessages as c } from "@/i18n/common";
import { failureText } from "@/i18n/errors";
import { deviceStatusText } from "@/i18n/device-status";
import {
  bulkDownloadMessages as bm,
  galleryMessages as m,
  gallerySavedViewMessages as sv,
  shareSyncMessages as sm,
} from "@/i18n/gallery";
import { useLocale, useRichT, useT, type Translator } from "@/lib/i18n";
import { useIsAdmin, useSessionUser } from "@/lib/use-session-user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/**
 * Sejauh mana galeri dan tabel riwayat bisa ditelusuri dari halaman ini.
 *
 * Diambil dari batas milik serverFn-nya, bukan ditulis ulang: angka yang
 * dijemput dari sana tidak bisa lagi melampaui apa yang divalidasinya.
 */
const RECORD_FETCH_LIMIT = CAPTURE_RECORDS_MAX_LIMIT;

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

function formatDateTime(ts: number, locale: string) {
  const date = new Date(ts);
  const datePart = date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString(locale, {
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

// Merapikan spasi saja, tidak menyeragamkan istilah: capture Acid Plant memang
// tersimpan sebagai TRAIN dan harus tetap tampil begitu. Bentuk tanpa
// spasi ("BIN1", "TRAIN1") berasal dari record lama yang menyimpan token nama
// berkas, bukan labelnya.
function formatBin(bin?: string): string {
  if (!bin) return "—";
  const normalized = bin.trim().toUpperCase();
  if (normalized === "BIN1" || normalized === "BIN 1") return "BIN 1";
  if (normalized === "BIN2" || normalized === "BIN 2") return "BIN 2";
  if (normalized === "TRAIN1" || normalized === "TRAIN 1") return "TRAIN 1";
  if (normalized === "TRAIN2" || normalized === "TRAIN 2") return "TRAIN 2";
  if (normalized === "BIN 1 / BIN 2" || normalized === "BIN1/BIN2") return "BIN 1 / BIN 2";
  return bin;
}

function formatCaptureRecordStatus(status: string, t: Translator): string {
  return status === "downloaded"
    ? t(m.statusDownloaded)
    : status === "pending"
      ? t(m.waitingToBeSent)
      : status === "saved"
        ? t(m.saved)
        : status || "—";
}

// Menerjemahkan path tersimpan jadi keterangan yang bisa dibaca operator.
//
// Nilai mentahnya berbeda bentuk per jalur simpan, dan yang paling menyesatkan
// adalah "browser-download/<nama>": itu bukan folder yang bisa dibuka, hanya
// penanda bahwa berkasnya turun ke folder Unduhan browser dan BELUM masuk
// share. Menampilkannya apa adanya membuat orang mengira file-nya sudah aman
// di jaringan.
//
// Path jalur jaringan ditampilkan seperti yang dilihat app server (mis.
// /mnt/mti/...), bukan bentuk UNC-nya -- itu memang yang tercatat di registry.
/**
 * Satu kartu di galeri.
 *
 * Bentuknya sengaja memakai nama medan yang sama dengan `GalleryItem` supaya
 * kartu yang datang dari registry dan yang datang dari IndexedDB dirender oleh
 * kode yang sama persis. Bedanya cuma satu: `local`.
 *
 * `local === null` berarti browser ini tidak punya blob-nya -- capture-nya
 * dilakukan di PC lain. Kartunya tetap lengkap; gambarnya diambil dari folder
 * jaringan saat dibuka. Semua tindakan yang membutuhkan berkas lokal (unduh,
 * ubah nama, hapus, histogram) ikut menyesuaikan.
 */
type GalleryCard = {
  id: string;
  name: string;
  folder: string;
  bin?: string;
  /** Jalur jadwal: sesi per 3 jam ("regular") atau sesi per 2 jam ("trial"). */
  track: CaptureRecordView["captureTrack"];
  /** Ditaruh langsung di folder jaringan lalu didaftarkan, bukan hasil capture. */
  imported: boolean;
  createdAt: number;
  captureRecordId: number | null;
  persistedPath: string | null;
  saveMethod: CaptureRecordView["saveMethod"];
  capturedBy: string | null;
  /**
   * Ukuran berkas menurut REGISTRY, bukan menurut isi browser.
   *
   * Tanpa ini "Storage Terlihat" hanya bisa menjumlahkan salinan lokal, dan di
   * browser yang belum pernah capture -- incognito, PC lain, operator shift
   * berikutnya -- jawabannya selalu 0 B untuk galeri yang jelas-jelas berisi.
   */
  fileSizeBytes: number | null;
  local: GalleryItem | null;
};

/**
 * Gambar kartu. Dua keadaan, dan bedanya bukan kosmetik:
 *
 * - `local` ada  -> blob dari IndexedDB, tampil seketika tanpa menyentuh server
 * - `local` null -> browser ini tidak punya salinannya; gambarnya di folder
 *                   jaringan, diambil saat kartunya dibuka
 *
 * Placeholder-nya menjelaskan sebabnya, bukan sekadar kotak abu-abu: "tidak
 * ada di PC ini" dan "capture-nya gagal" dua hal yang sangat berbeda, dan
 * operator perlu bisa membedakannya sekilas.
 */
function CardThumb({
  card,
  thumbUrl,
  className,
}: {
  card: GalleryCard;
  thumbUrl?: string;
  className?: string;
}) {
  const t = useT();
  // Urutannya menaik dari yang paling murah: blob lokal tidak menyentuh
  // jaringan sama sekali, thumbnail ~50 KB dari disk app server, dan foto
  // ukuran penuh (~11 MB lewat CIFS) tidak pernah dipakai di grid.
  if (card.local) {
    return <img src={card.local.url} alt={card.name} className={className} />;
  }
  if (thumbUrl) {
    return <img src={thumbUrl} alt={card.name} className={className} loading="lazy" />;
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted px-2 text-center text-muted-foreground">
      <ImageOff className="h-5 w-5" />
      <span className="text-[10px] leading-tight">{t(m.thumbPlaceholder)}</span>
    </div>
  );
}

function describeStorage(
  rawPath: string | null | undefined,
  saveMethod: CaptureRecordView["saveMethod"] | undefined,
  t: Translator,
): { label: string; path: string | null; network: boolean } {
  if (!rawPath) return { label: t(m.notKnownYet), path: null, network: false };
  const DOWNLOAD_PREFIX = "browser-download/";
  if (rawPath.startsWith(DOWNLOAD_PREFIX)) {
    return {
      label: t(m.storageBrowserDownloads),
      path: rawPath.slice(DOWNLOAD_PREFIX.length),
      network: false,
    };
  }
  if (saveMethod === "spooled") {
    return { label: t(m.storageSpooled), path: rawPath, network: false };
  }
  if (saveMethod === "app-network" || saveMethod === "edge-network") {
    return { label: t(m.storageNetworkFolder), path: rawPath, network: true };
  }
  return { label: t(m.storageBrowserFolder), path: rawPath, network: false };
}

function formatSaveMethodLabel(
  method: CaptureRecordView["saveMethod"],
  t: Translator,
  origin?: CaptureRecordView["origin"],
): string {
  // Berkasnya memang di folder jaringan, tapi bukan aplikasi yang menaruhnya.
  if (origin === "share-import") return t(m.methodShareImport);
  return method === "spooled"
    ? t(m.waitingToBeSent)
    : method === "app-network"
      ? t(m.methodAppNetwork)
      : method === "edge-network"
        ? t(m.methodEdgeNetwork)
        : method === "browser-folder"
          ? t(m.methodBrowserFolder)
          : method === "browser-download"
            ? t(m.methodBrowserDownload)
            : "—";
}

/** Bentuk ringkas sebuah kartu untuk dialog unduh massal. */
function toBulkPhoto(card: GalleryCard): BulkDownloadPhoto {
  return {
    recordId: card.captureRecordId,
    filePath: card.persistedPath,
    capturedAt: card.createdAt,
    plant: card.folder || null,
    track: card.track,
    sizeBytes: card.fileSizeBytes,
  };
}

/** Penanda foto yang ditaruh langsung di folder jaringan lalu didaftarkan. */
function ManualBadge() {
  const t = useT();
  return (
    <span
      className="shrink-0 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-medium text-sky-700"
      title={t(m.badgeManualTitle)}
    >
      {t(m.badgeManual)}
    </span>
  );
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

/**
 * Keadaan simpan sebuah kartu.
 *
 * Sebelumnya badge ini selalu bertuliskan "Menunggu" -- sisa tempat untuk fitur
 * QC yang belum ada. Pada foto yang sudah aman di folder jaringan itu bukan
 * sekadar tidak berguna, tapi menyesatkan.
 */
function QcBadge({
  saveMethod,
  className = "",
}: {
  saveMethod?: CaptureRecordView["saveMethod"];
  className?: string;
}) {
  const t = useT();
  const [label, tone] =
    saveMethod === "app-network" || saveMethod === "edge-network"
      ? [t(m.saved), "bg-emerald-500/15 text-emerald-700"]
      : saveMethod === "spooled"
        ? [t(m.waitingSend), "bg-amber-500/15 text-amber-700"]
        : [t(m.notKnownYet), "bg-muted text-muted-foreground"];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone} ${className}`}>
      {label}
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
    <div className="rounded-xl border bg-card shadow-sm p-4">
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
  const user = useSessionUser();
  return <GalleryContent key={`${user?.id ?? "anonymous"}:${user?.role ?? ""}`} />;
}

function GalleryContent() {
  const isAdmin = useIsAdmin();
  // Viewer hanya melihat fotonya. Tabel riwayat registry -- path simpan,
  // metode, device -- adalah bahan kerja operator dan admin, bukan miliknya.
  const isViewer = useSessionUser()?.role === "viewer";
  const t = useT();
  const rich = useRichT();
  const locale = useLocale();
  // Penerjemah terbaru untuk efek pemuatan awal di bawah. Efek itu hanya boleh
  // jalan sekali; menjadikan `t` dependensinya akan memuat ulang seluruh galeri
  // setiap kali bahasa diganti.
  const tRef = useRef(t);
  tRef.current = t;
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const edgeSelection = useEdgeStatusSelection(isAdmin);
  const {
    status: deviceStatus,
    loading: deviceStatusLoading,
    checkedAt: deviceStatusCheckedAt,
  } = edgeSelection;
  const [captureRecords, setCaptureRecords] = useState<CaptureRecordView[]>([]);
  const [captureRecordsError, setCaptureRecordsError] = useState<string | null>(null);
  const [galleryScope, setGalleryScope] = useState<GalleryScope | null>(null);
  const visibleGallery = useMemo(
    () => filterGalleryCache(gallery, galleryScope, captureRecords),
    [gallery, galleryScope, captureRecords],
  );
  const [recordPage, setRecordPage] = useState(1);

  // Istilah slot mengikuti plant si PENONTON, bukan plant tiap record. Satu
  // galeri bisa memuat record dari beberapa plant sekaligus; menamai filternya
  // per record akan menghasilkan dua tombol yang menyaring hal yang sama.
  // Super Admin (tidak terkunci) jatuh ke istilah default.
  const viewerPlant = galleryScope?.plant ?? "";
  const binLabel = (slot: BinSlot) => toBinLabel(viewerPlant, slot);

  const [detailItem, setDetailItem] = useState<GalleryCard | null>(null);

  // Kartu aktif dan panel detail dipisah, karena keduanya bukan hal yang sama.
  //
  // `detailItem` menandai kartu mana yang sedang disorot -- layar penuh
  // memakainya untuk tahu posisi maju/mundurnya. Panel samping punya sakelar
  // sendiri, supaya membuka gambar layar penuh tidak ikut memunculkan panel
  // metadata di belakangnya. Panel itu hanya muncul kalau memang diminta lewat
  // tombol Detail.
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  // URL bertanda tangan untuk gambar yang tidak ada di browser ini, per record.
  // Umurnya lima menit, jadi disimpan per sesi buka halaman saja -- tidak perlu
  // dan tidak boleh diawetkan.
  const [remoteImageUrls, setRemoteImageUrls] = useState<Record<number, string>>({});
  // URL thumbnail per record. Diminta sekali untuk seluruh halaman grid, bukan
  // satu-satu: 24 kartu berarti 24 perjalanan bolak-balik sebelum gambar
  // pertama muncul.
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({});
  // Id yang sudah ditanyakan ke server. Tanpa ini, "tidak ada di thumbUrls"
  // rancu antara "memang belum punya thumbnail" dan "belum sempat ditanyakan"
  // -- dan spanduk backfill di bawah akan menghitung yang kedua sebagai yang
  // pertama.
  const [thumbChecked, setThumbChecked] = useState<ReadonlySet<number>>(new Set());
  const [backfilling, setBackfilling] = useState(false);
  const [backfillDone, setBackfillDone] = useState(0);
  const backfillStopRef = useRef(false);
  // Sudah pernah dijalankan otomatis pada pembukaan halaman ini. Menahan dua
  // hal sekaligus: efeknya menyalakan ulang setiap kali daftar menyusut, dan
  // backfill yang dihentikan orang menyala lagi dengan sendirinya.
  const backfillAutoStartedRef = useRef(false);
  const [remoteImageError, setRemoteImageError] = useState<string | null>(null);
  const [remoteImageLoading, setRemoteImageLoading] = useState(false);
  const [detailDimensions, setDetailDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [detailHistogram, setDetailHistogram] = useState<Histogram | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  // Sedang menukar gambar layar penuh dari thumbnail ke resolusi penuh.
  const [fullscreenUpgrading, setFullscreenUpgrading] = useState(false);

  // Bawaannya hemat: foto dibuka dari thumbnail (~50 KB dari disk app server),
  // bukan berkas asli (~11 MB lewat CIFS dari 10.1.1.44). HD ditarik hanya
  // ketika diminta -- entah lewat pilihan ini, atau tombol "Muat HD" pada satu
  // gambar saja.
  const [imageQuality, setImageQuality] = useState<GalleryImageQuality>(
    DEFAULT_GALLERY_IMAGE_QUALITY,
  );
  // Dibaca dari dalam showDetailAt, yang tidak boleh ikut dibuat ulang setiap
  // kali gambar layar penuh berganti -- ia dipakai juga oleh pendengar papan
  // ketik, dan mendaftar ulang listener pada tiap perpindahan gambar itu
  // pemborosan yang tidak perlu.
  const fullscreenOpenRef = useRef(false);
  // Kartu yang unduhannya sedang disiapkan dari folder jaringan.
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [shareSyncOpen, setShareSyncOpen] = useState(false);
  const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);

  // Konfirmasi hapus & ubah nama dipegang di state, bukan lewat confirm()/
  // prompt() bawaan browser. Dialog bawaan itu menempel di tepi atas jendela,
  // tidak mengikuti tema aplikasi, dan tidak bisa menampilkan sebab kegagalan
  // di tempat yang sama -- untuk penghapusan permanen ke folder jaringan,
  // dialognya justru bagian yang paling perlu terbaca jelas.
  const [pendingDelete, setPendingDelete] = useState<GalleryCard | null>(null);
  const [pendingRename, setPendingRename] = useState<GalleryCard | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const [sortOption, setSortOption] = useState<GallerySortOption>(
    DEFAULT_GALLERY_VIEW_STATE.sortOption,
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterBin, setFilterBin] = useState<GalleryViewState["filterBin"]>("");
  const [filterTrack, setFilterTrack] = useState<GalleryViewState["filterTrack"]>("");
  const [savedViewPreference, setSavedViewPreference] =
    useState<GallerySavedViewPreference>("all-images");
  const [galleryViewLoaded, setGalleryViewLoaded] = useState(false);
  // Kembali ke halaman pertama setiap kali filter berubah. Satu effect, bukan
  // setRecordPage(1) yang ditempel di 12 handler filter -- satu yang terlewat
  // akan menghasilkan bug yang hanya muncul lewat satu filter tertentu.
  useEffect(() => {
    setRecordPage(1);
  }, [searchQuery, filterDate, filterLocation, filterBin, filterTrack]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<GalleryViewState["pageSize"]>(
    DEFAULT_GALLERY_VIEW_STATE.pageSize,
  );

  const refreshDeviceStatus = () => edgeSelection.refresh(edgeSelection.selectedCode);

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
    setFilterTrack(savedViewState.filterTrack);
    setSavedViewPreference(savedView);
    setImageQuality(loadGalleryImageQuality());
    setGalleryViewLoaded(true);
    loadGallery()
      .then((items) => {
        if (!cancelled) setGallery(items);
      })
      .catch(() => {
        if (!cancelled) toast.error(tRef.current(m.cacheUnreadable));
      });
    // 200 hanya menutup sekitar tiga hari (8 sesi x 2 slot x 4 plant = 64
    // capture/hari). Sekarang galeri DAN tabel sama-sama bersumber dari sini,
    // jadi batasnya menentukan seberapa jauh ke belakang keduanya bisa dilihat.
    // Untuk riwayat yang lebih dalam, pakai /api/v1/captures yang berpaginasi
    // di SQL -- menarik seluruh tabel ke browser bukan jalan keluarnya.
    listCaptureRecords({ data: { limit: RECORD_FETCH_LIMIT } })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setCaptureRecordsError(failureText(tRef.current, result));
          setCaptureRecords([]);
          return;
        }
        setCaptureRecordsError(null);
        setGalleryScope(result.scope);
        if (!result.scope.allPlants) setFilterLocation("");
        setCaptureRecords(result.records);
      })
      // Kegagalan yang DILEMPAR -- validator menolak, jaringan putus, serverFn
      // error -- tidak pernah sampai ke cabang `!result.ok` di atas. Tanpa ini
      // galeri hanya diam dan kosong, dan kekosongan itu terbaca seperti
      // "memang belum ada capture".
      .catch((error: unknown) => {
        if (cancelled) return;
        setCaptureRecordsError(
          error instanceof Error ? error.message : tRef.current(m.registryRequestFailed),
        );
        setCaptureRecords([]);
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
      filterTrack,
    }),
    [
      filterBin,
      filterDate,
      filterLocation,
      filterTrack,
      pageSize,
      searchQuery,
      sortOption,
      viewMode,
    ],
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
  //
  // Hanya untuk kartu yang blob-nya ada di browser ini. Menghitungnya untuk
  // gambar jauh berarti mengunduh 11 MB demi sebuah grafik -- keduanya
  // ditampilkan sebagai "tidak tersedia" saja, dan itu jujur.
  useEffect(() => {
    const blob = detailItem?.local?.blob ?? null;
    if (!blob) {
      setDetailDimensions(null);
      setDetailHistogram(null);
      return;
    }
    let cancelled = false;
    setDetailDimensions(null);
    setDetailHistogram(null);
    getImageDimensions(blob).then((dims) => {
      if (!cancelled) setDetailDimensions(dims);
    });
    computeHistogram(blob).then((hist) => {
      if (!cancelled) setDetailHistogram(hist);
    });
    return () => {
      cancelled = true;
    };
  }, [detailItem]);

  // Foto ukuran penuh DIAMBIL HANYA KALAU DIMINTA.
  //
  // Dulu ini otomatis begitu kartunya dibuka, dan itu berarti ~11 MB lewat CIFS
  // ke 10.1.1.44 setiap kali seseorang menyusuri galeri dengan panah kiri/kanan.
  // Thumbnail sudah cukup untuk hampir semua keperluan; ukuran penuh baru perlu
  // saat ada yang benar-benar ingin memeriksa detail piksel.
  const loadFullImage = useCallback(async () => {
    const recordId = detailItem?.captureRecordId ?? null;
    if (recordId === null || remoteImageUrls[recordId]) return;
    setRemoteImageError(null);
    setRemoteImageLoading(true);
    try {
      const result = await createCaptureMediaUrl({ data: { recordId } });
      if (!result.ok) {
        setRemoteImageError(failureText(t, result));
        return;
      }
      setRemoteImageUrls((urls) => ({ ...urls, [recordId]: result.url }));

      // Fotonya sudah ditarik ke browser ini; membuat thumbnail-nya sekarang
      // praktis gratis, dan menghemat tarikan 11 MB berikutnya untuk siapa pun
      // yang membuka foto ini setelahnya.
      if (!thumbUrls[recordId]) {
        void (async () => {
          try {
            const response = await fetch(result.url);
            if (!response.ok) return;
            const thumb = await createThumbnailBlob(await response.blob());
            if (!thumb) return;
            const saved = await saveCaptureThumbnail({
              data: { recordId, base64: await blobToBase64(thumb) },
            });
            if (!saved.ok) return;
            const fresh = await createCaptureThumbUrls({ data: { recordIds: [recordId] } });
            if (fresh.ok) setThumbUrls((urls) => ({ ...urls, ...fresh.urls }));
          } catch {
            // Pemercepat saja; gagalnya tidak mengubah apa pun di layar.
          }
        })();
      }
    } catch {
      setRemoteImageError(t(m.imageRequestFailed));
    } finally {
      setRemoteImageLoading(false);
    }
  }, [detailItem, remoteImageUrls, t, thumbUrls]);

  // Pesan error milik kartu sebelumnya tidak boleh menempel di kartu berikutnya.
  useEffect(() => {
    setRemoteImageError(null);
    setRemoteImageLoading(false);
  }, [detailItem]);

  async function persist(items: GalleryItem[]) {
    setGallery(items);
    await saveGallery(items);
  }

  /**
   * Hapus capture: baris registry, JPEG di folder jaringan, thumbnail, dan
   * salinan di browser ini.
   *
   * SERVER DULU, LOKAL BELAKANGAN. Yang memegang berkas sungguhannya adalah
   * server; kalau ia menolak, salinan lokal tidak boleh ikut hilang -- itu
   * justru membuang satu-satunya salinan yang tersisa sementara fotonya tetap
   * ada di share.
   */
  function openDetail(card: GalleryCard) {
    setDetailItem(card);
    setDetailPanelOpen(true);
  }

  function closeDetail() {
    setDetailPanelOpen(false);
    setDetailItem(null);
  }

  /** Path berkasnya di share, atau null kalau capture ini tidak pernah ke sana. */
  function sharePathOf(card: GalleryCard): string | null {
    const path = card.persistedPath;
    if (!path || path.startsWith("browser-download/")) return null;
    return path;
  }

  function askDelete(card: GalleryCard) {
    setDialogError(null);
    setPendingDelete(card);
  }

  function askRename(card: GalleryCard) {
    setDialogError(null);
    setRenameValue(card.name);
    setPendingRename(card);
  }

  /**
   * Hapus capture: baris registry, JPEG di folder jaringan, thumbnail, dan
   * salinan di browser ini.
   *
   * SERVER DULU, LOKAL BELAKANGAN. Yang memegang berkas sungguhannya adalah
   * server; kalau ia menolak, salinan lokal tidak boleh ikut hilang -- itu
   * justru membuang satu-satunya salinan yang tersisa sementara fotonya tetap
   * ada di share.
   */
  async function confirmDelete() {
    const card = pendingDelete;
    if (!card) return;

    const local = card.local;
    setDialogBusy(true);
    setDialogError(null);
    try {
      const captureDelete = await deleteCaptureRecord({
        data: {
          recordId: card.captureRecordId ?? null,
          fileName: card.name,
          capturedAt: card.createdAt,
        },
      });

      // Record tidak ketemu bukan alasan berhenti: kartu yatim (registry sudah
      // tidak mengenalnya) tetap harus bisa dibersihkan dari browser ini.
      if (!captureDelete.ok && captureDelete.code !== "CAPTURE_RECORD_NOT_FOUND") {
        // Dialognya sengaja dibiarkan terbuka: sebabnya terbaca di tempat
        // keputusannya diambil, dan tombolnya tinggal ditekan lagi.
        setDialogError(failureText(t, captureDelete));
        return;
      }

      if (captureDelete.ok) {
        setCaptureRecords((prev) => prev.filter((record) => record.id !== captureDelete.recordId));
        if (captureDelete.fileLeftOnShare) {
          // Kartunya hilang dari galeri, berkasnya tidak. Itu harus dikatakan,
          // bukan didiamkan -- kalau tidak, orang menyangka share-nya sudah
          // bersih padahal tidak.
          toast.warning(t(m.recordDeletedFileKept), {
            description: t(m.recordDeletedFileKeptDetail, { path: captureDelete.fileLeftOnShare }),
          });
        }
      }

      if (local) {
        if (local.parentDir && local.fileHandle) {
          await local.parentDir.removeEntry(local.name).catch(() => {});
        }
        URL.revokeObjectURL(local.url);
        await persist(gallery.filter((x) => x.id !== local.id));
        await removeGalleryItem(local.id);
      }

      if (detailItem?.id === card.id) closeDetail();
      setSelectedIds((prev) => {
        if (!prev.has(card.id)) return prev;
        const next = new Set(prev);
        next.delete(card.id);
        return next;
      });
      setPendingDelete(null);
    } catch (error: unknown) {
      setDialogError(getErrorMessage(error, t(m.deleteFailed)));
    } finally {
      setDialogBusy(false);
    }
  }

  /**
   * Ubah nama capture, termasuk nama berkasnya di folder jaringan.
   *
   * Urutannya sama seperti hapus dan karena alasan yang sama: registry yang
   * menyebut nama yang tidak ada di share lebih buruk daripada perubahan nama
   * yang gagal dan tinggal diulang.
   */
  async function confirmRename() {
    const card = pendingRename;
    if (!card) return;
    const nextName = renameValue.trim();
    if (!nextName || nextName === card.name) {
      setPendingRename(null);
      return;
    }

    const local = card.local;
    setDialogBusy(true);
    setDialogError(null);
    try {
      const captureRename = await renameCaptureRecord({
        data: {
          recordId: card.captureRecordId ?? null,
          currentFileName: card.name,
          nextFileName: nextName,
          capturedAt: card.createdAt,
        },
      });

      if (!captureRename.ok && captureRename.code !== "CAPTURE_RECORD_NOT_FOUND") {
        setDialogError(failureText(t, captureRename));
        return;
      }

      if (captureRename.ok) {
        setCaptureRecords((prev) =>
          prev.map((record) =>
            record.id === captureRename.recordId
              ? { ...record, fileName: nextName, filePath: captureRename.nextFilePath }
              : record,
          ),
        );
      }

      let updatedLocal: GalleryItem | null = null;
      if (local) {
        updatedLocal = { ...local, name: nextName };
        if (local.parentDir && local.fileHandle) {
          const newHandle = await local.parentDir.getFileHandle(nextName, { create: true });
          const writable = await newHandle.createWritable();
          await writable.write(local.blob);
          await writable.close();
          await local.parentDir.removeEntry(local.name);
          updatedLocal = { ...updatedLocal, fileHandle: newHandle };
        }
        if (captureRename.ok) {
          updatedLocal = {
            ...updatedLocal,
            captureRecordId: captureRename.recordId,
            persistedPath: captureRename.nextFilePath,
          };
        }
        const settled = updatedLocal;
        await persist(gallery.map((x) => (x.id === local.id ? settled : x)));
      }

      if (detailItem?.id === card.id) {
        setDetailItem({
          ...detailItem,
          name: nextName,
          persistedPath: captureRename.ok ? captureRename.nextFilePath : detailItem.persistedPath,
          local: updatedLocal ?? detailItem.local,
        });
      }
      setPendingRename(null);
    } catch (error: unknown) {
      setDialogError(getErrorMessage(error, t(m.renameFailed)));
    } finally {
      setDialogBusy(false);
    }
  }

  // Dipanggil setelah "Sinkronkan folder" mendaftarkan berkas: baris barunya
  // harus langsung tampil tanpa memuat ulang halaman.
  async function reloadCaptureRecords() {
    try {
      const result = await listCaptureRecords({ data: { limit: RECORD_FETCH_LIMIT } });
      if (!result.ok) return;
      setCaptureRecordsError(null);
      setGalleryScope(result.scope);
      setCaptureRecords(result.records);
    } catch {
      // Daftar lama tetap tampil; memuat ulang halaman akan mengambil yang baru.
    }
  }

  function downloadItem(item: GalleryItem) {
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.name;
    a.click();
  }

  /**
   * Unduh satu kartu, ada atau tidak salinan lokalnya.
   *
   * Dulu unduhan hanya mungkin untuk foto yang di-capture di browser ini --
   * `item.url` menunjuk blob di IndexedDB. Sejak kartu datang dari registry,
   * itu berarti tombol Unduh mati untuk hampir semua kartu, termasuk bagi
   * Super Admin yang jelas berhak.
   *
   * Tanpa salinan lokal, berkasnya ditarik dari folder jaringan lewat URL
   * bertanda tangan lalu diserahkan sebagai unduhan. Ini memang menarik ~11 MB
   * -- tapi itu memang yang diminta orang saat menekan "Unduh".
   */
  async function downloadCard(card: GalleryCard, quiet = false): Promise<boolean> {
    if (card.local) {
      downloadItem(card.local);
      return true;
    }
    const recordId = card.captureRecordId;
    if (recordId == null) return false;
    setDownloadingId(card.id);
    try {
      const cached = remoteImageUrls[recordId];
      const signed = cached
        ? { ok: true as const, url: cached }
        : await createCaptureMediaUrl({ data: { recordId } });
      if (!signed.ok) {
        if (!quiet) alert(t(m.downloadPrepareFailed, { reason: failureText(t, signed) }));
        return false;
      }
      const response = await fetch(signed.url);
      if (!response.ok) {
        if (!quiet) alert(t(m.downloadFetchFailed));
        return false;
      }
      // Lewat blob, bukan menautkan URL bertanda tangan langsung: server
      // melayaninya sebagai image/jpeg, jadi tautan biasa akan MENAMPILKAN
      // gambarnya di tab baru alih-alih menyimpannya.
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = card.name;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      return true;
    } catch {
      if (!quiet) alert(t(m.downloadFailed));
      return false;
    } finally {
      setDownloadingId(null);
    }
  }

  /**
   * Unduh semua kartu yang dipilih.
   *
   * Dulu ini hanya menyapu salinan lokal di IndexedDB, jadi bagi siapa pun
   * yang tidak meng-capture di browser ini -- Viewer selalu, Super Admin
   * hampir selalu -- tombolnya tidak melakukan apa-apa. Sekarang tiap kartu
   * lewat downloadCard(), satu per satu: berkasnya ~11 MB, dan menariknya
   * serentak hanya membuat semuanya lambat sekaligus.
   */
  async function downloadSelected() {
    if (bulkDownloading) return;
    const cards = galleryCards.filter((card) => selectedIds.has(card.id));
    if (cards.length === 0) return;
    // Lebih dari satu foto berarti unduhan massal: satu ZIP berisi folder per
    // tanggal, bukan deretan unduhan terpisah yang menumpuk di satu folder.
    if (cards.length > 1) {
      setBulkDownloadOpen(true);
      return;
    }
    setBulkDownloading(true);
    try {
      let failed = 0;
      for (const card of cards) {
        if (!(await downloadCard(card, true))) failed += 1;
      }
      if (failed > 0) {
        alert(t(m.downloadSelectionFailed, { failed, total: cards.length }));
      }
    } finally {
      setBulkDownloading(false);
    }
  }

  function exportCSV() {
    if (filteredGallery.length === 0) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ["filename", "extension", "file_size_bytes", "captured_at", "location"],
      ...filteredGallery.map((item) => [
        item.name,
        item.name.includes(".") ? (item.name.split(".").pop() ?? "") : "",
        String(item.fileSizeBytes ?? item.local?.blob.size ?? 0),
        new Date(item.createdAt).toISOString(),
        item.folder,
      ]),
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
    setFilterTrack("");
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
    setFilterTrack(viewState.filterTrack);
    setPage(1);
  }

  function selectSavedView(savedViewId: GallerySavedViewPreference) {
    setSavedViewPreference(savedViewId);
    applyViewState(getGallerySavedViewById(savedViewId).state);
  }

  const uniqueLocations = Array.from(
    new Set(
      [
        ...visibleGallery.map((item) => item.folder),
        ...captureRecords.map((item) => item.plant ?? ""),
      ].filter(Boolean),
    ),
  ).sort();

  // Kartu galeri dibangun dari RECORD MSSQL, bukan dari isi IndexedDB.
  //
  // Ini pembalikan yang disengaja. Dulu IndexedDB yang menentukan apa yang
  // tampil, padahal ia cuma cache milik satu browser di satu PC: capture yang
  // dilakukan operator di area plant tidak pernah muncul di layar supervisor,
  // walau barisnya jelas ada di tabel registry tepat di atasnya. Registry-lah
  // yang berlaku untuk semua orang, jadi registry yang menentukan daftarnya.
  //
  // IndexedDB turun pangkat jadi pemercepat: kalau browser ini kebetulan punya
  // blob-nya, gambar tampil seketika tanpa menyentuh server. Kalau tidak,
  // kartunya tetap ada dan gambarnya diambil dari folder jaringan saat dibuka.
  //
  // Foto jalur cadangan (unduhan browser / folder pilihan) tidak ikut: ia hanya
  // ada di satu PC, jadi memajangnya memberi kesan sudah tersimpan bersama yang
  // lain, padahal tidak. Barisnya tetap utuh di tabel Riwayat Registry DB.
  const galleryCards = useMemo<GalleryCard[]>(() => {
    const unmatched = new Map<string, GalleryItem>();
    const localByRecordId = new Map<number, GalleryItem>();
    for (const item of visibleGallery) {
      unmatched.set(item.id, item);
      if (item.captureRecordId != null) localByRecordId.set(item.captureRecordId, item);
    }

    const fromRecords = captureRecords
      .filter((record) => !isLocalOnlySave(record.saveMethod))
      .map((record): GalleryCard => {
        const local = localByRecordId.get(record.id) ?? null;
        if (local) unmatched.delete(local.id);
        return {
          id: local?.id ?? `record-${record.id}`,
          name: record.fileName,
          folder: record.plant ?? "",
          bin: record.captureBin ?? undefined,
          track: record.captureTrack,
          imported: record.origin === "share-import",
          createdAt: Date.parse(record.capturedAt),
          captureRecordId: record.id,
          persistedPath: record.filePath,
          saveMethod: record.saveMethod,
          capturedBy: record.capturedBy,
          fileSizeBytes: record.fileSizeBytes,
          local,
        };
      });

    // Entri lokal tanpa pasangan record: pencatatan ke registry gagal, atau
    // record-nya sudah dihapus. Tetap ditampilkan supaya foto yang ada di
    // browser ini tidak lenyap hanya karena registry tidak mengenalinya.
    const orphans = [...unmatched.values()]
      .filter((item) => !isLocalOnlySave(item.saveMethod))
      .map((item): GalleryCard => ({
        id: item.id,
        name: item.name,
        folder: item.folder,
        bin: item.bin,
        // Salinan lokal tanpa record tidak membawa jalurnya; jalur reguler
        // adalah bawaan, sama seperti cara record lama dibaca.
        track: "regular",
        imported: false,
        createdAt: item.createdAt,
        captureRecordId: item.captureRecordId ?? null,
        persistedPath: item.persistedPath ?? null,
        saveMethod: item.saveMethod ?? null,
        capturedBy: item.capturedBy ?? null,
        // Yatim: tidak ada record, jadi satu-satunya ukuran yang diketahui
        // memang blob di browser ini.
        fileSizeBytes: item.blob.size,
        local: item,
      }));

    return [...fromRecords, ...orphans];
  }, [captureRecords, visibleGallery]);

  // Dihitung dari registry, bukan dari IndexedDB: jumlah foto yang tidak sampai
  // ke folder jaringan sama untuk semua orang, dan justru perlu terlihat dari
  // PC yang BUKAN tempat capture-nya dilakukan.
  const localOnlyCount = captureRecords.filter((record) =>
    isLocalOnlySave(record.saveMethod),
  ).length;

  const sortedGallery = [...galleryCards].sort((a, b) => {
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
    const matchesBin = filterBin === "" || toBinSlot(item.bin) === toBinSlot(filterBin);
    const matchesTrack = filterTrack === "" || item.track === filterTrack;
    return matchesSearch && matchesDate && matchesLocation && matchesBin && matchesTrack;
  });
  const filteredCaptureRecords = captureRecords.filter((item) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.fileName.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesDate = filterDate === "" || item.capturedAt.slice(0, 10) === filterDate;
    const matchesLocation = filterLocation === "" || item.plant === filterLocation;
    // Dibandingkan sebagai slot, bukan teks: "TRAIN 1" (Acid) dan "BIN 1"
    // (Chloride) adalah slot yang sama, dan record Acid Plant lama masih
    // tersimpan sebagai "BIN 1" dari sebelum istilahnya ditukar.
    const matchesBin = filterBin === "" || toBinSlot(item.captureBin) === toBinSlot(filterBin);
    const matchesTrack = filterTrack === "" || item.captureTrack === filterTrack;
    return matchesSearch && matchesDate && matchesLocation && matchesBin && matchesTrack;
  });
  // Sebelumnya `slice(0, 8)`: sisanya tidak bisa dijangkau sama sekali,
  // sementara badge di sebelahnya tetap mengumumkan "18 record cocok filter".
  // Angka yang menyebut lebih banyak daripada yang bisa dilihat itu justru
  // membuat orang mengira datanya hilang.
  const RECORDS_PER_PAGE = 8;
  const recordTotalPages = Math.max(1, Math.ceil(filteredCaptureRecords.length / RECORDS_PER_PAGE));
  // Di-clamp, bukan di-reset lewat effect: filter yang menyempit bisa membuat
  // halaman aktif melewati batas, dan clamp menanganinya saat render tanpa
  // menimbulkan render kedua.
  const clampedRecordPage = Math.min(recordPage, recordTotalPages);
  const recordStart = (clampedRecordPage - 1) * RECORDS_PER_PAGE;
  const recentCaptureRecords = filteredCaptureRecords.slice(
    recordStart,
    recordStart + RECORDS_PER_PAGE,
  );

  const totalPages = Math.max(1, Math.ceil(filteredGallery.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageStart = (clampedPage - 1) * pageSize;
  const pageItems = filteredGallery.slice(pageStart, pageStart + pageSize);

  // URL thumbnail untuk SELURUH kartu, bukan hanya halaman yang tampil.
  //
  // Jawabannya cuma peta URL -- ringan -- dan sekali ditanyakan, berpindah
  // halaman tidak perlu perjalanan baru. Ia juga yang membuat spanduk backfill
  // di bawah bisa menyebut angka yang benar untuk seluruh galeri, bukan hanya
  // halaman ini.
  //
  // Dipotong 200-an mengikuti batas serverFn-nya.
  useEffect(() => {
    const wanted = galleryCards
      .filter((card) => !card.local && card.captureRecordId != null)
      .map((card) => card.captureRecordId as number)
      .filter((id) => !thumbChecked.has(id));
    if (wanted.length === 0) return;

    let cancelled = false;
    void (async () => {
      for (let index = 0; index < wanted.length; index += 200) {
        const chunk = wanted.slice(index, index + 200);
        try {
          const result = await createCaptureThumbUrls({ data: { recordIds: chunk } });
          if (cancelled) return;
          if (result.ok) setThumbUrls((urls) => ({ ...urls, ...result.urls }));
        } catch {
          // Thumbnail cuma pemercepat. Gagalnya berarti kartu memakai
          // placeholder, bukan galeri yang rusak.
        }
        if (cancelled) return;
        setThumbChecked((prev) => {
          const next = new Set(prev);
          for (const id of chunk) next.add(id);
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [galleryCards, thumbChecked]);

  // Kartu yang SUDAH dipastikan tidak punya thumbnail -- record dari sebelum
  // fitur ini ada. Inilah yang membuat galeri terlihat seperti deretan kotak
  // kosong sampai dibuatkan.
  const missingThumbCards = useMemo(
    () =>
      galleryCards.filter(
        (card) =>
          !card.local &&
          card.captureRecordId != null &&
          thumbChecked.has(card.captureRecordId) &&
          !thumbUrls[card.captureRecordId],
      ),
    [galleryCards, thumbChecked, thumbUrls],
  );

  /**
   * Buat thumbnail untuk foto lama.
   *
   * Fotonya ditarik ukuran penuh sekali, diperkecil di browser ini, lalu
   * hasilnya dititipkan ke app server -- persis jalur yang dipakai capture
   * baru, hanya sumbernya folder jaringan alih-alih kamera. Setelah itu foto
   * itu ringan selamanya, untuk semua orang di semua PC.
   *
   * SATU PER SATU, bukan paralel: tiap berkas ~11 MB lewat CIFS, dan
   * menembakkan 24 sekaligus akan membuat link ke 10.1.1.44 tersendat untuk
   * semua orang, termasuk capture yang sedang berjalan.
   */
  const runThumbnailBackfill = useCallback(async () => {
    backfillStopRef.current = false;
    setBackfilling(true);
    setBackfillDone(0);
    try {
      for (const card of missingThumbCards) {
        if (backfillStopRef.current) break;
        const recordId = card.captureRecordId;
        if (recordId == null) continue;
        try {
          const signed = await createCaptureMediaUrl({ data: { recordId } });
          if (!signed.ok) continue;
          const response = await fetch(signed.url);
          if (!response.ok) continue;
          const thumb = await createThumbnailBlob(await response.blob());
          if (!thumb) continue;
          const saved = await saveCaptureThumbnail({
            data: { recordId, base64: await blobToBase64(thumb) },
          });
          if (!saved.ok) continue;
          const fresh = await createCaptureThumbUrls({ data: { recordIds: [recordId] } });
          if (fresh.ok) setThumbUrls((urls) => ({ ...urls, ...fresh.urls }));
        } catch {
          // Satu foto yang gagal tidak menghentikan sisanya -- berkasnya bisa
          // saja sudah dipindah orang, dan yang lain tetap layak dibuatkan.
        }
        setBackfillDone((done) => done + 1);
      }
    } finally {
      setBackfilling(false);
    }
  }, [missingThumbCards]);

  /**
   * Buka layar penuh dari sebuah kartu.
   *
   * Bertahap, dan itu yang penting: thumbnail 640 px ditampilkan SEKETIKA
   * supaya klik terasa langsung menjawab, lalu ditukar ke resolusi penuh
   * begitu berkasnya sampai. Menunggu 11 MB sebelum menampilkan apa pun akan
   * terasa seperti tombol yang rusak.
   *
   * Kartu yang blob-nya ada di browser ini sudah resolusi penuh sejak awal --
   * tidak ada yang perlu ditukar.
   */
  const openFullscreen = useCallback(
    async (card: GalleryCard) => {
      const recordId = card.captureRecordId;
      const immediate =
        card.local?.url ?? (recordId != null ? (thumbUrls[recordId] ?? null) : null);
      if (!immediate) {
        // Tidak ada yang bisa ditampilkan. Menutup lebih jujur daripada
        // membiarkan gambar sebelumnya terpampang seolah itu kartu ini.
        setFullscreenUrl(null);
        return;
      }
      // Kartu aktif ikut ditetapkan. Panah maju/mundur di layar penuh bekerja
      // atas posisi `detailItem`; tanpa ini, layar penuh yang dibuka langsung
      // dari grid muncul TANPA panah sama sekali -- indeksnya -1, dan kedua
      // tombol jadi nonaktif.
      setDetailItem(card);
      setFullscreenUrl(immediate);
      if (card.local || recordId == null) return;

      // Inilah yang dulu membuat galeri terasa berat: setiap kali gambar
      // dibuka, foto 11 MB ditarik dari share tanpa ada yang memintanya.
      // Sekarang itu hanya terjadi kalau operator memang memilih HD.
      if (imageQuality !== "hd") return;

      const cached = remoteImageUrls[recordId];
      if (cached) {
        setFullscreenUrl(cached);
        return;
      }

      setFullscreenUpgrading(true);
      try {
        const signed = await createCaptureMediaUrl({ data: { recordId } });
        if (!signed.ok) return;
        setRemoteImageUrls((urls) => ({ ...urls, [recordId]: signed.url }));
        // Hanya ditukar kalau yang sedang tampil masih gambar yang sama --
        // orang bisa saja sudah menutupnya atau berpindah ke foto lain.
        setFullscreenUrl((current) => (current === immediate ? signed.url : current));
      } catch {
        // Thumbnail-nya tetap terpampang; tidak ada yang perlu dibatalkan.
      } finally {
        setFullscreenUpgrading(false);
      }
    },
    [imageQuality, remoteImageUrls, thumbUrls],
  );

  /**
   * Tarik berkas asli untuk SATU gambar yang sedang dibuka.
   *
   * Ini yang membuat mode hemat tetap layak dipakai: bawaannya ringan, tapi
   * siapa pun yang benar-benar perlu memeriksa butiran sampel tinggal menekan
   * sekali -- tanpa mengubah preferensi, dan tanpa menyeret 11 MB untuk setiap
   * gambar lain yang kebetulan ia buka.
   */
  const upgradeFullscreenToHd = useCallback(async () => {
    const recordId = detailItem?.captureRecordId ?? null;
    if (recordId == null) return;

    const cached = remoteImageUrls[recordId];
    if (cached) {
      setFullscreenUrl(cached);
      return;
    }

    setFullscreenUpgrading(true);
    try {
      const signed = await createCaptureMediaUrl({ data: { recordId } });
      if (!signed.ok) return;
      setRemoteImageUrls((urls) => ({ ...urls, [recordId]: signed.url }));
      setFullscreenUrl(signed.url);
    } catch {
      // Thumbnail-nya tetap terpampang; tidak ada yang perlu dibatalkan.
    } finally {
      setFullscreenUpgrading(false);
    }
  }, [detailItem, remoteImageUrls]);

  // Tombol "Muat HD" hanya muncul kalau memang ada yang bisa dinaikkan:
  // kartu dengan salinan lokal sudah menampilkan berkas aslinya, dan gambar
  // yang sudah di-HD tidak perlu ditawari lagi.
  const fullscreenRecordId = detailItem?.captureRecordId ?? null;
  const showUpgradeButton =
    fullscreenUrl !== null &&
    !detailItem?.local &&
    fullscreenRecordId != null &&
    fullscreenUrl !== remoteImageUrls[fullscreenRecordId];

  // Dijalankan sendiri, tanpa menunggu diklik.
  //
  // Semula ini tombol opt-in karena menarik ulang foto lama berarti ratusan MB
  // lewat CIFS. Tapi tombol di atas halaman yang panjang ternyata tidak
  // ditemukan orang, dan galeri yang terlihat rusak jauh lebih merugikan
  // daripada satu kali lalu lintas yang memang harus terjadi cepat atau lambat.
  //
  // Ongkosnya sekali seumur hidup per foto, satu berkas pada satu waktu, dan
  // bisa dihentikan kapan saja lewat tombol yang sama.
  useEffect(() => {
    if (backfillAutoStartedRef.current || backfilling) return;
    if (missingThumbCards.length === 0) return;
    backfillAutoStartedRef.current = true;
    void runThumbnailBackfill();
  }, [backfilling, missingThumbCards, runThumbnailBackfill]);

  // Navigasi maju-mundur di panel detail.
  //
  // Dicari lewat id, bukan menyimpan indeks di state: daftar bisa berubah di
  // bawah panel yang sedang terbuka -- rename, hapus, ganti filter, ganti
  // urutan -- dan indeks tersimpan akan menunjuk gambar yang salah tanpa ada
  // tanda apa pun. `-1` berarti gambar yang dibuka sudah tidak ada di daftar,
  // dan tombolnya ikut mati dengan sendirinya.
  useEffect(() => {
    fullscreenOpenRef.current = fullscreenUrl !== null;
  }, [fullscreenUrl]);

  const detailIndex = detailItem
    ? filteredGallery.findIndex((item) => item.id === detailItem.id)
    : -1;

  const showDetailAt = useCallback(
    (index: number) => {
      const next = filteredGallery[index];
      if (!next) return;
      setDetailItem(next);
      // Grid ikut berpindah halaman. Tanpa ini, menutup panel setelah menyusuri
      // 30 gambar akan mendarat di halaman pertama, jauh dari yang terakhir
      // dilihat.
      setPage(Math.floor(index / pageSize) + 1);
      // Layar penuh ikut berganti gambar HANYA kalau ia sedang terbuka.
      //
      // Lewat openFullscreen(), bukan `next.local?.url` seperti dulu: sejak
      // galeri menampilkan kartu dari registry, kebanyakan kartu TIDAK punya
      // blob lokal. Cara lama menghasilkan null untuk kartu semacam itu, dan
      // menekan panah justru menutup layar penuh alih-alih maju ke gambar
      // berikutnya.
      if (fullscreenOpenRef.current) void openFullscreen(next);
    },
    [filteredGallery, openFullscreen, pageSize],
  );

  useEffect(() => {
    if (detailIndex < 0) return;
    const onKey = (event: KeyboardEvent) => {
      // Halaman ini punya kolom pencarian dan beberapa dropdown; panah di
      // dalamnya milik kontrol itu, bukan milik penampil gambar.
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showDetailAt(detailIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showDetailAt(detailIndex + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailIndex, showDetailAt]);
  const selectedItems = visibleGallery.filter((item) => selectedIds.has(item.id));
  // Hanya menjumlahkan kartu yang blob-nya ada di browser ini. Ukuran foto
  // yang tersimpan di share tidak diketahui tanpa menariknya, dan menariknya
  // hanya demi angka ini jelas tidak sepadan.
  // Ukuran registry lebih dulu, blob lokal hanya sebagai cadangan: registry
  // tahu ukuran SEMUA capture, sedangkan blob hanya yang kebetulan pernah
  // lewat browser ini.
  const cardBytes = (card: GalleryCard) => card.fileSizeBytes ?? card.local?.blob.size ?? 0;
  const filteredBytes = filteredGallery.reduce((sum, card) => sum + cardBytes(card), 0);
  const allCardBytes = galleryCards.reduce((sum, card) => sum + cardBytes(card), 0);
  const selectedBytes = selectedItems.reduce((sum, item) => sum + item.blob.size, 0);
  const cameraStateLabel = deviceStatus?.online
    ? deviceStatus.camera?.connected
      ? t(m.cameraConnected)
      : t(m.edgeOnline)
    : t(m.offline);
  const cameraStateHint =
    deviceStatusText(t, deviceStatus) ??
    (deviceStatus?.online
      ? (deviceStatus.deviceId ?? t(m.edgeMonitored))
      : t(m.deviceStatusUnavailable));
  const deviceStatusTone = deviceStatus?.online
    ? deviceStatus.camera?.connected
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
      : "border-amber-500/30 bg-amber-500/5 text-amber-700"
    : "border-amber-500/30 bg-amber-500/5 text-amber-700";
  const deviceStatusBadgeLabel = deviceStatusLoading
    ? t(m.badgeRefreshing)
    : !edgeSelection.selectedCode
      ? t(m.badgeChooseDevice)
      : deviceStatus?.online
        ? deviceStatus.camera?.connected
          ? t(m.badgeReady)
          : t(m.badgeEdgeActive)
        : t(m.badgeNotConnected);
  const connectedCameraName = deviceStatus?.camera
    ? [deviceStatus.camera.manufacturer, deviceStatus.camera.model].filter(Boolean).join(" ")
    : "";
  const deviceStatusDetail =
    edgeSelection.error ??
    (deviceStatusLoading
      ? t(m.detailLoading)
      : !edgeSelection.selectedCode
        ? edgeSelection.devices.length > 0
          ? t(m.detailChooseDevice)
          : t(m.detailNoActiveDevice)
        : deviceStatus?.online
          ? deviceStatus.camera?.connected
            ? connectedCameraName
              ? t(m.detailCameraNamed, { camera: connectedCameraName })
              : t(m.detailCameraActive)
            : t(m.detailCameraNotReady)
          : cameraStateHint);
  const deviceCheckedAtLabel = deviceStatusCheckedAt
    ? formatDateTime(deviceStatusCheckedAt.getTime(), locale)
    : t(m.neverChecked);
  const activeFilters = [
    filterLocation
      ? {
          key: "location",
          label: t(m.chipLocation, { value: filterLocation }),
          clear: () => setFilterLocation(""),
        }
      : null,
    filterBin
      ? {
          key: "bin",
          label: t(m.chipBin, { value: binLabel(filterBin === "BIN2" ? 2 : 1) }),
          clear: () => setFilterBin(""),
        }
      : null,
    filterTrack
      ? {
          key: "track",
          label: t(m.chipTrack, {
            value: t(filterTrack === "trial" ? m.trackTrial : m.trackRegular),
          }),
          clear: () => setFilterTrack(""),
        }
      : null,
    filterDate
      ? {
          key: "date",
          label: t(m.chipDate, { value: filterDate }),
          clear: () => setFilterDate(""),
        }
      : null,
    searchQuery.trim()
      ? {
          key: "search",
          label: t(m.chipSearch, { value: searchQuery.trim() }),
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
          if (detailItem.captureRecordId && record.id === detailItem.captureRecordId) return true;
          if (record.fileName !== detailItem.name) return false;
          return Math.abs(new Date(record.capturedAt).getTime() - detailItem.createdAt) < 120_000;
        }) ?? null);

  // Sumber gambar panel detail: blob lokal kalau ada, kalau tidak URL
  // bertanda tangan yang sudah diambil dari app server. `null` berarti belum
  // ada -- entah sedang diminta, entah gagal, dan panelnya membedakan keduanya.
  const detailRecordId = detailItem?.captureRecordId ?? null;
  const detailFullUrl =
    detailItem?.local?.url ??
    (detailRecordId != null ? (remoteImageUrls[detailRecordId] ?? null) : null);
  // Thumbnail dipakai selama ukuran penuh belum diminta. 640 px sudah tajam di
  // panel selebar ini; menariknya ~11 MB hanya untuk ditampilkan sekecil itu
  // adalah pemborosan yang dulu membuat galeri terasa berat.
  const detailThumbUrl = detailRecordId != null ? (thumbUrls[detailRecordId] ?? null) : null;
  const detailImageUrl = detailFullUrl ?? detailThumbUrl;
  const detailShowsThumbOnly = detailFullUrl === null && detailThumbUrl !== null;

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
            <PageTitle
              title={t(c.navGallery)}
              description={
                galleryScope?.allPlants
                  ? t(m.descriptionAllPlants)
                  : galleryScope?.plant
                    ? t(m.descriptionPlant, { plant: galleryScope.plant })
                    : captureRecordsError
                      ? t(m.loadFailedShort)
                      : t(m.checkingAccess)
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompareOpen(true)}
              disabled={selectedIds.size < 2}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Columns2 className="h-4 w-4" /> {t(m.compare)}
            </button>
            <button
              onClick={() => void downloadSelected()}
              disabled={selectedIds.size === 0 || bulkDownloading}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> {bulkDownloading ? t(m.preparing) : t(m.download)}
            </button>
            <button
              onClick={() => setBulkDownloadOpen(true)}
              disabled={filteredGallery.length === 0 && selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <FolderArchive className="h-4 w-4" /> {t(bm.button)}
            </button>
            {/* Untuk semua peran. Server membatasi pemindaian ke plant yang
                boleh dilihat akunnya, sama seperti isi galeri ini. */}
            <button
              onClick={() => setShareSyncOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <FolderSync className="h-4 w-4" /> {t(sm.button)}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-md border border-input bg-background p-2 hover:bg-accent">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCSV} disabled={filteredGallery.length === 0}>
                  {t(m.exportCsv)}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <section
          className={`mb-6 grid gap-4 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-5" : "xl:grid-cols-3"}`}
        >
          <OverviewCard
            icon={Search}
            label={t(m.filteredResults)}
            value={filteredGallery.length}
            hint={t(m.imagesOnNetworkFolder, { count: galleryCards.length })}
          />
          {/* Memilih hanya berguna untuk Bandingkan dan Ekspor CSV, dan
              keduanya wewenang admin. Bagi operator kartu ini selalu menunjuk
              nol dan tidak menuntun ke tindakan apa pun. */}
          {isAdmin && (
            <OverviewCard
              icon={CheckSquare}
              label={t(m.selectedItems)}
              value={selectedIds.size}
              hint={
                selectedIds.size > 0
                  ? t(m.selectedReady, { size: formatBytes(selectedBytes) })
                  : t(m.noneSelected)
              }
            />
          )}
          <OverviewCard
            icon={HardDrive}
            label={t(m.visibleStorage)}
            value={formatBytes(filteredBytes)}
            hint={t(m.totalOnNetworkFolder, { size: formatBytes(allCardBytes) })}
          />
          <OverviewCard
            icon={Wifi}
            label={t(m.deviceStatus)}
            value={cameraStateLabel}
            hint={cameraStateHint}
          />
          {/* Hitungan baris registry MSSQL adalah ukuran kesehatan sistem,
              bukan alat kerja operator. Ia menghitung SEMUA record termasuk
              yang tidak pernah sampai ke folder jaringan, jadi angkanya
              sengaja berbeda dari "Hasil Tersaring" di sebelah kiri -- selisih
              yang berguna bagi yang mengurus sistemnya, dan cuma
              membingungkan bagi yang tidak. */}
          {isAdmin && (
            <OverviewCard
              icon={Package}
              label={t(m.registryLog)}
              value={filteredCaptureRecords.length}
              hint={t(m.recordsInMssql, { count: captureRecords.length })}
            />
          )}
        </section>

        {/* Status edge device itu urusan yang mengelola perangkat, bukan yang
            memakai galeri. Operator sudah punya panel status di sidebar, dan
            di halaman Capture -- tempat status itu memang menentukan apakah ia
            bisa bekerja. Di sini ia cuma kebisingan. */}
        {isAdmin && (
          <section
            className={`mb-4 rounded-lg border px-4 py-3 ${deviceStatusTone}`}
            aria-live="polite"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {t(m.statusEdge)}
                  </span>
                  <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {deviceStatusBadgeLabel}
                  </span>
                  {deviceStatus?.online ? null : <AlertTriangle className="h-3.5 w-3.5" />}
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{deviceStatusDetail}</p>
                <div className="mt-3 w-full max-w-sm">
                  <label
                    id="gallery-edge-device-label"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    {t(m.cameraDevice)}
                  </label>
                  <Select
                    value={edgeSelection.selectedCode}
                    onValueChange={edgeSelection.select}
                    disabled={deviceStatusLoading || edgeSelection.devices.length === 0}
                  >
                    <SelectTrigger
                      aria-labelledby="gallery-edge-device-label"
                      className="w-full bg-background text-foreground"
                    >
                      <SelectValue placeholder={t(m.chooseCameraDevice)} />
                    </SelectTrigger>
                    <SelectContent>
                      {edgeSelection.devices.map((device) => (
                        <SelectItem key={device.id} value={device.deviceCode}>
                          {device.deviceName || device.deviceCode} / {device.deviceCode} /{" "}
                          {device.plant}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-1 text-xs text-foreground/70">
                  {t(m.lastChecked, { time: deviceCheckedAtLabel })}
                  {deviceStatus?.deviceId ? ` • Device ID: ${deviceStatus.deviceId}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void refreshDeviceStatus();
                  }}
                  disabled={deviceStatusLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${deviceStatusLoading ? "animate-spin" : ""}`}
                  />
                  {deviceStatusLoading ? t(m.refreshing) : t(m.refreshDevice)}
                </button>
                {isAdmin && (
                  <Link
                    to="/devices"
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    {t(m.openDevices)}
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {!isViewer && (
          <section className="mb-4 rounded-xl border bg-card shadow-sm p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(m.registryHistory)}
                </div>
                {/* Penjelasan sumber data hanya berarti bagi yang mengurus
                  sistemnya. Bagi operator, "MSSQL" dan "browser gallery lokal"
                  adalah istilah yang tidak menuntun ke tindakan apa pun. */}
                {isAdmin && (
                  <p className="mt-1 text-sm text-muted-foreground">{t(m.registryHistoryHint)}</p>
                )}
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                {t(m.recordsMatchFilter, { count: filteredCaptureRecords.length })}
              </span>
            </div>

            {captureRecordsError ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-700">
                {t(m.recordsLoadFailed, { reason: captureRecordsError })}
              </div>
            ) : recentCaptureRecords.length === 0 ? (
              <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                {t(m.recordsEmpty)}
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="p-2">{t(m.colFileName)}</th>
                      <th className="p-2">{t(m.colTime)}</th>
                      <th className="p-2">{t(m.location)}</th>
                      <th className="p-2">{t(m.colBin)}</th>
                      <th className="p-2">{t(m.colSession)}</th>
                      <th className="p-2">{t(m.operator)}</th>
                      <th className="p-2">{t(m.colStatus)}</th>
                      <th className="p-2">{t(m.colMethod)}</th>
                      <th className="p-2">{t(m.savePath)}</th>
                      <th className="p-2">{t(m.colDevice)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCaptureRecords.map((record) => (
                      <tr key={record.id} className="border-t">
                        <td className="max-w-xs truncate p-2 font-medium" title={record.fileName}>
                          {record.fileName}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {formatDateTime(new Date(record.capturedAt).getTime(), locale)}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{record.plant ?? "—"}</td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {formatBin(record.captureBin ?? undefined)}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {record.captureSession ?? "—"}
                          {record.captureTrack === "trial" && (
                            <span className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                              {t(m.trackTrialShort)}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {record.capturedBy ?? "—"}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {formatCaptureRecordStatus(record.status, t)}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {formatSaveMethodLabel(record.saveMethod, t, record.origin)}
                        </td>
                        <td className="max-w-sm p-2 text-xs text-muted-foreground">
                          {(() => {
                            const storage = describeStorage(record.filePath, record.saveMethod, t);
                            return (
                              <span
                                className="block truncate font-mono"
                                title={`${storage.label}
${storage.path ?? "—"}`}
                              >
                                {storage.path ?? "—"}
                              </span>
                            );
                          })()}
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

            {filteredCaptureRecords.length > RECORDS_PER_PAGE && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {t(m.showingRecords, {
                    from: recordStart + 1,
                    to: Math.min(recordStart + RECORDS_PER_PAGE, filteredCaptureRecords.length),
                    total: filteredCaptureRecords.length,
                  })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setRecordPage((p) => Math.max(1, p - 1))}
                    disabled={clampedRecordPage <= 1}
                    className="rounded-md border border-input bg-background p-1.5 hover:bg-accent disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="rounded-md border border-input px-2 py-1">
                    {clampedRecordPage} / {recordTotalPages}
                  </span>
                  <button
                    onClick={() => setRecordPage((p) => Math.min(recordTotalPages, p + 1))}
                    disabled={clampedRecordPage >= recordTotalPages}
                    className="rounded-md border border-input bg-background p-1.5 hover:bg-accent disabled:opacity-40"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mb-4 rounded-xl border bg-card shadow-sm p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(m.savedViews)}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t(m.savedViewsHint)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  isCustomView ? "bg-amber-500/10 text-amber-700" : "bg-primary/10 text-primary"
                }`}
              >
                {isCustomView ? t(m.customView) : t(selectedSavedView.label)}
              </span>
              {isCustomView && (
                <button
                  type="button"
                  onClick={() => selectSavedView(savedViewPreference)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t(m.reapplySavedView)}
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
                    <span className="text-sm font-semibold">
                      {savedView.slot
                        ? t(sv.slotReviewTitle, { slot: binLabel(savedView.slot) })
                        : t(savedView.label)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : isSelected
                            ? "bg-amber-500/10 text-amber-700"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isActive
                        ? t(m.viewActive)
                        : isSelected
                          ? t(m.viewSelected)
                          : t(m.viewPreset)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t(savedView.description)}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filter bar */}
        <section className="mb-4 grid gap-3 rounded-xl border bg-card shadow-sm p-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t(m.location)}
            </label>
            <AppSelect
              value={filterLocation}
              onValueChange={(value) => {
                setFilterLocation(value);
                setPage(1);
              }}
              options={[
                { value: "", label: t(m.allLocations) },
                ...uniqueLocations.map((loc) => ({ value: loc, label: loc })),
              ]}
              ariaLabel={t(m.filterLocationAria)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t(m.sourceBin)}
            </label>
            <AppSelect
              value={filterBin}
              onValueChange={(value) => {
                setFilterBin(value as GalleryViewState["filterBin"]);
                setPage(1);
              }}
              options={[
                { value: "", label: t(m.allOfTerm, { term: binLabel(1).replace(/ ?1$/, "") }) },
                { value: "BIN1", label: binLabel(1) },
                { value: "BIN2", label: binLabel(2) },
              ]}
              ariaLabel={t(m.filterSlotAria)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t(m.date)}
            </label>
            <AppDatePicker
              value={filterDate}
              onValueChange={(value) => {
                setFilterDate(value);
                setPage(1);
              }}
              ariaLabel={t(m.filterDateAria)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t(m.sessionType)}
            </label>
            <AppSelect
              value={filterTrack}
              onValueChange={(value) => {
                setFilterTrack(value as GalleryViewState["filterTrack"]);
                setPage(1);
              }}
              options={[
                { value: "", label: t(m.allSessionTypes) },
                { value: "regular", label: t(m.trackRegular) },
                { value: "trial", label: t(m.trackTrial) },
              ]}
              ariaLabel={t(m.filterTrackAria)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t(m.shift)}
            </label>
            <AppSelect
              value="all"
              onValueChange={() => {}}
              options={[{ value: "all", label: t(m.allShifts) }]}
              disabled
              ariaLabel={t(m.filterShiftAria)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t(m.qcStatus)}
            </label>
            <AppSelect
              value="all"
              onValueChange={() => {}}
              options={[{ value: "all", label: t(m.all) }]}
              disabled
              ariaLabel={t(m.filterQcAria)}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              {t(m.clearFilters)}
            </button>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t(m.imageQuality)}
            </label>
            <AppSelect
              value={imageQuality}
              onValueChange={(value) => {
                const next = value as GalleryImageQuality;
                setImageQuality(next);
                saveGalleryImageQuality(next);
              }}
              options={[
                { value: "hemat", label: t(m.qualitySaver) },
                { value: "hd", label: t(m.qualityHd) },
              ]}
              title={t(m.imageQualityTitle)}
              ariaLabel={t(m.imageQuality)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t(m.searchFileName)}
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t(m.searchPlaceholder)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            />
          </div>
        </section>

        {activeFilters.length > 0 && (
          <section className="mb-4 rounded-xl border bg-card shadow-sm p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(m.activeFilters)}
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
                {t(m.resetAll)}
              </button>
            </div>
          </section>
        )}

        {selectedIds.size > 0 && (
          <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div>
              <div className="text-sm font-semibold">
                {t(m.batchSelected, { count: selectedIds.size })}
              </div>
              <div className="text-xs text-muted-foreground">{t(m.batchHint)}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCompareOpen(true)}
                disabled={selectedIds.size < 2}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                <Columns2 className="h-3.5 w-3.5" />
                {t(m.compareSelection)}
              </button>
              <button
                onClick={() => void downloadSelected()}
                disabled={bulkDownloading}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {bulkDownloading ? t(m.preparing) : t(m.downloadSelection)}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
                {t(m.clearSelection)}
              </button>
            </div>
          </section>
        )}

        {/* Content header */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {t(m.totalImages, { count: filteredGallery.length })}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <label className="text-muted-foreground">{t(m.sortBy)}</label>
              <AppSelect
                value={sortOption}
                onValueChange={(value) => {
                  setSortOption(value as GallerySortOption);
                  setPage(1);
                }}
                options={[
                  { value: "newest", label: t(m.sortNewest) },
                  { value: "oldest", label: t(m.sortOldest) },
                  { value: "name-asc", label: t(m.sortNameAsc) },
                  { value: "name-desc", label: t(m.sortNameDesc) },
                ]}
                className="w-40"
                ariaLabel={t(m.sortBy)}
              />
            </div>
            <div className="flex overflow-hidden rounded-md border border-input">
              <button
                onClick={() => {
                  setViewMode("grid");
                  setPage(1);
                }}
                className={`p-1.5 ${viewMode === "grid" ? "bg-accent" : "bg-background hover:bg-accent/50"}`}
                title={t(m.gridMode)}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setViewMode("list");
                  setPage(1);
                }}
                className={`p-1.5 ${viewMode === "list" ? "bg-accent" : "bg-background hover:bg-accent/50"}`}
                title={t(m.listMode)}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Foto lama dari sebelum thumbnail ada. Tanpa spanduk ini, galerinya
            hanya tampak sebagai deretan kotak kosong tanpa penjelasan dan
            tanpa jalan keluar. */}
        {missingThumbCards.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-xs">
            <div className="text-muted-foreground">
              {backfilling
                ? rich(m.backfillProgress, {
                    done: <span className="font-medium">{backfillDone}</span>,
                    total: missingThumbCards.length,
                  })
                : rich(m.backfillPaused, {
                    photos: (
                      <span className="font-medium text-foreground">
                        {t(m.photoCount, { count: missingThumbCards.length })}
                      </span>
                    ),
                  })}
            </div>
            <button
              onClick={() => {
                if (backfilling) {
                  backfillStopRef.current = true;
                  return;
                }
                void runThumbnailBackfill();
              }}
              className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              {backfilling ? t(m.backfillStop) : t(m.backfillContinue)}
            </button>
          </div>
        )}

        {/* Foto yang disembunyikan tetap diumumkan jumlahnya. Menyembunyikan
            tanpa memberi tahu akan membuat operator mengira capture-nya tidak
            pernah terjadi -- padahal justru foto inilah yang perlu tindakan.
            Tidak untuk Viewer: pemberitahuannya menunjuk ke tabel riwayat yang
            tidak ia lihat, dan tindak lanjutnya bukan urusannya. */}
        {localOnlyCount > 0 && !isViewer && (
          <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
            {rich(m.localOnlyHidden, {
              count: localOnlyCount,
              label: <span className="font-medium">{t(m.methodBrowserDownload)}</span>,
            })}
          </div>
        )}

        {!galleryScope ? (
          <div
            role={captureRecordsError ? "alert" : "status"}
            className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground"
          >
            <p>{captureRecordsError ? t(m.loadFailedLong) : t(m.loadingGallery)}</p>
            {captureRecordsError && (
              <button
                className="mt-3 rounded-md border px-3 py-2"
                onClick={() => window.location.reload()}
              >
                {t(c.tryAgain)}
              </button>
            )}
          </div>
        ) : galleryCards.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            <p>{t(m.emptyGallery)}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link
                to="/capture"
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t(m.openCapture)}
              </Link>
              {isAdmin && (
                <Link
                  to="/storage"
                  className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
                >
                  {t(m.checkStorageFlow)}
                </Link>
              )}
            </div>
          </div>
        ) : filteredGallery.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            {t(m.noMatch)}
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
                  disabled={!item.local}
                  className="absolute left-2 top-2 z-10 h-4 w-4 rounded disabled:opacity-30"
                  aria-label={t(m.selectNamed, { name: item.name })}
                  title={item.local ? t(m.select) : t(m.compareNeedsLocalCopy)}
                />
                <QcBadge saveMethod={item.saveMethod} className="absolute right-2 top-2 z-10" />
                {/* Pembungkus relatif sendiri: tombol layar penuh dijangkarkan
                    ke AREA GAMBAR, bukan ke kartu. Kalau diukur dari kartu,
                    posisinya ikut bergeser mengikuti tinggi blok metadata di
                    bawahnya -- yang berubah-ubah tergantung panjang path. */}
                <div className="relative">
                  <button
                    onClick={() => void openFullscreen(item)}
                    className="block aspect-square w-full overflow-hidden bg-muted"
                    title={t(m.viewFullscreen)}
                  >
                    <CardThumb
                      card={item}
                      thumbUrl={
                        item.captureRecordId != null ? thumbUrls[item.captureRecordId] : undefined
                      }
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </button>
                  {/* Layar penuh langsung dari grid, tanpa mampir ke panel
                      detail. Bersebelahan dengan tombol gambar, bukan di
                      dalamnya: tombol di dalam tombol bukan HTML yang sah, dan
                      stopPropagation saja tidak memperbaikinya. */}
                  {(item.local ||
                    (item.captureRecordId != null && thumbUrls[item.captureRecordId])) && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void openFullscreen(item);
                      }}
                      className="absolute bottom-2 right-2 rounded-md bg-background/85 p-1.5 opacity-0 transition hover:bg-background focus:opacity-100 group-hover:opacity-100"
                      title={t(m.viewFullscreen)}
                      aria-label={t(m.viewNamedFullscreen, { name: item.name })}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="p-2">
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="h-2.5 w-2.5" /> {formatDateTime(item.createdAt, locale)}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 truncate text-xs font-medium" title={item.name}>
                      {item.name}
                    </div>
                    {item.imported && <ManualBadge />}
                  </div>
                  <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" /> {item.folder || "—"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-2.5 w-2.5" /> {formatBin(item.bin)}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-2.5 w-2.5" /> {item.capturedBy ?? "—"}
                    </div>
                    {(() => {
                      const storage = describeStorage(item.persistedPath, item.saveMethod, t);
                      return (
                        <div
                          className="flex items-start gap-1"
                          title={`${storage.label}
${storage.path ?? "—"}`}
                        >
                          <HardDrive
                            className={`mt-px h-2.5 w-2.5 shrink-0 ${
                              storage.network ? "text-emerald-600" : "text-amber-600"
                            }`}
                          />
                          <span className="truncate font-mono">{storage.path ?? "—"}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {/* Panel metadata sekarang HANYA terbuka dari sini.
                        Sebelumnya ia ikut muncul setiap kali gambarnya
                        diklik -- termasuk saat orang cuma ingin melihat
                        fotonya lebih besar, dan panel yang tidak diminta itu
                        menutupi galerinya. Terlihat untuk semua peran: di
                        sinilah operator menemukan path simpan dan tombol
                        Unduh. */}
                    <button
                      onClick={() => openDetail(item)}
                      className="rounded-md border border-input px-2 py-1 text-[10px] font-medium hover:bg-accent"
                      title={t(m.viewDetailOf, { name: item.name })}
                    >
                      {t(m.detail)}
                    </button>
                    {/* Ubah nama dan Hapus mengubah registry MSSQL, dan itu bukan
                        wewenang operator. Menyembunyikan seluruh menunya, bukan
                        menonaktifkan butirnya satu-satu: tombol mati yang tetap
                        terlihat mengundang orang mencobanya lalu bertanya kenapa
                        tidak bisa. Tanpa menu itu, Unduh tampil sebagai tombol
                        sendiri supaya Operator dan Viewer tidak perlu membuka
                        panel detail dulu. */}
                    {!isAdmin && (
                      <button
                        disabled={downloadingId === item.id}
                        onClick={() => void downloadCard(item)}
                        className="rounded p-1 hover:bg-accent disabled:opacity-40"
                        title={downloadingId === item.id ? t(m.preparing) : t(m.download)}
                        aria-label={t(m.download)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded p-1 hover:bg-accent">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={downloadingId === item.id}
                            onClick={() => void downloadCard(item)}
                          >
                            {downloadingId === item.id ? t(m.preparing) : t(m.download)}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => askRename(item)}>
                            {t(m.rename)}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => askDelete(item)}
                            className="text-destructive"
                          >
                            {t(m.delete)}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
                  <th className="p-2">{t(m.colName)}</th>
                  <th className="p-2">{t(m.captureTime)}</th>
                  <th className="p-2">{t(m.location)}</th>
                  <th className="p-2">{t(m.colBin)}</th>
                  <th className="p-2">{t(m.savePath)}</th>
                  <th className="p-2">{t(m.colQc)}</th>
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
                        aria-label={t(m.selectNamed, { name: item.name })}
                      />
                    </td>
                    <td className="p-2">
                      <button
                        onClick={() => void openFullscreen(item)}
                        className="block h-10 w-10 overflow-hidden rounded bg-muted"
                        title={t(m.viewFullscreen)}
                      >
                        <CardThumb
                          card={item}
                          thumbUrl={
                            item.captureRecordId != null
                              ? thumbUrls[item.captureRecordId]
                              : undefined
                          }
                          className="h-full w-full object-cover"
                        />
                      </button>
                    </td>
                    <td className="max-w-xs p-2 font-medium">
                      <div className="flex items-center gap-1">
                        <span className="min-w-0 truncate">{item.name}</span>
                        {item.imported && <ManualBadge />}
                      </div>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt, locale)}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{item.folder || "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">{formatBin(item.bin)}</td>
                    <td className="max-w-sm p-2 text-xs text-muted-foreground">
                      {(() => {
                        const storage = describeStorage(item.persistedPath, item.saveMethod, t);
                        return (
                          <span
                            className="block truncate font-mono"
                            title={`${storage.label}
${storage.path ?? "—"}`}
                          >
                            {storage.path ?? "—"}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-2">
                      <QcBadge />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-end gap-1">
                        {/* Sama seperti di grid: panel detail hanya terbuka
                            dari tombol ini, dan tombolnya terlihat untuk semua
                            peran -- menu di sebelahnya khusus admin, jadi
                            tanpa ini operator tidak punya jalan ke panel sama
                            sekali di mode list. */}
                        <button
                          onClick={() => openDetail(item)}
                          className="rounded-md border border-input px-2 py-1 text-[10px] font-medium hover:bg-accent"
                          title={t(m.viewDetailOf, { name: item.name })}
                        >
                          {t(m.detail)}
                        </button>
                        {!isAdmin && (
                          <button
                            disabled={downloadingId === item.id}
                            onClick={() => void downloadCard(item)}
                            className="rounded p-1 hover:bg-accent disabled:opacity-40"
                            title={downloadingId === item.id ? t(m.preparing) : t(m.download)}
                            aria-label={t(m.download)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded p-1 hover:bg-accent">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={downloadingId === item.id}
                                onClick={() => void downloadCard(item)}
                              >
                                {downloadingId === item.id ? t(m.preparing) : t(m.download)}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => askRename(item)}>
                                {t(m.rename)}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => askDelete(item)}
                                className="text-destructive"
                              >
                                {t(m.delete)}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
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
              {t(m.showingImages, {
                from: pageStart + 1,
                to: Math.min(pageStart + pageSize, filteredGallery.length),
                total: filteredGallery.length,
              })}
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
              <AppSelect
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value) as (typeof GALLERY_PAGE_SIZE_OPTIONS)[number]);
                  setPage(1);
                }}
                options={GALLERY_PAGE_SIZE_OPTIONS.map((n) => ({
                  value: String(n),
                  label: t(m.perPage, { count: n }),
                }))}
                className="w-32"
                ariaLabel={t(m.perPageAria)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Detail side panel */}
      {detailItem && detailPanelOpen && (
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l bg-card p-4 lg:block">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold" title={detailItem.name}>
              {detailItem.name}
            </span>
            <button onClick={closeDetail} className="shrink-0 rounded p-1 hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mb-2 overflow-hidden rounded-md border bg-muted">
            {detailImageUrl ? (
              <img
                src={detailImageUrl}
                alt={detailItem.name}
                className="aspect-video w-full object-contain"
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground">
                {remoteImageLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{t(m.fetchingImage)}</span>
                  </>
                ) : (
                  <>
                    <ImageOff className="h-5 w-5" />
                    <span>{remoteImageError ?? t(m.imageUnavailable)}</span>
                  </>
                )}
              </div>
            )}
            {detailImageUrl && (
              <button
                onClick={() => void openFullscreen(detailItem)}
                className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 hover:bg-background"
                title={t(m.fullscreen)}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
            {/* Ukuran penuh selalu bisa dijangkau, tapi selalu atas permintaan.
                Label menyebut ukurannya supaya orang tahu apa yang ia minta
                sebelum menunggu. */}
            {detailShowsThumbOnly && (
              <button
                onClick={() => void loadFullImage()}
                disabled={remoteImageLoading}
                className="absolute bottom-2 left-2 rounded-md bg-background/85 px-2 py-1 text-[11px] font-medium hover:bg-background disabled:opacity-60"
              >
                {remoteImageLoading
                  ? t(m.loading)
                  : detailRecord?.fileSizeBytes
                    ? t(m.loadFullSizeWithSize, { size: formatBytes(detailRecord.fileSizeBytes) })
                    : t(m.loadFullSize)}
              </button>
            )}
            <button
              onClick={() => showDetailAt(detailIndex - 1)}
              disabled={detailIndex <= 0}
              title={t(m.previousImage)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 hover:bg-background disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => showDetailAt(detailIndex + 1)}
              disabled={detailIndex < 0 || detailIndex >= filteredGallery.length - 1}
              title={t(m.nextImage)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 hover:bg-background disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-4 text-center text-[11px] text-muted-foreground">
            {detailIndex >= 0
              ? t(m.positionHint, { index: detailIndex + 1, total: filteredGallery.length })
              : t(m.notInFilteredList)}
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{t(m.metadata)}</span>
              {isAdmin && (
                <button
                  onClick={() => askRename(detailItem)}
                  className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-40"
                  title={t(m.renameFileTitle)}
                >
                  <Pencil className="h-3 w-3" /> {t(m.edit)}
                </button>
              )}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">{t(m.location)}</dt>
              <dd className="text-right font-medium">{detailItem.folder || "—"}</dd>
              <dt className="text-muted-foreground">{t(m.sourceBinDetail)}</dt>
              <dd className="text-right font-medium">{formatBin(detailItem.bin)}</dd>
              <dt className="text-muted-foreground">{t(m.captureTime)}</dt>
              <dd className="text-right font-medium">
                {formatDateTime(detailItem.createdAt, locale)}
              </dd>
              <dt className="text-muted-foreground">{t(m.operator)}</dt>
              <dd className="text-right font-medium">
                {detailRecord?.capturedBy ?? detailItem.capturedBy ?? "—"}
              </dd>
              <dt className="text-muted-foreground">{t(m.dbStatus)}</dt>
              <dd className="text-right font-medium">
                {detailRecord
                  ? formatCaptureRecordStatus(detailRecord.status, t)
                  : t(m.notRecorded)}
              </dd>
              <dt className="text-muted-foreground">{t(m.saveMethod)}</dt>
              <dd className="text-right font-medium">
                {detailRecord
                  ? formatSaveMethodLabel(detailRecord.saveMethod, t, detailRecord.origin)
                  : "—"}
              </dd>
              <dt className="text-muted-foreground">{t(m.camera)}</dt>
              <dd className="text-right font-medium">
                {/* Foto yang ditaruh manual tidak diambil kamera mana pun; mengisi
                    kolom ini dari device yang sedang dipilih akan mengaku sebaliknya. */}
                {detailItem.imported ? "—" : (deviceStatus?.camera?.model ?? "—")}
              </dd>
              <dt className="text-muted-foreground">{t(m.miniPc)}</dt>
              <dd className="text-right font-medium">
                {detailItem.imported
                  ? "—"
                  : (detailRecord?.deviceName ??
                    detailRecord?.deviceCode ??
                    deviceStatus?.deviceId ??
                    "—")}
              </dd>
              <dt className="text-muted-foreground">{t(m.fileSize)}</dt>
              <dd className="text-right font-medium">
                {detailItem.local
                  ? formatBytes(detailItem.local.blob.size)
                  : detailRecord?.fileSizeBytes
                    ? formatBytes(detailRecord.fileSizeBytes)
                    : "—"}
              </dd>
              <dt className="text-muted-foreground">{t(m.storedIn)}</dt>
              <dd className="text-right font-medium">
                {
                  describeStorage(
                    detailRecord?.filePath ?? detailItem.persistedPath,
                    detailRecord?.saveMethod ?? detailItem.saveMethod,
                    t,
                  ).label
                }
              </dd>
              <dt className="text-muted-foreground">{t(m.imageSize)}</dt>
              <dd className="text-right font-medium">
                {detailDimensions ? `${detailDimensions.width} x ${detailDimensions.height}` : "—"}
              </dd>
              <dt className="text-muted-foreground">{t(m.fileFormat)}</dt>
              <dd className="text-right font-medium">{getFileFormat(detailItem.name)}</dd>
            </dl>

            {(() => {
              const storage = describeStorage(
                detailRecord?.filePath ?? detailItem.persistedPath,
                detailRecord?.saveMethod ?? detailItem.saveMethod,
                t,
              );
              if (!storage.path) return null;
              return (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {t(m.fullPath)}
                    </span>
                    <button
                      onClick={() => void navigator.clipboard?.writeText(storage.path ?? "")}
                      className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-0.5 text-[11px] hover:bg-accent"
                    >
                      {t(m.copy)}
                    </button>
                  </div>
                  <p
                    className={`rounded-md px-2 py-1.5 font-mono text-[11px] break-all ${
                      storage.network
                        ? "bg-emerald-500/10 text-emerald-800"
                        : "bg-amber-500/10 text-amber-800"
                    }`}
                  >
                    {storage.path}
                  </p>
                  {!storage.network && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t(m.notOnNetworkFolder)}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t(m.qualityCheck)}
              </span>
              <QcBadge />
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t(m.focusScore)}</dt>
                <dd className="font-medium">—</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t(m.lensCleanliness)}</dt>
                <dd className="font-medium">—</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t(m.exposure)}</dt>
                <dd className="font-medium">—</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t(m.resolution)}</dt>
                <dd className="font-medium">
                  {detailDimensions
                    ? `${detailDimensions.width} x ${detailDimensions.height}`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t(m.lighting)}</dt>
                <dd className="font-medium">—</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t(m.blurLevel)}</dt>
                <dd className="font-medium">—</dd>
              </div>
            </dl>
          </div>

          <div className="mb-4">
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">
              {t(m.histogram)}
            </span>
            {detailHistogram ? (
              <HistogramChart histogram={detailHistogram} />
            ) : (
              <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                {t(m.calculating)}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              disabled={downloadingId === detailItem.id}
              onClick={() => void downloadCard(detailItem)}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              title={detailItem.local ? t(m.downloadLocalCopy) : t(m.downloadFromNetwork)}
            >
              {t(m.download)}
            </button>
            <button
              onClick={() => toggleSelect(detailItem.id)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              {selectedIds.has(detailItem.id) ? t(m.deselect) : t(m.compare)}
            </button>
            {isAdmin && (
              <button
                onClick={() => askDelete(detailItem)}
                className="flex-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-40"
              >
                {t(m.delete)}
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Daftarnya hanya disusun saat dialog terbuka: sampai seribu kartu, dan
          tidak ada gunanya memetakannya di setiap render galeri. */}
      <BulkDownloadDialog
        open={bulkDownloadOpen}
        onOpenChange={setBulkDownloadOpen}
        selected={
          bulkDownloadOpen
            ? galleryCards.filter((card) => selectedIds.has(card.id)).map(toBulkPhoto)
            : []
        }
        filtered={bulkDownloadOpen ? filteredGallery.map(toBulkPhoto) : []}
      />

      <ShareSyncDialog
        open={shareSyncOpen}
        onOpenChange={setShareSyncOpen}
        onImported={() => void reloadCaptureRecords()}
        canManage={isAdmin}
      />

      {/* Fullscreen viewer */}
      {fullscreenUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setFullscreenUrl(null)}
        >
          <img src={fullscreenUrl} alt="" className="max-h-full max-w-full object-contain" />
          {fullscreenUpgrading ? (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-background/85 px-3 py-1.5 text-xs font-medium">
              {t(m.loadingFullResolution)}
            </span>
          ) : (
            // Mode hemat tanpa jalan keluar sama saja melumpuhkan galeri: orang
            // membuka foto sampel justru untuk memeriksa butirannya. Jadi HD
            // tetap terjangkau, hanya untuk gambar ini saja, sekali klik.
            showUpgradeButton && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  void upgradeFullscreenToHd();
                }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-background/85 px-3 py-1.5 text-xs font-medium hover:bg-background"
                title={t(m.loadHdTitle)}
              >
                {t(m.loadHd)}
              </button>
            )
          )}
          <button
            onClick={() => setFullscreenUrl(null)}
            className="absolute right-4 top-4 rounded-md bg-background/80 p-2 hover:bg-background"
          >
            <X className="h-4 w-4" />
          </button>
          {/* stopPropagation wajib: latar overlay menutup dirinya saat diklik,
              dan tanpa ini menekan panah justru menutup layar penuh. */}
          <button
            onClick={(event) => {
              event.stopPropagation();
              showDetailAt(detailIndex - 1);
            }}
            disabled={detailIndex <= 0}
            title={t(m.previousImage)}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 hover:bg-background disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              showDetailAt(detailIndex + 1);
            }}
            disabled={detailIndex < 0 || detailIndex >= filteredGallery.length - 1}
            title={t(m.nextImage)}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 hover:bg-background disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronRight className="h-5 w-5" />
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
              <h2 className="text-lg font-semibold">
                {t(m.compareCount, { count: selectedItems.length })}
              </h2>
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

      {/* Konfirmasi hapus.
          Dipisah dari confirm() bawaan browser karena yang dipertaruhkan bukan
          sekadar baris database: berkasnya dibuang permanen dari share, dan
          path-nya perlu terbaca utuh sebelum tombolnya ditekan. */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !dialogBusy) {
            setPendingDelete(null);
            setDialogError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(m.deleteTitle)}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="font-medium text-foreground">{pendingDelete?.name}</p>
                {pendingDelete && sharePathOf(pendingDelete) ? (
                  <div className="space-y-1">
                    <p>{t(m.deleteShareFile)}</p>
                    <code className="block overflow-x-auto rounded-md border bg-muted px-2 py-1.5 text-[11px] leading-relaxed">
                      {sharePathOf(pendingDelete)}
                    </code>
                  </div>
                ) : (
                  <p>{t(m.deleteNoShareFile)}</p>
                )}
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                  {t(m.deletePermanentWarning)}
                </p>
                {dialogError && (
                  <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-[12px] font-medium text-destructive">
                    {dialogError}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dialogBusy}>{t(m.cancel)}</AlertDialogCancel>
            <AlertDialogAction
              disabled={dialogBusy}
              onClick={(event) => {
                // Radix menutup dialognya sendiri saat Action ditekan. Di sini
                // penutupan justru harus menunggu servernya menjawab, supaya
                // kegagalan masih punya tempat untuk tampil.
                event.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {dialogBusy ? t(m.deleting) : t(m.deletePermanently)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ubah nama. Pakai AlertDialog yang sama supaya kedua aksi berbahaya di
          galeri terasa satu keluarga, bukan satu modal rapi dan satu prompt()
          bawaan browser. */}
      <AlertDialog
        open={pendingRename !== null}
        onOpenChange={(open) => {
          if (!open && !dialogBusy) {
            setPendingRename(null);
            setDialogError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(m.renameDialogTitle)}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>{t(m.renameDialogBody)}</p>
                {pendingRename && sharePathOf(pendingRename) && (
                  <code className="block overflow-x-auto rounded-md border bg-muted px-2 py-1.5 text-[11px] leading-relaxed">
                    {sharePathOf(pendingRename)}
                  </code>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="rename-input" className="text-xs font-medium text-muted-foreground">
              {t(m.newNameLabel)}
            </label>
            <input
              id="rename-input"
              autoFocus
              value={renameValue}
              disabled={dialogBusy}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !dialogBusy) {
                  event.preventDefault();
                  void confirmRename();
                }
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <p className="text-[11px] text-muted-foreground">
              {t(m.forbiddenChars, { chars: '/ \\ : * ? " < > |' })}
            </p>
            {dialogError && (
              <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-[12px] font-medium text-destructive">
                {dialogError}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dialogBusy}>{t(m.cancel)}</AlertDialogCancel>
            <AlertDialogAction
              disabled={dialogBusy || renameValue.trim() === ""}
              onClick={(event) => {
                event.preventDefault();
                void confirmRename();
              }}
            >
              {dialogBusy ? t(m.saving) : t(m.saveName)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
