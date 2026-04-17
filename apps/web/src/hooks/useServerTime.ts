import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

// Global variable to store the offset so it persists across hook instances
let globalClockOffset = 0;
let isSynced = false;

export const useServerTime = () => {
  const [synced, setSynced] = useState(isSynced);

  useEffect(() => {
    if (isSynced) return;

    const syncTime = async () => {
      try {
        const startTime = Date.now();
        const response = await axios.get(`${API_URL}/time`);
        const endTime = Date.now();
        
        // Estimate round-trip time (latency)
        const latency = (endTime - startTime) / 2;
        const serverTimestamp = response.data.timestamp;
        
        // Offset = ServerTime - (ClientTime - Latency)
        // serverAdjustedTime = clientTime + offset
        globalClockOffset = serverTimestamp - (endTime - latency);
        isSynced = true;
        setSynced(true);
        
        console.log(`[TimeSync] Server offset calculated: ${globalClockOffset}ms (latency: ${latency}ms)`);
      } catch (err) {
        console.error("[TimeSync] Failed to sync with server time:", err);
      }
    };

    syncTime();
  }, []);

  const getSyncedDate = (clientDate: Date = new Date()) => {
    return new Date(clientDate.getTime() + globalClockOffset);
  };

  const formatServerTimestamp = (timestamp: string | number | Date) => {
    const date = new Date(timestamp);
    // Note: We don't apply offset here because 'timestamp' is already the absolute point in time from the server
    // We only use offset to calculate "now" via getSyncedDate()
    return date;
  };

  return { synced, getSyncedDate, formatServerTimestamp, offset: globalClockOffset };
};
