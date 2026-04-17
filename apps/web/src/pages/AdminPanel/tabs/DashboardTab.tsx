import React, { useEffect, useState } from "react";
import { useAdminApi } from "../../../hooks/useAdminApi";
import { 
  Clock, 
  Cpu, 
  Users, 
  Box, 
  Server, 
  Database, 
  Cloud, 
  Mic,
  Activity,
  ShieldCheck,
  Zap
} from "lucide-react";

import { cn } from "@sori/ui";

interface SystemStats {
  uptime: number;
  memory: {
    heapUsed: number;
  };
  totalUsers: number;
}

interface HealthStatus {
  backend: string;
  database: string;
  storage: string;
  livekit: string;
}

export default function DashboardTab() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const api = useAdminApi();

  const fetchData = async () => {
    try {
      const [statsRes, healthRes] = await Promise.all([
        api.getStats(),
        api.getHealth()
      ]);
      
      if (statsRes.data) setStats(statsRes.data);
      if (healthRes.data) setHealth(healthRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-4">
        <Activity className="h-10 w-10 animate-spin text-sori-error" />
        <p className="text-xs animate-pulse tracking-widest text-sori-error uppercase font-black">Establishing Connection...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-sori-error pl-6 py-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-sori-error rounded-lg shadow-[0_0_15px_rgba(237,66,69,0.3)]">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase">System Pulse</h1>
          </div>
          <p className="text-gray-400 text-[10px] font-medium max-w-lg tracking-wide uppercase opacity-70">
            Real-time infrastructure monitoring.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-sori-sidebar border border-white/5 px-4 py-2 rounded-xl shrink-0">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse"></div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Status: Stable</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          icon={<Clock className="h-5 w-5" />} 
          label="Uptime" 
          value={stats ? `${Math.floor(stats.uptime / 60)}m` : "---"} 
          description="Continuous session"
        />
        <StatCard 
          icon={<Cpu className="h-5 w-5" />} 
          label="Memory" 
          value={stats ? `${Math.round(stats.memory.heapUsed / 1024 / 1024)}MB` : "---"} 
          description="Heap usage"
        />
        <StatCard 
          icon={<Users className="h-5 w-5" />} 
          label="Online" 
          value={stats?.totalUsers ?? "---"} 
          description="Active sessions"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <Zap className="h-4 w-4 text-sori-error fill-sori-error" />
          <h2 className="text-[10px] font-black uppercase text-white tracking-[0.4em]">Integrity Nodes</h2>
          <div className="h-px flex-1 bg-white/5"></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <HealthCard label="Client" status="online" icon={<Box className="h-5 w-5" />} />
          <HealthCard label="Core" status={health?.backend} icon={<Server className="h-5 w-5" />} />
          <HealthCard label="DB" status={health?.database} icon={<Database className="h-5 w-5" />} />
          <HealthCard label="Storage" status={health?.storage} icon={<Cloud className="h-5 w-5" />} />
          <HealthCard label="Media" status={health?.livekit} icon={<Mic className="h-5 w-5" />} />
        </div>
      </div>
    </div>
  );
}

const HealthCard = ({ label, status, icon }: { label: string, status: string | undefined, icon: React.ReactNode }) => {
  const isOnline = status === "online";
  const isError = status === "error";
  const statusText = isOnline ? "ACTIVE" : isError ? "ERROR" : status || "SCAN...";
  
  return (
    <div className="bg-sori-sidebar border border-white/5 rounded-2xl p-4 flex flex-col gap-3 group hover:border-sori-error/30 transition-all relative overflow-hidden">
      <div className="absolute top-0 right-0 p-2 opacity-5 scale-75">{icon}</div>
      
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-all border shadow-lg",
        isOnline 
          ? 'bg-green-500/10 border-green-500/20 text-green-500' 
          : isError 
            ? 'bg-sori-error/10 border-sori-error/20 text-sori-error' 
            : 'bg-white/5 border-white/10 text-gray-500'
      )}>
        <div className={cn(isOnline ? 'animate-pulse' : '')}>{icon}</div>
      </div>
      
      <div className="space-y-0.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors">{label}</p>
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            isOnline ? 'bg-green-500' : isError ? 'bg-sori-error' : 'bg-gray-600'
          )}></div>
          <span className={cn(
            "text-[8px] font-black uppercase tracking-widest",
            isOnline ? 'text-white' : isError ? 'text-sori-error' : 'text-gray-500'
          )}>
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, description }: { icon: React.ReactNode, label: string, value: string | number, description: string }) => (
  <div className="bg-sori-sidebar border border-white/5 rounded-3xl p-5 shadow-xl relative overflow-hidden group hover:border-sori-error/50 transition-all duration-500">
    <div className="absolute -top-6 -right-6 p-10 opacity-5 group-hover:opacity-10 transition-all duration-700 group-hover:scale-110 text-white">
      <div className="scale-150">{icon}</div>
    </div>
    
    <div className="relative z-10 space-y-3">
      <header className="flex items-center justify-between">
        <div className="p-3 bg-black/20 border border-white/5 rounded-xl text-sori-error shadow-inner">
          {icon}
        </div>
        <span className="text-[9px] font-black uppercase text-gray-500 tracking-[0.2em]">{label}</span>
      </header>
      
      <div className="space-y-0.5">
        <div className="text-3xl font-black text-white tracking-tighter tabular-nums">
          {value}
        </div>
        <p className="text-[8px] font-bold text-gray-500 tracking-widest uppercase opacity-60">{description}</p>
      </div>
    </div>
    
    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-sori-error/0 group-hover:bg-sori-error transition-all duration-500"></div>
  </div>
);


