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
        "bg-sori-server border p-6 rounded-[2.5rem] shadow-2xl min-w-[320px] flex flex-col items-center gap-6 relative overflow-hidden transition-all duration-500",
        isIncoming ? "border-secondary shadow-secondary" : "border-muted shadow-2xl",
        isConnected && "border-sori-primary"
      )}>
        
        {/* Background glow effects */}
        {isIncoming && <div className="absolute inset-0 bg-muted animate-pulse pointer-events-none" />}
        {isConnected && <div className="absolute -top-10 -right-10 w-32 h-32 bg-muted  rounded-full" />}

        <div className="flex items-center w-full gap-4 relative z-10">
          <div className="relative shrink-0">
            <div className={cn(
              "w-16 h-16 rounded-full bg-sori-sidebar border flex items-center justify-center text-2xl font-black text-muted-foreground overflow-hidden shadow-inner transition-all duration-500 relative",
              isIncoming ? "border-secondary animate-pulse scale-110" : "border-muted",
              isPartnerSpeaking && "ring-4 ring-sori-primary ring-offset-2 ring-offset-sori-server scale-105"
            )}>
              {/* Speaking Pulse Ring */}
              {isPartnerSpeaking && (
                <div className="absolute inset-0 rounded-full border-2 border-sori-primary animate-ping " />
              )}
              {getAvatarUrl(partner?.avatarUrl) ? (
                <img src={getAvatarUrl(partner?.avatarUrl)!} alt={partner?.username} className={cn("w-full h-full object-cover", isOutgoing && "grayscale ")} />
              ) : (
                partner?.username?.[0]?.toUpperCase()
              )}
            </div>
            {(isOutgoing || isConnected) && (
              <div className="absolute -bottom-1 -right-1 bg-sori-server p-1 rounded-full border border-sori-sidebar transition-all duration-300">
                {isOutgoing ? (
                   <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                   <div className={cn(
                     "w-4 h-4 rounded-full transition-all duration-300 shadow-[0_0_8px_#22c55e]",
                     isPartnerSpeaking 
                      ? "bg-sori-primary scale-125 shadow-[0_0_15px_#a3a6ff] animate-[pulse_1s_cubic-bezier(0.4,0,0.6,1)_infinite]" 
                      : "bg-sori-success animate-pulse"
                   )} />
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-white uppercase tracking-tight truncate">{partner?.username}</h3>
            <div className="flex items-center gap-2">
              {isIncoming && <p className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] animate-pulse transition-all">Incoming Call...</p>}
              {isOutgoing && <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Contacting...</p>}
              {isConnected && (
                <p className="text-[9px] font-black text-sori-primary uppercase tracking-[0.2em] flex items-center gap-1">
                  <span>Live Connection •</span>
                  <span className="font-mono tabular-nums tracking-normal">{duration}</span>
                </p>
              )}
            </div>
          </div>

          {isConnected && onToggleMaximize && (
            <button 
              onClick={onToggleMaximize}
              className="w-10 h-10 rounded-xl bg-sori-sidebar hover:bg-muted text-gray-400 hover:text-white flex items-center justify-center transition-all group"
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
                className="flex-1 h-12 rounded-2xl hover:bg-muted hover:text-sori-error transition-all font-black uppercase text-[9px] tracking-widest gap-2 text-gray-500"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                Ignore
              </Button>
              <Button 
                onClick={onAccept}
                className="flex-[2] h-12 bg-secondary text-black hover:brightness-110 active:scale-95 rounded-2xl transition-all font-black uppercase text-[9px] tracking-widest gap-2 shadow-[0_0_20px_#6df5e1]"
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
              className="w-full h-12 rounded-2xl hover:bg-muted hover:text-sori-error transition-all font-black uppercase text-[9px] tracking-widest gap-2 text-gray-500 group"
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

