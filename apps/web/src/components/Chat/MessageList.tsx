import React, { useState, useRef, useCallback, RefObject } from "react";
import { Message, CallLog, ChatItem } from "../../types/chat";
import { MessageItem } from "./MessageItem";
import { SystemCallToast } from "./SystemCallToast";
import { Skeleton, cn } from "@sori/ui";
import { format, differenceInMinutes } from "date-fns";
import { Loader2, ArrowDown, MessageCircle } from "lucide-react";
import { useUserStore } from "../../store/useUserStore";

interface MessageListProps {
  messages: ChatItem[];
  onMessageContextMenu: (e: React.MouseEvent, m: Message) => void;
  scrollRef: RefObject<HTMLDivElement>;
  handleScroll: () => void;
  showScrollButton: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  onLoadMore?: () => Promise<void>;
  isLoadingMessages?: boolean;
  onForward?: (data: any) => void;
}

export const MessageList: React.FC<MessageListProps> = React.memo(({
  messages, onMessageContextMenu, scrollRef, 
  handleScroll, showScrollButton, scrollToBottom, onLoadMore,
  isLoadingMessages,
  onForward
}) => {
  const { user } = useUserStore();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const lastScrollHeightRef = useRef<number>(0);

  const internalHandleScroll = useCallback(async () => {
    handleScroll();
    
    if (scrollRef.current && onLoadMore && !isLoadingMore && messages.length >= 50) {
      const { scrollTop, scrollHeight } = scrollRef.current;
      
      if (scrollTop < 50) {
        setIsLoadingMore(true);
        lastScrollHeightRef.current = scrollHeight;
        await onLoadMore();
        setIsLoadingMore(false);
        
        if (scrollRef.current) {
          const newScrollHeight = scrollRef.current.scrollHeight;
          scrollRef.current.scrollTop = newScrollHeight - lastScrollHeightRef.current;
        }
      }
    }
  }, [handleScroll, onLoadMore, isLoadingMore, messages.length, scrollRef]);

  if (!user) return null;

  return (
    <div 
      className="flex-1 overflow-y-auto no-scrollbar pl-6 pr-5 py-4 space-y-4 relative" 
      ref={scrollRef}
      onScroll={internalHandleScroll}
    >
      {messages.length >= 50 && onLoadMore && (
        <div className="flex justify-center py-2">
          {isLoadingMore ? (
            <div className="flex gap-2 items-center text-primary text-[10px] font-black uppercase animate-pulse">
               <Loader2 className="h-3 w-3 animate-spin" />
               Syncing archives...
            </div>
          ) : (
            <div className="text-white/20 text-[9px] font-black uppercase tracking-tighter">End of recent history</div>
          )}
        </div>
      )}

      {isLoadingMessages ? (
        <div className="space-y-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="h-full items-center justify-center opacity-20 space-y-4 flex flex-col flex-1">
          <MessageCircle className="h-16 w-16" />
          <p className="font-headline font-bold text-xl">Welcome to your conversation!</p>
        </div>
      ) : (
        (() => {
          const renderedItems: React.ReactNode[] = [];
          let index = 0;

          while (index < messages.length) {
            const msg = messages[index];
            const prevMsg = messages[index - 1];
            const currDate = new Date(msg.createdAt).toDateString();
            const prevDate = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
            const showDivider = currDate !== prevDate;

            if (showDivider) {
              renderedItems.push(
                <div key={`divider-${msg.id}`} className="flex items-center gap-4 py-6">
                  <div className="h-[1px] flex-1 bg-white/5" />
                  <div className="px-4 py-1.5 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-sm">
                    <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                      {format(new Date(msg.createdAt), "dd.MM.yy")}
                    </span>
                  </div>
                  <div className="h-[1px] flex-1 bg-white/5" />
                </div>
              );
            }

            if (msg.type === "system_call") {
              const logId = msg.id;
              const log = msg as unknown as CallLog;
              let count = 1;
              let lastIndex = index;

              while (lastIndex + 1 < messages.length) {
                const nextMsg = messages[lastIndex + 1];
                const nextLog = nextMsg as unknown as CallLog;

                if (
                  nextMsg.type === "system_call" &&
                  nextLog.status === log.status &&
                  differenceInMinutes(new Date(nextMsg.createdAt), new Date(messages[lastIndex].createdAt)) < 5
                ) {
                  count++;
                  lastIndex++;
                } else {
                  break;
                }
              }

              renderedItems.push(
                <SystemCallToast 
                  key={`call-log-${logId}`} 
                  log={log} 
                  count={count} 
                  isCaller={log.callerId === user.id} 
                />
              );

              index = lastIndex + 1;
            } else {
              const m = msg as Message;
              renderedItems.push(
                <MessageItem 
                  key={`${m.id}-${index}`}
                  msg={m} 
                  onContextMenu={(e) => onMessageContextMenu(e, m)} 
                  onForward={onForward}
                />
              );
              index++;
            }
          }
          return renderedItems;
        })()
      )}
      
      {showScrollButton && (
        <div className="sticky bottom-4 left-0 right-0 flex justify-center pointer-events-none z-50">
          <button 
            onClick={() => scrollToBottom('smooth')}
            className="pointer-events-auto bg-sori-chat border border-primary/30 text-primary w-10 h-10 rounded-full flex items-center justify-center shadow-2xl shadow-primary/20 hover:scale-110 active:scale-95 transition-all animate-in slide-in-from-bottom-4"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
});
