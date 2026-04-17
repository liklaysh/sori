import React from 'react';
import { VoiceOccupant } from '../../../types/chat';

interface OccupantContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  occupant: VoiceOccupant | null;
  participantVolume: number;
  onVolumeChange: (val: number) => void;
}

export const OccupantContextMenu: React.FC<OccupantContextMenuProps> = ({ 
  visible, x, y, occupant, participantVolume, onVolumeChange 
}) => {
  if (!visible || !occupant) return null;

  const getMenuStyles = (x: number, y: number) => {
    const vThreshold = window.innerHeight / 2;
    const hThreshold = window.innerWidth / 2;
    const styles: React.CSSProperties = {};
    if (y > vThreshold) styles.bottom = window.innerHeight - y; else styles.top = y;
    if (x > hThreshold) styles.right = window.innerWidth - x; else styles.left = x;
    return styles;
  };

  return (
    <div className="fixed z-[300] bg-sori-chat border border-white/10 rounded-xl shadow-2xl p-4 min-w-[220px] animate-in zoom-in-95 shadow-black/50" style={getMenuStyles(x, y)}>
      <p className="text-[10px] font-black uppercase text-primary mb-3">User Volume: {occupant.username}</p>
      <div className="flex items-center gap-3">
        <input 
          type="range" min="0" max="200" 
          value={participantVolume} 
          onChange={(e) => onVolumeChange(parseInt(e.target.value))}
          className="flex-1 h-1 bg-sori-sidebar rounded-lg appearance-none cursor-pointer accent-primary" 
        />
        <span className="text-[10px] font-bold text-white w-8">{participantVolume}%</span>
      </div>
    </div>
  );
};
