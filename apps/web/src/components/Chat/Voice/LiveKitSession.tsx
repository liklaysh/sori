import React, { useEffect, useRef } from "react";
import {
  LayoutContextProvider,
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { LIVEKIT_URL } from "../../../config";
import { ChatItem, User } from "../../../types/chat";
import { useUIStore } from "../../../store/useUIStore";
import { useVoiceStore } from "../../../store/useVoiceStore";
import { ParticipantsVolumeManager } from "./ParticipantsVolumeManager";
import { SoriVoiceRoom } from "./SoriVoiceRoom";
import { StreamingTracker } from "./StreamingTracker";
import { CallTelemetryReporter } from "./CallTelemetryReporter";

interface LiveKitSessionProps {
  socket: any;
  livekitToken: string;
  connectedChannelId: string | null;
  activeChannelId: string | null;
  callId: string | null;
  partner: { id: string; username: string; avatarUrl?: string } | null;
  status: string;
  startTime: number | null;
  showFullVoiceUI: boolean;
  activeModule: "community" | "dm";
  currentChannelName?: string;
  isInternalChatOpen: boolean;
  setIsInternalChatOpen: (open: boolean) => void;
  messages: ChatItem[];
  inputValue: string;
  setInputValue: (value: string) => void;
  onSendMessage: (e: React.FormEvent, attachments?: any[]) => void;
  onLoadMore?: () => Promise<void>;
  searchQuery: string;
  scrollRef: React.RefObject<HTMLDivElement>;
  showScrollButton: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  user: User;
  outputVolume: number;
  micGain: number;
  noiseSuppression: boolean;
  toggleNoiseSuppression: () => void;
  micDevices: MediaDeviceInfo[];
  activeMicId?: string;
  setActiveMic: (id: string) => void;
  outputDevices: MediaDeviceInfo[];
  activeOutputId?: string;
  setActiveOutput: (id: string) => void;
  setMicGain: (gain: number) => void;
  setOutputVolume: (volume: number) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onLeave: () => void;
  onPeerGone: () => void;
}

const VoiceSessionManager: React.FC<{
  callId: string | null;
  partner: { id: string; username: string; avatarUrl?: string } | null;
  connectedChannelId: string | null;
  status: string;
  onPeerGone: () => void;
}> = ({ callId, partner, connectedChannelId, status, onPeerGone }) => {
  const remoteParticipants = useRemoteParticipants();
  const connectionState = useConnectionState();
  const hadParticipants = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const isDMCall = !!callId && !!partner && !connectedChannelId;

  useEffect(() => {
    if (remoteParticipants.length > 0 && !hadParticipants.current) {
      hadParticipants.current = true;
    }
  }, [remoteParticipants.length]);

  useEffect(() => {
    const clearTimer = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    if (!isDMCall || status !== "connected" || connectionState !== ConnectionState.Connected) {
      clearTimer();
      return;
    }

    if (hadParticipants.current && remoteParticipants.length === 0) {
      if (!timeoutRef.current) {
        timeoutRef.current = window.setTimeout(() => {
          const currentStatus = useVoiceStore.getState().status;
          if (currentStatus === "connected") {
            onPeerGone();
          }
          timeoutRef.current = null;
        }, 2000);
      }
    } else {
      clearTimer();
    }

    return clearTimer;
  }, [connectionState, isDMCall, onPeerGone, remoteParticipants.length, status]);

  return null;
};

const LiveKitMediaDeviceSync: React.FC<{
  activeMicId?: string;
  activeOutputId?: string;
}> = ({ activeMicId, activeOutputId }) => {
  const room = useRoomContext();

  useEffect(() => {
    if (!activeMicId) {
      return;
    }

    room.switchActiveDevice("audioinput", activeMicId).catch(() => {});
  }, [activeMicId, room]);

  useEffect(() => {
    if (!activeOutputId) {
      return;
    }

    room.switchActiveDevice("audiooutput", activeOutputId).catch(() => {});
  }, [activeOutputId, room]);

  return null;
};

const LiveKitMuteSync: React.FC = () => {
  const { localParticipant } = useLocalParticipant();
  const isMuted = useUIStore((state) => state.isMuted);

  useEffect(() => {
    localParticipant.setMicrophoneEnabled(!isMuted).catch(() => {});
  }, [isMuted, localParticipant]);

  return null;
};

export default function LiveKitSession(props: LiveKitSessionProps) {
  const participantVolumes = useUIStore((state) => state.participantVolumes);

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      options={{ webAudioMix: true }}
      token={props.livekitToken}
      serverUrl={LIVEKIT_URL}
      connect={true}
      onConnected={props.onConnected}
      onDisconnected={props.onDisconnected}
      className={props.showFullVoiceUI
        ? "absolute inset-0 z-20 flex bg-sori-surface-main"
        : "absolute left-[-10000px] top-0 h-px w-px overflow-hidden opacity-0 pointer-events-none"
      }
    >
      <VoiceSessionManager
        callId={props.callId}
        partner={props.partner}
        connectedChannelId={props.connectedChannelId}
        status={props.status}
        onPeerGone={props.onPeerGone}
      />
      <LiveKitMediaDeviceSync
        activeMicId={props.activeMicId}
        activeOutputId={props.activeOutputId}
      />
      <LiveKitMuteSync />
      <StreamingTracker socket={props.socket} channelId={props.connectedChannelId ?? undefined} />
      <CallTelemetryReporter
        socket={props.socket}
        callId={props.callId}
        channelId={props.connectedChannelId ?? props.activeChannelId}
      />
      <ParticipantsVolumeManager volumes={participantVolumes} />
      <RoomAudioRenderer volume={props.outputVolume / 100} />
      {props.showFullVoiceUI ? (
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <LayoutContextProvider>
            <SoriVoiceRoom
              onLeave={props.onLeave}
              socket={props.socket}
              channelId={props.connectedChannelId ?? props.activeChannelId}
              messages={props.messages}
              inputValue={props.inputValue}
              onInputChange={(event) => props.setInputValue(event.target.value)}
              onSendMessage={props.onSendMessage}
              user={props.user}
              outputVolume={props.outputVolume}
              micGain={props.micGain}
              participantVolumes={{}}
              noiseSuppression={props.noiseSuppression}
              toggleNoiseSuppression={props.toggleNoiseSuppression}
              isChatOpen={props.isInternalChatOpen}
              setIsChatOpen={props.setIsInternalChatOpen}
              channelName={props.activeModule === "dm" ? (props.partner?.username || "Direct Call") : (props.currentChannelName || "Voice Channel")}
              startTime={props.startTime}
              micDevices={props.micDevices}
              activeMicId={props.activeMicId}
              setActiveMic={props.setActiveMic}
              outputDevices={props.outputDevices}
              activeOutputId={props.activeOutputId}
              setActiveOutput={props.setActiveOutput}
              setMicGain={props.setMicGain}
              setOutputVolume={props.setOutputVolume}
            />
          </LayoutContextProvider>
        </div>
      ) : (
        <div aria-hidden="true" />
      )}
    </LiveKitRoom>
  );
}
