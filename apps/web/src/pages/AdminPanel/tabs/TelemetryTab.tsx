import React, { useState, useEffect } from "react";
import { useAdminApi } from "../../../hooks/useAdminApi";
import { 
  Activity, 
  Clock, 
  Users, 
  Signal, 
  AlertCircle,
  ArrowRight
} from "lucide-react";
import { API_URL } from "../../../config";
import { cn } from "@sori/ui";
import { getAvatarUrl } from "../../../utils/avatar";

interface CallParticipant {
  user: {
    username: string;
    avatarUrl?: string;
  };
}

interface CallLog {
  id: string;
  type: 'channel' | 'direct';
  status: 'active' | 'ended' | 'missed' | 'rejected';
  mos: string | null;
  avgBitrate: number | null;
  packetLoss: string | null;
  startedAt: string;
  endedAt: string | null;
  channel?: { name: string };
  caller?: { username: string };
  callee?: { username: string };
  participants: CallParticipant[];
}

export default function TelemetryTab() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useAdminApi();

  const fetchCalls = async () => {
    try {
      const res = await api.getCalls();
      if (res.data) {
        setCalls(res.data);
        setError(null);
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err) {
      setError("Failed to fetch call telemetry");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (start: string, end: string | null) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const diff = Math.floor((endTime - startTime) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}m ${secs}s`;
  };

  const getMOSColor = (mos: string | null) => {
    if (!mos) return "text-gray-500";
    const val = parseFloat(mos);
    if (val >= 4.0) return "text-sori-success";
    if (val >= 3.0) return "text-white opacity-80";
    return "text-sori-error";
  };

  if (loading && calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-gray-400">
        <Activity className="h-10 w-10 animate-pulse mb-4 text-sori-error/40" />
        <p className="font-bold uppercase tracking-widest text-[10px]">Analyzing Protocol Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-sori-error pl-6 py-1">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Call Protocol Telemetry</h2>
          <p className="text-gray-400 text-[10px] font-medium tracking-wide uppercase opacity-70">Real-time monitoring of WebRTC quality and session health.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="px-4 py-2 rounded-xl bg-sori-error/10 border border-sori-error/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sori-error animate-pulse" />
            <span className="text-[10px] font-black text-sori-error uppercase tracking-widest">Live Monitoring Active</span>
          </div>
          <div className="flex items-center gap-1.5 opacity-40">
            <Clock className="h-3 w-3 text-gray-500" />
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Auto-purification active (72h policy)</span>
          </div>
        </div>
      </div>

      {/* Automated Cleanup Notice */}
      <div className="bg-sori-error/5 border border-sori-error/10 rounded-2xl p-4 flex items-center gap-3 shadow-inner">
        <AlertCircle className="h-4 w-4 text-sori-error opacity-60" />
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
          System Orchestration: Interaction streams older than 72 hours are automatically purged every 3 days to optimize database performance.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-sori-error/10 border border-sori-error/20 text-sori-error flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}

      <div className="max-h-[500px] overflow-auto custom-scrollbar pr-2 -mr-2">
        <div className="grid gap-4">
          {calls.map((call) => (
            <div key={call.id} className="group relative bg-[#2b2d31]/50 border border-white/5 rounded-2xl p-5 hover:bg-[#2b2d31] transition-all overflow-hidden font-sans">
              {/* MOS Indicator Line */}
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1",
                call.status === 'active' ? "bg-sori-error" : 
                call.mos ? (parseFloat(call.mos) > 3.5 ? "bg-sori-success" : "bg-sori-error") : "bg-gray-700"
              )} />

              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                {/* Type / Status */}
                <div className="flex items-center gap-4 min-w-[180px]">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-inner shrink-0",
                    call.status === 'active' ? "bg-sori-error/10 text-sori-error" : "bg-white/5 text-gray-500"
                  )}>
                    {call.type === 'direct' ? <Users className="h-6 w-6" /> : <Activity className="h-6 w-6" />}
                  </div>
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-0.5">{call.type === 'direct' ? 'Direct Call' : 'Channel'}</p>
                     <div className="flex items-center gap-2">
                       <h4 className="font-bold text-sm text-white">{call.channel?.name || "Private Session"}</h4>
                       {call.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-sori-error animate-pulse" />}
                     </div>
                  </div>
                </div>

                {/* Participants */}
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Participants</p>
                  <div className="flex items-center gap-2">
                    {call.type === 'direct' ? (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-white">{call.caller?.username}</span>
                        <ArrowRight className="h-3 w-3 text-gray-600" />
                        <span className="text-xs font-bold text-white">{call.callee?.username}</span>
                      </div>
                    ) : (
                      <div className="flex -space-x-2">
                        {call.participants.slice(0, 5).map((p, i) => (
                          <div key={i} className="w-7 h-7 rounded-lg bg-sori-sidebar border border-sori-chat flex items-center justify-center text-[10px] font-bold text-white shadow-sm overflow-hidden">
                            {getAvatarUrl(p.user.avatarUrl) ? <img src={getAvatarUrl(p.user.avatarUrl)!} className="w-full h-full object-cover" /> : p.user.username[0].toUpperCase()}
                          </div>
                        ))}
                        {call.participants.length > 5 && (
                          <div className="w-7 h-7 rounded-lg bg-sori-sidebar border border-sori-chat flex items-center justify-center text-[8px] font-bold text-gray-500 shadow-sm">
                            +{call.participants.length - 5}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quality Metrics */}
                <div className="grid grid-cols-3 gap-6 lg:border-l lg:border-white/5 lg:pl-6 min-w-[280px]">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">MOS (Quality)</p>
                    <p className={cn("text-sm font-black italic", getMOSColor(call.mos))}>
                      {call.mos || (call.status === 'active' ? "CALCULATING..." : "N/A")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Bitrate</p>
                    <p className="text-sm font-bold text-white">
                      {call.avgBitrate ? `${(call.avgBitrate / 1000).toFixed(1)} kbps` : (call.status === 'active' ? "SIGNALING..." : "—")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Loss</p>
                    <p className={cn("text-sm font-bold", call.packetLoss && parseFloat(call.packetLoss) > 5 ? "text-sori-error" : "text-white")}>
                      {call.packetLoss ? `${call.packetLoss}%` : "0%"}
                    </p>
                  </div>
                </div>

                {/* Timing */}
                <div className="min-w-[120px] lg:border-l lg:border-white/5 lg:pl-6 text-right">
                  <div className="flex items-center justify-end gap-1.5 text-gray-500 mb-1">
                    <Clock className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">{formatDuration(call.startedAt, call.endedAt)}</span>
                  </div>
                  <p className="text-[10px] font-bold text-gray-600">
                    {new Date(call.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {calls.length === 0 && (
            <div className="p-12 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center opacity-30">
              <Signal className="h-10 w-10 mb-4 text-sori-error" />
              <p className="font-bold uppercase tracking-widest text-xs">No Recent Call Traffic Detected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
