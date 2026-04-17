import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../../store/useUserStore';
import { useUIStore } from '../../../store/useUIStore';
import { useChatStore } from '../../../store/useChatStore';
import { getAvatarUrl } from "../../../utils/avatar";
import { 
  cn,
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogHeader, 
  DialogTitle,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  Button
} from "@sori/ui";
import { UserSearch, UserPlus, MessageSquare } from "lucide-react";
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
  const { setActiveConversationId, setActiveModule } = useUIStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);

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
    console.log(`[DM Initialization] 1. Clicked user search result (UserId: ${userId})`);
    try {
      console.log(`[DM Initialization] 2. Calling API POST /dm/conversations...`);
      const res = await api.post("/dm/conversations", { targetUserId: userId });
      const data = res.data as any;
      console.log(`[DM Initialization] 3. Backend response received:`, data);

      if (data && data.id) {
        console.log(`[DM Initialization] 4. Updating Zustand store (upsertConversation)...`);
        useChatStore.getState().upsertConversation(data);
        
        console.log(`[DM Initialization] 5. Switching UI to active conversation (ID: ${data.id})`);
        setActiveConversationId(data.id);
        setActiveModule("dm");
        onClose();
        console.log(`[DM Initialization] 6. Modal closed, UI should be active.`);
      } else {
        console.error("[DM Initialization] ❌ Error: Backend returned invalid conversation data:", data);
      }
    } catch (err) {
      console.error("[DM Initialization] ❌ FAILED to start DM:", err);
    }
  };

  if (!currentUser) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-white/5 bg-sori-sidebar shadow-2xl rounded-[1.5rem]">
        <div className="sr-only">
          <DialogTitle>Find Friends</DialogTitle>
          <DialogDescription>Search for people to start a direct conversation.</DialogDescription>
        </div>

        <Command className="bg-transparent border-none" shouldFilter={false}>
          <div className="flex items-center border-b border-white/5 px-6">
            <UserSearch className="mr-3 h-5 w-5 text-sori-primary opacity-50" />
            <CommandInput 
              placeholder="Search users to chat..."
              className="bg-transparent border-none py-6 text-base focus:ring-0"
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>
          
          <CommandList className="pb-4 max-h-[450px] no-scrollbar">
            <CommandEmpty className="py-12 text-center text-gray-500">
              <div className="flex flex-col items-center gap-2">
                <UserPlus className="h-8 w-8 opacity-20 mb-2" />
                <p className="text-sm font-bold text-white uppercase tracking-widest">No users found</p>
                <p className="text-[10px] opacity-50 uppercase tracking-tighter">Try another username</p>
              </div>
            </CommandEmpty>
            
            <CommandGroup heading="Global Sori Discovery" className="px-3 pt-4">
              <div className="space-y-1">
                {results.filter(u => u.id !== currentUser.id).map(u => {
                  const isOnline = onlineUsersSet.has(u.id);
                  
                  return (
                    <div 
                      key={u.id}
                      onClick={() => handleStartDM(u.id)}
                      className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:bg-sori-primary/10 group cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3 min-w-0 pointer-events-none">
                        <div className="w-10 h-10 rounded-xl bg-sori-primary/20 flex items-center justify-center text-sm font-black text-sori-primary border border-sori-primary/10 relative shrink-0">
                          {getAvatarUrl(u.avatarUrl) ? (
                            <img src={getAvatarUrl(u.avatarUrl)!} className="w-full h-full object-cover rounded-xl" alt={u.username} />
                          ) : (
                            u.username[0].toUpperCase()
                          )}
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sori-sidebar",
                            isOnline ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.3)]' : 'bg-white/20'
                          )} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate group-hover:text-sori-primary transition-colors">{u.username}</p>
                          <p className={cn(
                            "text-[9px] uppercase font-black tracking-widest leading-none",
                            isOnline ? 'text-green-400' : 'text-white/40'
                          )}>
                            {isOnline ? 'Online' : 'Offline'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 pointer-events-none">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-sori-primary/5 text-sori-primary group-hover:bg-sori-primary group-hover:text-white transition-all">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

