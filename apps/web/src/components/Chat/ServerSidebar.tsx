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
    <aside className="fixed left-0 top-0 h-full flex flex-col z-50 bg-sori-surface-base w-20 items-center py-4 space-y-4 border-r border-sori-border-subtle overflow-x-hidden overflow-y-auto no-scrollbar capitalize">
      {/* Home / Community Button */}
      <div 
        onClick={() => setActiveModule('community')}
        className={`w-12 h-12 flex items-center justify-center rounded-[1.5rem] shadow-lg cursor-pointer transition-all active:scale-95 group relative flex-shrink-0 border-none ${activeModule === 'community' ? 'bg-sori-accent-primary text-sori-text-on-primary' : 'bg-sori-surface-panel text-sori-text-muted hover:text-sori-accent-primary hover:rounded-xl'}`}
      >
        <Home className="h-6 w-6" />
      </div>

      <div className="w-8 h-px bg-sori-border-subtle flex-shrink-0"></div>

      <div className="flex-1 flex flex-col items-center space-y-3 w-full">
        {/* DM Button */}
        <div 
          onClick={() => setActiveModule('dm')}
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all cursor-pointer group relative flex-shrink-0 ${activeModule === 'dm' ? 'bg-sori-accent-primary text-sori-text-on-primary shadow-lg' : 'bg-sori-surface-panel text-sori-text-muted hover:text-sori-accent-primary'}`}
        >
          <MessageCircle className="h-6 w-6" />
          
          {/* Unread Badge */}
          {totalUnreadDMs > 0 && (
            <div className="absolute -top-1 -right-1 bg-sori-accent-danger text-sori-text-on-accent text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-sori-surface-panel animate-in zoom-in">
              {totalUnreadDMs > 99 ? '99+' : totalUnreadDMs}
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col items-center gap-4 pb-6 flex-shrink-0">
        <button 
          onClick={onOpenSettings}
          className="w-12 h-12 flex items-center justify-center text-sori-text-muted hover:text-sori-accent-primary hover:bg-sori-surface-hover rounded-xl transition-all"
        >
          <Settings className="h-6 w-6" />
        </button>
        <button 
          onClick={onLogout} 
          className="w-12 h-12 flex items-center justify-center text-sori-accent-danger hover:bg-sori-surface-danger-subtle rounded-xl transition-all"
        >
          <LogOut className="h-6 w-6" />
        </button>
      </div>
    </aside>
  );
};

// Assuming handleLogout logic should be handled by props or we keep the onLogout prop
