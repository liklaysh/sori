import React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["voice"]);
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
    <div className="relative w-full h-full flex items-center justify-center bg-sori-surface-main group overflow-hidden">
      {/* Video Track */}
      {isVideoEnabled && isTrackReference(trackRef) ? (
        <VideoTrack 
          trackRef={trackRef} 
          className={`w-full h-full transition-all duration-700 ${isScreenShare ? 'object-contain bg-sori-surface-main' : 'object-cover'}`} 
        />
      ) : (
        /* Beautiful Avatar Placeholder */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-sori-surface-main">
          <div className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black text-sori-text-strong bg-sori-accent-primary-gradient shadow-2xl transition-all duration-300 relative overflow-hidden",
            isSpeaking ? 'speaking-pulse scale-110' : 'border border-sori-border-subtle'
          )}>
           {avatarUrl ? (
              <img src={avatarUrl} alt={participant.name} className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          
          {/* Subtle Reflection below avatar */}
          <div className="mt-4 w-12 h-1 bg-sori-accent-primary rounded-full"></div>
       </div>
      )}

      {/* Overlay: Name Tag & Stream Status */}
      <div className="absolute bottom-3 left-3 flex flex-col items-start gap-1 transition-all group-hover:translate-x-1 drop-shadow-2xl">
        <div className="flex items-center gap-2 bg-sori-surface-panel px-3 py-1.5 rounded-xl border border-sori-border-subtle shadow-lg">
          {isSpeaking && (
            <span className="w-2 h-2 rounded-full bg-sori-accent-success animate-pulse"></span>
          )}
         <span className="text-[11px] font-black text-white tracking-wide uppercase">
            {participant.name || participant.identity}
          </span>
          {participant.isLocal && (
            <span className="text-[8px] bg-sori-surface-hover text-sori-text-strong px-1.5 py-0.5 rounded-md font-bold border border-sori-border-subtle">{t("voice:participant.you")}</span>
          )}
       </div>

        {/* Live Stream Tech Info: For All Screen Shares */}
        {isScreenShare && (
          <div className="bg-sori-surface-panel border border-sori-border-accent rounded-lg px-2 py-0.5 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300 shadow-xl">
             <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sori-accent-danger"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sori-accent-danger"></span>
             </span>
             <span className="text-[9px] font-black text-sori-accent-danger tracking-[0.1em] uppercase">{t("voice:participant.live")}</span>
             <span className="text-[9px] font-black text-sori-accent-primary tracking-[0.1em] uppercase">1080P, 30FPS</span>
          </div>
       )}
      </div>

      {/* Mic Off Status Indicator */}
      {!participant.isMicrophoneEnabled && (
        <div className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-sori-accent-danger text-sori-text-strong flex items-center justify-center shadow-lg">
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
              "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-2xl border",
              isStreamMuted 
                ? "bg-sori-surface-danger-subtle border-sori-accent-danger text-sori-text-strong" 
                : "bg-sori-surface-accent-subtle border-sori-border-accent text-sori-text-strong hover:bg-sori-surface-hover"
           )}
            title={isStreamMuted ? t("voice:participant.unmuteStreamAudio") : t("voice:participant.muteStreamAudio")}
          >
            {isStreamMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5 animate-pulse" />
            )}
          </button>
          
          <div className={cn(
            "flex flex-col items-end gap-1 transition-all duration-300",
            isStreamMuted ? "visible translate-x-0" : "invisible translate-x-4 pointer-events-none"
          )}>
            <div className="bg-sori-accent-danger px-3 py-1.5 rounded-xl border border-sori-accent-danger shadow-2xl">
               <span className="text-[10px] font-black text-sori-text-strong uppercase tracking-widest leading-none">{t("voice:participant.streamMuted")}</span>
            </div>
          </div>
       </div>
      )}
    </div>
  );
};
