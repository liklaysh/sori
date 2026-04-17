import React from "react";
import { getAvatarUrl } from "../../../utils/avatar";
import { 
  TrackReferenceOrPlaceholder, 
  VideoTrack, 
  useParticipantContext,
  ParticipantName,
  isTrackReference,
} from "@livekit/components-react";
import { Track, RemoteTrackPublication, TrackPublication } from "livekit-client";
import { cn } from "@sori/ui";

import { MicOff, Volume2, VolumeX } from "lucide-react";

interface SoriParticipantTileProps {
  trackRef: TrackReferenceOrPlaceholder;
}

export const SoriParticipantTile: React.FC<SoriParticipantTileProps> = ({ trackRef }) => {
  const participant = trackRef.participant;
  const isSpeaking = participant.isSpeaking;
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const isVideoEnabled = isScreenShare ? true : participant.isCameraEnabled;
  const initial = (participant.name || participant.identity || "?")[0].toUpperCase();

  const [isStreamMuted, setIsStreamMuted] = React.useState(false);
  const [streamAudioPub, setStreamAudioPub] = React.useState<TrackPublication | undefined>(
    participant.getTrackPublication(Track.Source.ScreenShareAudio)
  );

  const isStreamAudioAvailable = !!streamAudioPub;

  // Sync local state with publication and listen for changes
  React.useEffect(() => {
    const updatePub = () => {
      const pub = participant.getTrackPublication(Track.Source.ScreenShareAudio);
      setStreamAudioPub(pub);
      if (pub) setIsStreamMuted(pub.isMuted);
    };

    updatePub();

    participant.on("trackPublished", updatePub);
    participant.on("trackUnpublished", updatePub);
    participant.on("trackMuted", updatePub);
    participant.on("trackUnmuted", updatePub);

    return () => {
      participant.off("trackPublished", updatePub);
      participant.off("trackUnpublished", updatePub);
      participant.off("trackMuted", updatePub);
      participant.off("trackUnmuted", updatePub);
    };
  }, [participant]);

  const toggleStreamAudioMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (streamAudioPub && streamAudioPub instanceof RemoteTrackPublication) {
      const nextMuted = !isStreamMuted;
      // .setEnabled() on a RemoteTrackPublication is the v2 way for local subscriber action
      streamAudioPub.setEnabled(!nextMuted);
      setIsStreamMuted(nextMuted);
    }
  };

  const metadata = React.useMemo(() => {
    try {
      return participant.metadata ? JSON.parse(participant.metadata) : {};
    } catch (e) {
      return {};
    }
  }, [participant.metadata]);

  const avatarUrl = getAvatarUrl(metadata.avatar);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-sori-chat group overflow-hidden">
      {/* Video Track */}
      {isVideoEnabled && isTrackReference(trackRef) ? (
        <VideoTrack 
          trackRef={trackRef} 
          className={`w-full h-full transition-all duration-700 ${isScreenShare ? 'object-contain bg-sori-server' : 'object-cover'}`} 
        />
      ) : (
        /* Beautiful Avatar Placeholder */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-sori-chat">
          <div className={`
            w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black text-white
            bg-sori-primary-gradient shadow-2xl transition-all duration-300 relative overflow-hidden
            ${isSpeaking ? 'speaking-pulse scale-110 shadow-[0_0_30px_#a3a6ff]' : 'border border-muted'}
          `}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={participant.name} className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          
          {/* Subtle Reflection below avatar */}
          <div className="mt-4 w-12 h-1 bg-sori-primary rounded-full"></div>
        </div>
      )}

      {/* Overlay: Name Tag & Stream Status */}
      <div className="absolute bottom-3 left-3 flex flex-col items-start gap-1 transition-all group-hover:translate-x-1 drop-shadow-2xl">
        <div className="flex items-center gap-2 bg-sori-server px-3 py-1.5 rounded-xl border border-muted shadow-lg">
          {isSpeaking && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></span>
          )}
          <span className="text-[11px] font-black text-white tracking-wide uppercase">
            {participant.name || participant.identity}
          </span>
          {participant.isLocal && (
            <span className="text-[8px] bg-muted text-white px-1.5 py-0.5 rounded-md font-bold border border-muted">YOU</span>
          )}
        </div>

        {/* Live Stream Tech Info: For All Screen Shares */}
        {isScreenShare && (
          <div className="bg-sori-sidebar border border-primary rounded-lg px-2 py-0.5 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300 shadow-xl">
             <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
             </span>
             <span className="text-[9px] font-black text-primary tracking-[0.1em] uppercase">
               LIVE: 1080p, 30FPS
             </span>
          </div>
        )}
      </div>

      {/* Mic Off Status Indicator */}
      {!participant.isMicrophoneEnabled && (
        <div className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-sori-error text-white flex items-center justify-center shadow-lg">
          <MicOff className="h-4 w-4" />
        </div>
      )}
      {/* Stream Audio Mute Toggle */}
      {isScreenShare && isStreamAudioAvailable && (
        <div className={cn(
          "absolute bottom-4 right-4 flex items-center gap-3 flex-row-reverse",
        )}>
          <button
            onClick={toggleStreamAudioMute}
            className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-2xl border backdrop-blur-xl",
              isStreamMuted 
                ? "bg-sori-error/40 border-sori-error text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]" 
                : "bg-sori-primary/40 border-sori-primary text-white hover:bg-sori-primary/60 shadow-[0_0_15px_rgba(163,166,255,0.4)]"
            )}
            title={isStreamMuted ? "Unmute Stream Audio" : "Mute Stream Audio"}
          >
            {isStreamMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5 animate-pulse" />
            )}
          </button>
          
          <div className={cn(
            "flex flex-col items-end gap-1 transition-all duration-300",
            isStreamMuted ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
          )}>
            <div className="bg-sori-error px-3 py-1.5 rounded-xl border border-sori-error/50 shadow-2xl">
               <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Stream Muted</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
