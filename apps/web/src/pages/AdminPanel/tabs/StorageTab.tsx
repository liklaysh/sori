import React, { useEffect, useState } from "react";
import { useAdminApi } from "../../../hooks/useAdminApi";
import { toast } from "sonner";
import { 
  HardDrive, 
  Package, 
  RefreshCw, 
  Trash2, 
  Search,
  FileText,
  ExternalLink,
  Activity,
  AlertTriangle,
  Server,
  Database,
  Cloud
} from "lucide-react";

interface StorageStats {
  objectCount: number;
  totalSize: number;
}

interface StorageFile {
  key: string;
  size: number;
  lastModified: string;
  url: string;
}

export default function StorageTab() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const api = useAdminApi();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, filesRes] = await Promise.all([
        api.getStorageStats(),
        api.getStorageFiles()
      ]);
      
      if (statsRes.data) setStats(statsRes.data);
      if (filesRes.data) setFiles(filesRes.data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to sync storage data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (key: string) => {
    if (!confirm(`Confirm permanent termination of asset: ${key}?`)) return;
    
    setIsDeleting(key);
    try {
      const { error } = await api.deleteStorageFile(key);
      if (error) throw new Error(error);
      
      toast.success("Artifact purged");
      fetchData();
    } catch (e) {
      toast.error("Purge operation failed");
    } finally {
      setIsDeleting(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const isImage = (key: string) => {
    const ext = key.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-sori-accent-danger pl-6 py-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-sori-accent-danger rounded-lg shadow-lg">
              <Cloud className="h-5 w-5 text-sori-text-on-accent" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-sori-text-strong uppercase">Media Repository</h1>
          </div>
          <p className="text-sori-text-muted text-[10px] font-medium tracking-wide uppercase">MinIO asset orchestration and tracking.</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-sori-surface-main border border-sori-border-subtle rounded-3xl p-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-5 opacity-5 text-sori-accent-danger rotate-12 group-hover:scale-110 transition-transform duration-700">
            <Package className="h-20 w-20" />
          </div>
          <div className="flex items-center gap-2 mb-4 relative z-10 font-black uppercase tracking-[0.2em] text-[8px] text-sori-accent-danger">
            <Package className="h-3 w-3" />
            Total Objects
          </div>
          <div className="text-3xl font-black relative z-10 text-sori-text-strong tabular-nums">
            {stats ? stats.objectCount : "..."}
          </div>
          <div className="mt-2 text-[8px] font-bold text-sori-text-dim uppercase tracking-widest">Verified cluster assets</div>
        </div>

        <div className="bg-sori-surface-main border border-sori-border-subtle rounded-3xl p-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-5 opacity-5 text-sori-accent-danger -rotate-12 group-hover:scale-110 transition-transform duration-700">
            <HardDrive className="h-20 w-20" />
          </div>
          <div className="flex items-center gap-2 mb-4 relative z-10 font-black uppercase tracking-[0.2em] text-[8px] text-sori-accent-danger">
            <Database className="h-3 w-3" />
            Storage Used
          </div>
          <div className="text-3xl font-black relative z-10 text-sori-text-strong tabular-nums">
            {stats ? formatFileSize(stats.totalSize).split(' ')[0] : "..."}
            <span className="text-lg ml-1 text-sori-text-muted">{stats ? formatFileSize(stats.totalSize).split(' ')[1] : ""}</span>
          </div>
          <div className="mt-2 text-[8px] font-bold text-sori-text-dim uppercase tracking-widest">Binary data volume</div>
        </div>
      </div>

      {/* File List Section */}
      <section className="space-y-4">
         <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3 text-sori-accent-danger" />
              <h2 className="text-[9px] font-black uppercase text-sori-text-muted tracking-[0.3em]">Recent Ingress</h2>
            </div>
            <button 
              onClick={fetchData} 
              disabled={isLoading}
              className="w-8 h-8 rounded-lg bg-sori-surface-main border border-sori-border-subtle flex items-center justify-center hover:bg-sori-surface-hover transition-all active:scale-95"
            >
               <RefreshCw className={`h-3 w-3 text-sori-text-muted ${isLoading ? 'animate-spin text-sori-accent-danger' : ''}`} />
            </button>
         </div>

        <div className="bg-sori-surface-main border border-sori-border-subtle rounded-3xl overflow-hidden shadow-xl relative">
          <div className="max-h-[450px] overflow-auto custom-scrollbar">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="bg-sori-surface-active border-b border-sori-border-subtle">
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">Preview</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">Node Identity</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">Size</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted">Accession</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-sori-text-muted text-right">Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sori-border-subtle">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-sori-text-muted">
                        <Activity className="h-6 w-6 animate-spin text-sori-accent-danger" />
                        <p className="text-[10px] font-bold animate-pulse uppercase tracking-widest">Scanning network...</p>
                      </div>
                    </td>
                  </tr>
                ) : files.map(file => (
                  <tr key={file.key} className="hover:bg-sori-surface-hover transition-colors group">
                    <td className="px-6 py-4 w-28">
                      <div className="w-12 h-12 rounded-xl bg-sori-surface-panel border border-sori-border-subtle flex items-center justify-center overflow-hidden shadow-inner group-hover:border-sori-accent-danger transition-colors">
                        {isImage(file.key) ? (
                          <img src={file.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <FileText className="h-5 w-5 text-sori-text-muted group-hover:text-sori-accent-danger transition-colors" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sori-text-strong text-sm max-w-[200px] truncate mb-0.5">{file.key}</span>
                        <a 
                          href={file.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center gap-1 text-[8px] text-sori-accent-danger font-black uppercase tracking-widest hover:underline w-fit"
                        >
                          Pulse Entry
                          <ExternalLink className="h-2 w-2" />
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[10px] font-black text-sori-text-muted">{formatFileSize(file.size)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[10px] font-bold text-sori-text-dim">
                        {new Date(file.lastModified).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(file.key)}
                        disabled={isDeleting === file.key}
                        className="w-10 h-10 rounded-xl bg-sori-surface-danger-subtle text-sori-accent-danger hover:bg-sori-accent-danger hover:text-sori-text-on-accent transition-all disabled:bg-sori-surface-active flex items-center justify-center ml-auto shadow-md active:scale-95"
                        title="Delete permanently"
                      >
                        {isDeleting === file.key ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {!isLoading && files.length === 0 && (
                   <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                           <Search className="h-10 w-10 text-sori-text-dim" />
                           <p className="font-black uppercase tracking-[0.3em] text-[10px] text-sori-text-dim">Registry Empty</p>
                        </div>
                      </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Safety Notice */}
      <div className="bg-sori-surface-danger-subtle border border-sori-accent-danger rounded-2xl p-6 flex items-start gap-4 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-5 text-sori-accent-danger group-hover:scale-110 transition-transform">
           <AlertTriangle className="h-16 w-16" />
        </div>
        <div className="w-10 h-10 bg-sori-surface-danger-subtle rounded-xl flex items-center justify-center shrink-0 border border-sori-accent-danger/20">
           <AlertTriangle className="h-5 w-5 text-sori-accent-danger animate-pulse" />
        </div>
        <div className="relative z-10">
           <h3 className="text-[9px] font-black text-sori-text-strong uppercase tracking-[0.2em] mb-1">Critical Modification Notice</h3>
           <p className="text-[10px] text-sori-text-dim font-medium leading-relaxed max-w-2xl">
              Object deletion bypasses temporary storage and is executed instantly. Confirm asset redundancy before termination.
           </p>
        </div>
      </div>
    </div>
  );
}
