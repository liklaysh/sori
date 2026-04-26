import { useEffect, useCallback, useMemo, useRef } from "react";
import { Socket } from "socket.io-client";
import api from "../lib/api";
import { toast } from "sonner";
import { useVoiceStore } from "../store/useVoiceStore";
import { startNotificationSoundLoop, stopNotificationSoundLoop } from "../utils/notificationSounds";
import i18n from "../i18n";

interface CallMetrics {
  duration?: number;
  packetsLost?: number;
  jitter?: number;
  [key: string]: any;
}

interface CallerData {
  id: string;
  username: string;
  avatarUrl?: string;
}

interface UseCallProps {
  socket: Socket | null;
}

export function useCall({ socket }: UseCallProps) {
  const { 
    livekitToken, connectedChannelId, status, partner, callId, startTime,
    isDisconnecting, setIsDisconnecting, isPartnerSpeaking,
    setToken, setConnectedChannel, setStatus, setCallData, setPartnerSpeaking, reset 
  } = useVoiceStore();
  const socketRef = useRef(socket);
  const callIdRef = useRef(callId);
  const connectedChannelIdRef = useRef(connectedChannelId);
  const statusRef = useRef(status);
  const notifiedIncomingCallIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { callIdRef.current = callId; }, [callId]);
  useEffect(() => { connectedChannelIdRef.current = connectedChannelId; }, [connectedChannelId]);
  useEffect(() => { statusRef.current = status; }, [status]);

  const initiateCall = useCallback((targetUser: CallerData) => {
    if (!socket || status !== "idle") {
      return;
    }
    setStatus("calling");
    setCallData({ partner: targetUser });
    socket.emit("direct_call_initiate", { targetUserId: targetUser.id });
  }, [socket, status, setStatus, setCallData]);

  const acceptCall = useCallback(() => {
    if (!socket || !callId) return;
    stopNotificationSoundLoop("directCall");
    socket.emit("direct_call_accept", { callId });
  }, [socket, callId]);

  const rejectCall = useCallback(() => {
    stopNotificationSoundLoop("directCall");
    if (callId) {
      notifiedIncomingCallIdsRef.current.delete(callId);
    }
    if (socket && callId) {
      socket.emit("direct_call_reject", { callId });
    }
    reset();
  }, [socket, callId, reset]);

  const endCall = useCallback((metrics?: CallMetrics) => {
    stopNotificationSoundLoop("directCall");
    if (callId) {
      notifiedIncomingCallIdsRef.current.delete(callId);
    }
    if (socket && callId) {
      const cleanMetrics = (metrics && typeof metrics === 'object' && !(metrics instanceof Event) && !('nativeEvent' in metrics)) 
        ? metrics 
        : undefined;
        
      socket.emit("direct_call_end", { callId, metrics: cleanMetrics });
    }
    reset();
  }, [socket, callId, reset]);

  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data: { callId: string, caller: CallerData }) => {
      // Use useVoiceStore.getState() to get the freshest data in listeners without re-binding
      const currentStatus = useVoiceStore.getState().status;
      if (currentStatus !== "idle") {
        socket.emit("direct_call_reject", { callId: data.callId });
        return;
      }
      if (!notifiedIncomingCallIdsRef.current.has(data.callId)) {
        notifiedIncomingCallIdsRef.current.add(data.callId);
        startNotificationSoundLoop("directCall");
      }
      setStatus("ringing");
      setCallData({ callId: data.callId, partner: data.caller });
    };

    const handleStarted = (data: { callId: string }) => {
      setCallData({ callId: data.callId });
    };

    const handleAccepted = async (data: { callId: string }) => {
      try {
        const res = await api.post("/calls/token", { callId: data.callId });
        const tokenData = res.data as { token: string; startedAt: number };
        setToken(tokenData.token);
        setStatus("connected");
        setCallData({ startTime: tokenData.startedAt });
      } catch (err) {
        console.error("Failed to get direct call token", err);
        endCall();
      }
    };

    const safeReset = (_reason?: string) => {
      stopNotificationSoundLoop("directCall");
      const activeCallId = useVoiceStore.getState().callId;
      if (activeCallId) {
        notifiedIncomingCallIdsRef.current.delete(activeCallId);
      }
      reset();
    };

    const onCallRejected = () => safeReset("call_rejected");
    const onCallEnded = () => safeReset("call_ended");
    const onCallMissed = () => safeReset("call_missed");
    const onCallTimedOut = () => safeReset("call_timed_out");
    const onDisconnect = () => safeReset("socket_disconnect");

    const onDirectCallError = (data: { message: string }) => {
      toast.error(data.message);
      safeReset("direct_call_error");
    };

    const onUserSpeakingStatus = (data: { userId: string, isSpeaking: boolean }) => {
      const currentPartner = useVoiceStore.getState().partner;
      if (currentPartner && data.userId === currentPartner.id) {
        setPartnerSpeaking(data.isSpeaking);
      }
    };

    socket.on("incoming_call", handleIncoming);
    socket.on("outgoing_call_started", handleStarted);
    socket.on("call_accepted", handleAccepted);
    socket.on("call_rejected", onCallRejected);
    socket.on("call_ended", onCallEnded);
    socket.on("call_missed", onCallMissed);
    socket.on("call_timed_out", onCallTimedOut);
    socket.on("direct_call_error", onDirectCallError);
    socket.on("disconnect", onDisconnect);
    socket.on("user_speaking_status", onUserSpeakingStatus);

    return () => {
      socket.off("incoming_call", handleIncoming);
      socket.off("outgoing_call_started", handleStarted);
      socket.off("call_accepted", handleAccepted);
      socket.off("call_rejected", onCallRejected);
      socket.off("call_ended", onCallEnded);
      socket.off("call_missed", onCallMissed);
      socket.off("call_timed_out", onCallTimedOut);
      socket.off("direct_call_error", onDirectCallError);
      socket.off("user_speaking_status", onUserSpeakingStatus);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket, setToken, setStatus, setCallData, endCall, reset]);

  const getChannelToken = useCallback(async (channelId: string) => {
    try {
      const res = await api.post("/calls/token", { channelId });
      const tokenData = res.data as { token: string; startedAt?: number };
      
      setToken(tokenData.token);
      setStatus("connected");
      setCallData({
        callId: null,
        partner: null,
        startTime: tokenData.startedAt || Date.now(),
      });
      setConnectedChannel(channelId);
      
      return tokenData.token;
    } catch (err) {
      console.error("❌ [useCall] getChannelToken failed:", err);
      toast.error(i18n.t("notifications:voice.connectFailed"));
      throw err;
    }
  }, [setToken, setStatus, setCallData, setConnectedChannel]);

  useEffect(() => {
    const handlePageHide = () => {
      const activeSocket = socketRef.current;
      if (!activeSocket) {
        return;
      }

      const activeChannelId = connectedChannelIdRef.current;
      const activeCallId = callIdRef.current;
      const currentStatus = statusRef.current;

      if (activeChannelId) {
        activeSocket.emit("leave_voice_channel", activeChannelId);
      }

      if (activeCallId && currentStatus !== "idle") {
        stopNotificationSoundLoop("directCall");
        activeSocket.emit("direct_call_end", { callId: activeCallId });
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  return useMemo(() => ({
    livekitToken,
    connectedChannelId,
    status,
    partner,
    callId,
    startTime,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    getChannelToken,
    resetCall: reset,
    setIsDisconnecting,
    isDisconnecting,
    isPartnerSpeaking
  }), [
    livekitToken, connectedChannelId, status, partner, callId, startTime,
    initiateCall, acceptCall, rejectCall, endCall, getChannelToken, reset, setIsDisconnecting, isDisconnecting, isPartnerSpeaking
  ]);
}
