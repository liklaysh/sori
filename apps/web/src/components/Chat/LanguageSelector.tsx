import React from "react";
import { Check, Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@sori/ui";
import { useTranslation } from "react-i18next";
import { AppLanguage, SUPPORTED_LANGUAGES, changeAppLanguage, normalizeLanguage } from "../../i18n";

interface LanguageSelectorProps {
  variant?: "icon" | "panel";
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = "icon" }) => {
  const { t, i18n } = useTranslation(["common", "settings"]);
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage);

  const handleChangeLanguage = async (language: AppLanguage) => {
    if (language === currentLanguage) {
      return;
    }

    await changeAppLanguage(language);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "panel" ? (
          <button
            aria-label={t("settings:languageSelectorLabel")}
            title={t("common:languages.selector")}
            className="w-full flex items-center justify-between gap-3 rounded-2xl border border-sori-border-subtle bg-sori-surface-base px-4 py-3 text-left text-sori-text-muted hover:border-sori-border-accent hover:bg-sori-surface-hover hover:text-sori-text-strong transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-sori-surface-panel border border-sori-border-subtle flex items-center justify-center shrink-0">
                <Languages className="h-4 w-4 text-sori-accent-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sori-text-dim">
                  {t("common:languages.selector")}
                </div>
                <div className="text-sm font-bold text-sori-text-strong truncate">
                  {t(currentLanguage === "en" ? "common:languages.english" : "common:languages.russian")}
                </div>
              </div>
            </div>
            <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-sori-surface-panel px-2.5 py-1 text-[10px] font-black tracking-[0.2em] text-sori-accent-primary border border-sori-border-accent shrink-0">
              {t(`common:languages.short.${currentLanguage}`)}
            </span>
          </button>
        ) : (
          <button
            aria-label={t("settings:languageSelectorLabel")}
            title={t("common:languages.selector")}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-sori-surface-panel text-sori-text-muted hover:text-sori-accent-primary hover:bg-sori-surface-hover transition-all"
          >
            <div className="flex flex-col items-center justify-center leading-none">
              <Languages className="h-4 w-4 mb-0.5" />
              <span className="text-[9px] font-black tracking-[0.2em]">
                {t(`common:languages.short.${currentLanguage}`)}
              </span>
            </div>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align={variant === "panel" ? "start" : "end"}
        sideOffset={12}
        className="w-56"
      >
        <DropdownMenuLabel>{t("common:languages.selector")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language}
            onSelect={() => {
              void handleChangeLanguage(language);
            }}
            className="justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-sori-surface-base px-2 py-1 text-[10px] font-black tracking-[0.2em] text-sori-text-muted border border-sori-border-subtle",
                  currentLanguage === language && "text-sori-accent-primary border-sori-border-accent",
                )}
              >
                {t(`common:languages.short.${language}`)}
              </span>
              <span className="font-bold text-sori-text-strong">
                {t(language === "en" ? "common:languages.english" : "common:languages.russian")}
              </span>
            </div>
            {currentLanguage === language && <Check className="h-4 w-4 text-sori-accent-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
