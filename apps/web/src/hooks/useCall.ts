import { useEffect, useCallback, useRef, useMemo, useReducer } from "react";
import { Socket } from "socket.io-client";
import api from "../lib/api";
import { toast } from "sonner";
import { User } from "../types/chat";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

interface CallState {
  callId: string | null;
  status: CallStatus;
  partner: { id: string, username: string, avatarUrl?: string } | null;
  livekitToken: string | null;
  startTime: number | null;
}

type CallAction = 
  | { type: 'INITIATE', partner: { id: string, username: string, avatarUrl?: string } }
  | { type: 'SET_CALL_ID', callId: string }
  | { type: 'INCOMING', callId: string, partner: { id: string, username: string, avatarUrl?: string } }
  | { type: 'CONNECTED', token: string, startTime: number }
  | { type: 'RESET' };

const initialState: CallState = {
  callId: null,
  status: 'idle',
  partner: null,
  livekitToken: null,
  startTime: null,
};

function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case 'INITIATE':
      return { ...state, status: 'calling', partner: action.partner };
    case 'SET_CALL_ID':
      return { ...state, callId: action.callId };
    case 'INCOMING':
      return { ...state, status: 'ringing', callId: action.callId, partner: action.partner };
    case 'CONNECTED':
      return { ...state, status: 'connected', livekitToken: action.token, startTime: action.startTime };
    case 'RESET':
      if (state.status === 'idle' && state.callId === null) return state;
      return initialState;
    default:
      return state;
  }
}

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
  const [state, dispatch] = useReducer(callReducer, initialState);
  
  // Keep refs for latest values needed in socket listeners to avoid effect re-binds
  const stateRef = useRef(state);
  const propsRef = useRef({ socket });

  useEffect(() => { 
    stateRef.current = state;
    propsRef.current = { socket };
  }, [state, socket]);

  const resetCall = useCallback(() => {
    // Break the call stack to prevent recursion
    setTimeout(() => {
      dispatch({ type: 'RESET' });
    }, 0);
  }, []);

  const initiateCall = useCallback((targetUser: CallerData) => {
    if (!socket || stateRef.current.status !== "idle") return;
    dispatch({ type: 'INITIATE', partner: targetUser });
    socket.emit("direct_call_initiate", { targetUserId: targetUser.id });
  }, [socket]);

  const acceptCall = useCallback(() => {
    const { callId } = stateRef.current;
    if (!socket || !callId) return;
    socket.emit("direct_call_accept", { callId });
  }, [socket]);

  const rejectCall = useCallback(() => {
    const { callId } = stateRef.current;
    if (socket && callId) {
      socket.emit("direct_call_reject", { callId });
    }
    resetCall();
  }, [socket, resetCall]);

  const endCall = useCallback((metrics?: CallMetrics) => {
    const { callId } = stateRef.current;
    if (socket && callId) {
      // Ensure we don't pass React events or non-plain objects as metrics
      const cleanMetrics = (metrics && typeof metrics === 'object' && !(metrics instanceof Event) && !('nativeEvent' in metrics)) 
        ? metrics 
        : undefined;
        
      socket.emit("direct_call_end", { callId, metrics: cleanMetrics });
    }
    resetCall();
  }, [socket, resetCall]);

  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data: { callId: string, caller: CallerData }) => {
      if (stateRef.current.status !== "idle") {
        socket.emit("direct_call_reject", { callId: data.callId });
        return;
      }
      dispatch({ type: 'INCOMING', callId: data.callId, partner: data.caller });
    };

    const handleStarted = (data: { callId: string }) => {
      dispatch({ type: 'SET_CALL_ID', callId: data.callId });
    };

    const handleAccepted = async (data: { callId: string }) => {
      try {
        const res = await api.post("/calls/token", { callId: data.callId });
        dispatch({ type: 'CONNECTED', token: res.data.token, startTime: res.data.startedAt });
      } catch (err) {
        console.error("Failed to get direct call token", err);
        endCall();
      }
    };

    const safeReset = () => resetCall();

    socket.on("incoming_call", handleIncoming);
    socket.on("outgoing_call_started", handleStarted);
    socket.on("call_accepted", handleAccepted);
    socket.on("call_rejected", safeReset);
    socket.on("call_ended", safeReset);
    socket.on("call_missed", safeReset);
    socket.on("call_timed_out", safeReset);
    socket.on("direct_call_error", (data: { message: string }) => {
      toast.error(data.message);
      safeReset();
    });
    socket.on("disconnect", safeReset);

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
  }, [socket, endCall, resetCall]);

  return useMemo(() => ({
    ...state,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall
  }), [state, initiateCall, acceptCall, rejectCall, endCall]);
}
