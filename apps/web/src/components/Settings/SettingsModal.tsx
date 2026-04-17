import React, { useState } from "react";
import { useUserStore } from "../../store/useUserStore";
import { 
  cn
} from "@sori/ui";
import { 
  User as UserIcon, 
  Settings2, 
  Menu,
  X 
} from "lucide-react";

import { ProfileTab } from "./Tabs/ProfileTab";
import { VoiceVideoTab } from "./Tabs/VoiceVideoTab";

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

type Tab = "profile" | "equipment";

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const { user } = useUserStore();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [isNavOpen, setIsNavOpen] = useState(false);

  if (!props.isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-[#1e2124] flex items-center justify-center animate-in fade-in duration-300">
      <div className="w-full h-full flex flex-col md:flex-row relative overflow-hidden bg-[#1e2124]">
        
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-white/5 flex items-center justify-between px-6 bg-sori-sidebar shrink-0">
          <button onClick={() => setIsNavOpen(true)} className="flex items-center gap-3">
            <Menu className="h-5 w-5 text-sori-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white">
              {activeTab === "profile" ? "Profile" : "Equipment"}
            </span>
          </button>
          <button onClick={props.onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center transition-all">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </header>

        {/* Navigation Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-[1100] w-72 bg-sori-sidebar border-r border-white/5 flex flex-col p-6 transition-transform duration-300",
          "md:relative md:translate-x-0 md:z-auto md:pt-16",
          isNavOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="flex items-center justify-between mb-8 md:hidden">
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Settings</h2>
            <button onClick={() => setIsNavOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
          </div>

          <h2 className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-6 ml-4">User Settings</h2>
          <nav className="space-y-1">
            <TabItem icon="profile" label="Profile" active={activeTab === "profile"} onClick={() => { setActiveTab("profile"); setIsNavOpen(false); }} />
            <TabItem icon="equipment" label="Equipment" active={activeTab === "equipment"} onClick={() => { setActiveTab("equipment"); setIsNavOpen(false); }} />
          </nav>
        </aside>

        {/* Sidebar Backdrop for mobile */}
        {isNavOpen && <div className="fixed inset-0 bg-black/60 z-[1050] md:hidden" onClick={() => setIsNavOpen(false)}></div>}

        {/* Main Content Area */}
        <main className="flex-1 bg-[#1e2124] flex flex-col pt-8 md:pt-16 px-6 md:px-12 relative overflow-y-auto no-scrollbar">
          
          <button 
            onClick={props.onClose}
            className="hidden md:flex absolute top-8 right-12 w-10 h-10 items-center justify-center rounded-full border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all hover:rotate-90 group"
          >
            <X className="h-6 w-6 group-active:scale-90" />
          </button>

          <div className="max-w-3xl w-full mx-auto pb-20">
            {activeTab === "profile" ? (
              <ProfileTab />
            ) : (
              <VoiceVideoTab 
                micGain={props.micGain} setMicGain={props.setMicGain}
                outputVolume={props.outputVolume} setOutputVolume={props.setOutputVolume}
                micDevices={props.micDevices} activeMicId={props.activeMicId} setActiveMic={props.setActiveMic}
                outputDevices={props.outputDevices} activeOutputId={props.activeOutputId} setActiveOutput={props.setActiveOutput}
                noiseSuppression={props.noiseSuppression} toggleNoiseSuppression={props.toggleNoiseSuppression}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const TabItem = ({ icon, label, active, onClick }: { icon: "profile" | "equipment", label: string, active: boolean, onClick: () => void }) => {
  const Icon = icon === "profile" ? UserIcon : Settings2;
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer transition-all group",
        active ? 'bg-primary text-white shadow-xl shadow-primary/10' : 'text-on-surface-variant hover:bg-white/5 hover:text-white'
      )}
    >
      <Icon className={cn("h-5 w-5 transition-all", active ? 'text-white scale-110' : 'text-gray-500 group-hover:scale-110')} />
      <span className="text-sm font-black tracking-tight uppercase">{label}</span>
    </div>
  );
};
