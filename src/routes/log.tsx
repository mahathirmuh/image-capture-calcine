import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Camera,
  CloudOff,
  Cpu,
  CloudUpload,
  HardDrive,
  PenLine,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  UserMinus,
  UserPen,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageTitle } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { csvBlob, downloadBlobFile, fileTimestamp, toCsv } from "@/lib/csv";
import {
  ACTION_LABELS,
  ACTIVITY_ACTIONS,
  ACTIVITY_EXPORT_LIMIT,
  ACTIVITY_PAGE_SIZES,
  listActivityLog,
  type ActivityAction,
  type ActivityEntry,
} from "@/lib/activity-log";

export const Route = createFileRoute("/log")({
  // Penjaga tampilan. Yang mengikat ada di listActivityLog, yang membaca ulang
  // peran dari database -- log ini memuat siapa mencoba masuk dari alamat mana.
  beforeLoad: ({ context }) => {
    if (context.user && context.user.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LogPage,
  head: () => ({
    meta: [
      { title: "Log — Capture App" },
      { name: "description", content: "Jejak aktivitas akun dan percobaan masuk." },
    ],
  }),
});

const ACTION_ICONS: Record<ActivityAction, LucideIcon> = {
  "login.success": LogIn,
  "login.failed": ShieldAlert,
  "login.blocked": ShieldAlert,
  logout: LogOut,
  "user.created": UserPlus,
  "user.updated": UserPen,
  "user.deleted": UserMinus,
  "user.password_reset": ShieldAlert,
  "capture.deleted": Trash2,
  "capture.renamed": PenLine,
  "storage.target_changed": HardDrive,
  "storage.forward_failed": CloudOff,
  "storage.forward_recovered": CloudUpload,
  "device.updated": Cpu,
  "camera.settings_applied": SlidersHorizontal,
  "capture.created": Camera,
  "storage.flush_manual": CloudUpload,
};

const SEMUA = "__semua__";

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const tanggal = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const jam = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${tanggal} ${jam}`;
}

function LogPage() {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [action, setAction] = useState<string>(SEMUA);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState<number>(100);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listActivityLog({
        data: {
          action: action === SEMUA ? null : (action as ActivityAction),
          search: search.trim() || null,
          limit,
        },
      });
      if (!result.ok) {
        setLoadError(result.message);
        setEntries(null);
        return;
      }
      setEntries(result.entries);
      setTotal(result.total);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? `Server aplikasi tidak merespons: ${error.message}`
          : "Server aplikasi tidak merespons.",
      );
      setEntries(null);
    } finally {
      setLoading(false);
    }
  }, [action, search, limit]);

  const [exporting, setExporting] = useState(false);

  /**
   * Mengekspor seluruh baris yang cocok dengan penyaring, bukan hanya yang
   * sedang tampil di layar -- berkas audit bertuliskan "500 dari 12.000" tanpa
   * penjelasan justru menyesatkan pembacanya.
   */
  async function handleExport(format: "csv" | "json") {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await listActivityLog({
        data: {
          action: action === SEMUA ? null : (action as ActivityAction),
          search: search.trim() || null,
          limit: ACTIVITY_EXPORT_LIMIT,
        },
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      if (result.entries.length === 0) {
        toast.message("Tidak ada kejadian yang cocok dengan penyaring itu");
        return;
      }

      const nama = `jejak-aktivitas_${fileTimestamp()}`;

      if (format === "json") {
        downloadBlobFile(
          new Blob([JSON.stringify(result.entries, null, 2)], { type: "application/json" }),
          `${nama}.json`,
        );
      } else {
        const rows = [
          [
            "Waktu Lokal",
            "Waktu UTC",
            "Aksi",
            "Kode Aksi",
            "Tingkat",
            "Pelaku",
            "Sasaran",
            "Detail",
            "Alamat IP",
          ],
          ...result.entries.map((entry) => [
            formatDateTime(entry.occurredAt),
            entry.occurredAt,
            ACTION_LABELS[entry.action] ?? entry.action,
            entry.action,
            entry.severity,
            entry.actorUsername ?? "",
            entry.targetUsername ?? "",
            entry.detail ?? "",
            entry.ipAddress ?? "",
          ]),
        ];
        downloadBlobFile(csvBlob(toCsv(rows)), `${nama}.csv`);
      }

      // Pemotongan disebutkan terang-terangan. Berkas audit yang diam-diam
      // kurang lengkap lebih berbahaya daripada tidak ada berkas sama sekali.
      const terpotong = result.total > result.entries.length;
      toast.success(`${result.entries.length} kejadian diekspor ke ${format.toUpperCase()}`, {
        description: terpotong
          ? `Terpotong di ${ACTIVITY_EXPORT_LIMIT.toLocaleString("id-ID")} baris teratas dari ${result.total.toLocaleString("id-ID")} yang cocok. Persempit penyaringnya untuk mengambil sisanya.`
          : "Seluruh kejadian yang cocok dengan penyaring ikut terbawa.",
      });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Ekspor gagal.");
    } finally {
      setExporting(false);
    }
  }

  // Penyaring aksi dan jumlah baris langsung memuat ulang, tapi kolom pencarian
  // diberi jeda: memanggil server pada setiap ketukan tombol berarti satu query
  // per huruf ke tabel yang akan terus tumbuh.
  useEffect(() => {
    const timer = setTimeout(refresh, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [refresh, search]);

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PageTitle
          title="Log"
          description="Jejak siapa masuk, siapa mengubah akun, dan siapa menyentuh capture, perangkat, atau folder jaringan — beserta kejadian sistem seperti antrean kirim yang tertahan. Baris tidak bisa disunting atau dihapus dari halaman ini."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat ulang
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={exporting || !entries || entries.length === 0}>
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Ekspor
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => handleExport("csv")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                CSV untuk Excel
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport("json")}>
                <FileJson className="mr-2 h-4 w-4" />
                JSON mentah
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Jejak aktivitas tidak bisa dimuat</p>
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
            placeholder="Cari username, detail, atau IP"
            className="pl-9"
            aria-label="Cari jejak aktivitas"
          />
        </div>

        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-52" aria-label="Saring per jenis aksi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEMUA}>Semua aksi</SelectItem>
            {ACTIVITY_ACTIONS.map((item) => (
              <SelectItem key={item} value={item}>
                {ACTION_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
          <SelectTrigger className="w-36" aria-label="Jumlah baris">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} baris
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {entries && (
          <p className="text-xs text-muted-foreground">
            Menampilkan {entries.length} dari {total} kejadian
            {total > entries.length && " — persempit penyaringnya untuk melihat sisanya"}
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">Waktu</TableHead>
              <TableHead className="w-44">Aksi</TableHead>
              <TableHead className="w-40">Pelaku</TableHead>
              <TableHead className="w-40">Sasaran</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead className="w-36">Alamat IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && entries === null ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Memuat jejak aktivitas...
                </TableCell>
              </TableRow>
            ) : !entries || entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {total === 0 && action === SEMUA && !search
                    ? "Belum ada kejadian tercatat. Baris pertama muncul begitu ada yang masuk atau mengubah akun."
                    : "Tidak ada kejadian yang cocok dengan penyaring itu."}
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const Icon = ACTION_ICONS[entry.action] ?? ShieldAlert;
                const perhatian = entry.severity === "warning";
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatDateTime(entry.occurredAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={perhatian ? "destructive" : "secondary"}
                        className="gap-1.5 whitespace-nowrap font-normal"
                      >
                        <Icon className="h-3 w-3" />
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.actorUsername ?? (
                        <span className="text-muted-foreground">tidak dikenal</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.targetUsername ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.detail ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {entry.ipAddress ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
