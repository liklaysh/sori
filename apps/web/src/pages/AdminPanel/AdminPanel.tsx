import React, { Suspense, lazy, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { 
  LayoutDashboard, 
  Users, 
  Hash, 
  Settings, 
  Database, 
  History, 
  Save, 
  LogOut, 
  Menu, 
  ShieldCheck,
  Activity
} from "lucide-react";

import { useUserStore } from "../../store/useUserStore";

const DashboardTab = lazy(() => import("./tabs/DashboardTab"));
const UsersTab = lazy(() => import("./tabs/UsersTab"));
const ChannelsTab = lazy(() => import("./tabs/ChannelsTab"));
const SettingsTab = lazy(() => import("./tabs/SettingsTab"));
const AuditLogTab = lazy(() => import("./tabs/AuditLogTab"));
const BackupsTab = lazy(() => import("./tabs/BackupsTab"));
const StorageTab = lazy(() => import("./tabs/StorageTab"));
const TelemetryTab = lazy(() => import("./tabs/TelemetryTab"));

type AdminTab = "dashboard" | "users" | "channels" | "settings" | "audit" | "backups" | "storage" | "telemetry";

const AdminTabLoader = () => (
  <AdminTabLoaderInner />
);

const AdminTabLoaderInner = () => {
  const { t } = useTranslation(["admin"]);
  return (
    <div className="min-h-[22rem] flex items-center justify-center">
      <div className="animate-pulse text-[11px] font-black uppercase tracking-[0.24em] text-sori-text-muted">
        {t("admin:shell.syncingModule")}
      </div>
    </div>
  );
};

export default function AdminPanel() {
  const { t } = useTranslation(["admin"]);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useUserStore();

  useEffect(() => {
    // Auto-close sidebar on tab change (mobile)
    setIsSidebarOpen(false);
  }, [activeTab]);

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; section?: string }[] = [
    { id: "dashboard", label: t("admin:shell.tabs.dashboard"), icon: <LayoutDashboard className="h-5 w-5" />, section: t("admin:shell.sections.overview") },
    { id: "users", label: t("admin:shell.tabs.users"), icon: <Users className="h-5 w-5" />, section: t("admin:shell.sections.management") },
    { id: "channels", label: t("admin:shell.tabs.channels"), icon: <Hash className="h-5 w-5" /> },
    { id: "settings", label: t("admin:shell.tabs.settings"), icon: <Settings className="h-5 w-5" />, section: t("admin:shell.sections.system") },
    { id: "storage", label: t("admin:shell.tabs.storage"), icon: <Database className="h-5 w-5" /> },
    { id: "audit", label: t("admin:shell.tabs.audit"), icon: <History className="h-5 w-5" /> },
    { id: "telemetry", label: t("admin:shell.tabs.telemetry"), icon: <Activity className="h-5 w-5" />, section: t("admin:shell.sections.analytics") },
    { id: "backups", label: t("admin:shell.tabs.backups"), icon: <Save className="h-5 w-5" /> },
  ];

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="h-screen flex bg-sori-surface-base font-sans text-sori-text-primary overflow-hidden relative">
      
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-sori-surface-overlay z-[100] lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[110] w-72 bg-sori-surface-main border-r border-sori-border-subtle flex flex-col p-6 transition-transform duration-300
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center gap-2 mb-8">
          <div className="p-1.5 bg-sori-accent-danger rounded-lg">
            <ShieldCheck className="h-5 w-5 text-sori-text-on-accent" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-sori-text-strong uppercase">{t("admin:shell.systemPulse")}</h1>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto custom-scrollbar pr-1">
          {tabs.map((tab, index) => (
            <React.Fragment key={tab.id}>
              {tab.section && (
                <h2 className="text-[10px] font-black uppercase text-sori-text-muted tracking-[0.2em] mb-3 ml-4 mt-6 first:mt-2">
                  {tab.section}
                </h2>
              )}
              <TabItem 
                icon={tab.icon} 
                label={tab.label} 
                active={activeTab === tab.id} 
                onClick={() => setActiveTab(tab.id)} 
              />
            </React.Fragment>
          ))}
        </nav>

        <div className="mt-4 pt-4 border-t border-sori-border-subtle">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sori-text-muted hover:bg-sori-surface-hover hover:text-sori-text-strong transition-all group"
          >
            <LogOut className="h-5 w-5 group-hover:rotate-12 transition-transform" />
            <span className="text-sm font-bold">{t("admin:shell.logoutSystem")}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-sori-surface-base">
        {/* Header */}
        <header className="h-16 border-b border-sori-border-subtle flex items-center justify-between px-8 bg-sori-surface-main shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-sori-text-muted hover:text-sori-text-strong">
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm tracking-widest uppercase text-sori-text-muted">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-sori-surface-main border border-sori-border-subtle px-4 py-2 rounded-xl shrink-0">
            <div className="w-2 h-2 rounded-full bg-sori-accent-secondary shadow-lg animate-pulse"></div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-sori-text-strong">{t("admin:shell.statusStable")}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-6xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Suspense fallback={<AdminTabLoader />}>
              {activeTab === "dashboard" && <DashboardTab />}
              {activeTab === "users" && <UsersTab />}
              {activeTab === "channels" && <ChannelsTab />}
              {activeTab === "settings" && <SettingsTab />}
              {activeTab === "audit" && <AuditLogTab />}
              {activeTab === "telemetry" && <TelemetryTab />}
              {activeTab === "backups" && <BackupsTab />}
              {activeTab === "storage" && <StorageTab />}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

const TabItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all group
      ${active 
        ? 'bg-sori-accent-danger text-sori-text-on-accent shadow-lg' 
        : 'text-sori-text-muted hover:bg-sori-surface-hover hover:text-sori-text-strong'}
    `}
  >
    <div className={`transition-all ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
      {icon}
    </div>
    <span className="text-sm font-bold">{label}</span>
  </button>
);
