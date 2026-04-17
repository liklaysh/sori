import { create } from "zustand";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

interface VoiceState {
  livekitToken: string | null;
  connectedChannelId: string | null;
  status: CallStatus;
  partner: { id: string, username: string, avatarUrl?: string } | null;
  callId: string | null;
  startTime: number | null;

  // Actions
  setToken: (token: string | null) => void;
  setConnectedChannel: (id: string | null) => void;
  setStatus: (status: CallStatus) => void;
  setCallData: (data: Partial<Pick<VoiceState, 'callId' | 'partner' | 'startTime'>>) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  livekitToken: null,
  connectedChannelId: null,
  status: "idle",
  partner: null,
  callId: null,
  startTime: null,

  setToken: (livekitToken) => set({ livekitToken }),
  setConnectedChannel: (connectedChannelId) => set({ connectedChannelId }),
  setStatus: (status) => set({ status }),
  setCallData: (data) => set((state) => ({ ...state, ...data })),
  reset: () => set({
    livekitToken: null,
    connectedChannelId: null,
    status: "idle",
    partner: null,
    callId: null,
    startTime: null
  }),
}));
