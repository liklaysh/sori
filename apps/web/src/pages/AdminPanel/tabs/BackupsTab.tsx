import React, { useState, useEffect } from "react";
import { useAdminApi } from "../../../hooks/useAdminApi";
import http from "../../../lib/api";
import { toast } from "sonner";
import { 
  Download, 
  RefreshCw, 
  ShieldCheck,
  AlertTriangle,
  Database,
  History,
  Info,
  Clock,
  FileArchive
} from "lucide-react";

interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

export default function BackupsTab() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string>("active");
  const api = useAdminApi();

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const res = await api.getBackups();
      if (res.data) {
        setBackups(res.data.backups || []);
        setStatus(res.data.status || "active");
      }
    } catch (e) {
      toast.error("Failed to sync backup registry");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleDownload = async (filename: string) => {
    try {
      const response = await http.get(`/admin/backup/download/${encodeURIComponent(filename)}`, {
        responseType: "blob",
      });

      const blobUrl = URL.createObjectURL(response.data as Blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      toast.success(`Downloading payload: ${filename}`);
    } catch (error) {
      toast.error("Failed to download backup");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-sori-accent-danger pl-6 py-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-sori-accent-danger rounded-lg">
              <ShieldCheck className="h-5 w-5 text-sori-text-on-accent" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-sori-text-strong uppercase">Data Resilience</h1>
          </div>
          <p className="text-sori-text-muted text-[10px] font-medium tracking-wide uppercase">Infrastructure state orchestration and point-in-time recovery.</p>
        </div>
        <div className="flex items-center gap-3 bg-sori-surface-main border border-sori-border-subtle px-4 py-2 rounded-xl shrink-0">
          <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-sori-accent-secondary' : 'bg-sori-accent-danger'} animate-pulse shadow-lg`}></div>
          <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-sori-accent-success' : 'bg-sori-accent-danger'} animate-pulse shadow-lg`}></div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-sori-text-strong">Service: {status === 'active' ? 'Operational' : 'Error'}</span>
        </div>
      </div>

      {/* Backup Registry Section */}
      <section className="space-y-4">
         <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-sori-accent-danger" />
              <h2 className="text-[9px] font-black uppercase text-sori-text-muted tracking-[0.3em]">Backup Registry</h2>
            </div>
            <button 
              onClick={fetchBackups} 
              disabled={isLoading}
              className="w-8 h-8 rounded-lg bg-sori-surface-main border border-sori-border-subtle flex items-center justify-center hover:bg-sori-surface-hover transition-all active:scale-95"
            >
               <RefreshCw className={`h-3 w-3 text-sori-text-muted ${isLoading ? 'animate-spin text-sori-accent-danger' : ''}`} />
            </button>
         </div>

        <div className="bg-sori-surface-main border border-sori-border-subtle rounded-3xl overflow-hidden shadow-xl">
          <div className="max-h-[400px] overflow-auto custom-scrollbar">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="bg-sori-surface-active border-b border-sori-border-subtle text-[9px] font-black uppercase tracking-widest text-sori-text-muted">
                  <th className="px-6 py-4">Snapshot</th>
                  <th className="px-6 py-4">Dimensions</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4 text-right">Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sori-border-subtle">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                       <RefreshCw className="h-6 w-6 animate-spin text-sori-accent-danger mx-auto mb-2" />
                       <p className="text-[10px] font-bold text-sori-text-muted uppercase tracking-widest">Scanning infrastructure...</p>
                    </td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-sori-text-dim font-bold uppercase tracking-widest text-[10px]">
                      No automated snapshots identified.
                    </td>
                  </tr>
                ) : backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-sori-surface-hover transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileArchive className="h-4 w-4 text-sori-accent-danger transition-opacity" />
                        <span className="font-bold text-sori-text-strong text-sm group-hover:text-sori-accent-danger transition-colors">{b.filename}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[10px] font-black text-sori-text-muted">{formatSize(b.size)}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[10px] font-bold text-sori-text-muted">
                         {new Date(b.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDownload(b.filename)}
                        className="p-2.5 rounded-lg bg-sori-surface-danger-subtle text-sori-accent-danger hover:bg-sori-accent-danger hover:text-sori-text-on-accent transition-all shadow-md active:scale-95"
                        title="Download locally"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Security Warning */}
      <div className="bg-sori-surface-danger-subtle border border-sori-accent-danger rounded-2xl p-6 flex items-start gap-4 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 text-sori-accent-danger opacity-5 group-hover:scale-110 transition-transform">
           <AlertTriangle className="h-16 w-16" />
        </div>
        <div className="w-10 h-10 bg-sori-surface-danger-subtle rounded-xl flex items-center justify-center shrink-0 border border-sori-accent-danger/20">
           <AlertTriangle className="h-5 w-5 text-sori-accent-danger animate-pulse" />
        </div>
        <div className="relative z-10">
           <h3 className="text-[9px] font-black text-sori-text-strong uppercase tracking-[0.2em] mb-1">Infrastructure Notice</h3>
           <p className="text-[10px] text-sori-text-dim font-medium leading-relaxed max-w-2xl">
              Database snapshots are generated every 24 hours. Only the latest 3 daily backups are retained to keep local storage bounded.
           </p>
        </div>
      </div>
      
      {/* Informative Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: ShieldCheck, title: "Automated", desc: "Backups generated every 24h by infra-service" },
          { icon: Database, title: "PostgreSQL", desc: "Native SQL dumps optimized for relational integrity" },
          { icon: Info, title: "Retention", desc: "Only the latest 3 daily snapshots are kept" }
        ].map((item, i) => (
          <div key={i} className="bg-sori-surface-main border border-sori-border-subtle rounded-2xl p-4 flex gap-3 items-center">
            <item.icon className="h-4 w-4 text-sori-accent-danger shrink-0" />
            <div>
              <h4 className="text-[9px] font-black text-sori-text-strong uppercase tracking-wider">{item.title}</h4>
              <p className="text-[10px] text-sori-text-muted font-medium">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
