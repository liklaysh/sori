import React from "react";
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
  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-sori-chat border border-white/10 rounded-[2rem] p-6 shadow-2xl z-[2001] overflow-hidden">
        {/* Background elements */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-[40px] pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-inner border",
              isEnabled ? "bg-primary/20 border-primary/20 text-primary" : "bg-white/5 border-white/5 text-on-surface-variant"
            )}>
              <Waves className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-black tracking-tight uppercase text-white">Protocol: Silence</h3>
          </div>

          <div className="space-y-4 mb-6">
             <div className="flex gap-3">
                <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                   <Sparkles className="h-3 w-3 text-primary" />
                </div>
                <div className="space-y-0.5">
                   <h4 className="text-[10px] font-black uppercase text-white tracking-wide">Neural Isolation</h4>
                   <p className="text-[9px] text-on-surface-variant font-bold leading-tight">Distinguishes voice from background via AI.</p>
                </div>
             </div>
             <div className="flex gap-3">
                <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                   <ShieldCheck className="h-3 w-3 text-secondary" />
                </div>
                <div className="space-y-0.5">
                   <h4 className="text-[10px] font-black uppercase text-white tracking-wide">Acoustic Shield</h4>
                   <p className="text-[9px] text-on-surface-variant font-bold leading-tight">Eliminates clicks and environment static.</p>
                </div>
             </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5">
             <div className="flex flex-col">
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-wider transition-colors",
                  isEnabled ? "text-primary" : "text-on-surface-variant/40"
                )}>
                  {isEnabled ? "Active" : "Suspended"}
                </span>
                <span className="text-[8px] text-on-surface-variant/60 font-bold">Neural Engine</span>
             </div>

             <button 
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className={cn(
                  "w-12 h-7 rounded-full relative transition-all duration-500 shadow-lg",
                  isEnabled ? "bg-primary shadow-primary/20" : "bg-white/10"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-500",
                  isEnabled ? "left-6" : "left-1"
                )} />
             </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
