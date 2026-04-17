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
  setIsVoiceChatOpen?: (open: boolean) => void;
  livekitToken?: string | null;
  searchResults?: ChatItem[];
  onResultClick?: (id: string) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeModule, currentChannel, activeConversation, user, isVoice,
  searchQuery, setSearchQuery, setIsChannelSidebarOpen, setIsMemberSidebarOpen,
  onInitiateCall, callStatus, isVoiceChatOpen, setIsVoiceChatOpen, livekitToken,
  searchResults = [], onResultClick
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const otherUser = activeModule === 'dm' 
    ? (activeConversation?.user1Id === user.id ? activeConversation?.user2 : activeConversation?.user1) 
    : null;

  return (
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-sori-chat sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        <button 
          onClick={() => setIsChannelSidebarOpen(true)}
          className="md:hidden w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>

        {activeModule === 'dm' ? (
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-sori-primary/20 flex items-center justify-center text-sm font-black text-sori-primary uppercase overflow-hidden border border-sori-primary/10">
                {otherUser?.avatarUrl ? <img src={otherUser.avatarUrl} className="w-full h-full object-cover" alt="" /> : otherUser?.username?.[0]}
              </div>
              <div className={cn(
                "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-4 border-sori-bg",
                otherUser?.status === 'online' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.3)]' : 'bg-gray-500'
              )}></div>
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base text-white flex items-center gap-2 truncate">
                {otherUser?.username}
              </h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {otherUser?.status === 'online' ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-xl">
              {isVoice ? (
                <Volume2 className="h-5 w-5 text-gray-400" />
              ) : (
                <Hash className="h-5 w-5 text-gray-400" />
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
              <Button 
                variant="ghost" 
                className={cn(
                  "hidden sm:flex items-center gap-3 px-4 py-2 bg-black/20 border border-white/5 rounded-2xl text-gray-400 hover:text-white hover:bg-black/30 transition-all",
                  isSearchOpen && "border-sori-primary/30 text-white bg-black/40"
                )}
              >
                <Search className="h-4 w-4" />
                <span className="text-xs font-medium">Search labels, keywords...</span>
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0 bg-sori-sidebar border-white/10 shadow-2xl rounded-[1.5rem]" align="end">
              <Command className="bg-transparent" shouldFilter={false}>
                <CommandInput 
                  placeholder="Search in conversation..." 
                  value={searchQuery}
                  onValueChange={(val: string) => {
                    setSearchQuery(val);
                  }}
                  className="py-6 border-none focus:ring-0"
                />
                <CommandList className="max-h-[300px] no-scrollbar">
                  <CommandEmpty className="py-6 text-center text-sm text-gray-500">
                    No results found...
                  </CommandEmpty>
                  <CommandGroup heading="Search Results" className="px-2 pb-2">
                    {searchResults.length > 0 ? (
                      searchResults.map((msg) => (
                        <CommandItem
                          key={msg.id}
                          onSelect={() => {
                            onResultClick?.(msg.id);
                            setIsSearchOpen(false);
                          }}
                          className="flex flex-col items-start gap-1 p-3 rounded-xl hover:bg-sori-primary/10 group cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-lg bg-sori-primary/20 flex items-center justify-center text-[10px] font-black text-sori-primary shrink-0 overflow-hidden">
                                  {'author' in msg && msg.author?.avatarUrl ? <img src={msg.author.avatarUrl} className="w-full h-full object-cover" alt="" /> : (('username' in msg ? msg.username?.[0] : undefined) || ('author' in msg ? msg.author?.username?.[0] : '?') || "?")}
                               </div>
                               <span className="font-bold text-xs text-white group-hover:text-sori-primary transition-colors">{('username' in msg ? msg.username : undefined) || ('author' in msg ? msg.author?.username : 'System')}</span>
                            </div>
                            <span className="text-[9px] font-bold opacity-30 uppercase">
                               {new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed pl-8">
                             {'content' in msg ? msg.content : `Call Event: ${msg.status}`}
                          </p>
                        </CommandItem>
                      ))
                    ) : (
                      <div className="py-12 flex flex-col items-center justify-center opacity-20">
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
            className="xl:hidden w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Users className="h-5 w-5" />
          </button>
        )}

        {activeModule === 'dm' && otherUser && !isVoice && (
          <button 
            onClick={() => onInitiateCall?.(otherUser)}
            disabled={callStatus !== 'idle'}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-sori-primary/10 text-sori-primary hover:bg-sori-primary hover:text-white border border-sori-primary/20",
              callStatus !== 'idle' && "opacity-30 grayscale cursor-not-allowed"
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
              isVoiceChatOpen ? 'bg-sori-primary text-white shadow-[0_0_15px_rgba(var(--sori-primary-rgb),0.3)]' : 'bg-white/5 text-gray-400'
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
