import { useState, useEffect, useRef } from "react";
import api from "../lib/api";
import { useMediaDeviceSelect } from "@livekit/components-react";
import { User } from "../types/chat";
import { useUserStore } from "../store/useUserStore";

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
  const { devices: micDevices, activeDeviceId: activeMicId, setActiveMediaDevice: setActiveMic } = useMediaDeviceSelect({ kind: 'audioinput' });
  const { devices: outputDevices, activeDeviceId: activeOutputId, setActiveMediaDevice: setActiveOutput } = useMediaDeviceSelect({ kind: 'audiooutput' });

  // Note: We still use localStorage for purely local browser-only device preferences (activeMicId/activeOutputId)
  useEffect(() => {
    if (activeMicId) localStorage.setItem("sori_active_mic", activeMicId);
  }, [activeMicId]);

  useEffect(() => {
    if (activeOutputId) localStorage.setItem("sori_active_output", activeOutputId);
  }, [activeOutputId]);

  useEffect(() => {
    const savedMic = localStorage.getItem("sori_active_mic");
    if (savedMic && micDevices.length > 0 && activeMicId !== savedMic) {
      if (micDevices.some(d => d.deviceId === savedMic)) {
        setActiveMic(savedMic);
      }
    }
  }, [micDevices, activeMicId, setActiveMic]);

  useEffect(() => {
    const savedOutput = localStorage.getItem("sori_active_output");
    if (savedOutput && outputDevices.length > 0 && activeOutputId !== savedOutput) {
      if (outputDevices.some(d => d.deviceId === savedOutput)) {
        setActiveOutput(savedOutput);
      }
    }
  }, [outputDevices, activeOutputId, setActiveOutput]);

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
