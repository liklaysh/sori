import React, { useEffect } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { ParticipantEvent, Track } from "livekit-client";

export const StreamingTracker: React.FC<{ socket: any, channelId?: string }> = ({ socket, channelId }) => {
  const { localParticipant } = useLocalParticipant();
  
  useEffect(() => {
    if (!localParticipant || !socket || !channelId) return;

    const syncStreamingStatus = () => {
      // Check for ScreenShare track directly
      const isStreaming = Array.from(localParticipant.trackPublications.values())
        .some(p => p.source === Track.Source.ScreenShare);
      
      socket.emit("user_streaming_update", { 
        channelId, 
        isStreaming 
      });
    };

    // Initial sync
    syncStreamingStatus();

    // Listen for publication events
    localParticipant.on(ParticipantEvent.TrackPublished, syncStreamingStatus);
    localParticipant.on(ParticipantEvent.TrackUnpublished, syncStreamingStatus);
    localParticipant.on(ParticipantEvent.LocalTrackPublished, syncStreamingStatus);
    localParticipant.on(ParticipantEvent.LocalTrackUnpublished, syncStreamingStatus);

    return () => {
      localParticipant.off(ParticipantEvent.TrackPublished, syncStreamingStatus);
      localParticipant.off(ParticipantEvent.TrackUnpublished, syncStreamingStatus);
      localParticipant.off(ParticipantEvent.LocalTrackPublished, syncStreamingStatus);
      localParticipant.off(ParticipantEvent.LocalTrackUnpublished, syncStreamingStatus);
    };
  }, [localParticipant, socket, channelId]);

  return null;
};
