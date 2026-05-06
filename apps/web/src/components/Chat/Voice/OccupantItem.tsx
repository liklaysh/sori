import React from "react";
import { VoiceOccupant } from "../../../types/chat";
import { getAvatarUrl } from "../../../utils/avatar";
import { cn } from "@sori/ui";
import { Headphones, MicOff } from "lucide-react";

interface OccupantItemProps {
  occupant: VoiceOccupant;
  onContextMenu?: (e: React.MouseEvent, o: VoiceOccupant) => void;
  isSpeaking?: boolean;
  isContextMenuEnabled?: boolean;
}

export const OccupantItem: React.FC<OccupantItemProps> = ({ occupant, onContextMenu, isSpeaking, isContextMenuEnabled }) => {
  return (
    <div 
      onContextMenu={(e) => {
        if (!isContextMenuEnabled || !onContextMenu) {
          return;
        }
        onContextMenu(e, occupant);
      }}
      className={cn(
        "flex items-center justify-between py-1 px-2 hover:bg-sori-surface-panel rounded-md group transition-all",
        isContextMenuEnabled ? "cursor-pointer" : "cursor-default",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative shrink-0">
          <div className={cn(
            "w-6 h-6 rounded-full bg-sori-surface-base flex items-center justify-center text-[8px] font-black text-sori-text-muted border border-transparent transition-all overflow-hidden",
            isSpeaking ? 'speaking-pulse' : ''
          )}>
            {getAvatarUrl(occupant.avatarUrl) ? (
              <img 
                src={getAvatarUrl(occupant.avatarUrl)!} 
                className="w-full h-full object-cover" 
                alt={occupant.username} 
              />
            ) : (
              occupant.username[0].toUpperCase()
            )}
          </div>
        </div>
        <span className={cn(
          "text-[11px] font-bold truncate transition-colors",
          isSpeaking ? 'text-white' : 'text-sori-text-muted group-hover:text-sori-text-primary'
        )}>
          {occupant.username}
        </span>
      </div>

      {(occupant.isMuted || occupant.isDeafened || occupant.isStreaming) && (
        <div className="ml-2 shrink-0 flex items-center gap-1.5">
          {occupant.isMuted && (
            <MicOff className="h-3.5 w-3.5 text-sori-text-dim group-hover:text-sori-accent-danger transition-colors" />
          )}

          {occupant.isDeafened && (
            <span className="relative flex h-3.5 w-3.5 items-center justify-center">
              <Headphones className="h-3.5 w-3.5 text-sori-text-dim group-hover:text-sori-accent-danger transition-colors" />
              <span className="absolute h-[1.5px] w-4 rotate-45 rounded-full bg-sori-text-dim transition-colors group-hover:bg-sori-accent-danger" />
            </span>
          )}

          {occupant.isStreaming && (
            <div className="bg-sori-accent-danger text-white text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none uppercase tracking-tighter shadow-sm shrink-0 flex items-center gap-1 justify-center">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white/80 animate-ping"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white"></span>
              </span>
              LIVE
            </div>
          )}
        </div>
      )}
    </div>
  );
};
