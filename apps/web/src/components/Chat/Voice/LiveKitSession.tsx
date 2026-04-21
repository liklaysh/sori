import React, { useEffect, useRef } from "react";
import {
  LayoutContextProvider,
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useRemoteParticipants,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { LIVEKIT_URL } from "../../../config";
import { ChatItem, User } from "../../../types/chat";
import { useVoiceStore } from "../../../store/useVoiceStore";
import { MessageList } from "../MessageList";
import { ParticipantsVolumeManager } from "./ParticipantsVolumeManager";
import { SoriVoiceRoom } from "./SoriVoiceRoom";
import { StreamingTracker } from "./StreamingTracker";

interface LiveKitSessionProps {
  socket: any;
  livekitToken: string;
  connectedChannelId: string | null;
  activeChannelId: string | null;
  callId: string | null;
  partner: { id: string; username: string; avatarUrl?: string } | null;
  status: string;
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

export default function LiveKitSession(props: LiveKitSessionProps) {
  const filteredMessages = props.searchQuery
    ? props.messages.filter((message) => "content" in message && message.content?.toLowerCase().includes(props.searchQuery.toLowerCase()))
    : props.messages;

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={props.livekitToken}
      serverUrl={LIVEKIT_URL}
      connect={true}
      onConnected={props.onConnected}
      onDisconnected={props.onDisconnected}
      className="flex-1 flex"
    >
      <VoiceSessionManager
        callId={props.callId}
        partner={props.partner}
        connectedChannelId={props.connectedChannelId}
        status={props.status}
        onPeerGone={props.onPeerGone}
      />
      <StreamingTracker socket={props.socket} channelId={props.connectedChannelId ?? undefined} />
      <ParticipantsVolumeManager volumes={{}} />
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
              startTime={null}
              micDevices={props.micDevices}
              activeMicId={props.activeMicId}
              setActiveMic={props.setActiveMic}
              outputDevices={props.outputDevices}
              activeOutputId={props.activeOutputId}
              setActiveOutput={props.setActiveOutput}
              setMicGain={props.setMicGain}
              setOutputVolume={props.setOutputVolume}
            />
            <RoomAudioRenderer volume={props.outputVolume / 100} />
          </LayoutContextProvider>
        </div>
      ) : (
        <MessageList
          messages={filteredMessages}
          onMessageContextMenu={() => {}}
          isLoadingMessages={false}
          scrollRef={props.scrollRef}
          handleScroll={() => {}}
          showScrollButton={props.showScrollButton}
          scrollToBottom={props.scrollToBottom}
          onLoadMore={props.onLoadMore}
          onForward={() => {}}
        />
      )}
    </LiveKitRoom>
  );
}
