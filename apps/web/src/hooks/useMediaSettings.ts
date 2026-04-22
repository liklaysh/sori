import { useState, useEffect, useRef } from "react";
import api from "../lib/api";
import { User } from "../types/chat";
import { useUserStore } from "../store/useUserStore";
import { useBrowserMediaDevices } from "./useBrowserMediaDevices";

interface UseMediaSettingsProps {
  initialUser: User;
}

export const useMediaSettings = ({ initialUser }: UseMediaSettingsProps) => {
  const { setUser } = useUserStore();
  const [currentUser, setCurrentUser] = useState<User>(initialUser);

  // 1. Noise Suppression
  const [noiseSuppression, setNoiseSuppression] = useState(() => {
    return !!initialUser?.noiseSuppression;
  });

  const toggleNoiseSuppression = async () => {
    const newState = !noiseSuppression;
    setNoiseSuppression(newState);
    
    try {
      const res = await api.patch("/users/me", {
        noiseSuppression: newState
      });
      const updatedUser = res.data as User;
      setCurrentUser(updatedUser);
      setUser(updatedUser);
    } catch (err) {
      console.error("[MediaSettings] Noise sync failed:", err);
    }
  };

  // 2. Volumes
  const [micGain, setMicGain] = useState(() => initialUser?.micGain ?? 100);
  const [outputVolume, setOutputVolume] = useState(() => initialUser?.outputVolume ?? 100);

  // Sync volumes to backend (Debounced)
  const lastSyncedRef = useRef({ micGain, outputVolume });

  useEffect(() => {
    const nextNoiseSuppression = !!initialUser?.noiseSuppression;
    const nextMicGain = initialUser?.micGain ?? 100;
    const nextOutputVolume = initialUser?.outputVolume ?? 100;

    setCurrentUser(initialUser);
    setNoiseSuppression((prev) => (prev === nextNoiseSuppression ? prev : nextNoiseSuppression));
    setMicGain((prev) => (prev === nextMicGain ? prev : nextMicGain));
    setOutputVolume((prev) => (prev === nextOutputVolume ? prev : nextOutputVolume));
    lastSyncedRef.current = { micGain: nextMicGain, outputVolume: nextOutputVolume };
  }, [
    initialUser?.id,
    initialUser?.username,
    initialUser?.avatarUrl,
    initialUser?.noiseSuppression,
    initialUser?.micGain,
    initialUser?.outputVolume,
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
    toggleNoiseSuppression,
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
