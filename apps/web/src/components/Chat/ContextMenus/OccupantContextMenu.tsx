import React from 'react';
import { VoiceOccupant } from '../../../types/chat';
import { MessageSquare, Volume2, VolumeX, UserMinus } from 'lucide-react';
import { useContextMenuPosition } from '../../../hooks/useContextMenuPosition';

interface OccupantContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  occupant: VoiceOccupant | null;
  participantVolume: number;
  onVolumeChange: (val: number) => void;
  onDirectMessage: () => void;
  onMute?: () => void;
  isMuted?: boolean;
  onKick?: () => void;
  onClose: () => void;
}

export const OccupantContextMenu: React.FC<OccupantContextMenuProps> = ({ 
  visible, x, y, occupant, participantVolume, onVolumeChange, onDirectMessage, onMute, isMuted, onKick, onClose
}) => {
  const menuStyles = useContextMenuPosition(x, y);

  if (!visible || !occupant) return null;

  return (
    <div className="fixed z-[300] bg-sori-surface-panel border border-sori-border-subtle rounded-xl shadow-2xl p-2 min-w-[200px] animate-in zoom-in-95 shadow-black" style={menuStyles}>
      <div className="p-1 px-1.5 border-b border-sori-border-subtle mb-1">
        <p className="text-[10px] font-black uppercase text-sori-text-muted tracking-widest">{occupant.username}</p>
      </div>

      <div className="px-2 py-2">
        <p className="text-[9px] font-bold text-sori-text-muted mb-2 uppercase">Volume: {participantVolume}%</p>
        <input 
          type="range" min="0" max="200" 
          value={participantVolume} 
          onChange={(e) => onVolumeChange(parseInt(e.target.value))}
          className="w-full h-1 bg-sori-surface-base rounded-lg appearance-none cursor-pointer accent-sori-accent-primary" 
        />
      </div>

      <div className="p-1 px-1.5 border-b border-sori-border-subtle mb-1">
        <p className="text-[10px] font-black uppercase text-sori-text-muted tracking-widest">Controls</p>
      </div>

      <button
        onClick={() => { onDirectMessage(); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold text-sori-text-strong hover:bg-sori-accent-primary hover:text-sori-text-on-primary transition-all rounded-lg group"
      >
        <MessageSquare className="h-3.5 w-3.5 text-sori-text-muted group-hover:text-sori-text-on-primary transition-colors" />
        Message
      </button>

      {onMute && (
        <button
          onClick={() => { onMute(); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold text-sori-text-strong hover:bg-sori-accent-primary hover:text-sori-text-on-primary transition-all rounded-lg group"
        >
          {isMuted ? (
            <>
              <Volume2 className="h-3.5 w-3.5 text-sori-accent-primary group-hover:text-sori-text-on-primary transition-colors" />
              Unmute
            </>
          ) : (
            <>
              <VolumeX className="h-3.5 w-3.5 text-sori-text-muted group-hover:text-sori-text-on-primary transition-colors" />
              Mute
            </>
          )}
        </button>
      )}

      {onKick && (
        <>
          <div className="h-px bg-sori-border-subtle my-1 mx-2" />
          <button
            onClick={() => { onKick(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold text-sori-accent-danger hover:bg-sori-accent-danger hover:text-sori-text-on-accent transition-all rounded-lg group"
          >
            <UserMinus className="h-3.5 w-3.5 text-sori-accent-danger group-hover:text-sori-text-on-accent transition-colors" />
            Terminate Link
          </button>
        </>
      )}
    </div>
  );
};
