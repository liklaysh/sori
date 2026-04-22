import React, { useState, useRef, useCallback, RefObject, useEffect } from "react";
import { Message, CallLog, ChatItem } from "../../types/chat";
import { MessageItem } from "./MessageItem";
import { SystemCallToast } from "./SystemCallToast";
import { Skeleton, cn } from "@sori/ui";
import { format, differenceInMinutes } from "date-fns";
import { Loader2, ArrowDown, MessageCircle } from "lucide-react";
import { useUserStore } from "../../store/useUserStore";
import { useUIStore } from "../../store/useUIStore";

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
  const { activeModule, activeChannelId, activeConversationId } = useUIStore();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const lastScrollHeightRef = useRef<number>(0);

  // Refs for smart scroll detection
  const lastIdRef = useRef<string | null>(null);
  const lastMessagesLengthRef = useRef(messages.length);
  const lastFirstMessageIdRef = useRef<string | null>(null);
  const lastLastMessageIdRef = useRef<string | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;

    const currentId = activeModule === 'community' ? activeChannelId : activeConversationId;
    if (!currentId) return;

    const isSwitch = currentId !== lastIdRef.current;
    
    // Check if data just appeared (from 0 to >0)
    const dataJustArrived = messages.length > 0 && lastMessagesLengthRef.current === 0;
    
    const firstMsgId = messages[0]?.id || null;
    const lastMsgId = messages[messages.length - 1]?.id || null;

    // SCENARIO DETECTION
    // [RESET]: Switching conversations, initial page load, or full dataset replacement (jump)
    const isReset = isSwitch || dataJustArrived || (
      lastFirstMessageIdRef.current !== null && 
      lastLastMessageIdRef.current !== null && 
      firstMsgId !== lastFirstMessageIdRef.current && 
      lastMsgId !== lastLastMessageIdRef.current
    );

    // [APPEND]: New messages added at the bottom (first message stayed same, last changed)
    const isAppend = !isReset && 
                     lastFirstMessageIdRef.current === firstMsgId && 
                     lastLastMessageIdRef.current !== lastMsgId;

    const lastMessage = messages[messages.length - 1];
    const appendedByCurrentUser = isAppend
      && lastMessage?.type !== "system_call"
      && (lastMessage as Message).authorId === user?.id;

    // [PREPEND]: Loading older history (last message stayed same, first changed)
    // No action needed here, handled by manual scroll offset preservation in internalHandleScroll

    if (isReset || (isAppend && (() => {
      const threshold = 150;
      const isNearBottom =
        scrollRef.current!.scrollHeight - scrollRef.current!.scrollTop - scrollRef.current!.clientHeight < threshold;

      return appendedByCurrentUser || isNearBottom;
    })())) {
      
      const performScroll = () => {
        if (!scrollRef.current) return;
        
        // 1. Initial attempt: Scroll to physical anchor
        bottomAnchorRef.current?.scrollIntoView({ block: 'end', behavior: isReset ? 'auto' : 'smooth' });

        // 2. Physical Verification after layout
        requestAnimationFrame(() => {
          if (!scrollRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
          const isAtBottom = (scrollTop + clientHeight) >= (scrollHeight - 10);
          
          if (!isAtBottom) {
            // Corrective pass for layout shifts
            scrollRef.current.scrollTo({ top: scrollHeight, behavior: isReset ? 'auto' : 'smooth' });
          }
        });
      };

      if (isReset) {
        // Use double RAF for switch/reset to ensure all skeletons are gone
        requestAnimationFrame(() => {
          requestAnimationFrame(performScroll);
        });
      } else {
        performScroll();
      }
    }

    // Update tracked markers
    lastIdRef.current = currentId;
    lastMessagesLengthRef.current = messages.length;
    lastFirstMessageIdRef.current = firstMsgId;
    lastLastMessageIdRef.current = lastMsgId;
  }, [messages, activeModule, activeChannelId, activeConversationId, scrollToBottom, scrollRef]);

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
            <div className="flex gap-2 items-center text-sori-accent-primary text-[10px] font-black uppercase animate-pulse">
               <Loader2 className="h-3 w-3 animate-spin" />
               Syncing archives...
            </div>
          ) : (
            <div className="text-sori-text-muted text-[9px] font-black uppercase tracking-tighter">End of recent history</div>
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
        <div className="h-full items-center justify-center space-y-4 flex flex-col flex-1 text-sori-text-muted">
          <MessageCircle className="h-16 w-16" />
          <p className="font-headline font-bold text-xl text-sori-text-strong">Welcome to your conversation!</p>
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
                  <div className="h-[1px] flex-1 bg-sori-border-subtle" />
                  <div className="px-4 py-1.5 rounded-full border border-sori-border-subtle bg-sori-surface-panel">
                    <span className="text-[10px] font-black text-sori-text-dim tracking-widest uppercase">
                      {format(new Date(msg.createdAt), "dd.MM.yy")}
                    </span>
                  </div>
                  <div className="h-[1px] flex-1 bg-sori-border-subtle" />
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
      
      <div ref={bottomAnchorRef} className="h-px -mt-px w-full pointer-events-none opacity-0" aria-hidden="true" />

      {showScrollButton && (
        <div className="sticky bottom-4 left-0 right-0 flex justify-center pointer-events-none z-50">
          <button 
            onClick={() => scrollToBottom('smooth')}
            className="pointer-events-auto bg-sori-surface-main border border-sori-border-accent text-sori-accent-primary w-10 h-10 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all animate-in slide-in-from-bottom-4"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
});
