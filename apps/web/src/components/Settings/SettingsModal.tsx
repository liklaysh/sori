import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserStore } from "../../store/useUserStore";
import { 
  cn
} from "@sori/ui";
import { 
  User as UserIcon, 
  Settings2, 
  Bell,
  Menu,
  X 
} from "lucide-react";

import { ProfileTab } from "./Tabs/ProfileTab";
import { VoiceVideoTab } from "./Tabs/VoiceVideoTab";
import { NotificationsTab } from "./Tabs/NotificationsTab";
import { LanguageSelector } from "../Chat/LanguageSelector";
import api from "../../lib/api";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Equipment shared state (from useMediaSettings)
  micGain: number;
  setMicGain: (val: number) => void;
  outputVolume: number;
  setOutputVolume: (val: number) => void;
  micDevices: MediaDeviceInfo[];
  activeMicId?: string;
  setActiveMic: (id: string) => void;
  outputDevices: MediaDeviceInfo[];
  activeOutputId?: string;
  setActiveOutput: (id: string) => void;
  
  // RNNoise State
  noiseSuppression: boolean;
  toggleNoiseSuppression: () => void;
}

type Tab = "profile" | "equipment" | "notifications";

interface SystemVersion {
  name: string;
  version: string;
  buildId: string;
  commit: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const { user } = useUserStore();
  const { t } = useTranslation(["settings", "common"]);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [systemVersion, setSystemVersion] = useState<SystemVersion | null>(null);

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    let isMounted = true;

    api.get<SystemVersion>(`/api/system/version?t=${Date.now()}`, {
      headers: {
        "Cache-Control": "no-cache",
      },
    })
      .then((response) => {
        if (isMounted) {
          setSystemVersion(response.data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSystemVersion(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [props.isOpen]);

  if (!props.isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-sori-surface-overlay flex items-center justify-center animate-in fade-in duration-300">
      <div className="w-full h-full flex flex-col md:flex-row relative overflow-hidden bg-sori-surface-base">
        
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-sori-border-subtle flex items-center justify-between px-6 bg-sori-surface-panel shrink-0">
          <button onClick={() => setIsNavOpen(true)} className="flex items-center gap-3">
            <Menu className="h-5 w-5 text-sori-accent-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-sori-text-strong">
              {activeTab === "profile"
                ? t("settings:profile")
                : activeTab === "equipment"
                  ? t("settings:equipment")
                  : t("settings:notifications.title")}
            </span>
          </button>
          <button onClick={props.onClose} className="w-8 h-8 rounded-full bg-sori-surface-hover flex items-center justify-center transition-all">
            <X className="h-5 w-5 text-sori-text-muted" />
          </button>
        </header>

        {/* Navigation Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-[1100] w-72 bg-sori-surface-panel border-r border-sori-border-subtle flex flex-col p-6 transition-transform duration-300",
          "md:relative md:translate-x-0 md:z-auto md:pt-16",
          isNavOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="flex items-center justify-between mb-8 md:hidden">
            <h2 className="text-sm font-black uppercase tracking-widest text-sori-text-strong">{t("settings:title")}</h2>
            <button onClick={() => setIsNavOpen(false)}><X className="h-5 w-5 text-sori-text-muted" /></button>
          </div>

          <h2 className="text-[10px] font-black uppercase text-sori-text-muted tracking-[0.2em] mb-6 ml-4">{t("settings:userSettings")}</h2>
          <nav className="space-y-1">
            <TabItem icon="profile" label={t("settings:profile")} active={activeTab === "profile"} onClick={() => { setActiveTab("profile"); setIsNavOpen(false); }} />
            <TabItem icon="equipment" label={t("settings:equipment")} active={activeTab === "equipment"} onClick={() => { setActiveTab("equipment"); setIsNavOpen(false); }} />
            <TabItem icon="notifications" label={t("settings:notifications.title")} active={activeTab === "notifications"} onClick={() => { setActiveTab("notifications"); setIsNavOpen(false); }} />
          </nav>

          <div className="mt-auto pt-6">
            <div className="border-t border-sori-border-subtle pt-6">
              <LanguageSelector variant="panel" />
              {systemVersion && (
                <p className="mt-3 text-xs text-sori-text-dim">
                  {systemVersion.name} {systemVersion.version} • build {systemVersion.buildId}
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* Sidebar Backdrop for mobile */}
        {isNavOpen && <div className="fixed inset-0 bg-sori-surface-overlay z-[1050] md:hidden" onClick={() => setIsNavOpen(false)}></div>}

        {/* Main Content Area */}
        <main className="flex-1 bg-sori-surface-base flex flex-col pt-8 md:pt-16 px-6 md:px-12 relative overflow-y-auto no-scrollbar">
          
          <button 
            onClick={props.onClose}
            className="hidden md:flex absolute top-8 right-12 w-10 h-10 items-center justify-center rounded-full border border-sori-border-medium text-sori-text-muted hover:text-white hover:bg-sori-surface-elevated transition-all hover:rotate-90 group"
          >
            <X className="h-6 w-6 group-active:scale-90" />
          </button>

          <div className="max-w-3xl w-full mx-auto pb-20">
            {activeTab === "profile" ? (
              <ProfileTab />
            ) : activeTab === "equipment" ? (
              <VoiceVideoTab 
                micGain={props.micGain} setMicGain={props.setMicGain}
                outputVolume={props.outputVolume} setOutputVolume={props.setOutputVolume}
                micDevices={props.micDevices} activeMicId={props.activeMicId} setActiveMic={props.setActiveMic}
                outputDevices={props.outputDevices} activeOutputId={props.activeOutputId} setActiveOutput={props.setActiveOutput}
                noiseSuppression={props.noiseSuppression} toggleNoiseSuppression={props.toggleNoiseSuppression}
              />
            ) : (
              <NotificationsTab />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const TabItem = ({ icon, label, active, onClick }: { icon: "profile" | "equipment" | "notifications", label: string, active: boolean, onClick: () => void }) => {
  const Icon = icon === "profile" ? UserIcon : icon === "equipment" ? Settings2 : Bell;
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer transition-all group",
        active ? 'bg-sori-accent-primary text-white shadow-xl' : 'text-sori-text-muted hover:bg-sori-surface-hover hover:text-white'
      )}
    >
      <Icon className={cn("h-5 w-5 transition-all", active ? 'text-white scale-110' : 'text-sori-text-muted group-hover:scale-110')} />
      <span className="text-sm font-black tracking-tight uppercase">{label}</span>
    </div>
  );
};
