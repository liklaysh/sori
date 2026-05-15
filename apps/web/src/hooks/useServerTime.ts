import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

// Global variable to store the offset so it persists across hook instances
let globalClockOffset = 0;
let isSynced = false;
let syncPromise: Promise<void> | null = null;
const syncListeners = new Set<() => void>();

const notifySyncListeners = () => {
  syncListeners.forEach((listener) => listener());
};

const syncServerTime = async () => {
  if (isSynced) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${API_URL}/time`);
      const endTime = Date.now();

      // Estimate round-trip time (latency)
      const latency = (endTime - startTime) / 2;
      const data = response.data as { timestamp: number };
      const serverTimestamp = data.timestamp;

      // Offset = ServerTime - (ClientTime - Latency)
      // serverAdjustedTime = clientTime + offset
      globalClockOffset = serverTimestamp - (endTime - latency);
      isSynced = true;
      notifySyncListeners();
    } catch (err) {
      console.error("[TimeSync] Failed to sync with server time:", err);
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
};

export const useServerTime = () => {
  const [synced, setSynced] = useState(isSynced);

  useEffect(() => {
    if (isSynced) {
      setSynced(true);
      return;
    }

    const handleSynced = () => {
      if (isSynced) {
        setSynced(true);
      }
    };

    syncListeners.add(handleSynced);
    void syncServerTime();

    return () => {
      syncListeners.delete(handleSynced);
    };
  }, []);

  const getSyncedDate = useCallback((clientDate: Date = new Date()) => {
    return new Date(clientDate.getTime() + globalClockOffset);
  }, []);

  const formatServerTimestamp = useCallback((timestamp: string | number | Date) => {
    const date = new Date(timestamp);
    // Note: We don't apply offset here because 'timestamp' is already the absolute point in time from the server
    // We only use offset to calculate "now" via getSyncedDate()
    return date;
  }, []);

  return { synced, getSyncedDate, formatServerTimestamp, offset: globalClockOffset };
};
