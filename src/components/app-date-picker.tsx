import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatIsoDateLabel, fromIsoDate, toIsoDate } from "@/lib/iso-date";
import { cn } from "@/lib/utils";

/**
 * Pemilih tanggal aplikasi.
 *
 * Menggantikan `<input type="date">`, yang kalendernya digambar browser dan
 * karena itu tidak bisa ditata sama sekali -- ia muncul dengan warna, huruf,
 * dan bahasa sistem operasi, di tengah halaman yang bertema sendiri.
 *
 * Nilainya tetap berbentuk `YYYY-MM-DD` seperti input aslinya, dan string
 * kosong tetap berarti "semua tanggal". Itu disengaja: nilai ini tersimpan di
 * localStorage lewat gallery-preferences dan ikut dibandingkan oleh Saved
 * View, jadi mengubah bentuknya akan membatalkan preferensi setiap operator
 * tanpa memberi apa pun sebagai gantinya.
 */

export function AppDatePicker({
  value,
  onValueChange,
  placeholder = "Semua tanggal",
  className,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromIsoDate(value);
  const label = formatIsoDateLabel(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className={cn(
              "flex w-full items-center gap-2 rounded-md border border-input bg-background py-1.5 pl-2 text-left text-xs",
              "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              // Ruang untuk tombol hapus supaya teksnya tidak tertimpa.
              label ? "pr-8" : "pr-2",
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className={cn("truncate", !label && "text-muted-foreground")}>
              {label ?? placeholder}
            </span>
          </button>
        </PopoverTrigger>

        {/* Di luar trigger, bukan di dalamnya: tombol di dalam tombol bukan
            HTML yang sah, dan klik pada yang dalam tetap membuka popover. */}
        {label && (
          <button
            type="button"
            onClick={() => onValueChange("")}
            aria-label="Hapus filter tanggal"
            title="Hapus filter tanggal"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          onSelect={(date) => {
            onValueChange(date ? toIsoDate(date) : "");
            setOpen(false);
          }}
        />
        <div className="flex items-center justify-between border-t p-2">
          <button
            type="button"
            onClick={() => {
              onValueChange("");
              setOpen(false);
            }}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Semua tanggal
          </button>
          <button
            type="button"
            onClick={() => {
              onValueChange(toIsoDate(new Date()));
              setOpen(false);
            }}
            className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
          >
            Hari ini
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
