import { useEffect, useRef } from "react";
import { useLocalParticipant, useRemoteParticipants, useRoomContext } from "@livekit/components-react";
import { ConnectionState, RoomEvent } from "livekit-client";
import {
  buildTelemetrySnapshot,
  collectReportMetrics,
  getParticipantAudioReport,
  getWorstConnectionQuality,
  type StatsBaselineMap,
} from "../../../utils/callTelemetry";

interface CallTelemetryReporterProps {
  socket: { emit: (event: string, payload: Record<string, unknown>) => void } | null;
  callId: string | null;
  channelId?: string | null;
}

const SAMPLE_INTERVAL_MS = 10_000;

export function CallTelemetryReporter({ socket, callId, channelId }: CallTelemetryReporterProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const baselinesRef = useRef<StatsBaselineMap>(new Map());
  const reconnectCountRef = useRef(0);

  useEffect(() => {
    const onReconnected = () => {
      reconnectCountRef.current += 1;
    };

    room.on(RoomEvent.Reconnected, onReconnected);
    return () => {
      room.off(RoomEvent.Reconnected, onReconnected);
    };
  }, [room]);

  useEffect(() => {
    if (!socket || (!callId && !channelId)) {
      return;
    }

    let isCancelled = false;

    const sendTelemetry = async () => {
      if (isCancelled || room.state !== ConnectionState.Connected) {
        return;
      }

      const metricReports = [];

      const localReport = await getParticipantAudioReport(localParticipant);
      if (localReport) {
        metricReports.push(collectReportMetrics(localReport, `local:${localParticipant.identity}`, baselinesRef.current));
      }

      const remoteReports = await Promise.all(
        remoteParticipants.map(async (participant) => {
          const report = await getParticipantAudioReport(participant);
          if (!report) {
            return null;
          }

          return collectReportMetrics(report, `remote:${participant.identity}`, baselinesRef.current);
        }),
      );

      metricReports.push(...remoteReports.filter((report): report is NonNullable<typeof report> => Boolean(report)));

      const connectionQuality = getWorstConnectionQuality([
        localParticipant.connectionQuality,
        ...remoteParticipants.map((participant) => participant.connectionQuality),
      ]);

      const snapshot = buildTelemetrySnapshot({
        metrics: metricReports,
        quality: connectionQuality,
        participantCount: remoteParticipants.length + 1,
        reconnectCount: reconnectCountRef.current,
      });

      socket.emit("call_telemetry_update", {
        callId: callId || undefined,
        channelId: channelId || undefined,
        ...snapshot,
      });
    };

    void sendTelemetry();
    const interval = window.setInterval(() => {
      void sendTelemetry();
    }, SAMPLE_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(interval);
    };
  }, [socket, callId, channelId, room, localParticipant, remoteParticipants]);

  return null;
}

