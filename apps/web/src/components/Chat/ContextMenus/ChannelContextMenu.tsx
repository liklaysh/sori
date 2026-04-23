import React from 'react';
import { useTranslation } from 'react-i18next';
import { Channel } from '../../../types/chat';
import { Edit2, Trash2 } from 'lucide-react';
import { cn } from "@sori/ui";
import { useContextMenuPosition } from '../../../hooks/useContextMenuPosition';

interface ChannelContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  channel: Channel | null;
  onRename: () => void;
  onDelete: () => void;
}

export const ChannelContextMenu: React.FC<ChannelContextMenuProps> = ({ visible, x, y, channel, onRename, onDelete }) => {
  const { t } = useTranslation(["chat"]);
  const menuStyles = useContextMenuPosition(x, y);

  if (!visible || !channel) return null;

  return (
    <div 
      className="fixed z-[250] bg-sori-surface-panel border border-sori-border-subtle rounded-2xl shadow-2xl py-2 min-w-[200px] animate-in fade-in zoom-in-95 shadow-black ring-1 ring-sori-border-medium" 
      style={menuStyles}
    >
      <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-sori-text-dim">
        {t("chat:channelContext.options")}
      </div>
      <button 
        onClick={onRename} 
        className="w-full px-4 py-2.5 hover:bg-sori-surface-hover hover:text-primary cursor-pointer flex items-center gap-3 transition-all text-sm font-bold group"
      >
        <Edit2 className="h-4 w-4 text-sori-text-muted group-hover:text-primary" />
        {t("chat:channelContext.rename")}
      </button>
      <button 
        onClick={onDelete} 
        className="w-full px-4 py-2.5 hover:bg-sori-accent-danger-subtle hover:text-sori-accent-danger cursor-pointer flex items-center gap-3 transition-all text-sm font-bold group"
      >
        <Trash2 className="h-4 w-4 text-sori-text-muted group-hover:text-sori-accent-danger" />
        {t("chat:channelContext.delete")}
      </button>
    </div>
  );
};
