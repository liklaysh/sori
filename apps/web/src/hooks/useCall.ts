import { useEffect, useCallback, useRef, useMemo } from "react";
import { Socket } from "socket.io-client";
import api from "../lib/api";
import { toast } from "sonner";
import { User } from "../types/chat";
import { useVoiceStore, CallStatus } from "../store/useVoiceStore";

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
  currentUser: User;
}

export function useCall({ socket, currentUser }: UseCallProps) {
  const { 
    livekitToken, connectedChannelId, status, partner, callId, startTime,
    setToken, setConnectedChannel, setStatus, setCallData, reset 
  } = useVoiceStore();
  
  // Keep refs for latest values needed in socket listeners to avoid effect re-binds
  const propsRef = useRef({ socket });

  useEffect(() => { 
    propsRef.current = { socket };
  }, [socket]);

  const initiateCall = useCallback((targetUser: CallerData) => {
    if (!socket || status !== "idle") return;
    setStatus("calling");
    setCallData({ partner: targetUser });
    socket.emit("direct_call_initiate", { targetUserId: targetUser.id });
  }, [socket, status, setStatus, setCallData]);

  const acceptCall = useCallback(() => {
    if (!socket || !callId) return;
    socket.emit("direct_call_accept", { callId });
  }, [socket, callId]);

  const rejectCall = useCallback(() => {
    if (socket && callId) {
      socket.emit("direct_call_reject", { callId });
    }
    reset();
  }, [socket, callId, reset]);

  const endCall = useCallback((metrics?: CallMetrics) => {
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

    const safeReset = (reason?: string) => {
      console.trace(`🧹 [useCall] reset triggered${reason ? ': ' + reason : ''}`);
      reset();
    };

    socket.on("incoming_call", handleIncoming);
    socket.on("outgoing_call_started", handleStarted);
    socket.on("call_accepted", handleAccepted);
    socket.on("call_rejected", () => safeReset("call_rejected"));
    socket.on("call_ended", () => safeReset("call_ended"));
    socket.on("call_missed", () => safeReset("call_missed"));
    socket.on("call_timed_out", () => safeReset("call_timed_out"));
    socket.on("direct_call_error", (data: { message: string }) => {
      console.error("❌ [useCall] direct_call_error:", data.message);
      toast.error(data.message);
      safeReset("direct_call_error");
    });
    socket.on("disconnect", () => safeReset("socket_disconnect"));

    return () => {
      socket.off("incoming_call", handleIncoming);
      socket.off("outgoing_call_started", handleStarted);
      socket.off("call_accepted", handleAccepted);
      socket.off("call_rejected", safeReset);
      socket.off("call_ended", safeReset);
      socket.off("call_missed", safeReset);
      socket.off("call_timed_out", safeReset);
      socket.off("direct_call_error");
      socket.off("disconnect", safeReset);
    };
  }, [socket, setToken, setStatus, setCallData, endCall, reset]);

  const getChannelToken = useCallback(async (channelId: string) => {
    console.log("📡 [useCall] getChannelToken starting for:", channelId);
    try {
      const res = await api.post("/calls/token", { channelId });
      const tokenData = res.data as { token: string; startedAt?: number };
      
      console.log("📡 [useCall] token received successfully");
      setToken(tokenData.token);
      setStatus("connected");
      setCallData({ startTime: tokenData.startedAt || Date.now() });
      setConnectedChannel(channelId);
      console.log("📡 [useCall] Zustand store updated: status=connected, channel=", channelId);
      
      return tokenData.token;
    } catch (err) {
      console.error("❌ [useCall] getChannelToken failed:", err);
      toast.error("Failed to connect to voice server");
      throw err;
    }
  }, [setToken, setStatus, setCallData, setConnectedChannel]);

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
    resetCall: reset
  }), [
    livekitToken, connectedChannelId, status, partner, callId, startTime,
    initiateCall, acceptCall, rejectCall, endCall, getChannelToken, reset
  ]);
}
