import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../store/useChatStore";
import { useUserStore } from "../../store/useUserStore";
import { useUIStore } from "../../store/useUIStore";
import { OccupantItem } from "./Voice/OccupantItem";
import { OccupantContextMenu } from "./ContextMenus/OccupantContextMenu";
import { Skeleton, cn, Popover, PopoverTrigger, PopoverContent, Slider } from "@sori/ui";
import { ChevronDown, Plus, ChevronRight, Hash, Volume2, Mic, MicOff, Headphones, Waves, PhoneOff } from "lucide-react";
import { NoiseSuppressionPopup } from "./Modals/NoiseSuppressionPopup";
import { getAvatarUrl } from "../../utils/avatar";
import { CreateChannelModal } from "./Modals/CreateChannelModal";
import api from "../../lib/api";
import { toast } from "sonner";
import { playNotificationSound } from "../../utils/notificationSounds";
import { VoiceOccupant } from "../../types/chat";

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
  
  // Call Orchestration (from Chat.tsx)
  livekitToken: string | null;
  connectedChannelId: string | null;
  status: string;
  getChannelToken: (channelId: string) => Promise<string>;
  resetCall: () => void;
  setIsDisconnecting: (val: boolean) => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = (props) => {
  const { t } = useTranslation(["chat", "common", "voice"]);
  const {
    socket, setIsVoiceChatOpen,
    micGain, setMicGain, outputVolume, setOutputVolume,
    micDevices, activeMicId, setActiveMic, outputDevices, activeOutputId, setActiveOutput,
    noiseSuppression, toggleNoiseSuppression,
    livekitToken, connectedChannelId, status, 
    getChannelToken, resetCall, setIsDisconnecting 
  } = props;

  const { user } = useUserStore();
  const { channels, voiceOccupants } = useChatStore();
  const { 
    activeChannelId, setActiveChannelId, 
    collapsedCategories, toggleCategory,
    setChannelSidebarOpen,
    isMuted, setIsMuted, isDeafened, setIsDeafened,
    isCreateChannelModalOpen, setCreateChannelModalOpen, createChannelCategoryId,
    participantVolumes, setParticipantVolume
  } = useUIStore();
  const { activeCommunityId, fetchInitialData } = useChatStore();
  const [occupantMenu, setOccupantMenu] = useState<{
    x: number;
    y: number;
    occupant: VoiceOccupant;
  } | null>(null);

  const currentChannel = channels.find(c => c.id === activeChannelId) || null;
  const connectedChannel = channels.find(c => c.id === connectedChannelId) || null;
  const shouldCollapseSidebarAfterSelection =
    typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches;
  
  const handleJoinVoiceChannel = async (channelId: string) => {
    if (connectedChannelId === channelId && livekitToken) {
      setIsVoiceChatOpen(true);
      return;
    }

    try {
      setIsDisconnecting(false);
      await getChannelToken(channelId);
      socket?.emit("join_voice_channel", channelId);
      setIsVoiceChatOpen(true);
      playNotificationSound("voiceJoin");
    } catch (err) {
      console.error("Join voice failed:", err);
    }
  };

  const handleLeaveVoiceChannel = () => {
    if (connectedChannelId) {
      playNotificationSound("voiceLeave");
    }
    socket?.emit("leave_voice_channel", connectedChannelId);
    setIsVoiceChatOpen(false);
    resetCall();
    setIsDisconnecting(true);
  };

  const handleOccupantContextMenu = (e: React.MouseEvent, occupant: VoiceOccupant, channelId: string) => {
    if (!livekitToken || connectedChannelId !== channelId || occupant.userId === user?.id) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setOccupantMenu({
      x: e.clientX,
      y: e.clientY,
      occupant,
    });
  };

  useEffect(() => {
    if (!occupantMenu) {
      return;
    }

    const closeMenu = () => setOccupantMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeMenu);
    };
  }, [occupantMenu]);

  // Categorize channels
  const categories = Array.from(new Set(channels.map(c => c.categoryId))).map((id) => {
    const categoryChannels = channels.filter((channel) => channel.categoryId === id);
    const firstChannel = categoryChannels[0];
    const fallbackName = firstChannel?.type === "voice"
      ? t("chat:categories.voiceChannels")
      : t("chat:categories.textChannels");

    return {
      id,
      name: firstChannel?.categoryName || fallbackName,
    };
  });

  const handleCreateChannel = async (data: { name: string; type: "text" | "voice"; categoryId: string }) => {
    if (!activeCommunityId) {
      toast.error("No active community context");
      return;
    }

    try {
      await api.post(`/communities/${activeCommunityId}/channels`, data);
      toast.success(`Channel #${data.name} created!`);
      
      // Reactive update: refetch channels for this community
      await fetchInitialData(activeCommunityId);
      
      setCreateChannelModalOpen(false);
    } catch (err: any) {
      console.error("Failed to create channel:", err);
      toast.error(err.response?.data?.error || "Failed to create channel");
    }
  };

  const dynamicServerName = "Sori Sanctuary";

  if (!user) return null;

  return (
    <aside className="h-full min-h-0 flex flex-col w-64 bg-sori-surface-panel z-40 border-r border-sori-border-subtle">
      <header className="h-14 px-4 flex items-center border-b border-sori-border-subtle shrink-0 bg-sori-surface-panel">
        <h2 className="font-headline text-sori-text-strong font-bold text-base truncate">{dynamicServerName}</h2>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-2 no-scrollbar">
        {categories.map(cat => (
          <div key={cat.id} className="mb-4">
            <div 
              className="px-4 py-1 flex items-center justify-between group cursor-pointer" 
              onClick={() => toggleCategory(cat.id)}
            >
              <div className="flex items-center gap-1">
                {collapsedCategories.has(cat.id) ? (
                  <ChevronRight className="h-3 w-3 text-sori-text-muted transition-all" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-sori-text-muted transition-all" />
                )}
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-sori-text-muted group-hover:text-sori-text-strong transition-colors">{cat.name}</span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCreateChannelModalOpen(true, cat.id);
                }}
                className="invisible group-hover:visible hover:text-sori-text-strong transition-colors p-0.5 rounded hover:bg-sori-surface-hover"
              >
                <Plus className="h-3.5 w-3.5 text-sori-text-muted" />
              </button>
            </div>
            {!collapsedCategories.has(cat.id) && (
              <div className="space-y-0.5 px-2 mt-1">
                {channels.filter(c => c.categoryId === cat.id).map(ch => {
                  const occupants = [...(voiceOccupants[ch.id] || [])].sort((a, b) => a.joinedAt - b.joinedAt);
                  const isActive = activeChannelId === ch.id;
                  const canShowVoiceActivity = Boolean(livekitToken && connectedChannelId === ch.id);
                  const canOpenOccupantMenu = Boolean(livekitToken && connectedChannelId === ch.id);
                  return (
                    <div key={ch.id} className="mb-1">
                      <div 
                        onClick={() => {
                          setActiveChannelId(ch.id);
                          if (shouldCollapseSidebarAfterSelection) {
                            setChannelSidebarOpen(false);
                          }
                          if (ch.type === 'voice') {
                            handleJoinVoiceChannel(ch.id);
                          } else {
                            setIsVoiceChatOpen(false);
                          }
                        }} 
                        className={cn(
                          "px-3 py-2 rounded-lg cursor-pointer flex items-center gap-2 transition-all group/ch",
                          isActive 
                            ? "bg-sori-surface-selected text-sori-accent-primary font-bold" 
                            : "text-sori-text-muted hover:bg-sori-surface-hover hover:text-sori-text-strong"
                        )}
                      >
                        {ch.type === 'text' ? (
                          <Hash className={cn("h-4 w-4", isActive ? "text-sori-accent-primary" : "text-sori-text-dim group-hover/ch:text-sori-text-muted")} />
                        ) : (
                          <Volume2 className={cn("h-4 w-4", isActive ? "text-sori-accent-primary" : "text-sori-text-dim group-hover/ch:text-sori-text-muted")} />
                        )}
                        <span className="text-sm truncate flex-1">{ch.name}</span>
                      </div>
                      {ch.type === 'voice' && occupants.length > 0 && (
                        <div className="ml-6 mt-1 space-y-0.5">
                          {occupants.map(occ => {
                            const isSpeaking = canShowVoiceActivity && Boolean(occ.isSpeaking);
                            return (
                              <OccupantItem 
                                key={occ.userId} 
                                occupant={occ} 
                                isSpeaking={isSpeaking} 
                                isContextMenuEnabled={canOpenOccupantMenu && occ.userId !== user.id}
                                onContextMenu={(event, occupant) => handleOccupantContextMenu(event, occupant, ch.id)}
                              />
                            );
                          })}
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

      <OccupantContextMenu
        visible={!!occupantMenu}
        x={occupantMenu?.x || 0}
        y={occupantMenu?.y || 0}
        occupant={occupantMenu?.occupant || null}
        participantVolume={occupantMenu ? participantVolumes[occupantMenu.occupant.userId] ?? 100 : 100}
        onVolumeChange={(volume) => {
          if (occupantMenu) {
            setParticipantVolume(occupantMenu.occupant.userId, volume);
          }
        }}
        onClose={() => setOccupantMenu(null)}
      />

      <div className="mt-auto flex flex-col">
        {socket?.connected && connectedChannelId && (
          <div className="bg-sori-surface-elevated px-3 py-2 border-t border-sori-border-subtle flex items-center gap-3 animate-in slide-in-from-bottom relative">
            <Volume2 className="h-4 w-4 text-sori-accent-secondary animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black uppercase text-sori-accent-secondary leading-none">{t("chat:voiceConnected")}</div>
              <div className="text-[10px] text-sori-text-muted font-bold truncate">{connectedChannel?.name}</div>
            </div>
            
            <div className="flex items-center">
              <NoiseSuppressionPopup isEnabled={noiseSuppression} onToggle={toggleNoiseSuppression}>
                <button 
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    noiseSuppression ? 'text-sori-accent-primary' : 'text-sori-text-dim hover:text-sori-text-muted'
                  )}
                  title={t("voice:noiseSuppression")}
                >
                  <Waves className="h-5 w-5" />
                </button>
              </NoiseSuppressionPopup>
            </div>

            <button 
              onClick={handleLeaveVoiceChannel} 
              className="p-1.5 bg-sori-accent-danger rounded-xl text-sori-text-on-accent hover:brightness-110 transition-all shadow-sm"
              title={t("voice:controls.disconnect")}
            >
              <PhoneOff className="h-5 w-5" /> 
            </button>
          </div>
        )}
        <div className="m-2 p-2 bg-sori-surface-elevated border border-sori-border-subtle rounded-2xl flex items-center justify-between gap-2 group/user">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 hover:bg-sori-surface-hover rounded-xl p-1 cursor-pointer transition-all">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-sori-surface-base flex items-center justify-center text-[11px] font-black text-sori-accent-primary border border-sori-border-subtle group-hover/user:scale-105 transition-transform overflow-hidden">
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
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-sori-accent-secondary rounded-full border-2 border-sori-surface-panel shadow-sm"></div>
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-black truncate text-sori-text-strong leading-tight">{user.username}</div>
              <div className="text-[8px] text-sori-text-dim font-bold uppercase tracking-tighter">{t("common:status.online")}</div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="flex items-center relative h-8">
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                  isMuted ? 'text-sori-accent-danger hover:bg-sori-surface-danger-subtle' : 'text-sori-text-muted hover:text-sori-text-strong hover:bg-sori-surface-hover'
                )}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-4 h-8 flex items-center justify-center text-sori-text-muted hover:text-white transition-all">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-64 p-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black uppercase text-sori-text-muted tracking-widest mb-3 ml-1">{t("voice:controls.inputDevice")}</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                        {micDevices.map(d => (
                          <div 
                            key={d.deviceId} 
                            onClick={() => setActiveMic(d.deviceId)} 
                            className={cn(
                              "px-3 py-2 text-[11px] rounded-xl cursor-pointer transition-all",
                              activeMicId === d.deviceId 
                                ? 'text-sori-accent-primary bg-sori-surface-accent-subtle font-bold' 
                                : 'text-sori-text-muted hover:bg-sori-surface-hover hover:text-white'
                            )}
                          >
                            {d.label || t("voice:controls.microphone")}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="h-px bg-sori-border-strong" />
                    
                    <div>
                      <div className="flex items-center justify-between mb-3 px-1">
                        <p className="text-[10px] font-black uppercase text-sori-accent-primary tracking-widest">{t("voice:controls.inputVolume")}</p>
                        <span className="text-[11px] text-sori-accent-primary font-bold">{micGain}%</span>
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
                  isDeafened ? 'text-sori-accent-danger hover:bg-sori-surface-danger-subtle' : 'text-sori-text-muted hover:text-sori-text-strong hover:bg-sori-surface-hover'
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
                  <button className="w-4 h-8 flex items-center justify-center text-sori-text-muted hover:text-white transition-all">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-64 p-4 ml-[-40px]">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black uppercase text-sori-text-muted tracking-widest mb-3 ml-1">{t("voice:controls.outputDevice")}</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                        {outputDevices.map(d => (
                          <div 
                            key={d.deviceId} 
                            onClick={() => setActiveOutput(d.deviceId)} 
                            className={cn(
                              "px-3 py-2 text-[11px] rounded-xl cursor-pointer transition-all",
                              activeOutputId === d.deviceId 
                                ? 'text-sori-accent-secondary bg-sori-surface-accent-subtle font-bold' 
                                : 'text-sori-text-muted hover:bg-sori-surface-hover hover:text-white'
                            )}
                          >
                            {d.label || t("voice:controls.speaker")}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="h-px bg-sori-border-strong" />
                    
                    <div>
                      <div className="flex items-center justify-between mb-3 px-1">
                        <p className="text-[10px] font-black uppercase text-sori-accent-secondary tracking-widest">{t("voice:controls.outputVolume")}</p>
                        <span className="text-[11px] text-sori-accent-secondary font-bold">{outputVolume}%</span>
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

      {/* Modals */}
      {isCreateChannelModalOpen && (
        <CreateChannelModal
          isOpen={isCreateChannelModalOpen}
          onClose={() => setCreateChannelModalOpen(false)}
          onCreate={handleCreateChannel}
          initialCategoryId={createChannelCategoryId || undefined}
        />
      )}
    </aside>
  );
};
