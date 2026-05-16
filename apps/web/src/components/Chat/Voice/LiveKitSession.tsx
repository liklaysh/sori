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
import { ConnectionState, RoomEvent } from "livekit-client";
import { Track, LocalAudioTrack } from "livekit-client";
import { LIVEKIT_URL } from "../../../config";
import { ChatItem, User } from "../../../types/chat";
import { useUIStore } from "../../../store/useUIStore";
import { useVoiceStore } from "../../../store/useVoiceStore";
import { ParticipantsVolumeManager } from "./ParticipantsVolumeManager";
import { SoriVoiceRoom } from "./SoriVoiceRoom";
import { StreamingTracker } from "./StreamingTracker";
import { CallTelemetryReporter } from "./CallTelemetryReporter";
import { WebNoiseSuppressionMode, getLiveKitAudioCaptureOptions } from "../../../utils/noiseSuppressionModes";
import { emitVoiceLifecycle } from "../../../utils/voiceLifecycleTelemetry";

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
  effectiveNoiseSuppressionMode: WebNoiseSuppressionMode;
  setNoiseSuppressionMode: (mode: WebNoiseSuppressionMode) => void;
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

const LiveKitLifecycleReporter: React.FC<{
  socket: any;
  callId: string | null;
  channelId: string | null;
  voiceSessionId: string;
}> = ({ socket, callId, channelId, voiceSessionId }) => {
  const room = useRoomContext();

  useEffect(() => {
    const report = (event: string, reason?: string | null, severity: "info" | "warn" | "error" = "info") => {
      emitVoiceLifecycle(socket, {
        event,
        reason,
        severity,
        callId,
        channelId,
        voiceSessionId,
        details: { roomState: room.state },
      });
    };

    report("livekit_room_mounted", "component_mount");

    const onReconnecting = () => report("livekit_reconnecting", "room_event", "warn");
    const onReconnected = () => report("livekit_reconnected", "room_event");
    const onDisconnected = (reason?: unknown) => report("livekit_disconnected", typeof reason === "string" ? reason : "room_event", "warn");

    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);

    return () => {
      report("livekit_room_unmounted", "component_cleanup");
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [callId, channelId, room, socket, voiceSessionId]);

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

const LiveKitAudioSync: React.FC<{
  socket: any;
  channelId: string | null;
  callId: string | null;
  voiceSessionId: string;
  activeMicId?: string;
  noiseSuppressionMode: WebNoiseSuppressionMode;
}> = ({ socket, channelId, callId, voiceSessionId, activeMicId, noiseSuppressionMode }) => {
  const { localParticipant } = useLocalParticipant();
  const isMuted = useUIStore((state) => state.isMuted);

  useEffect(() => {
    const audioOptions = {
      ...getLiveKitAudioCaptureOptions(noiseSuppressionMode),
      deviceId: activeMicId && activeMicId !== "default" ? activeMicId : undefined,
    };

    localParticipant.setMicrophoneEnabled(!isMuted, audioOptions).catch((error) => {
      if (isMuted) {
        return;
      }
      emitVoiceLifecycle(socket, {
        event: "audio_track_publish_failed",
        reason: error instanceof Error ? error.message : "unknown",
        severity: "error",
        channelId,
        callId,
        voiceSessionId,
        details: { activeMicId, noiseSuppressionMode },
      });
    });
  }, [activeMicId, callId, channelId, isMuted, localParticipant, noiseSuppressionMode, socket, voiceSessionId]);

  useEffect(() => {
    let isCancelled = false;

    const applyProcessor = async () => {
      const audioPub = localParticipant.getTrackPublication(Track.Source.Microphone);
      if (!audioPub?.audioTrack || !(audioPub.audioTrack instanceof LocalAudioTrack)) {
        return;
      }

      const { applyNoiseSuppressionMode } = await import("../../../utils/noise-processor");
      if (isCancelled) {
        return;
      }

      const processorDiagnostics = await applyNoiseSuppressionMode(audioPub.audioTrack, noiseSuppressionMode);
      const gateDiagnostics = "gate" in processorDiagnostics ? processorDiagnostics.gate : null;
      emitVoiceLifecycle(socket, {
        event: "audio_processor_applied",
        reason: "publish_track_processor",
        channelId,
        callId,
        voiceSessionId,
        details: {
          mode: noiseSuppressionMode,
          gateEnabled: Boolean(processorDiagnostics.gateEnabled),
          hasProcessedTrack: Boolean(processorDiagnostics.hasProcessedTrack),
          thresholdDb: gateDiagnostics?.thresholdDb,
          floorGain: gateDiagnostics?.floorGain,
        },
      });
    };

    applyProcessor().catch((err) => {
      emitVoiceLifecycle(socket, {
        event: "noise_processor_failed",
        reason: err instanceof Error ? err.message : "unknown",
        severity: "warn",
        channelId,
        callId,
        voiceSessionId,
        details: { noiseSuppressionMode },
      });
      console.error("[NoiseSuppression] Failed to apply:", err);
    });

    return () => {
      isCancelled = true;
    };
  }, [callId, channelId, localParticipant, noiseSuppressionMode, socket, voiceSessionId]);

  return null;
};

export default function LiveKitSession(props: LiveKitSessionProps) {
  const participantVolumes = useUIStore((state) => state.participantVolumes);
  const voiceSessionIdRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  useEffect(() => {
    emitVoiceLifecycle(props.socket, {
      event: "voice_session_rendered",
      reason: props.connectedChannelId ? "voice_channel" : "direct_call",
      channelId: props.connectedChannelId,
      callId: props.callId,
      voiceSessionId: voiceSessionIdRef.current,
    });
  }, [props.callId, props.connectedChannelId, props.socket]);

  return (
    <LiveKitRoom
      video={false}
      audio={getLiveKitAudioCaptureOptions(props.effectiveNoiseSuppressionMode)}
      options={{ webAudioMix: true }}
      token={props.livekitToken}
      serverUrl={LIVEKIT_URL}
      connect={true}
      onConnected={() => {
        emitVoiceLifecycle(props.socket, {
          event: "livekit_connected",
          reason: "room_callback",
          channelId: props.connectedChannelId,
          callId: props.callId,
          voiceSessionId: voiceSessionIdRef.current,
        });
        props.onConnected();
      }}
      onDisconnected={() => {
        emitVoiceLifecycle(props.socket, {
          event: "livekit_disconnected",
          reason: "room_callback",
          severity: "warn",
          channelId: props.connectedChannelId,
          callId: props.callId,
          voiceSessionId: voiceSessionIdRef.current,
        });
        props.onDisconnected();
      }}
      className={props.showFullVoiceUI
        ? "absolute inset-0 z-20 flex bg-sori-surface-main"
        : "absolute left-[-10000px] top-0 h-px w-px overflow-hidden opacity-0 pointer-events-none"
      }
    >
      <LiveKitLifecycleReporter
        socket={props.socket}
        callId={props.callId}
        channelId={props.connectedChannelId}
        voiceSessionId={voiceSessionIdRef.current}
      />
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
      <LiveKitAudioSync
        socket={props.socket}
        channelId={props.connectedChannelId}
        callId={props.callId}
        voiceSessionId={voiceSessionIdRef.current}
        activeMicId={props.activeMicId}
        noiseSuppressionMode={props.effectiveNoiseSuppressionMode}
      />
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
              effectiveNoiseSuppressionMode={props.effectiveNoiseSuppressionMode}
              setNoiseSuppressionMode={props.setNoiseSuppressionMode}
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
