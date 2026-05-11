import React from 'react';
import { Message, User } from '../../../types/chat';
import { Copy, Reply } from 'lucide-react';
import { cn } from "@sori/ui";
import { useContextMenuPosition } from '../../../hooks/useContextMenuPosition';
import { useTranslation } from 'react-i18next';

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface MessageContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  message: Message | null;
  currentUser: User;
  onReply: () => void;
  onCopy: () => void;
  onReaction: (emoji: string) => void;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  visible, x, y, message, currentUser, onReply, onCopy, onReaction
}) => {
  const { t } = useTranslation(["chat"]);
  const menuStyles = useContextMenuPosition(x, y);

  if (!visible || !message) return null;

  const canReact = Boolean(message.channelId && !message.isDeleted);
  const currentUserReactions = new Set(
    (message.reactions || [])
      .filter((reaction) => reaction.userId === currentUser.id)
      .map((reaction) => reaction.emoji)
  );

  return (
    <div
      className="fixed z-[300] min-w-[220px] animate-in fade-in zoom-in-95 rounded-2xl border border-sori-border-subtle bg-sori-surface-panel py-2 shadow-2xl shadow-black ring-1 ring-sori-border-subtle"
      style={menuStyles}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        onClick={onReply}
        className="group flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-sm font-bold transition-all hover:bg-sori-surface-hover hover:text-sori-accent-primary"
      >
        <Reply className="h-4 w-4 text-sori-text-muted group-hover:text-sori-accent-primary" />
        {t("chat:messageActions.reply")}
      </button>

      <button
        type="button"
        onClick={onCopy}
        className="group flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-sm font-bold transition-all hover:bg-sori-surface-hover hover:text-sori-accent-primary"
      >
        <Copy className="h-4 w-4 text-sori-text-muted group-hover:text-sori-accent-primary" />
        {t("chat:messageActions.copy")}
      </button>

      {canReact && (
        <>
          <div className="h-px bg-sori-border-subtle my-1 mx-2"></div>

          <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-sori-text-dim">
            {t("chat:messageActions.reactions")}
          </div>

          <div className="px-4 py-1.5 flex justify-between gap-1">
            {QUICK_REACTIONS.map(emoji => (
                <button
                type="button"
                key={emoji}
                onClick={() => onReaction(emoji)}
                className={cn(
                  "text-xl hover:scale-125 p-1 rounded-lg transition-all cursor-pointer active:scale-90",
                  currentUserReactions.has(emoji) ? "bg-sori-surface-accent-subtle ring-1 ring-sori-border-accent" : "hover:bg-sori-surface-hover"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
