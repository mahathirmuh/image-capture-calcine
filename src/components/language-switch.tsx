import { Check, Globe } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { commonMessages } from "@/i18n/common";
import { LANGUAGES, LANGUAGE_NAMES, setLanguage, useLanguage, useT } from "@/lib/i18n";

/**
 * Pemilih bahasa antarmuka: Indonesia, English, 中文.
 *
 * Tiap pilihan ditulis dengan aksaranya sendiri, jadi tetap terbaca oleh
 * penuturnya walau antarmuka sedang dalam bahasa yang tidak ia pahami.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const language = useLanguage();
  const t = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t(commonMessages.language)}
        title={t(commonMessages.language)}
        className={
          className ??
          "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        }
      >
        <Globe className="h-4 w-4 shrink-0" />
        <span>{LANGUAGE_NAMES[language]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {LANGUAGES.map((option) => (
          <DropdownMenuItem
            key={option}
            lang={option === "zh" ? "zh-CN" : option}
            onSelect={() => setLanguage(option)}
            className="justify-between"
          >
            {LANGUAGE_NAMES[option]}
            {option === language && <Check className="h-4 w-4" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
