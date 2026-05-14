import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import api from "../lib/api";
import { User } from "../types/chat";
import { useUserStore } from "../store/useUserStore";
import { useBrowserMediaDevices } from "./useBrowserMediaDevices";
import {
  NoiseSuppressionMode,
  WebNoiseSuppressionMode,
  isNoiseSuppressionMode,
  isWebNoiseSuppressionMode,
  resolveWebNoiseSuppressionMode,
} from "../utils/noiseSuppressionModes";

interface UseMediaSettingsProps {
  initialUser: User;
}

export const useMediaSettings = ({ initialUser }: UseMediaSettingsProps) => {
  const { t } = useTranslation(["voice"]);
  const { setUser } = useUserStore();
  const [currentUser, setCurrentUser] = useState<User>(initialUser);
  const unsupportedModeNoticeRef = useRef<string | null>(null);

  const resolveInitialNoiseMode = (user?: User): NoiseSuppressionMode => {
    if (isNoiseSuppressionMode(user?.noiseSuppressionMode)) {
      return user.noiseSuppressionMode;
    }

    return user?.noiseSuppression ? "rnnoise" : "webrtc_basic";
  };

  const resolveInitialWebFallbackMode = (user?: User): WebNoiseSuppressionMode | null => {
    if (isWebNoiseSuppressionMode(user?.webNoiseSuppressionFallbackMode)) {
      return user.webNoiseSuppressionFallbackMode;
    }

    return user?.noiseSuppression ? "rnnoise" : null;
  };

  // 1. Noise Suppression
  const [noiseSuppressionMode, setNoiseSuppressionModeState] = useState<NoiseSuppressionMode>(() => {
    return resolveInitialNoiseMode(initialUser);
  });
  const [webNoiseSuppressionFallbackMode, setWebNoiseSuppressionFallbackMode] = useState<WebNoiseSuppressionMode | null>(() => {
    return resolveInitialWebFallbackMode(initialUser);
  });

  const effectiveNoiseSuppressionMode = resolveWebNoiseSuppressionMode(
    noiseSuppressionMode,
    webNoiseSuppressionFallbackMode,
  );
  const noiseSuppression = effectiveNoiseSuppressionMode === "rnnoise";

  const toggleNoiseSuppression = async () => {
    await setNoiseSuppressionMode(noiseSuppression ? "webrtc_basic" : "rnnoise");
  };

  const setNoiseSuppressionMode = async (mode: WebNoiseSuppressionMode) => {
    const previousMode = noiseSuppressionMode;
    const previousFallbackMode = webNoiseSuppressionFallbackMode;
    setNoiseSuppressionModeState(mode);
    setWebNoiseSuppressionFallbackMode(mode);
    
    try {
      const res = await api.patch("/users/me", {
        noiseSuppressionMode: mode,
        webNoiseSuppressionFallbackMode: mode,
      });
      const updatedUser = res.data as User;
      setCurrentUser(updatedUser);
      setUser(updatedUser);
      setNoiseSuppressionModeState(resolveInitialNoiseMode(updatedUser));
      setWebNoiseSuppressionFallbackMode(resolveInitialWebFallbackMode(updatedUser));
      toast.success(t("voice:noiseSuppressionChanged"));
    } catch (err) {
      setNoiseSuppressionModeState(previousMode);
      setWebNoiseSuppressionFallbackMode(previousFallbackMode);
      console.error("[MediaSettings] Noise sync failed:", err);
    }
  };

  // 2. Volumes
  const [micGain, setMicGain] = useState(() => initialUser?.micGain ?? 100);
  const [outputVolume, setOutputVolume] = useState(() => initialUser?.outputVolume ?? 100);

  // Sync volumes to backend (Debounced)
  const lastSyncedRef = useRef({ micGain, outputVolume });

  useEffect(() => {
    const nextNoiseSuppressionMode = resolveInitialNoiseMode(initialUser);
    const nextWebFallbackMode = resolveInitialWebFallbackMode(initialUser);
    const nextMicGain = initialUser?.micGain ?? 100;
    const nextOutputVolume = initialUser?.outputVolume ?? 100;

    setCurrentUser(initialUser);
    setNoiseSuppressionModeState((prev) => (prev === nextNoiseSuppressionMode ? prev : nextNoiseSuppressionMode));
    setWebNoiseSuppressionFallbackMode((prev) => (prev === nextWebFallbackMode ? prev : nextWebFallbackMode));
    setMicGain((prev) => (prev === nextMicGain ? prev : nextMicGain));
    setOutputVolume((prev) => (prev === nextOutputVolume ? prev : nextOutputVolume));
    lastSyncedRef.current = { micGain: nextMicGain, outputVolume: nextOutputVolume };

    if (
      nextNoiseSuppressionMode === "experimental_ai"
      && unsupportedModeNoticeRef.current !== `${initialUser?.id}:experimental_ai`
    ) {
      unsupportedModeNoticeRef.current = `${initialUser?.id}:experimental_ai`;
      toast.message(t("voice:experimentalAiDesktopOnly"));
    }
  }, [
    initialUser?.id,
    initialUser?.username,
    initialUser?.avatarUrl,
    initialUser?.noiseSuppression,
    initialUser?.noiseSuppressionMode,
    initialUser?.webNoiseSuppressionFallbackMode,
    initialUser?.micGain,
    initialUser?.outputVolume,
    t,
  ]);

  useEffect(() => {
    if (micGain === lastSyncedRef.current.micGain && outputVolume === lastSyncedRef.current.outputVolume) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const res = await api.patch("/users/me", {
          micGain,
          outputVolume
        });
        const updatedUser = res.data as User;
        setCurrentUser(updatedUser);
        setUser(updatedUser);
        lastSyncedRef.current = { micGain, outputVolume };
      } catch (err) {
        console.error("[MediaSettings] Volume sync failed:", err);
      }
    }, 1500); 
    
    return () => clearTimeout(timeoutId);
  }, [micGain, outputVolume, setUser]);

  // 3. Devices
  const {
    devices: micDevices,
    activeDeviceId: activeMicId,
    setActiveMediaDevice: setActiveMic,
  } = useBrowserMediaDevices({
    kind: "audioinput",
    storageKey: "sori_active_mic",
  });

  const {
    devices: outputDevices,
    activeDeviceId: activeOutputId,
    setActiveMediaDevice: setActiveOutput,
  } = useBrowserMediaDevices({
    kind: "audiooutput",
    storageKey: "sori_active_output",
  });

  return {
    noiseSuppression,
    noiseSuppressionMode,
    effectiveNoiseSuppressionMode,
    webNoiseSuppressionFallbackMode,
    toggleNoiseSuppression,
    setNoiseSuppressionMode,
    micGain,
    setMicGain,
    outputVolume,
    setOutputVolume,
    micDevices,
    activeMicId,
    setActiveMic,
    outputDevices,
    activeOutputId,
    setActiveOutput,
    currentUser,
    setCurrentUser
  };
};
