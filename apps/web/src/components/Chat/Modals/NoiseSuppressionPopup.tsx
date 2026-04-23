import React from "react";
import { useTranslation } from "react-i18next";
import { 
  Popover, 
  PopoverTrigger, 
  PopoverContent,
  cn
} from "@sori/ui";
import { Waves, Sparkles, ShieldCheck } from "lucide-react";

interface NoiseSuppressionPopupProps {
  children: React.ReactNode;
  isEnabled: boolean;
  onToggle: () => void;
}

export const NoiseSuppressionPopup: React.FC<NoiseSuppressionPopupProps> = ({
  children,
  isEnabled,
  onToggle
}) => {
  const { t } = useTranslation(["voice"]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-sori-surface-main border border-sori-border-subtle rounded-[2rem] p-6 shadow-2xl z-[2001]">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-inner border",
              isEnabled ? "bg-sori-surface-accent-subtle border-sori-border-accent text-sori-accent-primary" : "bg-sori-surface-base border-sori-border-subtle text-sori-text-muted"
            )}>
               <Waves className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-black tracking-tight uppercase text-white">{t("voice:noisePopup.title")}</h3>
          </div>

          <div className="space-y-4 mb-6">
             <div className="flex gap-3">
                <div className="w-6 h-6 rounded-md bg-sori-surface-elevated flex items-center justify-center shrink-0 border border-sori-border-subtle">
                   <Sparkles className="h-3 w-3 text-sori-accent-primary" />
                </div>
                <div className="space-y-0.5">
                   <h4 className="text-[10px] font-black uppercase text-white tracking-wide">{t("voice:noisePopup.neuralIsolation")}</h4>
                   <p className="text-[9px] text-sori-text-muted font-bold leading-tight">{t("voice:noisePopup.neuralIsolationDescription")}</p>
                </div>
             </div>
             <div className="flex gap-3">
                <div className="w-6 h-6 rounded-md bg-sori-surface-elevated flex items-center justify-center shrink-0 border border-sori-border-subtle">
                   <ShieldCheck className="h-3 w-3 text-sori-accent-secondary" />
                </div>
                <div className="space-y-0.5">
                   <h4 className="text-[10px] font-black uppercase text-white tracking-wide">{t("voice:noisePopup.acousticShield")}</h4>
                   <p className="text-[9px] text-sori-text-muted font-bold leading-tight">{t("voice:noisePopup.acousticShieldDescription")}</p>
                </div>
             </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-sori-surface-base rounded-2xl border border-sori-border-subtle">
             <div className="flex flex-col">
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-wider transition-colors",
                  isEnabled ? "text-sori-accent-primary" : "text-sori-text-dim"
                )}>
                  {isEnabled ? t("voice:noisePopup.active") : t("voice:noisePopup.suspended")}
                </span>
                <span className="text-[8px] text-sori-text-dim font-bold">{t("voice:noisePopup.engine")}</span>
             </div>

              <button 
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className={cn(
                  "w-12 h-7 rounded-full relative transition-all duration-500",
                  isEnabled ? "bg-sori-accent-primary" : "bg-sori-surface-hover"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-5 h-5 rounded-full bg-white transition-all duration-500",
                  isEnabled ? "left-6" : "left-1"
                )} />
             </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
