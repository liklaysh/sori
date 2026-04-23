import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["admin"]);
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
      <div className="flex flex-col items-center justify-center py-24 text-sori-text-muted gap-4">
        <Activity className="h-10 w-10 animate-spin text-sori-accent-danger" />
        <p className="text-xs animate-pulse tracking-widest text-sori-accent-danger uppercase font-black">{t("admin:dashboard.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-sori-accent-danger pl-6 py-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-sori-accent-danger rounded-lg">
              <ShieldCheck className="h-5 w-5 text-sori-text-on-accent" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-sori-text-strong uppercase">{t("admin:dashboard.title")}</h1>
          </div>
          <p className="text-sori-text-muted text-[10px] font-medium max-w-lg tracking-wide uppercase">
            {t("admin:dashboard.description")}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-sori-surface-main border border-sori-border-subtle px-4 py-2 rounded-xl shrink-0">
          <div className="w-2 h-2 rounded-full bg-sori-accent-secondary shadow-lg animate-pulse"></div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-sori-text-strong">{t("admin:dashboard.statusStable")}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          icon={<Clock className="h-5 w-5" />} 
          label={t("admin:dashboard.uptime")} 
          value={stats ? `${Math.floor(stats.uptime / 60)}m` : "---"} 
          description={t("admin:dashboard.uptimeDescription")}
        />
        <StatCard 
          icon={<Cpu className="h-5 w-5" />} 
          label={t("admin:dashboard.memory")} 
          value={stats ? `${Math.round(stats.memory.heapUsed / 1024 / 1024)}MB` : "---"} 
          description={t("admin:dashboard.memoryDescription")}
        />
        <StatCard 
          icon={<Users className="h-5 w-5" />} 
          label={t("admin:dashboard.users")} 
          value={stats?.totalUsers ?? "---"} 
          description={t("admin:dashboard.usersDescription")}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <Zap className="h-4 w-4 text-sori-accent-danger fill-sori-accent-danger" />
          <h2 className="text-[10px] font-black uppercase text-sori-text-strong tracking-[0.4em]">{t("admin:dashboard.integrityNodes")}</h2>
          <div className="h-px flex-1 bg-sori-border-subtle"></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <HealthCard label={t("admin:dashboard.client")} status="online" icon={<Box className="h-5 w-5" />} />
          <HealthCard label={t("admin:dashboard.core")} status={health?.backend} icon={<Server className="h-5 w-5" />} />
          <HealthCard label={t("admin:dashboard.database")} status={health?.database} icon={<Database className="h-5 w-5" />} />
          <HealthCard label={t("admin:dashboard.storage")} status={health?.storage} icon={<Cloud className="h-5 w-5" />} />
          <HealthCard label={t("admin:dashboard.media")} status={health?.livekit} icon={<Mic className="h-5 w-5" />} />
        </div>
      </div>
    </div>
  );
}

const HealthCard = ({ label, status, icon }: { label: string, status: string | undefined, icon: React.ReactNode }) => {
  const { t } = useTranslation(["admin"]);
  const isOnline = status === "online";
  const isError = status === "error";
  const statusText = isOnline ? t("admin:dashboard.active") : isError ? t("admin:dashboard.error") : status || t("admin:dashboard.scan");
  
  return (
    <div className="bg-sori-surface-main border border-sori-border-subtle rounded-2xl p-4 flex flex-col gap-3 group hover:border-sori-accent-danger transition-all relative overflow-hidden">
      <div className="absolute top-0 right-0 p-2 text-sori-text-dim scale-75 opacity-0 group-hover:opacity-100 transition-opacity duration-300">{icon}</div>
      
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-all border shadow-lg",
        isOnline 
          ? 'bg-sori-surface-accent-subtle border-sori-accent-secondary text-sori-accent-secondary' 
          : isError 
            ? 'bg-sori-surface-danger-subtle border-sori-accent-danger text-sori-accent-danger' 
            : 'bg-sori-surface-active border-sori-border-strong text-sori-text-dim'
      )}>
        <div className={cn(isOnline ? 'animate-pulse' : '')}>{icon}</div>
      </div>
      
      <div className="space-y-0.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-sori-text-muted group-hover:text-sori-text-strong transition-colors">{label}</p>
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            isOnline ? 'bg-sori-accent-secondary' : isError ? 'bg-sori-accent-danger' : 'bg-sori-surface-active'
          )}></div>
          <span className={cn(
            "text-[8px] font-black uppercase tracking-widest",
            isOnline ? 'text-sori-text-strong' : isError ? 'text-sori-accent-danger' : 'text-sori-text-muted'
          )}>
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, description }: { icon: React.ReactNode, label: string, value: string | number, description: string }) => (
  <div className="bg-sori-surface-main border border-sori-border-subtle rounded-3xl p-5 shadow-xl relative overflow-hidden group hover:border-sori-accent-danger transition-all duration-500">
    <div className="absolute -top-6 -right-6 p-10 group-hover:scale-110 text-sori-text-dim group-hover:text-sori-text-strong transition-all duration-700">
      <div className="scale-150">{icon}</div>
    </div>
    
    <div className="relative z-10 space-y-3">
      <header className="flex items-center justify-between">
        <div className="p-3 bg-sori-surface-base border border-sori-border-subtle rounded-xl text-sori-accent-danger shadow-inner">
          {icon}
        </div>
        <span className="text-[9px] font-black uppercase text-sori-text-muted tracking-[0.2em]">{label}</span>
      </header>
      
      <div className="space-y-0.5">
        <div className="text-3xl font-black text-sori-text-strong tracking-tighter tabular-nums">
          {value}
        </div>
        <p className="text-[8px] font-bold text-sori-text-muted tracking-widest uppercase">{description}</p>
      </div>
    </div>
    
    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-sori-accent-danger invisible group-hover:visible transition-all duration-500"></div>
  </div>
);
