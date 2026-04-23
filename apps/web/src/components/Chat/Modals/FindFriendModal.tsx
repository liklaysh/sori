import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../../../store/useUserStore';
import { useUIStore } from '../../../store/useUIStore';
import { useChatStore } from '../../../store/useChatStore';
import { getAvatarUrl } from "../../../utils/avatar";
import { 
  cn,
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
} from "@sori/ui";
import { UserSearch, MessageSquare, X } from "lucide-react";
import api from '../../../lib/api';

interface FindFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onlineUsersSet: Set<string>;
}

export const FindFriendModal: React.FC<FindFriendModalProps> = ({
  isOpen, 
  onClose, 
  onlineUsersSet
}) => {
  const { user: currentUser } = useUserStore();
  const { t } = useTranslation(["chat", "common"]);
  const { setActiveConversationId, setActiveModule } = useUIStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const popupRef = useRef<HTMLDivElement>(null);
  const visibleResults = results.filter(u => u.id !== currentUser?.id);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!popupRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await api.get(`/users/search?q=${searchQuery}`);
        setResults((res.data as any[]) || []);
      } catch (err) {
        console.error("Search failed:", err);
      }
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStartDM = async (userId: string) => {
    const conv = await useChatStore.getState().startDM(userId);
    
    if (conv) {
      setActiveConversationId(conv.id);
      setActiveModule("dm");
      onClose();
    }
  };

  if (!currentUser) return null;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[900]">
      <div
        ref={popupRef}
        className="pointer-events-auto absolute left-1/2 top-24 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[1.5rem] border border-sori-border-subtle bg-sori-surface-panel shadow-2xl md:left-[22rem] md:w-[28rem] md:translate-x-0"
      >
        <Command className="bg-transparent border-none" shouldFilter={false}>
          <div className="flex items-center gap-3 border-b border-sori-border-subtle px-5">
              <UserSearch className="h-5 w-5 text-sori-text-dim" />
              <CommandInput
                autoFocus
                placeholder={t("chat:findFriendDialog.searchPlaceholder")}
                className="border-none bg-transparent py-5 text-base focus:ring-0"
                value={searchQuery}
                onValueChange={setSearchQuery}
            />
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sori-text-dim transition-all hover:bg-sori-surface-hover hover:text-sori-text-strong"
              aria-label={t("common:accessibility.closeUserSearch")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <CommandList className="max-h-[450px] pb-4 no-scrollbar">
            {visibleResults.length > 0 && (
              <CommandGroup heading={t("chat:findFriendDialog.globalDiscovery")} className="px-3 pt-4">
                <div className="space-y-1">
                  {visibleResults.map(u => {
                  const isOnline = onlineUsersSet.has(u.id);
                  
                  return (
                    <div 
                      key={u.id}
                      onClick={() => handleStartDM(u.id)}
                      className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:bg-sori-surface-selected group cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3 min-w-0 pointer-events-none">
                        <div className="w-10 h-10 rounded-xl bg-sori-surface-panel flex items-center justify-center text-sm font-black text-sori-accent-primary border border-sori-border-accent relative shrink-0">
                          {getAvatarUrl(u.avatarUrl) ? (
                            <img src={getAvatarUrl(u.avatarUrl)!} className="w-full h-full object-cover rounded-xl" alt={u.username} />
                          ) : (
                            u.username[0].toUpperCase()
                          )}
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sori-surface-panel",
                            isOnline ? 'bg-sori-accent-success' : 'bg-sori-surface-active'
                          )} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-sori-text-strong truncate group-hover:text-sori-accent-primary transition-colors">{u.username}</p>
                          <p className={cn(
                            "text-[9px] uppercase font-black tracking-widest leading-none",
                            isOnline ? 'text-sori-accent-success' : 'text-sori-text-muted'
                          )}>
                            {isOnline ? t("common:status.online") : t("common:status.offline")}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 pointer-events-none">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-sori-surface-base text-sori-accent-primary group-hover:bg-sori-accent-primary group-hover:text-black transition-all">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </div>
    </div>
  );
};
