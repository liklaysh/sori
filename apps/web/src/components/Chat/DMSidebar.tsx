import React from "react";
import { useChatStore } from "../../store/useChatStore";
import { useUserStore } from "../../store/useUserStore";
import { useUIStore } from "../../store/useUIStore";
import { useCall } from "../../hooks/useCall";
import { getAvatarUrl } from "../../utils/avatar";
import { Skeleton, cn, Popover, PopoverTrigger, PopoverContent, Slider } from "@sori/ui";
import { UserPlus, MessageSquare, Volume2, Mic, MicOff, Headphones, ChevronDown, Sparkles, PhoneOff } from "lucide-react";
import { NoiseSuppressionPopup } from "./Modals/NoiseSuppressionPopup";
import { API_URL } from "../../config";

interface DMSidebarProps {
  onOpenFindFriend: () => void;
  socket: any;
  setIsVoiceChatOpen: (open: boolean) => void;
  
  // Audio control props (from useMediaSettings)
  micGain: number;
  setMicGain: (gain: number) => void;
  outputVolume: number;
  setOutputVolume: (volume: number) => void;
  micDevices: MediaDeviceInfo[];
  activeMicId?: string;
  setActiveMic: (id: string) => void;
  outputDevices: MediaDeviceInfo[];
  activeOutputId?: string;
  setActiveOutput: (id: string) => void;
  noiseSuppression: boolean;
  toggleNoiseSuppression: () => void;
  onlineUsersSet: Set<string>;
}

export const DMSidebar: React.FC<DMSidebarProps> = ({
  onOpenFindFriend, socket, setIsVoiceChatOpen,
  micGain, setMicGain, outputVolume, setOutputVolume,
  micDevices, activeMicId, setActiveMic, outputDevices, activeOutputId, setActiveOutput,
  noiseSuppression, toggleNoiseSuppression, onlineUsersSet
}) => {
  const { user } = useUserStore();
  const { conversations } = useChatStore();
  const { 
    activeConversationId, setActiveConversationId,
    isMuted, setIsMuted, isDeafened, setIsDeafened
  } = useUIStore();

  const { livekitToken, endCall } = useCall({ socket, currentUser: user! });

  const getOtherUser = (conv: any) => {
    return conv.user1Id === user?.id ? conv.user2 : conv.user1;
  };

  if (!user) return null;

  return (
    <div className="w-64 h-full bg-sori-sidebar flex flex-col border-r border-white/5 animate-in fade-in duration-300 relative">
      <header className="h-14 border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Direct Messages</h2>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
        <button 
          onClick={onOpenFindFriend}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-on-surface-variant hover:bg-white/5 hover:text-white transition-all group mb-4"
        >
           <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center border border-white/5 group-hover:border-primary/30 transition-all">
              <UserPlus className="h-4 w-4" />
           </div>
           <span className="text-xs font-bold">Find a friend</span>
        </button>

        {conversations.length === 0 ? (
          <div className="py-10 text-center px-4">
             <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-6 w-6 text-white/10" />
             </div>
             <p className="text-[10px] font-bold uppercase text-white/20 tracking-wider">No active chats</p>
          </div>
        ) : (
          conversations.map(conv => {
            const otherUser = getOtherUser(conv);
            if (!otherUser) return null;
            const isActive = activeConversationId === conv.id;
            const isOnline = onlineUsersSet.has(otherUser.id);

            return (
              <div 
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all relative",
                  isActive ? 'bg-white/10 text-white font-bold' : 'text-on-surface-variant hover:bg-white/5 hover:text-white'
                )}
              >
                <div className="relative shrink-0">
                  {getAvatarUrl(otherUser.avatarUrl) ? (
                    <img 
                      src={getAvatarUrl(otherUser.avatarUrl)!} 
                      alt={otherUser.username} 
                      className="w-8 h-8 rounded-lg object-cover" 
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">
                      {otherUser.username[0].toUpperCase()}
                    </div>
                  )}
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sori-sidebar",
                    isOnline ? 'bg-secondary' : 'bg-white/20'
                  )}></div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-bold truncate", isActive ? 'text-primary' : '')}>{otherUser.username}</p>
                  <p className="text-[9px] text-on-surface-variant truncate font-medium uppercase tracking-tighter">
                    {isOnline ? 'online' : 'offline'}
                  </p>
                </div>

                {conv.unreadCount && conv.unreadCount > 0 && (
                   <div className="bg-primary text-primary-foreground text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 animate-in zoom-in">
                      {conv.unreadCount}
                   </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-auto flex flex-col">
        {livekitToken && (
          <div className="bg-sori-voice px-3 py-2 border-t border-white/5 flex items-center gap-3 animate-in slide-in-from-bottom relative">
            <Volume2 className="h-4 w-4 text-secondary animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black uppercase text-secondary leading-none">Voice Connected</div>
              <div className="text-[10px] text-on-surface-variant font-bold truncate">Current Call</div>
            </div>
            
            <div className="flex items-center">
              <NoiseSuppressionPopup isEnabled={noiseSuppression} onToggle={toggleNoiseSuppression}>
                <button 
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    noiseSuppression ? 'text-primary' : 'text-on-surface-variant/60 hover:text-on-surface-variant'
                  )}
                  title="Noise Suppression"
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </NoiseSuppressionPopup>
            </div>

            <button 
              onClick={endCall} 
              className="p-1.5 bg-sori-error rounded-xl text-white hover:brightness-110 transition-all shadow-sm"
              title="Disconnect"
            >
              <PhoneOff className="h-5 w-5" /> 
            </button>
          </div>
        )}
        <div className="m-2 p-2 bg-sori-sidebar border border-white/5 rounded-2xl flex items-center justify-between gap-2 group/user">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 hover:bg-white/5 rounded-xl p-1 cursor-pointer transition-all">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-black text-primary border border-primary/20 group-hover/user:scale-105 transition-transform overflow-hidden">
                {getAvatarUrl(user.avatarUrl) ? (
                  <img src={getAvatarUrl(user.avatarUrl)!} className="w-full h-full object-cover" alt={user.username} />
                ) : (
                  user.username?.[0]?.toUpperCase()
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-secondary rounded-full border-2 border-sori-sidebar shadow-sm"></div>
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-black truncate text-white leading-tight">{user.username}</div>
              <div className="text-[8px] text-on-surface-variant font-bold opacity-60 uppercase tracking-tighter">Online</div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="flex items-center relative h-8">
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                  isMuted ? 'text-sori-error hover:bg-sori-error/10' : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                )}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-4 h-8 flex items-center justify-center text-outline hover:text-white transition-all">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-64 p-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 ml-1">Input Device</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                        {micDevices.map(d => (
                          <div 
                            key={d.deviceId} 
                            onClick={() => setActiveMic(d.deviceId)} 
                            className={cn(
                              "px-3 py-2 text-[11px] rounded-xl cursor-pointer transition-all",
                              activeMicId === d.deviceId ? 'text-primary bg-primary/10 font-bold' : 'text-on-surface-variant hover:bg-white/5 hover:text-white'
                            )}
                          >
                            {d.label || 'Microphone'}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div>
                      <div className="flex items-center justify-between mb-3 px-1">
                        <p className="text-[10px] font-black uppercase text-primary tracking-widest">Input Volume</p>
                        <span className="text-[11px] text-primary font-bold">{micGain}%</span>
                      </div>
                      <Slider value={[micGain]} onValueChange={([val]: number[]) => setMicGain(val)} max={100} step={1} className="py-2" />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center relative h-8">
              <button 
                onClick={() => setIsDeafened(!isDeafened)} 
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                  isDeafened ? 'text-sori-error hover:bg-sori-error/10' : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                )}
              >
                <div className="relative">
                   <Headphones className={cn("h-5 w-5", isDeafened ? "text-sori-error" : "text-on-surface-variant")} />
                   {isDeafened && (
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-[2px] bg-sori-error rotate-45 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                   )}
                </div>
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-4 h-8 flex items-center justify-center text-outline hover:text-white transition-all">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-64 p-4 ml-[-40px]">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 ml-1">Output Device</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                        {outputDevices.map(d => (
                          <div 
                            key={d.deviceId} 
                            onClick={() => setActiveOutput(d.deviceId)} 
                            className={cn(
                              "px-3 py-2 text-[11px] rounded-xl cursor-pointer transition-all",
                              activeOutputId === d.deviceId ? 'text-secondary bg-secondary/10 font-bold' : 'text-on-surface-variant hover:bg-white/5 hover:text-white'
                            )}
                          >
                            {d.label || 'Speaker'}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div>
                      <div className="flex items-center justify-between mb-3 px-1">
                        <p className="text-[10px] font-black uppercase text-secondary tracking-widest">Output Volume</p>
                        <span className="text-[11px] text-secondary font-bold">{outputVolume}%</span>
                      </div>
                      <Slider value={[outputVolume]} onValueChange={([val]: number[]) => setOutputVolume(val)} max={200} step={1} className="py-2" />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
