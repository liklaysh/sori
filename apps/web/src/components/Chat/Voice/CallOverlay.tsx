import React, { useState, useEffect } from "react";
import { CallStatus } from "../../../store/useVoiceStore";
import { getAvatarUrl } from "../../../utils/avatar";
import { Phone, PhoneOff, X, Loader2, Maximize2, Mic, MicOff } from "lucide-react";
import { useServerTime } from "../../../hooks/useServerTime";
import { 
  Button,
  cn
} from "@sori/ui";

interface CallOverlayProps {
  status: CallStatus;
  partner: { id: string, username: string, avatarUrl?: string } | null;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isPartnerSpeaking?: boolean;
  startTime?: number | null;
}

export const CallOverlay: React.FC<CallOverlayProps> = ({ 
  status, 
  partner, 
  onAccept, 
  onReject, 
  onCancel,
  isMaximized,
  onToggleMaximize,
  isPartnerSpeaking,
  startTime
}) => {
  const { getSyncedDate } = useServerTime();
  const [duration, setDuration] = useState("00:00");

  useEffect(() => {
    let interval: any;
    if (status === "connected" && startTime) {
      interval = setInterval(() => {
        const now = getSyncedDate().getTime();
        const diff = Math.floor((now - startTime) / 1000);
        const mins = Math.floor(diff / 60).toString().padStart(2, "0");
        const secs = (diff % 60).toString().padStart(2, "0");
        setDuration(`${mins}:${secs}`);
      }, 1000);
    } else {
      setDuration("00:00");
    }
    return () => clearInterval(interval);
  }, [status]);

  if (status === "idle" || status === "ended") return null;
  
  // If maximized, we don't show the overlay because SoriVoiceRoom is taking over
  if (isMaximized && status === "connected") return null;

  const isIncoming = status === "ringing";
  const isOutgoing = status === "calling";
  const isConnected = status === "connected";

  return (
    <div className="fixed bottom-8 right-8 z-[2000] animate-in slide-in-from-right duration-500">
      <div className={cn(
        "bg-sori-surface-panel border p-6 rounded-[2.5rem] shadow-2xl min-w-[320px] flex flex-col items-center gap-6 relative overflow-hidden transition-all duration-500",
        isIncoming ? "border-sori-accent-secondary" : "border-sori-border-subtle shadow-2xl",
        isConnected && "border-sori-accent-primary"
      )}>
        
        <div className="flex items-center w-full gap-4 relative z-10">
          <div className="relative shrink-0">
            <div className={cn(
              "w-16 h-16 rounded-full bg-sori-surface-base border border-sori-border-subtle flex items-center justify-center text-2xl font-black text-sori-text-dim overflow-hidden shadow-inner transition-all duration-500 relative",
              isIncoming ? "border-sori-accent-secondary animate-pulse scale-110" : "border-sori-border-subtle",
              isPartnerSpeaking && "ring-4 ring-sori-accent-primary ring-offset-2 ring-offset-sori-surface-panel scale-105"
            )}>
              {/* Speaking Pulse Ring */}
              {isPartnerSpeaking && (
                <div className="absolute inset-0 rounded-full border-2 border-sori-accent-primary animate-ping " />
              )}
              {getAvatarUrl(partner?.avatarUrl) ? (
                <img src={getAvatarUrl(partner?.avatarUrl)!} alt={partner?.username} className={cn("w-full h-full object-cover", isOutgoing && "grayscale ")} />
              ) : (
                partner?.username?.[0]?.toUpperCase()
              )}
            </div>
            {(isOutgoing || isConnected) && (
              <div className="absolute -bottom-1 -right-1 bg-sori-surface-base p-1 rounded-full border border-sori-border-subtle transition-all duration-300">
                {isOutgoing ? (
                   <Loader2 className="h-4 w-4 text-sori-accent-primary animate-spin" />
                ) : (
                   <div className={cn(
                     "w-4 h-4 rounded-full transition-all duration-300 shadow-lg",
                     isPartnerSpeaking 
                      ? "bg-sori-accent-primary scale-125 animate-[pulse_1s_cubic-bezier(0.4,0,0.6,1)_infinite]" 
                      : "bg-sori-accent-success"
                   )} />
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-white uppercase tracking-tight truncate">{partner?.username}</h3>
            <div className="flex items-center gap-2">
              {isIncoming && <p className="text-[9px] font-black text-sori-accent-secondary uppercase tracking-[0.2em] animate-pulse transition-all">Incoming Call...</p>}
              {isOutgoing && <p className="text-[9px] font-black text-sori-text-muted uppercase tracking-[0.2em]">Contacting...</p>}
              {isConnected && (
                <p className="text-[9px] font-black text-sori-accent-primary uppercase tracking-[0.2em] flex items-center gap-1">
                  <span>Live Connection •</span>
                  <span className="font-mono tabular-nums tracking-normal">{duration}</span>
                </p>
              )}
            </div>
          </div>

          {isConnected && onToggleMaximize && (
            <button 
              onClick={onToggleMaximize}
              className="w-10 h-10 rounded-xl bg-sori-surface-base hover:bg-sori-surface-hover text-sori-text-muted hover:text-white flex items-center justify-center transition-all group"
            >
              <Maximize2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>

        <div className="w-full flex gap-3 relative z-10">
          {isIncoming && (
            <>
              <Button 
                variant="ghost" 
                onClick={onReject}
                className="flex-1 h-12 rounded-2xl hover:bg-sori-surface-hover hover:text-sori-accent-danger transition-all font-black uppercase text-[9px] tracking-widest gap-2 text-sori-text-muted"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                Ignore
              </Button>
              <Button 
                onClick={onAccept}
                className="flex-[2] h-12 bg-sori-accent-secondary text-black hover:brightness-110 active:scale-95 rounded-2xl transition-all font-black uppercase text-[9px] tracking-widest gap-2"
              >
                <Phone className="h-4 w-4 fill-current" />
                Accept
              </Button>
            </>
          )}

          {(isOutgoing || isConnected) && (
            <Button 
              onClick={isConnected ? onCancel : onCancel}
              variant="ghost"
              className="w-full h-12 rounded-2xl hover:bg-sori-surface-hover hover:text-sori-accent-danger transition-all font-black uppercase text-[9px] tracking-widest gap-2 text-sori-text-muted group"
            >
              <X className="h-4 w-4 group-hover:rotate-90 transition-transform" />
              {isOutgoing ? "Abort Call" : "Hang Up"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
