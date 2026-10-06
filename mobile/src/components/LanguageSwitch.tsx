import { LANGUAGES, LANGUAGE_NAMES, useLanguage, useT, type Language } from "../lib/i18n";

type LanguageSwitchProps = {
  onChange: (language: Language) => void;
  disabled?: boolean;
};

/** English / 中文 switch. Each option is labelled in its own language. */
export function LanguageSwitch({ onChange, disabled = false }: LanguageSwitchProps) {
  const language = useLanguage();
  const t = useT();

  return (
    <div className="language-switch" role="group" aria-label={t("language.label")}>
      {LANGUAGES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option === "zh" ? "zh-CN" : "en"}
          aria-pressed={language === option}
          className={`capture-slot-selector__button language-switch__button ${
            language === option ? "capture-slot-selector__button--active" : ""
          }`}
          disabled={disabled}
          onClick={() => onChange(option)}
        >
          {LANGUAGE_NAMES[option]}
        </button>
      ))}
    </div>
  );
}
