import React from 'react';
import { Message, User } from '../../../types/chat';
import { Reply, Edit2, Trash2 } from 'lucide-react';
import { cn } from "@sori/ui";
import { useContextMenuPosition } from '../../../hooks/useContextMenuPosition';

interface MessageContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  message: Message | null;
  currentUser: User;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReaction: (emoji: string) => void;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({ 
  visible, x, y, message, currentUser, onReply, onEdit, onDelete, onReaction 
}) => {
  const menuStyles = useContextMenuPosition(x, y);

  if (!visible || !message) return null;

  const isMine = message.authorId === currentUser.id;

  return (
    <div 
      className="fixed z-[300] bg-sori-surface-panel border border-sori-border-subtle rounded-2xl shadow-2xl py-2 min-w-[200px] animate-in fade-in zoom-in-95 shadow-black ring-1 ring-sori-border-medium" 
      style={menuStyles}
    >
      <button 
        onClick={onReply} 
        className="w-full px-4 py-2.5 hover:bg-sori-surface-hover hover:text-primary cursor-pointer flex items-center gap-3 transition-all text-sm font-bold group"
      >
        <Reply className="h-4 w-4 text-sori-text-muted group-hover:text-primary" />
        Reply
      </button>

      {isMine && !message.isDeleted && (
        <>
          <button 
            onClick={onEdit} 
            className="w-full px-4 py-2.5 hover:bg-sori-surface-hover hover:text-primary cursor-pointer flex items-center gap-3 transition-all text-sm font-bold group"
          >
            <Edit2 className="h-4 w-4 text-sori-text-muted group-hover:text-primary" />
            Edit Message
          </button>
          <button 
            onClick={onDelete} 
            className="w-full px-4 py-2.5 hover:bg-sori-accent-danger-subtle hover:text-sori-accent-danger cursor-pointer flex items-center gap-3 transition-all text-sm font-bold group"
          >
            <Trash2 className="h-4 w-4 text-sori-text-muted group-hover:text-sori-accent-danger" />
            Delete Message
          </button>
        </>
      )}

      <div className="h-px bg-sori-border-subtle my-1 mx-2"></div>
      
      <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-sori-text-dim">
        Reactions
      </div>
      
      <div className="px-4 py-1.5 flex justify-between gap-1">
        {["👍", "❤️", "😂", "😮", "😢", "🔥"].map(emoji => (
            <button 
            key={emoji} 
            onClick={() => onReaction(emoji)} 
            className="text-xl hover:scale-125 hover:bg-sori-surface-hover p-1 rounded-lg transition-all cursor-pointer active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
