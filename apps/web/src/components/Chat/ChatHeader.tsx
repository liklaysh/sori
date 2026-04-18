import React, { useState } from "react";
import { Channel, User, DMConversation, ChatItem, Message } from "../../types/chat";
import { 
  cn, 
  Popover, 
  PopoverContent, 
  PopoverTrigger,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  Button
} from "@sori/ui";
import { 
  Hash, Volume2, Menu, Search, 
  Users, Phone, MessageSquare, UserSearch, MessageCircle 
} from "lucide-react";


interface ChatHeaderProps {
  activeModule: 'community' | 'dm';
  currentChannel: Channel | null;
  activeConversation: DMConversation | null;
  user: User;
  isVoice: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  setIsChannelSidebarOpen: (open: boolean) => void;
  setIsMemberSidebarOpen: (open: boolean) => void;
  onInitiateCall?: (targetUser: any) => void;
  callStatus?: string;
  isVoiceChatOpen?: boolean;
  setIsVoiceChatOpen: (open: boolean) => void;
  onlineUsersSet?: Set<string>;
  livekitToken?: string | null;
  searchResults?: ChatItem[];
  onResultClick?: (msg: ChatItem) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeModule, currentChannel, activeConversation, user, isVoice,
  searchQuery, setSearchQuery, setIsChannelSidebarOpen, setIsMemberSidebarOpen,
  onInitiateCall, callStatus, isVoiceChatOpen, setIsVoiceChatOpen, onlineUsersSet, livekitToken,
  searchResults = [], onResultClick
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const otherUser = activeModule === 'dm' 
    ? (activeConversation?.user1Id === user.id ? activeConversation?.user2 : activeConversation?.user1) 
    : null;

  const isOnline = otherUser?.id ? onlineUsersSet?.has(otherUser.id) : false;

  return (
    <header className="h-20 border-b border-sori-border-subtle flex items-center justify-between px-8 bg-sori-chat sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-5 min-w-0">
        <button 
          onClick={() => setIsChannelSidebarOpen(true)}
          className="md:hidden w-10 h-10 flex items-center justify-center text-sori-text-muted hover:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>

        {activeModule === 'dm' && otherUser ? (
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-sori-surface-base flex items-center justify-center text-sori-accent-primary font-black overflow-hidden border border-sori-border-accent">
                {otherUser.avatarUrl ? (
                  <img src={otherUser.avatarUrl} alt={otherUser.username} className="w-full h-full object-cover" />
                ) : (
                  otherUser.username[0].toUpperCase()
                )}
              </div>
              <div className={cn(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-sori-border-subtle transition-colors duration-300",
                isOnline ? "bg-sori-success shadow-lg" : "bg-sori-surface-disabled"
              )} />
            </div>
            <div className="flex flex-col min-w-0">
              <h2 className="font-headline text-lg text-white truncate">
                {otherUser.username}
              </h2>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isOnline ? "bg-sori-success" : "bg-sori-surface-disabled"
                )} />
                <p className="text-[10px] font-black uppercase tracking-widest text-sori-text-muted">
                  {isOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="p-2 bg-sori-surface-base rounded-xl">
              {isVoice ? (
                <Volume2 className="h-5 w-5 text-sori-text-muted" />
              ) : (
                <Hash className="h-5 w-5 text-sori-text-muted" />
              )}
            </div>
            <h1 className="font-bold text-lg text-white truncate">
              {currentChannel?.name}
            </h1>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {!isVoice && (
          <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <PopoverTrigger asChild>
              <button 
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                  isSearchOpen ? "bg-sori-accent-primary text-black" : "bg-sori-surface-panel text-sori-text-muted hover:text-white hover:bg-sori-surface-hover"
                )}
              >
                <Search className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0 bg-sori-surface-panel border-sori-border-subtle shadow-2xl rounded-2xl overflow-hidden mr-8" align="end">
              <Command shouldFilter={false} className="bg-transparent">
                <CommandInput 
                  placeholder="Search in conversation..." 
                  value={searchQuery}
                  onValueChange={(val: string) => setSearchQuery(val)}
                  className="py-6 border-none focus:ring-0"
                />
                <CommandList className="max-h-[300px] no-scrollbar">
                  <CommandEmpty className="py-6 text-center text-sm text-sori-text-muted">
                    No results found...
                  </CommandEmpty>
                  <CommandGroup heading="Search Results" className="px-2 pb-2">
                    {searchResults.length > 0 ? (
                      searchResults.map((msg) => (
                        <CommandItem
                          key={msg.id}
                          onSelect={() => {
                            onResultClick?.(msg);
                            setIsSearchOpen(false);
                          }}
                          className="flex flex-col items-start gap-1 p-3 rounded-xl hover:bg-sori-surface-accent-subtle group cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-lg bg-sori-surface-accent-subtle flex items-center justify-center text-[10px] font-black text-sori-accent-primary shrink-0 overflow-hidden border border-sori-border-accent">
                                  {'author' in msg && msg.author?.avatarUrl ? (
                                    <img src={msg.author.avatarUrl} className="w-full h-full object-cover" alt="" />
                                  ) : (
                                    <span className="text-sori-text-dim">
                                      {('username' in msg ? msg.username?.[0] : ('author' in msg ? msg.author?.username?.[0] : undefined)) || '?'}
                                    </span>
                                  )}
                               </div>
                               <span className="font-bold text-xs text-white group-hover:text-sori-accent-primary transition-colors">
                                 {('username' in msg ? msg.username : ('author' in msg ? msg.author?.username : undefined)) || 'System'}
                               </span>
                            </div>
                             <span className="text-[9px] font-bold text-sori-text-muted uppercase">
                               {new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-sori-text-muted line-clamp-2 leading-relaxed pl-8">
                             {'content' in msg ? msg.content : `System Event`}
                          </p>
                        </CommandItem>
                      ))
                    ) : (
                       <div className="py-12 flex flex-col items-center justify-center text-sori-text-muted">
                        <Search className="h-8 w-8 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Message Archive Mode</p>
                      </div>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
        
        {activeModule === 'community' && !isVoice && (
          <button 
            onClick={() => setIsMemberSidebarOpen(true)}
            className="xl:hidden w-12 h-12 rounded-2xl flex items-center justify-center bg-sori-surface-panel text-sori-text-muted hover:text-white hover:bg-sori-surface-hover transition-all"
          >
            <Users className="h-5 w-5" />
          </button>
        )}

        {activeModule === 'dm' && otherUser && !isVoice && (
          <button 
            onClick={() => onInitiateCall?.(otherUser)}
            disabled={callStatus !== 'idle'}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-sori-surface-accent-subtle text-sori-accent-primary hover:bg-sori-accent-primary hover:text-black border border-sori-border-accent",
               callStatus !== 'idle' && "bg-sori-surface-disabled text-sori-text-disabled border-sori-border-subtle grayscale cursor-not-allowed"
            )}
            title="Initiate Call"
          >
            <Phone className="h-[14px] w-[14px]" strokeWidth={2.5} />
          </button>
        )}

        {isVoice && livekitToken && (
          <button 
            onClick={() => setIsVoiceChatOpen?.(!isVoiceChatOpen)} 
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
              isVoiceChatOpen ? 'bg-sori-accent-primary text-black' : 'bg-sori-surface-panel text-sori-text-muted'
            )}
            title="Voice Chat"
          >
            <MessageSquare className="h-5 w-5 fill-current" />
          </button>
        )}
      </div>
    </header>
  );
};
