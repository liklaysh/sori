import React, { Suspense, lazy, useState } from "react";
import { useTranslation } from "react-i18next";
import { Message, User, ChatItem } from "../../../types/chat";
import { MessageList } from "../MessageList";
import { cn } from "@sori/ui";
import { 
  X, 
  MessageCircle, 
  Smile, 
  Send 
} from "lucide-react";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

interface SoriCallSidebarProps {
  messages: ChatItem[];
  user: User;
  onSendMessage: (e: React.FormEvent, attachments?: any[]) => void;
  inputValue: string;
  setInputValue: (val: string) => void;
  onClose: () => void;
  title: string;
  
  // MessageList props
  onMessageContextMenu: (e: React.MouseEvent, m: Message) => void;
  onLoadMore?: () => Promise<void>;
  isLoadingMessages?: boolean;
  onOpenForward: (data: any) => void;
  
  // Responsive / Layout
  className?: string;
}

export const SoriCallSidebar: React.FC<SoriCallSidebarProps> = ({
  messages,
  user,
  onSendMessage,
  inputValue,
  setInputValue,
  onClose,
  title,
  onMessageContextMenu,
  onLoadMore,
  isLoadingMessages,
  onOpenForward,
  className
}) => {
  const { t } = useTranslation(["voice"]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleEmojiClick = (emojiData: any) => {
    setInputValue(inputValue + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className={cn(
      "w-80 shrink-0 bg-sori-surface-panel border-l border-sori-surface-panel flex flex-col shadow-2xl z-40 h-full",
      className
    )}>
      <header className="h-14 border-b border-sori-border-subtle flex items-center px-4 gap-3 bg-sori-surface-panel shrink-0">
        <MessageCircle className="h-4 w-4 text-on-surface-variant" />
        <h2 className="text-[11px] font-black uppercase text-white truncate flex-1 tracking-wider">
          {t("voice:room.callChatTitle", { title })}
        </h2>
        <button 
          onClick={onClose} 
          className="text-on-surface-variant hover:text-white transition-colors p-1"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-sori-surface-base">
        <MessageList 
          messages={messages}
          onMessageContextMenu={onMessageContextMenu}
          scrollRef={scrollRef}
          handleScroll={() => {}} // Internal handling is enough for simple sidebar
          showScrollButton={false}
          scrollToBottom={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          onLoadMore={onLoadMore}
          isLoadingMessages={isLoadingMessages}
          onForward={onOpenForward}
        />
      </div>

      <div className="p-4 bg-sori-surface-base border-t border-sori-surface-panel">
        <form 
          onSubmit={onSendMessage} 
          className="bg-sori-surface-main rounded-xl px-3 py-2 flex items-center gap-2 border border-sori-surface-panel relative"
        >
          <input 
            className="flex-1 bg-transparent border-none text-[11px] text-white outline-none" 
            placeholder={t("voice:room.messageInCall")} 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
          />
          <div className="flex items-center gap-1.5">
            <button 
              type="button" 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
              className={cn(
                "text-on-surface-variant hover:text-primary transition-all", 
                showEmojiPicker && 'text-primary'
              )}
            >
              <Smile className="h-5 w-5" />
            </button>
            <button 
              type="submit" 
              disabled={!inputValue.trim()} 
              className="text-primary transition-opacity disabled:"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          
          {showEmojiPicker && (
            <Suspense fallback={null}>
              <div className="absolute bottom-full right-0 mb-4 z-[500] shadow-2xl">
                <EmojiPicker 
                  onEmojiClick={handleEmojiClick} 
                  theme={"dark" as any} 
                  width={280} 
                  height={350} 
                />
              </div>
            </Suspense>
          )}
        </form>
      </div>
    </div>
  );
};
