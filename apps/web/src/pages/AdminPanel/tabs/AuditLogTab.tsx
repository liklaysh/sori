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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-sori-accent-danger pl-6 py-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-sori-accent-danger rounded-lg">
                <ShieldCheck className="h-5 w-5 text-sori-text-on-accent" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter text-sori-text-strong uppercase">Action Ledger</h1>
            </div>
            <p className="text-sori-text-muted text-[10px] font-medium max-w-lg tracking-wide uppercase">Historical trace of administrative operations.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleCleanup} 
              className="bg-sori-surface-main border border-sori-border-subtle hover:border-sori-accent-danger text-sori-accent-danger font-black px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg group/clean"
            >
              <Eraser className="h-3.5 w-3.5 group-hover/clean:rotate-12 transition-transform" />
              <span className="text-[10px] uppercase tracking-widest">Purge</span>
            </button>
            <button 
              onClick={handleExportCSV} 
              className="bg-sori-accent-danger text-sori-text-on-accent font-black px-5 py-2.5 rounded-xl flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-widest">Export</span>
            </button>
          </div>
        </div>

        <div className="bg-sori-surface-main border border-sori-border-subtle rounded-3xl overflow-hidden shadow-xl">
          <div className="max-h-[450px] overflow-auto custom-scrollbar">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-sori-surface-active">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">Timestamp</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">Identity</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">Operation</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">Object</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sori-border-subtle">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-sori-text-muted">
                        <RefreshCw className="h-6 w-6 animate-spin text-sori-accent-danger" />
                        <p className="text-[10px] font-bold animate-pulse uppercase tracking-widest">Syncing ledger...</p>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                       <div className="flex flex-col items-center gap-2">
                         <Search className="h-8 w-8 text-sori-text-dim" />
                         <p className="font-black uppercase tracking-[0.2em] text-[10px] text-sori-text-dim">Ledger Empty</p>
                       </div>
                    </td>
                  </tr>
                ) : (
                  logs.map(l => (
                    <tr key={l.id} className="hover:bg-sori-surface-hover transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-sori-text-dim" />
                          <span className="text-[10px] font-mono text-sori-text-muted tracking-tighter">
                            {new Date(l.timestamp).toLocaleDateString()} {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sori-error-subtle flex items-center justify-center border border-sori-accent-danger">
                            <User className="h-3.5 w-3.5 text-sori-accent-danger" />
                          </div>
                          <span className="text-[11px] font-black text-sori-text-strong font-mono tracking-tighter">{l.adminId.slice(0, 12)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-sori-surface-base border border-sori-border-subtle px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest text-sori-accent-danger group-hover:border-sori-accent-danger transition-colors">
                          {l.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-sori-text-muted group-hover:text-sori-text-strong transition-colors truncate max-w-[200px] block">
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
        <div className="flex items-center gap-2 border-l-4 border-sori-accent-secondary pl-6 py-1">
          <div className="p-1.5 bg-sori-surface-accent-subtle rounded-lg border border-sori-accent-secondary">
            <Activity className="h-5 w-5 text-sori-accent-secondary" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tighter text-sori-text-strong uppercase">Interaction Streams</h2>
            <p className="text-sori-text-muted text-[10px] font-medium tracking-wide uppercase">Real-time media frequency orchestration.</p>
          </div>
        </div>

        <div className="bg-sori-surface-main border border-sori-border-subtle rounded-3xl overflow-hidden shadow-xl">
          <div className="max-h-[450px] overflow-auto custom-scrollbar">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-sori-surface-active">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-accent-secondary">Initiated</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-accent-secondary">Medium</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-accent-secondary">State</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-accent-secondary">Integrity (MOS)</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-accent-secondary">Bitrate</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-accent-secondary text-right">Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sori-border-subtle">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-sori-text-muted font-bold uppercase text-[10px] animate-pulse">Scanning Frequencies...</td>
                  </tr>
                ) : callLogs.map(c => (
                  <tr key={c.id} className="hover:bg-sori-surface-hover transition-colors border-l-2 border-transparent hover:border-sori-accent-secondary group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[10px] text-sori-text-muted font-mono tracking-tighter">
                         <History className="h-3 w-3" />
                         {new Date(c.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3 w-3 text-sori-accent-secondary" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-sori-text-strong">{c.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${c.status === 'active' ? 'text-sori-accent-secondary' : 'text-sori-text-dim'}`}>
                        {c.status === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-sori-accent-secondary animate-pulse shadow-lg"></div>}
                        {c.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 w-40">
                      {c.mos ? (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1 bg-sori-surface-panel rounded-full overflow-hidden border border-sori-border-subtle">
                            <div 
                              className="h-full bg-sori-accent-secondary shadow-lg" 
                              style={{ width: `${(parseFloat(c.mos) / 4.5) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sori-accent-secondary font-black text-[10px] tabular-nums">{c.mos}</span>
                        </div>
                      ) : "-"}
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[10px] font-mono text-sori-text-muted font-bold">
                         {c.avgBitrate ? `${(c.avgBitrate / 1000).toFixed(1)} kbps` : "N/A"}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-[10px] font-black ${parseFloat(c.packetLoss) > 5 ? 'text-sori-accent-danger' : 'text-sori-accent-secondary'} font-mono`}>
                        {c.packetLoss ? `${parseFloat(c.packetLoss).toFixed(1)}%` : "0.0%"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!isLoading && callLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Activity className="h-10 w-10 text-sori-text-dim" />
                        <p className="font-black uppercase tracking-[0.3em] text-[10px] text-sori-text-dim">Zero Interactions</p>
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
