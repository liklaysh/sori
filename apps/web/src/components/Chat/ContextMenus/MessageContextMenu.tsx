import React from 'react';
import { Message, User } from '../../../types/chat';
import { Reply, Edit2, Trash2 } from 'lucide-react';
import { cn } from "@sori/ui";

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
  if (!visible || !message) return null;

  const getMenuStyles = (x: number, y: number) => {
    const vThreshold = window.innerHeight / 2;
    const hThreshold = window.innerWidth / 2;
    const styles: React.CSSProperties = {};
    if (y > vThreshold) styles.bottom = window.innerHeight - y; else styles.top = y;
    if (x > hThreshold) styles.right = window.innerWidth - x; else styles.left = x;
    return styles;
  };

  const isMine = message.authorId === currentUser.id;

  return (
    <div 
      className="fixed z-[300] bg-sori-sidebar border border-white/5 rounded-2xl shadow-2xl py-2 min-w-[200px] animate-in fade-in zoom-in-95 shadow-black/80 ring-1 ring-white/10" 
      style={getMenuStyles(x, y)}
    >
      <button 
        onClick={onReply} 
        className="w-full px-4 py-2.5 hover:bg-primary/10 hover:text-primary cursor-pointer flex items-center gap-3 transition-all text-sm font-bold group"
      >
        <Reply className="h-4 w-4 text-on-surface-variant group-hover:text-primary" />
        Reply
      </button>

      {isMine && !message.isDeleted && (
        <>
          <button 
            onClick={onEdit} 
            className="w-full px-4 py-2.5 hover:bg-primary/10 hover:text-primary cursor-pointer flex items-center gap-3 transition-all text-sm font-bold group"
          >
            <Edit2 className="h-4 w-4 text-on-surface-variant group-hover:text-primary" />
            Edit Message
          </button>
          <button 
            onClick={onDelete} 
            className="w-full px-4 py-2.5 hover:bg-sori-error/10 hover:text-sori-error cursor-pointer flex items-center gap-3 transition-all text-sm font-bold group"
          >
            <Trash2 className="h-4 w-4 text-on-surface-variant group-hover:text-sori-error" />
            Delete Message
          </button>
        </>
      )}

      <div className="h-px bg-white/5 my-1 mx-2"></div>
      
      <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">
        Reactions
      </div>
      
      <div className="px-4 py-1.5 flex justify-between gap-1">
        {["👍", "❤️", "😂", "😮", "😢", "🔥"].map(emoji => (
          <button 
            key={emoji} 
            onClick={() => onReaction(emoji)} 
            className="text-xl hover:scale-125 hover:bg-white/5 p-1 rounded-lg transition-all cursor-pointer active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
