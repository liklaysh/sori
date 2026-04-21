import React from "react";
import { useChatStore } from "../../store/useChatStore";
import { useUserStore } from "../../store/useUserStore";
import { useUIStore } from "../../store/useUIStore";
import { getAvatarUrl } from "../../utils/avatar";
import { Skeleton, cn, Popover, PopoverTrigger, PopoverContent, Slider } from "@sori/ui";
import { UserPlus, MessageSquare, Volume2, Mic, MicOff, Headphones, ChevronDown, Waves, PhoneOff } from "lucide-react";
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
  
  // Call Orchestration (from Chat.tsx)
  livekitToken: string | null;
  connectedChannelId: string | null;
  partner: { id: string, username: string, avatarUrl?: string } | null;
  endCall: () => void;
  setIsDisconnecting: (val: boolean) => void;
}

export const DMSidebar: React.FC<DMSidebarProps> = (props) => {
  const {
    onOpenFindFriend, socket, setIsVoiceChatOpen,
    micGain, setMicGain, outputVolume, setOutputVolume,
    micDevices, activeMicId, setActiveMic, outputDevices, activeOutputId, setActiveOutput,
    noiseSuppression, toggleNoiseSuppression, onlineUsersSet,
    livekitToken, connectedChannelId, partner, endCall, setIsDisconnecting
  } = props;
  const { user } = useUserStore();
  const { conversations } = useChatStore();
  const { 
    activeConversationId, setActiveConversationId,
    isMuted, setIsMuted, isDeafened, setIsDeafened
  } = useUIStore();

  const getOtherUser = (conv: any) => {
    return conv.user1Id === user?.id ? conv.user2 : conv.user1;
  };
  const activeCallLabel = partner?.username || "Group Call";

  if (!user) return null;

  return (
    <div className="w-64 h-full bg-sori-surface-panel flex flex-col border-r border-sori-border-subtle animate-in fade-in duration-300 relative">
      <header className="h-14 border-b border-sori-border-subtle flex items-center px-4 shrink-0 bg-sori-surface-panel">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-sori-text-muted">Direct Messages</h2>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
        <button 
          onClick={onOpenFindFriend}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sori-text-muted hover:bg-sori-surface-hover hover:text-white transition-all group mb-4"
        >
           <div className="w-8 h-8 rounded-lg bg-sori-surface-elevated flex items-center justify-center border border-sori-border-subtle group-hover:border-sori-border-accent transition-all text-sori-accent-primary">
              <UserPlus className="h-4 w-4" />
           </div>
           <span className="text-xs font-bold">Find a friend</span>
        </button>

        {conversations.length === 0 ? (
          <div className="py-10 text-center px-4">
             <div className="w-12 h-12 bg-sori-surface-elevated rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-6 w-6 text-sori-text-dim" />
             </div>
             <p className="text-[10px] font-bold uppercase text-sori-text-dim tracking-wider">No active chats</p>
          </div>
        ) : (
          conversations.map(conv => {
            const otherUser = getOtherUser(conv);
            if (!otherUser || otherUser.id === user.id) return null;
            const isActive = activeConversationId === conv.id;
            const isOnline = onlineUsersSet.has(otherUser.id);

            return (
              <div 
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all relative",
                  isActive ? 'bg-sori-surface-selected text-sori-accent-primary' : 'text-sori-text-muted hover:bg-sori-surface-hover hover:text-sori-text-primary'
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
                    <div className="w-8 h-8 rounded-lg bg-sori-surface-accent-subtle flex items-center justify-center text-[10px] font-black text-sori-accent-primary border border-sori-border-accent">
                      {otherUser.username[0].toUpperCase()}
                    </div>
                  )}
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sori-surface-panel",
                    isOnline ? 'bg-sori-accent-secondary' : 'bg-sori-text-dim'
                  )}></div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-bold truncate", isActive ? 'text-sori-accent-primary' : '')}>{otherUser.username}</p>
                  <p className="text-[9px] text-sori-text-dim truncate font-medium uppercase tracking-tighter">
                    {isOnline ? 'online' : 'offline'}
                  </p>
                </div>

                {conv.unreadCount && conv.unreadCount > 0 && (
                   <div className="bg-sori-accent-primary text-black text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 animate-in zoom-in">
                      {conv.unreadCount}
                   </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-auto flex flex-col">
         {livekitToken && !connectedChannelId && (
          <div className="bg-sori-surface-elevated px-3 py-2 border-t border-sori-border-subtle flex items-center gap-3 animate-in slide-in-from-bottom relative">
            <Volume2 className="h-4 w-4 text-sori-accent-secondary animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black uppercase text-sori-accent-secondary leading-none">Voice Connected</div>
              <div className="text-[10px] text-sori-text-muted font-bold truncate">{activeCallLabel}</div>
            </div>
            
            <div className="flex items-center">
              <NoiseSuppressionPopup isEnabled={noiseSuppression} onToggle={toggleNoiseSuppression}>
                <button 
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    noiseSuppression ? 'text-sori-accent-primary' : 'text-sori-text-dim hover:text-sori-text-muted'
                  )}
                  title="Noise Suppression"
                >
                   <Waves className="h-5 w-5" />
                </button>
              </NoiseSuppressionPopup>
            </div>

            <button 
              onClick={() => {
                setIsDisconnecting(true);
                endCall();
              }} 
              className="p-1.5 bg-sori-accent-danger rounded-xl text-sori-text-on-accent hover:brightness-110 transition-all shadow-sm"
              title="Disconnect"
            >
              <PhoneOff className="h-5 w-5" /> 
            </button>
          </div>
        )}
        <div className="m-2 p-2 bg-sori-surface-elevated border border-sori-border-subtle rounded-2xl flex items-center justify-between gap-2 group/user">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 hover:bg-sori-surface-hover rounded-xl p-1 cursor-pointer transition-all">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-sori-surface-accent-subtle flex items-center justify-center text-[11px] font-black text-sori-accent-primary border border-sori-border-accent group-hover/user:scale-105 transition-transform overflow-hidden">
                {getAvatarUrl(user.avatarUrl) ? (
                  <img src={getAvatarUrl(user.avatarUrl)!} className="w-full h-full object-cover" alt={user.username} />
                ) : (
                  user.username?.[0]?.toUpperCase()
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-sori-accent-secondary rounded-full border-2 border-sori-surface-panel shadow-sm"></div>
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-black truncate text-sori-text-strong leading-tight">{user.username}</div>
              <div className="text-[8px] text-sori-text-dim font-bold uppercase tracking-tighter">Online</div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="flex items-center relative h-8">
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                  isMuted ? 'text-sori-accent-danger hover:bg-sori-accent-danger-subtle' : 'text-sori-text-muted hover:text-white hover:bg-sori-surface-hover'
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
                       <p className="text-[10px] font-black uppercase text-sori-text-muted tracking-widest mb-3 ml-1">Input Device</p>
                       <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                         {micDevices.map(d => (
                           <div 
                             key={d.deviceId} 
                             onClick={() => setActiveMic(d.deviceId)} 
                             className={cn(
                               "px-3 py-2 text-[11px] rounded-xl cursor-pointer transition-all",
                               activeMicId === d.deviceId ? 'text-sori-accent-primary bg-sori-surface-accent-subtle font-bold' : 'text-sori-text-muted hover:bg-sori-surface-hover hover:text-white'
                             )}
                           >
                             {d.label || 'Microphone'}
                           </div>
                         ))}
                       </div>
                     </div>
                     <div className="h-px bg-sori-border-subtle" />
                    <div>
                      <div className="flex items-center justify-between mb-3 px-1">
                        <p className="text-[10px] font-black uppercase text-sori-accent-primary tracking-widest">Input Volume</p>
                        <span className="text-[11px] text-sori-accent-primary font-bold">{micGain}%</span>
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
                  isDeafened ? 'text-sori-accent-danger hover:bg-sori-accent-danger-subtle' : 'text-sori-text-muted hover:text-white hover:bg-sori-surface-hover'
                )}
              >
                <div className="relative">
                   <Headphones className={cn("h-5 w-5", isDeafened ? "text-sori-accent-danger" : "text-sori-text-muted")} />
                   {isDeafened && (
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-[2px] bg-sori-accent-danger rotate-45 rounded-full" />
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
                       <p className="text-[10px] font-black uppercase text-sori-text-muted tracking-widest mb-3 ml-1">Output Device</p>
                       <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                         {outputDevices.map(d => (
                           <div 
                             key={d.deviceId} 
                             onClick={() => setActiveOutput(d.deviceId)} 
                             className={cn(
                               "px-3 py-2 text-[11px] rounded-xl cursor-pointer transition-all",
                               activeOutputId === d.deviceId ? 'text-sori-accent-secondary bg-sori-surface-accent-subtle font-bold' : 'text-sori-text-muted hover:bg-sori-surface-hover hover:text-white'
                             )}
                           >
                             {d.label || 'Speaker'}
                           </div>
                         ))}
                       </div>
                     </div>
                     <div className="h-px bg-sori-border-subtle" />
                    <div>
                      <div className="flex items-center justify-between mb-3 px-1">
                        <p className="text-[10px] font-black uppercase text-sori-accent-secondary tracking-widest">Output Volume</p>
                        <span className="text-[11px] text-sori-accent-secondary font-bold">{outputVolume}%</span>
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
