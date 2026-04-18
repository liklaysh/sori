import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { 
  Terminal, 
  Trash2, 
  Copy, 
  Pause, 
  Play, 
  AlertTriangle,
  Activity,
  Filter,
  Monitor
} from "lucide-react";

interface LogEntry {
  id: number;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
}

import { WS_URL } from "../../../config";

export default function ServerLogTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState("all");
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const socket: Socket = io(WS_URL, { 
      withCredentials: true,
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {
      socket.emit("join_channel", "admin_logs"); 
    });

    socket.on("server_log", (log: Omit<LogEntry, "id">) => {
      if (!isPausedRef.current) {
        setLogs(prev => {
          const updated = [...prev, { ...log, id: Date.now() + Math.random() }];
          if (updated.length > 500) return updated.slice(updated.length - 500);
          return updated;
        });
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (!isPaused) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isPaused]);

  const clearLogs = () => setLogs([]);
  
  const copyLogs = () => {
    const str = logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(str);
    toast.success("Logs copied to clipboard");
  };

  const filteredLogs = logs.filter(l => filter === "all" ? true : l.level === filter);

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const staleCount = logs.filter(l => new Date(l.timestamp) < threeDaysAgo).length;

  return (
    <div className="space-y-8 h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-sori-surface-accent-subtle rounded-lg">
              <Terminal className="h-6 w-6 text-sori-accent-secondary" />
            </div>
            <h1 className="text-3xl font-bold text-sori-text-strong">Live Telemetry</h1>
          </div>
          <p className="text-sori-text-muted text-sm font-medium">Real-time STDOUT/STDERR stream from the Sanctuary core.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group/select">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sori-text-muted" />
            <select 
              value={filter} 
              onChange={e => setFilter(e.target.value)} 
              className="bg-sori-surface-main border border-sori-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-[10px] font-black uppercase text-sori-text-muted outline-none appearance-none hover:border-sori-accent-secondary transition-all cursor-pointer shadow-lg"
            >
              <option value="all">Level: ALL</option>
              <option value="info">Level: INFO</option>
              <option value="warn">Level: WARN</option>
              <option value="error">Level: ERROR</option>
            </select>
          </div>

          <button 
            onClick={() => setIsPaused(!isPaused)} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isPaused ? 'bg-sori-accent-secondary text-sori-text-on-accent' : 'bg-sori-surface-main text-sori-text-muted border border-sori-border-subtle hover:bg-sori-surface-hover'}`}
          >
            {isPaused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3 fill-current" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <div className="flex gap-2">
            <button 
              onClick={clearLogs} 
              className="w-10 h-10 rounded-xl bg-sori-surface-main border border-sori-border-subtle hover:bg-sori-error-subtle hover:border-sori-accent-danger flex items-center justify-center transition-all group shadow-lg active:scale-90"
              title="Clear"
            >
              <Trash2 className="h-4 w-4 text-sori-text-muted group-hover:text-sori-accent-danger transition-colors" />
            </button>
            <button 
              onClick={copyLogs} 
              className="w-10 h-10 rounded-xl bg-sori-surface-main border border-sori-border-subtle hover:bg-sori-surface-hover hover:border-sori-accent-secondary flex items-center justify-center transition-all group shadow-lg active:scale-90"
              title="Copy"
            >
              <Copy className="h-4 w-4 text-sori-text-muted group-hover:text-sori-accent-secondary transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {staleCount > 0 && (
        <div className="bg-sori-surface-danger-subtle border border-sori-accent-danger p-6 rounded-[2rem] flex items-center justify-between animate-in zoom-in-95 shrink-0 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-sori-accent-danger">
            <AlertTriangle className="h-24 w-24 rotate-12" />
          </div>
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-sori-surface-danger-subtle text-sori-accent-danger border border-sori-accent-danger/20 rounded-2xl flex items-center justify-center shadow-inner">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sori-text-strong text-sm uppercase tracking-widest">Log Overflow</h3>
              <p className="text-sori-text-muted text-xs mt-1">Detected <span className="text-sori-accent-danger font-black">{staleCount}</span> packets older than 3 days.</p>
            </div>
          </div>
          <button 
            onClick={clearLogs} 
            className="bg-sori-accent-danger text-sori-text-on-accent text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-xl relative z-10"
          >
            Clear Cache
          </button>
        </div>
      )}

      <div className="flex-1 min-h-[500px] bg-sori-surface-main border border-sori-border-subtle rounded-[2.5rem] p-8 font-mono text-sm overflow-hidden flex flex-col shadow-lg relative">
        <div className="absolute top-6 left-6 flex items-center gap-2 pb-4">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-sori-accent-danger"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-sori-accent-secondary"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-sori-accent-success"></div>
          </div>
          <div className="h-px w-8 bg-sori-border-subtle mx-2"></div>
          <span className="text-[10px] uppercase font-black text-sori-text-dim tracking-widest">sori-telemetry.stream</span>
        </div>

        {!isPaused && logs.length > 0 && (
          <div className="absolute top-6 right-8 flex items-center gap-2 px-3 py-1 bg-sori-surface-accent-subtle border border-sori-accent-success rounded-full animate-pulse transition-opacity">
            <Activity className="h-3 w-3 text-sori-accent-success" />
            <span className="text-[9px] font-black text-sori-accent-success tracking-widest leading-none">LIVE</span>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto custom-scrollbar mt-10 pr-4 space-y-1.5 scroll-smooth">
          {filteredLogs.map(l => (
            <div key={l.id} className={`group/line flex gap-4 py-1.5 px-3 rounded-lg border-b border-sori-border-subtle transition-all hover:bg-sori-surface-hover border-l-2 border-transparent hover:border-sori-accent-secondary ${l.level === 'error' ? 'text-sori-accent-danger' : l.level === 'warn' ? 'text-sori-accent-secondary' : 'text-sori-text-muted'}`}>
              <span className="shrink-0 select-none text-[10px] font-black pt-0.5">[{new Date(l.timestamp).toLocaleTimeString()}]</span>
              <span className="font-black w-12 shrink-0 select-none text-[10px] pt-0.5">[{l.level.toUpperCase()}]</span>
              <span className="break-all font-medium selection:bg-sori-accent-secondary selection:text-sori-text-on-accent leading-relaxed">{l.message}</span>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-sori-text-dim">
              <Monitor className="h-24 w-24 animate-pulse" />
              <p className="font-black uppercase tracking-[0.4em] text-xs">Waiting for telemetry packets...</p>
            </div>
          )}
          <div ref={bottomRef} className="h-8"></div>
        </div>
      </div>
    </div>
  );
}


