import { useCallback, useEffect, useState } from "react";

type SupportedMediaDeviceKind = "audioinput" | "audiooutput";

interface UseBrowserMediaDevicesOptions {
  kind: SupportedMediaDeviceKind;
  storageKey: string;
}

function getStoredDeviceId(storageKey: string) {
  if (typeof window === "undefined") {
    return undefined;
  }

  return localStorage.getItem(storageKey) || undefined;
}

export function useBrowserMediaDevices({ kind, storageKey }: UseBrowserMediaDevicesOptions) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(() => getStoredDeviceId(storageKey));

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      return;
    }

    try {
      const nextDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === kind,
      );

      setDevices(nextDevices);
      setActiveDeviceId((currentDeviceId) => {
        if (currentDeviceId && nextDevices.some((device) => device.deviceId === currentDeviceId)) {
          return currentDeviceId;
        }

        const storedDeviceId = getStoredDeviceId(storageKey);
        if (storedDeviceId && nextDevices.some((device) => device.deviceId === storedDeviceId)) {
          return storedDeviceId;
        }

        return nextDevices[0]?.deviceId;
      });
    } catch {
      setDevices([]);
    }
  }, [kind, storageKey]);

  const setActiveMediaDevice = useCallback((deviceId: string) => {
    setActiveDeviceId(deviceId);
  }, []);

  useEffect(() => {
    refreshDevices();

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return;
    }

    navigator.mediaDevices.addEventListener?.("devicechange", refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener?.("devicechange", refreshDevices);
    };
  }, [refreshDevices]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (activeDeviceId) {
      localStorage.setItem(storageKey, activeDeviceId);
      return;
    }

    localStorage.removeItem(storageKey);
  }, [activeDeviceId, storageKey]);

  return {
    devices,
    activeDeviceId,
    setActiveMediaDevice,
    refreshDevices,
  };
}
