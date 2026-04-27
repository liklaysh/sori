import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@sori/ui";
import { 
  useTracks,
  useLocalParticipant,
  TrackReference,
  isTrackReference,
} from "@livekit/components-react";
import { Track, LocalAudioTrack } from "livekit-client";
import { User, ChatItem } from "../../../types/chat";
import { useServerTime } from "../../../hooks/useServerTime";
import { API_URL } from "../../../config";
import { 
  X, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  ScreenShare, 
  StopCircle, 
  PhoneOff, 
  Phone,
  Maximize2, 
  Minimize2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  Monitor,
  MoreVertical,
  UserPlus,
  MessageSquare
} from "lucide-react";
import { SoriParticipantTile } from "./SoriParticipantTile";
import { SoriCallControls } from "./SoriCallControls";
import { SoriCallSidebar } from "./SoriCallSidebar";

interface SoriVoiceRoomProps {
  onLeave: () => void;
  socket: any;
  channelId?: string | null;
  messages: ChatItem[];
  inputValue: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSendMessage: (e: React.FormEvent) => void;
  user: User;
  outputVolume: number;
  micGain: number;
  participantVolumes: Record<string, number>;
  noiseSuppression: boolean;
  toggleNoiseSuppression: () => void;
  isChatOpen: boolean;
  setIsChatOpen: (v: boolean) => void;
  channelName: string;
  startTime?: number | null;
  onOpenFindFriend?: () => void;
  onMinimize?: () => void;
  micDevices: MediaDeviceInfo[];
  activeMicId?: string;
  setActiveMic: (id: string) => void;
  outputDevices: MediaDeviceInfo[];
  activeOutputId?: string;
  setActiveOutput: (id: string) => void;
  setMicGain: (gain: number) => void;
  setOutputVolume: (volume: number) => void;
}

export const SoriVoiceRoom: React.FC<SoriVoiceRoomProps> = ({ 
  onLeave, 
  socket,
  channelId,
  messages,
  inputValue,
  onInputChange,
  onSendMessage,
  user,
  outputVolume,
  micGain,
  noiseSuppression,
  toggleNoiseSuppression,
  isChatOpen,
  setIsChatOpen,
  channelName,
  startTime,
  onOpenFindFriend,
  onMinimize,
  micDevices, activeMicId, setActiveMic,
  outputDevices, activeOutputId, setActiveOutput,
  setMicGain, setOutputVolume
}) => {
  const { t } = useTranslation(["voice"]);
  const { getSyncedDate } = useServerTime();
  const [duration, setDuration] = useState("00:00");
  const { localParticipant } = useLocalParticipant();
  const [currentPage, setCurrentPage] = useState(0);

  // --- Speaking Sync Logic ---
  const lastSpeakingState = useRef<boolean>(false);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const isSpeaking = localParticipant.isSpeaking;
    
    // Only proceed if state changed
    if (isSpeaking === lastSpeakingState.current) return;

    // Throttle: we don't want to spam socket on every micro-packet
    if (speakingTimeoutRef.current) return;

    speakingTimeoutRef.current = setTimeout(() => {
      // Final check of state before emit
      const currentState = localParticipant.isSpeaking;
      if (channelId && currentState !== lastSpeakingState.current) {
        socket?.emit("user_speaking_update", { 
          channelId, 
          isSpeaking: currentState 
        });
        lastSpeakingState.current = currentState;
      }
      speakingTimeoutRef.current = null;
    }, 200);

    return () => {
      if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    };
  }, [localParticipant.isSpeaking, socket, channelId, user?.id]);
  // ---------------------------
  const [focusedTrack, setFocusedTrack] = useState<TrackReference | null>(null);
  const [hideSelfCamera, setHideSelfCamera] = useState(false);

  const rawTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  ) || [];

  const participantTracks = React.useMemo(() => {
    let tracks = rawTracks.filter(t => 
      t.source === Track.Source.Camera || 
      t.source === Track.Source.ScreenShare
    );

    if (hideSelfCamera) {
      tracks = tracks.filter(t => !(t.participant.isLocal && t.source === Track.Source.Camera));
    }

    return tracks;
  }, [rawTracks, hideSelfCamera]);
  // Handle focused track disappearing - more robust check using identity
  useEffect(() => {
    if (focusedTrack) {
      const stillExists = rawTracks.some(t => 
        t.participant.identity === focusedTrack.participant.identity && 
        t.source === focusedTrack.source
      );
      
      // If the track is gone, wait a tiny bit to check again before closing
      // (prevents flicker on track metadata updates)
      if (!stillExists) {
        const timeout = setTimeout(() => {
          const againExists = rawTracks.some(t => 
            t.participant.identity === focusedTrack.participant.identity && 
            t.source === focusedTrack.source
          );
          if (!againExists) setFocusedTrack(null);
        }, 300);
        return () => clearTimeout(timeout);
      }
    }
  }, [rawTracks, focusedTrack]);

  // --- Duration Timer ---
  useEffect(() => {
    if (!startTime) {
      setDuration("00:00");
      return;
    }

    const updateDuration = () => {
      const now = getSyncedDate().getTime();
      const diff = Math.max(0, Math.floor((now - startTime) / 1000));
      const mins = Math.floor(diff / 60).toString().padStart(2, "0");
      const secs = (diff % 60).toString().padStart(2, "0");
      setDuration(`${mins}:${secs}`);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [startTime, getSyncedDate]);

  // Handle focused track disappearing

  // --- RNNoise Integration ---
  useEffect(() => {
    let isCancelled = false;

    const applyNoiseSuppression = async () => {
      const audioPub = localParticipant.getTrackPublication(Track.Source.Microphone);
      if (audioPub && audioPub.audioTrack instanceof LocalAudioTrack) {
        try {
          if (!noiseSuppression) {
            await audioPub.audioTrack.stopProcessor();
            return;
          }

          const { toggleNoiseSuppression } = await import("../../../utils/noise-processor");
          if (isCancelled) {
            return;
          }
          await toggleNoiseSuppression(audioPub.audioTrack, true);
        } catch (err) {
          console.error("[RNNoise] Failed to toggle:", err);
        }
      }
    };

    applyNoiseSuppression();

    return () => {
      isCancelled = true;
    };
  }, [noiseSuppression, localParticipant]);

  const ITEMS_PER_PAGE = 9;
  const totalPages = Math.ceil(participantTracks.length / ITEMS_PER_PAGE);
  const currentTracks = participantTracks.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  const getGridClass = (count: number) => {
    if (count === 1) return "grid-cols-1 max-w-4xl";
    if (count === 2) return "grid-cols-2 max-w-6xl";
    if (count === 3) return "grid-cols-2 max-w-6xl"; 
    if (count === 4) return "grid-cols-2 max-w-6xl";
    return "grid-cols-3 max-w-7xl";
  };

  const renderGrid = () => {
    const count = currentTracks.length;
    const gridClass = getGridClass(count);

    return (
      <div className={cn(
        "grid gap-6 w-full justify-center p-8 transition-all duration-500 mx-auto",
        gridClass
      )}>
        {currentTracks.map((track, index) => {
          const isLastOfThree = count === 3 && index === 2;
          const isScreenShare = track.source === Track.Source.ScreenShare;
          
          return (
            <div 
              key={`${track.participant.identity}-${track.source}`}
              onClick={() => isScreenShare && isTrackReference(track) && setFocusedTrack(track)}
              className={cn(
                "relative aspect-video bg-sori-surface-panel rounded-[2.5rem] overflow-hidden border border-sori-border-subtle shadow-2xl transition-all hover:border-sori-accent-primary group cursor-pointer",
                isLastOfThree && "col-span-2 mx-auto w-full max-w-[calc(50%-1.5rem)]"
              )}
            >
              <SoriParticipantTile trackRef={track as TrackReference} />
              {isScreenShare && (
                 <div className="absolute inset-0 hidden group-hover:flex items-center justify-center pointer-events-none">
                  <div className="bg-sori-surface-overlay px-4 py-2 rounded-xl border border-sori-accent-primary flex items-center gap-2">
                     <Maximize2 className="h-4 w-4 text-sori-accent-primary" />
                     <span className="text-[10px] font-black uppercase text-sori-text-strong tracking-widest">{t("voice:room.expand")}</span>
                  </div>
               </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex overflow-hidden relative h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Unified */}
        <div className="h-14 flex items-center justify-between px-6 bg-sori-surface-main border-b border-sori-border-subtle shrink-0 z-50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-sori-surface-hover flex items-center justify-center border border-sori-accent-primary shadow-sm">
              <Phone className="h-5 w-5 text-sori-accent-primary" />
            </div>
            <div>
              <h2 className="text-sm font-black text-sori-text-strong uppercase tracking-widest">{channelName}</h2>
              <p className="text-[10px] font-bold text-sori-text-muted uppercase flex items-center gap-1">
                <span>{t("voice:room.callProtocolActive")}</span>
                <span className="font-mono tabular-nums tracking-normal">{duration}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {onMinimize && (
              <button 
                onClick={onMinimize}
                className="w-10 h-10 rounded-xl bg-sori-surface-hover border border-sori-border-subtle hover:bg-sori-surface-panel text-sori-text-muted flex items-center justify-center transition-all"
                title={t("voice:room.minimizeCall")}
              >
                <Minimize2 className="h-5 w-5" />
              </button>
            )}
            {onOpenFindFriend && (
              <button 
                onClick={onOpenFindFriend}
                className="w-10 h-10 rounded-xl bg-sori-surface-hover border border-sori-border-subtle hover:bg-sori-surface-panel text-sori-text-muted flex items-center justify-center transition-all"
                title={t("voice:room.addToCall")}
              >
                <UserPlus className="h-5 w-5" />
              </button>
            )}
            <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                isChatOpen ? "bg-sori-accent-primary text-black shadow-lg" : "bg-sori-surface-hover border border-sori-border-subtle text-sori-text-muted hover:bg-sori-surface-panel hover:text-sori-text-strong"
              )}
              title={t("voice:room.toggleChat")}
            >
              <MessageSquare className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-sori-surface-base">
          {focusedTrack ? (
            /* FOCUSED VIEW */
            <div className="flex-1 w-full h-full flex flex-col relative overflow-hidden">
               <div className="flex-1 w-full h-full relative p-8 pb-0">
                  <div className="w-full h-full rounded-[3rem] overflow-hidden border border-sori-border-subtle bg-sori-surface-panel relative group shadow-2xl">
                     <SoriParticipantTile trackRef={focusedTrack} />
                     <button 
                        onClick={() => setFocusedTrack(null)}
                        className="absolute top-6 right-6 w-12 h-12 rounded-2xl bg-sori-surface-overlay border border-sori-border-subtle text-sori-text-strong hidden group-hover:flex items-center justify-center transition-all hover:bg-sori-accent-danger hover:scale-110"
                     >
                        <Minimize2 className="h-6 w-6" />
                     </button>
                  </div>
               </div>

               {/* Strip of other participants */}
               <div className="h-40 w-full px-8 pb-8 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="w-full h-full flex items-center gap-4 overflow-x-auto no-scrollbar py-2">
                     {participantTracks.map((t) => (
                        <div 
                           key={`${t.participant.identity}-${t.source}`}
                           onClick={() => t.source === Track.Source.ScreenShare && isTrackReference(t) ? setFocusedTrack(t) : null}
                           className={cn(
                             "h-full aspect-video rounded-2xl overflow-hidden border shrink-0 transition-all cursor-pointer hover:scale-105 shadow-xl",
                             focusedTrack.participant.identity === t.participant.identity && focusedTrack.source === t.source 
                              ? 'border-sori-accent-primary ring-2 ring-sori-accent-primary scale-105' 
                              : 'border-sori-border-subtle hover:border-sori-border-strong'
                           )}
                        >
                           <SoriParticipantTile trackRef={t as TrackReference} />
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          ) : (
            /* GRID VIEW */
            <>
              <div className="w-full h-full overflow-y-auto no-scrollbar flex items-center">
                {renderGrid()}
              </div>
              
              {totalPages > 1 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-sori-surface-main px-6 py-3 rounded-2xl border border-sori-border-subtle z-50 shadow-2xl">
                  <button 
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sori-text-strong disabled:text-sori-text-dim hover:bg-sori-surface-hover transition-colors"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <span className="text-[11px] font-black uppercase text-sori-text-muted tracking-widest">
                    {t("voice:room.page", { current: currentPage + 1, total: totalPages })}
                  </span>
                  <button 
                    disabled={currentPage === totalPages - 1}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sori-text-strong disabled:text-sori-text-dim hover:bg-sori-surface-hover transition-colors"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>

                </div>
              )}
            </>
          )}
        </div>

        {/* Unified Bottom Controls */}
        <SoriCallControls 
          onHangUp={onLeave}
          noiseSuppression={noiseSuppression}
          toggleNoiseSuppression={toggleNoiseSuppression}
          hideSelfCamera={hideSelfCamera}
          setHideSelfCamera={setHideSelfCamera}
          micDevices={micDevices}
          activeMicId={activeMicId}
          setActiveMic={setActiveMic}
          outputDevices={outputDevices}
          activeOutputId={activeOutputId}
          setActiveOutput={setActiveOutput}
          outputVolume={outputVolume}
          micGain={micGain}
          setMicGain={setMicGain}
          setOutputVolume={setOutputVolume}
        />
      </div>

      {/* Unified Chat Sidebar */}
      {isChatOpen && (
        <SoriCallSidebar 
          messages={messages}
          user={user}
          title={channelName}
          inputValue={inputValue}
          setInputValue={(v: string) => {
            const e = { target: { value: v } } as any;
            onInputChange(e);
          }}
          onSendMessage={onSendMessage}
          onClose={() => setIsChatOpen(false)}
          onMessageContextMenu={() => {}} 
          onOpenForward={() => {}}
        />
      )}
    </div>
  );
};
