import React from "react";
import { useChatStore } from "../../store/useChatStore";
import { useUserStore } from "../../store/useUserStore";
import { useUIStore } from "../../store/useUIStore";
import { useCall } from "../../hooks/useCall";
import { OccupantItem } from "./Voice/OccupantItem";
import { Skeleton, cn, Popover, PopoverTrigger, PopoverContent, Slider } from "@sori/ui";
import { ChevronDown, Plus, ChevronRight, Hash, Volume2, Mic, MicOff, Headphones, Sparkles, PhoneOff } from "lucide-react";
import { NoiseSuppressionPopup } from "./Modals/NoiseSuppressionPopup";
import { API_URL } from "../../config";
import { getAvatarUrl } from "../../utils/avatar";

interface ChannelSidebarProps {
  socket: any;
  setIsVoiceChatOpen: (open: boolean) => void;
  
  // From useMediaSettings
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
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  socket, setIsVoiceChatOpen,
  micGain, setMicGain, outputVolume, setOutputVolume,
  micDevices, activeMicId, setActiveMic, outputDevices, activeOutputId, setActiveOutput,
  noiseSuppression, toggleNoiseSuppression
}) => {
  const { user } = useUserStore();
  const { channels, voiceOccupants } = useChatStore();
  const { 
    activeChannelId, setActiveChannelId, 
    collapsedCategories, toggleCategory,
    setChannelSidebarOpen,
    isMuted, setIsMuted, isDeafened, setIsDeafened
  } = useUIStore();

  const { 
    livekitToken, connectedChannelId, status, 
    initiateCall, endCall, getChannelToken, resetCall 
  } = useCall({ socket, currentUser: user! });

  const currentChannel = channels.find(c => c.id === activeChannelId) || null;
  const connectedChannel = channels.find(c => c.id === connectedChannelId) || null;
  
  const handleJoinVoiceChannel = async (channelId: string) => {
    try {
      await getChannelToken(channelId);
      socket?.emit("join_voice_channel", channelId);
      setIsVoiceChatOpen(true);
    } catch (err) {
      console.error("Join voice failed:", err);
    }
  };

  const handleLeaveVoiceChannel = () => {
    socket?.emit("leave_voice_channel", connectedChannelId);
    setIsVoiceChatOpen(false);
    resetCall();
  };

  // Categorize channels
  const categories = Array.from(new Set(channels.map(c => c.categoryId))).map(id => ({
    id,
    name: channels.find(c => c.categoryId === id)?.categoryName || "Channels"
  }));

  const dynamicServerName = "Sori Sanctuary";

  if (!user) return null;

  return (
    <aside className="h-full flex flex-col w-64 bg-sori-sidebar z-40 border-r border-white/5">
      <div className="p-4 h-14 flex items-center justify-between border-b border-white/5 bg-sori-sidebar shrink-0">
        <h2 className="font-headline text-white font-bold text-base truncate">{dynamicServerName}</h2>
        <ChevronDown className="h-4 w-4 text-on-surface-variant" />
      </div>
      <div className="flex-1 overflow-y-auto py-4 space-y-2 no-scrollbar">
        {categories.map(cat => (
          <div key={cat.id} className="mb-4">
            <div 
              className="px-4 py-1 flex items-center justify-between group cursor-pointer" 
              onClick={() => toggleCategory(cat.id)}
            >
              <div className="flex items-center gap-1">
                {collapsedCategories.has(cat.id) ? (
                  <ChevronRight className="h-3 w-3 text-on-surface-variant transition-all" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-on-surface-variant transition-all" />
                )}
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-on-surface-variant hover:text-white transition-colors">{cat.name}</span>
              </div>
              <button className="opacity-0 group-hover:opacity-100 hover:text-white transition-all p-0.5 rounded hover:bg-white/5">
                <Plus className="h-3.5 w-3.5 text-on-surface-variant" />
              </button>
            </div>
            {!collapsedCategories.has(cat.id) && (
              <div className="space-y-0.5 px-2 mt-1">
                {channels.filter(c => c.categoryId === cat.id).map(ch => {
                  const occupants = [...(voiceOccupants[ch.id] || [])].sort((a, b) => a.joinedAt - b.joinedAt);
                  const isActive = activeChannelId === ch.id;
                  return (
                    <div key={ch.id} className="mb-1">
                      <div 
                        onClick={() => {
                          console.log("👆 [ChannelSidebar] Channel clicked:", ch.name, ch.id, ch.type);
                          setActiveChannelId(ch.id);
                          setChannelSidebarOpen(false);
                          if (ch.type === 'voice') {
                            console.log("👆 [ChannelSidebar] Initiating joinVoiceChannel flow");
                            handleJoinVoiceChannel(ch.id);
                          }
                        }} 
                        className={cn(
                          "px-3 py-2 rounded-lg cursor-pointer flex items-center gap-2 transition-all group/ch",
                          isActive 
                            ? "bg-white/10 text-white font-bold" 
                            : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                        )}
                      >
                        {ch.type === 'text' ? (
                          <Hash className={cn("h-4 w-4", isActive ? "text-primary" : "text-on-surface-variant/40 group-hover/ch:text-on-surface-variant")} />
                        ) : (
                          <Volume2 className={cn("h-4 w-4", isActive ? "text-primary" : "text-on-surface-variant/40 group-hover/ch:text-on-surface-variant")} />
                        )}
                        <span className="text-sm truncate flex-1">{ch.name}</span>
                      </div>
                      {ch.type === 'voice' && occupants.length > 0 && (
                        <div className="ml-6 mt-1 space-y-0.5">
                          {occupants.map(occ => (
                            <OccupantItem 
                              key={occ.userId} 
                              occupant={occ} 
                              isSpeaking={false} 
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col">
        {socket?.connected && connectedChannelId && (
          <div className="bg-sori-voice px-3 py-2 border-t border-white/5 flex items-center gap-3 animate-in slide-in-from-bottom relative">
            <Volume2 className="h-4 w-4 text-secondary animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black uppercase text-secondary leading-none">Voice Connected</div>
              <div className="text-[10px] text-on-surface-variant font-bold truncate">{connectedChannel?.name}</div>
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
              onClick={handleLeaveVoiceChannel} 
              className="p-1.5 bg-sori-error rounded-xl text-white hover:brightness-110 transition-all shadow-sm"
              title="Disconnect"
            >
              <PhoneOff className="h-5 w-5" /> 
            </button>
          </div>
        )}
        <div className="m-2 p-2 bg-sori-voice border border-white/5 rounded-2xl flex items-center justify-between gap-2 group/user">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 hover:bg-white/5 rounded-xl p-1 cursor-pointer transition-all">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-black text-primary border border-primary/20 group-hover/user:scale-105 transition-transform overflow-hidden">
                {getAvatarUrl(user.avatarUrl) ? (
                  <img 
                    src={getAvatarUrl(user.avatarUrl)!} 
                    className="w-full h-full object-cover" 
                    alt={user.username} 
                  />
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
                              activeMicId === d.deviceId 
                                ? 'text-primary bg-primary/10 font-bold' 
                                : 'text-on-surface-variant hover:bg-white/5 hover:text-white'
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
                      <Slider 
                        value={[micGain]} 
                        onValueChange={([val]: number[]) => setMicGain(val)} 
                        max={100} 
                        step={1}
                        className="py-2"
                      />
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
                              activeOutputId === d.deviceId 
                                ? 'text-secondary bg-secondary/10 font-bold' 
                                : 'text-on-surface-variant hover:bg-white/5 hover:text-white'
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
                      <Slider 
                        value={[outputVolume]} 
                        onValueChange={([val]: number[]) => setOutputVolume(val)} 
                        max={200} 
                        step={1}
                        className="py-2"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
