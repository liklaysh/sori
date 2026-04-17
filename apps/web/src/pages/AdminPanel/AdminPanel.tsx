import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { 
  LayoutDashboard, 
  Users, 
  Hash, 
  Settings, 
  Database, 
  Terminal, 
  History, 
  Save, 
  LogOut, 
  Menu, 
  X,
  ShieldAlert,
  ShieldCheck,
  Activity
} from "lucide-react";

import DashboardTab from "./tabs/DashboardTab";
import UsersTab from "./tabs/UsersTab";
import ChannelsTab from "./tabs/ChannelsTab";
import SettingsTab from "./tabs/SettingsTab";
import ServerLogTab from "./tabs/ServerLogTab";
import AuditLogTab from "./tabs/AuditLogTab";
import BackupsTab from "./tabs/BackupsTab";
import StorageTab from "./tabs/StorageTab";
import TelemetryTab from "./tabs/TelemetryTab";

import { API_URL } from "../../config";
import { useUserStore } from "../../store/useUserStore";

type AdminTab = "dashboard" | "users" | "channels" | "settings" | "logs" | "audit" | "backups" | "storage" | "telemetry";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useUserStore();

  useEffect(() => {
    // Auto-close sidebar on tab change (mobile)
    setIsSidebarOpen(false);
  }, [activeTab]);

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; section?: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" />, section: "Overview" },
    { id: "users", label: "Users", icon: <Users className="h-5 w-5" />, section: "Management" },
    { id: "channels", label: "Channels", icon: <Hash className="h-5 w-5" /> },
    { id: "settings", label: "Settings", icon: <Settings className="h-5 w-5" />, section: "System" },
    { id: "storage", label: "Media Storage", icon: <Database className="h-5 w-5" /> },
    { id: "logs", label: "Server Log", icon: <Terminal className="h-5 w-5" /> },
    { id: "audit", label: "Audit Log", icon: <History className="h-5 w-5" /> },
    { id: "telemetry", label: "Telemetry", icon: <Activity className="h-5 w-5" />, section: "Analytics" },
    { id: "backups", label: "Backups", icon: <Save className="h-5 w-5" /> },
  ];

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="h-screen flex bg-[#323338] font-sans text-white overflow-hidden relative">
      
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[100] lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[110] w-72 bg-sori-sidebar border-r border-white/5 flex flex-col p-6 transition-transform duration-300
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between mb-8 ml-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sori-error/10 flex items-center justify-center text-sori-error border border-sori-error/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Admin <span className="text-sori-error underline underline-offset-4 decoration-2">Panel</span></h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-lg transition-all">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto custom-scrollbar pr-1">
          {tabs.map((tab, index) => (
            <React.Fragment key={tab.id}>
              {tab.section && (
                <h2 className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-3 ml-4 mt-6 first:mt-2">
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

        <div className="mt-4 pt-4 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-sori-error/10 hover:text-sori-error transition-all group"
          >
            <LogOut className="h-5 w-5 group-hover:rotate-12 transition-transform" />
            <span className="text-sm font-bold">Logout System</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#323338]">
        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-sori-sidebar/50 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-400 hover:text-white">
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm tracking-widest uppercase text-gray-400">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded-full bg-sori-error/10 border border-sori-error/20 text-[10px] font-black uppercase text-sori-error tracking-widest">
              Live System
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-6xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === "dashboard" && <DashboardTab />}
            {activeTab === "users" && <UsersTab />}
            {activeTab === "channels" && <ChannelsTab />}
            {activeTab === "settings" && <SettingsTab />}
            {activeTab === "logs" && <ServerLogTab />}
            {activeTab === "audit" && <AuditLogTab />}
            {activeTab === "telemetry" && <TelemetryTab />}
            {activeTab === "backups" && <BackupsTab />}
            {activeTab === "storage" && <StorageTab />}
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
        ? 'bg-sori-error text-white shadow-lg shadow-sori-error/20' 
        : 'text-gray-400 hover:bg-white/5 hover:text-white'}
    `}
  >
    <div className={`transition-all ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
      {icon}
    </div>
    <span className="text-sm font-bold">{label}</span>
  </button>
);

