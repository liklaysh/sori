import { useEffect } from "react";
import { useParticipants } from "@livekit/components-react";
import { RemoteParticipant } from "livekit-client";

interface ParticipantsVolumeManagerProps {
  volumes: Record<string, number>;
}

export const ParticipantsVolumeManager: React.FC<ParticipantsVolumeManagerProps> = ({ volumes }) => {
  const participants = useParticipants();
  
  useEffect(() => {
    participants.forEach(p => {
      if (p instanceof RemoteParticipant && volumes[p.identity] !== undefined) {
        p.setVolume(volumes[p.identity] / 100);
      }
    });
  }, [participants, volumes]);
  
  return null;
};
