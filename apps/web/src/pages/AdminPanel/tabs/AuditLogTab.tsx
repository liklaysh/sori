import React, { useEffect, useState } from "react";
import { useAdminApi } from "../../../hooks/useAdminApi";
import { toast } from "sonner";
import { 
  ShieldCheck, 
  Eraser, 
  Download, 
  Activity, 
  History,
  User,
  Zap,
  Clock,
  ExternalLink,
  RefreshCw,
  Search
} from "lucide-react";

export default function AuditLogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const api = useAdminApi();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [auditRes, callRes] = await Promise.all([
        api.getAuditLogs(),
        api.getCalls()
      ]);
      
      if (auditRes.data) setLogs(auditRes.data);
      if (callRes.data) setCallLogs(callRes.data);
    } catch (e) {
      console.error(e);
      toast.error("Telemetry sync failed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const header = ["ID", "AdminID", "Action", "Target", "Timestamp", "Details"];
    const rows = logs.map(l => [
      l.id,
      l.adminId,
      l.action,
      l.target || "",
      new Date(l.timestamp).toISOString(),
      l.details || ""
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const csvStr = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csvStr], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sori_audit_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Operational ledger exported");
  };

  const handleCleanup = async () => {
    if (!confirm("Confirm purging of operational logs older than 72 hours? This operation is irreversible.")) return;
    try {
      const { error } = await api.cleanupAuditLogs();
      if (error) throw new Error(error);
      toast.success("History purged");
      fetchData();
    } catch (e) { 
      toast.error("Cleanup operation failed"); 
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Audit Trail Section */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-sori-error pl-6 py-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-sori-error rounded-lg shadow-[0_0_15px_rgba(237,66,69,0.3)]">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter text-white uppercase">Operations Ledger</h1>
            </div>
            <p className="text-gray-400 text-[10px] font-medium tracking-wide uppercase opacity-70">Authorized system state modifications.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleCleanup} 
              className="bg-sori-sidebar border border-white/5 hover:border-sori-error/50 text-sori-error font-black px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg group/clean"
            >
              <Eraser className="h-3.5 w-3.5 group-hover/clean:rotate-12 transition-transform" />
              <span className="text-[10px] uppercase tracking-widest">Purge</span>
            </button>
            <button 
              onClick={handleExportCSV} 
              className="bg-sori-error text-white font-black px-5 py-2.5 rounded-xl flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-sori-error/20"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-widest">Export</span>
            </button>
          </div>
        </div>

        <div className="bg-sori-sidebar border border-white/5 rounded-3xl overflow-hidden shadow-xl">
          <div className="max-h-[450px] overflow-auto custom-scrollbar">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Timestamp</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Identity</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Operation</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Object</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-500">
                        <RefreshCw className="h-6 w-6 animate-spin text-sori-error" />
                        <p className="text-[10px] font-bold animate-pulse uppercase tracking-widest">Syncing ledger...</p>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                       <div className="flex flex-col items-center gap-2 opacity-20">
                         <Search className="h-8 w-8 text-gray-500" />
                         <p className="font-black uppercase tracking-[0.2em] text-[10px] text-gray-400">Ledger Empty</p>
                       </div>
                    </td>
                  </tr>
                ) : (
                  logs.map(l => (
                    <tr key={l.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-gray-600" />
                          <span className="text-[10px] font-mono text-gray-500 tracking-tighter">
                            {new Date(l.timestamp).toLocaleDateString()} {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sori-error/10 flex items-center justify-center border border-sori-error/20">
                            <User className="h-3.5 w-3.5 text-sori-error" />
                          </div>
                          <span className="text-[11px] font-black text-white/90 font-mono tracking-tighter">{l.adminId.slice(0, 12)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-black/20 border border-white/5 px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest text-sori-error group-hover:border-sori-error/50 transition-colors">
                          {l.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-gray-500 group-hover:text-white transition-colors truncate max-w-[200px] block">
                          {l.target || "-"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Call protocol telemetry Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-l-4 border-secondary pl-6 py-1">
          <div className="p-1.5 bg-secondary/10 rounded-lg">
            <Activity className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Interaction Streams</h2>
            <p className="text-gray-400 text-[10px] font-medium tracking-wide uppercase opacity-70">Real-time media frequency orchestration.</p>
          </div>
        </div>

        <div className="bg-sori-sidebar border border-white/5 rounded-3xl overflow-hidden shadow-xl">
          <div className="max-h-[450px] overflow-auto custom-scrollbar">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-secondary">Initiated</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-secondary">Medium</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-secondary">State</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-secondary">Integrity (MOS)</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-secondary">Bitrate</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-secondary text-right">Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-gray-500 font-bold uppercase text-[10px] animate-pulse">Scanning Frequencies...</td>
                  </tr>
                ) : callLogs.map(c => (
                  <tr key={c.id} className="hover:bg-secondary/[0.02] transition-colors border-l-2 border-transparent hover:border-secondary group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono tracking-tighter">
                         <History className="h-3 w-3 opacity-40" />
                         {new Date(c.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3 w-3 text-secondary/50" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/90">{c.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${c.status === 'active' ? 'text-secondary' : 'text-gray-600'}`}>
                        {c.status === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(var(--secondary-rgb),0.5)]"></div>}
                        {c.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 w-40">
                      {c.mos ? (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="h-full bg-secondary shadow-[0_0_12px_theme(colors.secondary.DEFAULT)]" 
                              style={{ width: `${(parseFloat(c.mos) / 4.5) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-secondary font-black text-[10px] tabular-nums">{c.mos}</span>
                        </div>
                      ) : "-"}
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[10px] font-mono text-gray-500 font-bold">
                         {c.avgBitrate ? `${(c.avgBitrate / 1000).toFixed(1)} kbps` : "N/A"}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-[10px] font-black ${parseFloat(c.packetLoss) > 5 ? 'text-sori-error' : 'text-green-500'} font-mono`}>
                        {c.packetLoss ? `${parseFloat(c.packetLoss).toFixed(1)}%` : "0.0%"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!isLoading && callLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-20">
                        <Activity className="h-10 w-10 text-secondary" />
                        <p className="font-black uppercase tracking-[0.3em] text-[10px] text-secondary">Zero Interactions</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
