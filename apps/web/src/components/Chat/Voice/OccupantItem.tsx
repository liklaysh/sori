import React from "react";
import { VoiceOccupant } from "../../../types/chat";
import { getAvatarUrl } from "../../../utils/avatar";
import { cn } from "@sori/ui";

interface OccupantItemProps {
  occupant: VoiceOccupant;
  onContextMenu?: (e: React.MouseEvent, o: VoiceOccupant) => void;
  isSpeaking?: boolean;
}

export const OccupantItem: React.FC<OccupantItemProps> = ({ occupant, onContextMenu, isSpeaking }) => {
  // Debug log
  if (occupant.isStreaming) {
    console.log(`[OccupantItem] User ${occupant.username} is streaming!`);
  }
  
  return (
    <div 
      onContextMenu={(e) => onContextMenu?.(e, occupant)}
      className="flex items-center justify-between py-1 px-2 hover:bg-sori-sidebar rounded-md cursor-pointer group transition-all"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative shrink-0">
          <div className={cn(
            "w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[8px] font-black text-on-surface-variant border border-transparent transition-all overflow-hidden",
            isSpeaking ? 'speaking-pulse scale-110' : ''
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
        <span className={`text-[11px] font-bold truncate transition-colors ${isSpeaking ? 'text-white' : 'text-on-surface-variant group-hover:text-on-surface'}`}>
          {occupant.username}
        </span>
      </div>
      
      {occupant.isStreaming && (
        <div className="bg-[#ED4245] text-white text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none uppercase tracking-tighter ml-2 shadow-sm shrink-0 flex items-center justify-center">
          LIVE
        </div>
      )}
    </div>
  );
};
