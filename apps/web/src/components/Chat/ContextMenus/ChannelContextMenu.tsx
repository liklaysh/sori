import React from 'react';
import { Channel } from '../../../types/chat';
import { Edit2, Trash2 } from 'lucide-react';
import { cn } from "@sori/ui";

interface ChannelContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  channel: Channel | null;
  onRename: () => void;
  onDelete: () => void;
}

export const ChannelContextMenu: React.FC<ChannelContextMenuProps> = ({ visible, x, y, channel, onRename, onDelete }) => {
  if (!visible || !channel) return null;

  const getMenuStyles = (x: number, y: number) => {
    const vThreshold = window.innerHeight / 2;
    const hThreshold = window.innerWidth / 2;
    const styles: React.CSSProperties = {};
    if (y > vThreshold) styles.bottom = window.innerHeight - y; else styles.top = y;
    if (x > hThreshold) styles.right = window.innerWidth - x; else styles.left = x;
    return styles;
  };

  return (
    <div 
      className="fixed z-[250] bg-sori-sidebar border border-sori-border-subtle rounded-2xl shadow-2xl py-2 min-w-[200px] animate-in fade-in zoom-in-95 shadow-black ring-1 ring-sori-border-medium" 
      style={getMenuStyles(x, y)}
    >
      <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-sori-text-dim">
        Channel Options
      </div>
      <button 
        onClick={onRename} 
        className="w-full px-4 py-2.5 hover:bg-sori-surface-hover hover:text-primary cursor-pointer flex items-center gap-3 transition-all text-sm font-bold group"
      >
        <Edit2 className="h-4 w-4 text-sori-text-muted group-hover:text-primary" />
        Rename Channel
      </button>
      <button 
        onClick={onDelete} 
        className="w-full px-4 py-2.5 hover:bg-sori-error-subtle hover:text-sori-error cursor-pointer flex items-center gap-3 transition-all text-sm font-bold group"
      >
        <Trash2 className="h-4 w-4 text-sori-text-muted group-hover:text-sori-error" />
        Delete Channel
      </button>
    </div>
  );
};
