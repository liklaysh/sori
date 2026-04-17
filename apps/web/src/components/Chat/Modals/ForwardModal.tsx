import React from 'react';
import { User, DMConversation, Channel } from '../../../types/chat';
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
  CommandItem,
  Button
} from "@sori/ui";
import { Search, Send, Hash, MessageSquare } from "lucide-react";

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onForward: (targetId: string, isChannel: boolean) => void;
  friends: User[];
  conversations: DMConversation[];
  channels: Channel[];
  currentUser: User;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  isOpen, 
  onClose, 
  onForward,
  friends,
  conversations,
  channels,
  currentUser
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-white/5 bg-sori-sidebar shadow-2xl rounded-[1.5rem] z-[1100]">
        <div className="sr-only">
          <DialogTitle>Forward Message</DialogTitle>
          <DialogDescription>Select a user or channel to forward this content to.</DialogDescription>
        </div>

        <Command className="bg-transparent border-none">
          <div className="flex items-center border-b border-white/5 px-6">
            <Search className="mr-3 h-5 w-5 text-sori-primary opacity-50" />
            <CommandInput 
              placeholder="Forward to..."
              className="bg-transparent border-none py-6 text-base focus:ring-0"
            />
          </div>
          
          <CommandList className="pb-4 max-h-[400px] no-scrollbar">
            <CommandEmpty className="py-12 text-center text-gray-500 font-bold uppercase text-[10px] tracking-widest">
              No results found
            </CommandEmpty>
            
            {channels.length > 0 && (
              <CommandGroup heading="Channels" className="px-3 pt-3">
                {channels.map(ch => (
                  <CommandItem 
                    key={ch.id}
                    onSelect={() => onForward(ch.id, true)}
                    className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:bg-white/5 group cursor-pointer transition-all aria-selected:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-gray-500">
                        <Hash className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-sm text-white">{ch.name}</span>
                    </div>
                    <Send className="h-4 w-4 text-sori-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandGroup heading="Direct Messages" className="px-3 pt-3">
              {conversations.map(conv => {
                const targetUser = conv.user1Id === currentUser.id ? conv.user2 : conv.user1;
                if (!targetUser) return null;
                
                return (
                  <CommandItem 
                    key={conv.id}
                    onSelect={() => onForward(conv.id, false)}
                    className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:bg-white/5 group cursor-pointer transition-all aria-selected:bg-white/5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-sori-primary/20 flex items-center justify-center text-[10px] font-black text-sori-primary border border-sori-primary/10 shrink-0">
                        {targetUser.avatarUrl ? (
                          <img src={targetUser.avatarUrl} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          targetUser.username[0].toUpperCase()
                        )}
                      </div>
                      <span className="font-bold text-sm text-white truncate">{targetUser.username}</span>
                    </div>
                    <Send className="h-4 w-4 text-sori-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
