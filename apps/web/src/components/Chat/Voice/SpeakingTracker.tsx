import React, { useEffect } from 'react';
import { useParticipants } from '@livekit/components-react';

interface SpeakingTrackerProps {
  onSpeakingChange: (speakingUsers: Set<string>) => void;
}

export const SpeakingTracker: React.FC<SpeakingTrackerProps> = ({ onSpeakingChange }) => {
  const participants = useParticipants();

  useEffect(() => {
    const speaking = new Set<string>();
    participants.forEach((p) => {
      // LiveKit identity is usually the userId we set
      if (p.isSpeaking) {
        speaking.add(p.identity);
      }
    });
    onSpeakingChange(speaking);
  }, [participants, onSpeakingChange]);

  return null;
};
