import React from "react";
import { useTranslation } from "react-i18next";
import { 
  Popover, 
  PopoverTrigger, 
  PopoverContent,
  cn
} from "@sori/ui";
import { Waves } from "lucide-react";
import { WebNoiseSuppressionMode } from "../../../utils/noiseSuppressionModes";
import { NoiseSuppressionModePicker } from "../Voice/NoiseSuppressionModePicker";

interface NoiseSuppressionPopupProps {
  children: React.ReactNode;
  value: WebNoiseSuppressionMode;
  onChange: (mode: WebNoiseSuppressionMode) => void;
}

export const NoiseSuppressionPopup: React.FC<NoiseSuppressionPopupProps> = ({
  children,
  value,
  onChange
}) => {
  const { t } = useTranslation(["voice"]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-sori-surface-main border border-sori-border-subtle rounded-2xl p-4 shadow-2xl z-[2001]">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-inner border",
              "bg-sori-surface-accent-subtle border-sori-border-accent text-sori-accent-primary"
            )}>
               <Waves className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight uppercase text-white">{t("voice:noiseSuppression")}</h3>
              <p className="text-[10px] font-medium text-sori-text-muted">{t("voice:noiseSuppressionHint")}</p>
            </div>
          </div>

          <NoiseSuppressionModePicker value={value} onChange={onChange} compact />
        </div>
      </PopoverContent>
    </Popover>
  );
};
