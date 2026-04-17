import React, { useState, useEffect } from "react";
import { useAdminApi } from "../../../hooks/useAdminApi";
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
import { API_URL } from "../../../config";

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

  const handleDownload = (filename: string) => {
    const token = localStorage.getItem("sori_token");
    const url = `${API_URL}/admin/backup/download/${filename}?token=${token}`;
    
    // Create a temporary link and trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Downloading payload: ${filename}`);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-sori-error pl-6 py-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-sori-error rounded-lg shadow-[0_0_15px_rgba(237,66,69,0.3)]">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase">Data Resilience</h1>
          </div>
          <p className="text-gray-400 text-[10px] font-medium tracking-wide uppercase opacity-70">Infrastructure state orchestration and point-in-time recovery.</p>
        </div>
        <div className="flex items-center gap-3 bg-sori-sidebar border border-white/5 px-4 py-2 rounded-xl shrink-0">
          <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-sori-error'} animate-pulse`}></div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Service: {status === 'active' ? 'Operational' : 'Error'}</span>
        </div>
      </div>

      {/* Backup Registry Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <div className="flex items-center gap-2">
             <Clock className="h-3 w-3 text-sori-error" />
             <h2 className="text-[9px] font-black uppercase text-gray-500 tracking-[0.3em]">Backup Registry</h2>
           </div>
           <button 
             onClick={fetchBackups} 
             disabled={isLoading}
             className="w-8 h-8 rounded-lg bg-sori-sidebar border border-white/5 flex items-center justify-center hover:bg-white/5 transition-all active:scale-95"
           >
              <RefreshCw className={`h-3 w-3 text-gray-500 ${isLoading ? 'animate-spin text-sori-error' : ''}`} />
           </button>
        </div>

        <div className="bg-sori-sidebar border border-white/5 rounded-3xl overflow-hidden shadow-xl">
          <div className="max-h-[400px] overflow-auto custom-scrollbar">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="bg-white/5 border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-500">
                  <th className="px-6 py-4">Snapshot</th>
                  <th className="px-6 py-4">Dimensions</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4 text-right">Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                       <RefreshCw className="h-6 w-6 animate-spin text-sori-error mx-auto mb-2" />
                       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scanning infrastructure...</p>
                    </td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-gray-600 font-bold uppercase tracking-widest text-[10px]">
                      No automated snapshots identified.
                    </td>
                  </tr>
                ) : backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileArchive className="h-4 w-4 text-sori-error opacity-60 group-hover:opacity-100 transition-opacity" />
                        <span className="font-bold text-white text-sm group-hover:text-sori-error transition-colors">{b.filename}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[10px] font-black text-gray-500">{formatSize(b.size)}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[10px] font-bold text-gray-400">
                         {new Date(b.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDownload(b.filename)}
                        className="p-2.5 rounded-lg bg-sori-error/10 text-sori-error hover:bg-sori-error hover:text-white transition-all shadow-md active:scale-95"
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
      <div className="bg-sori-error/5 border border-sori-error/20 rounded-2xl p-6 flex items-start gap-4 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-[0.02] text-sori-error group-hover:scale-110 transition-transform">
           <AlertTriangle className="h-16 w-16" />
        </div>
        <div className="w-10 h-10 bg-sori-error/20 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
           <AlertTriangle className="h-5 w-5 text-sori-error animate-pulse" />
        </div>
        <div className="relative z-10">
           <h3 className="text-[9px] font-black text-white uppercase tracking-[0.2em] mb-1">Infrastructure Notice</h3>
           <p className="text-[10px] text-gray-500 font-medium leading-relaxed max-w-2xl">
              Sanctuary backups are automated every 12 hours. Restoration requires direct infrastructure access for security integrity.
           </p>
        </div>
      </div>
      
      {/* Informative Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: ShieldCheck, title: "Automated", desc: "Backups generated every 12h by infra-service" },
          { icon: Database, title: "PostgreSQL", desc: "Native SQL dumps optimized for relational integrity" },
          { icon: Info, title: "Retention", desc: "Local snapshots are retained for 7 diurnal periods" }
        ].map((item, i) => (
          <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex gap-3 items-center">
            <item.icon className="h-4 w-4 text-sori-error shrink-0" />
            <div>
              <h4 className="text-[9px] font-black text-white uppercase tracking-wider">{item.title}</h4>
              <p className="text-[10px] text-gray-500 font-medium">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
