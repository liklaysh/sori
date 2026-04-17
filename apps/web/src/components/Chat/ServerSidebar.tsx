import React from "react";
import { Home, MessageCircle, Settings, LogOut } from "lucide-react";

interface ServerSidebarProps {
  onLogout: () => void;
  onOpenSettings: () => void;
  activeModule: 'community' | 'dm';
  setActiveModule: (module: 'community' | 'dm') => void;
  totalUnreadDMs: number;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({ 
  onLogout, 
  onOpenSettings, 
  activeModule, 
  setActiveModule,
  totalUnreadDMs
}) => {
  return (
    <aside className="fixed left-0 top-0 h-full flex flex-col z-50 bg-sori-server w-20 items-center py-4 space-y-4 border-r border-white/5 overflow-x-hidden overflow-y-auto no-scrollbar capitalize">
      {/* Home / Community Button */}
      <div 
        onClick={() => setActiveModule('community')}
        className={`w-12 h-12 flex items-center justify-center rounded-[1.5rem] shadow-lg cursor-pointer transition-all active:scale-95 group relative flex-shrink-0 ${activeModule === 'community' ? 'bg-primary-gradient text-white' : 'bg-sori-chat text-on-surface-variant hover:text-primary hover:rounded-xl'}`}
      >
        <Home className="h-6 w-6" />
      </div>

      <div className="w-8 h-px bg-white/10 flex-shrink-0"></div>

      <div className="flex-1 flex flex-col items-center space-y-3 w-full">
        {/* DM Button */}
        <div 
          onClick={() => setActiveModule('dm')}
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all cursor-pointer group relative flex-shrink-0 ${activeModule === 'dm' ? 'bg-primary-gradient text-white shadow-lg shadow-primary/20' : 'bg-sori-chat text-on-surface-variant hover:text-primary'}`}
        >
          <MessageCircle className="h-6 w-6" />
          
          {/* Unread Badge */}
          {totalUnreadDMs > 0 && (
            <div className="absolute -top-1 -right-1 bg-sori-error text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-sori-server animate-in zoom-in">
              {totalUnreadDMs > 99 ? '99+' : totalUnreadDMs}
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col items-center gap-4 pb-6 flex-shrink-0">
        <button 
          onClick={onOpenSettings}
          className="w-12 h-12 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-white/5 rounded-xl transition-all"
        >
          <Settings className="h-6 w-6" />
        </button>
        <button 
          onClick={onLogout} 
          className="w-12 h-12 flex items-center justify-center text-sori-error/70 hover:text-sori-error hover:bg-sori-error/10 rounded-xl transition-all"
        >
          <LogOut className="h-6 w-6" />
        </button>
      </div>
    </aside>
  );
};

// Assuming handleLogout logic should be handled by props or we keep the onLogout prop
