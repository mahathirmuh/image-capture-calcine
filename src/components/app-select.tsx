import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Dropdown aplikasi.
 *
 * Membungkus Radix Select supaya seluruh halaman memakai daftar pilihan yang
 * sama tampilannya. `<select>` bawaan browser tidak bisa ditata sama sekali
 * pada bagian yang paling terlihat -- daftar opsinya digambar sistem operasi,
 * jadi ia selalu tampak asing di tengah halaman yang bertema gelap.
 *
 * Sengaja meniru bentuk `<select>` yang digantikannya (satu `value`, satu
 * penangan perubahan, satu daftar opsi) alih-alih membiarkan tiap pemanggil
 * merakit sendiri lima komponen Radix. Tiga puluh lima titik pemakaian yang
 * masing-masing merakit sendiri pasti menyimpang satu sama lain.
 */
const EMPTY_SENTINEL = "__semua__";

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function AppSelect({
  value,
  onValueChange,
  options,
  disabled,
  className,
  id,
  title,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly AppSelectOption[];
  disabled?: boolean;
  className?: string;
  id?: string;
  title?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  // Radix menolak SelectItem bernilai string kosong -- nilai itu ia pakai
  // sendiri untuk menandai "belum ada yang dipilih". Padahal beberapa filter di
  // aplikasi ini memang memakai "" sebagai "semua", dan nilai itu tersimpan
  // apa adanya di localStorage lewat gallery-preferences. Pemetaannya
  // dikerjakan di sini supaya pemanggil tetap bekerja dengan "" seperti dulu,
  // dan preferensi yang sudah tersimpan tidak perlu dimigrasikan.
  const toRadix = (raw: string) => (raw === "" ? EMPTY_SENTINEL : raw);
  const fromRadix = (raw: string) => (raw === EMPTY_SENTINEL ? "" : raw);

  return (
    <Select value={toRadix(value)} onValueChange={(next) => onValueChange(fromRadix(next))}>
      <SelectTrigger
        id={id}
        title={title}
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn("h-auto py-1.5 text-xs", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={toRadix(option.value)} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
