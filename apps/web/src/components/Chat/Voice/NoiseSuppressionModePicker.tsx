import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@sori/ui";
import { Check, Waves } from "lucide-react";
import {
  WEB_NOISE_SUPPRESSION_MODES,
  WebNoiseSuppressionMode,
} from "../../../utils/noiseSuppressionModes";

interface NoiseSuppressionModePickerProps {
  value: WebNoiseSuppressionMode;
  onChange: (mode: WebNoiseSuppressionMode) => void;
  compact?: boolean;
}

export const NoiseSuppressionModePicker: React.FC<NoiseSuppressionModePickerProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  const { t } = useTranslation(["voice"]);

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {WEB_NOISE_SUPPRESSION_MODES.map((mode) => {
        const isActive = value === mode;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={cn(
              "w-full rounded-xl border px-3 py-3 text-left transition-all",
              "flex items-start gap-3",
              isActive
                ? "border-sori-border-accent bg-sori-surface-accent-subtle text-sori-text-strong"
                : "border-sori-border-subtle bg-sori-surface-base text-sori-text-muted hover:border-sori-border-medium hover:text-sori-text-strong",
              compact && "py-2.5",
            )}
          >
            <div className={cn(
              "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border",
              isActive
                ? "border-sori-border-accent bg-sori-accent-primary text-sori-text-on-accent"
                : "border-sori-border-subtle bg-sori-surface-panel text-sori-text-dim",
            )}>
              {isActive ? <Check className="h-3.5 w-3.5" /> : <Waves className="h-3.5 w-3.5" />}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-wide">
                {t(`voice:noiseModes.${mode}.label`)}
              </div>
              <p className="mt-1 text-[10px] font-medium leading-snug text-sori-text-muted">
                {t(`voice:noiseModes.${mode}.description`)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
