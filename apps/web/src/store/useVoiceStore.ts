import { create } from "zustand";

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

interface VoiceState {
  livekitToken: string | null;
  connectedChannelId: string | null;
  status: CallStatus;
  partner: { id: string, username: string, avatarUrl?: string } | null;
  callId: string | null;
  isDisconnecting: boolean;
  startTime: number | null;
  isPartnerSpeaking: boolean;

  // Actions
  setToken: (token: string | null) => void;
  setConnectedChannel: (id: string | null) => void;
  setIsDisconnecting: (val: boolean) => void;
  setStatus: (status: CallStatus) => void;
  setCallData: (data: Partial<Pick<VoiceState, 'callId' | 'partner' | 'startTime'>>) => void;
  setPartnerSpeaking: (isSpeaking: boolean) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  livekitToken: null,
  connectedChannelId: null,
  isDisconnecting: false,
  status: "idle",
  partner: null,
  callId: null,
  startTime: null,
  isPartnerSpeaking: false,

  setToken: (livekitToken) => set({ livekitToken }),
  setConnectedChannel: (connectedChannelId) => set({ connectedChannelId }),
  setIsDisconnecting: (isDisconnecting) => set({ isDisconnecting }),
  setStatus: (status) => set({ status }),
  setCallData: (data) => set((state) => ({ ...state, ...data })),
  setPartnerSpeaking: (isPartnerSpeaking) => set({ isPartnerSpeaking }),
  reset: () => {
    set({
      livekitToken: null,
      connectedChannelId: null,
      isDisconnecting: false,
      status: "idle",
      partner: null,
      callId: null,
      startTime: null,
      isPartnerSpeaking: false
    });
  },
}));
