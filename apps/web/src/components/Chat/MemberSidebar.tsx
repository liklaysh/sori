import React from "react";
import { useChatStore } from "../../store/useChatStore";
import { getAvatarUrl } from "../../utils/avatar";

interface MemberSidebarProps {
  onlineUsersSet: Set<string>;
}

export const MemberSidebar: React.FC<MemberSidebarProps> = ({ onlineUsersSet }) => {
  const { members } = useChatStore();
  
  const onlineMembers = members.filter(m => onlineUsersSet.has(m.id));
  const offlineMembers = members.filter(m => !onlineUsersSet.has(m.id));

  const renderMember = (m: any, isOnline: boolean) => (
    <div 
      key={m.id} 
      className={`flex items-center gap-3 py-2 px-3 hover:bg-white/5 rounded-xl cursor-pointer group transition-all ${isOnline ? '' : 'opacity-40 grayscale'}`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black border transition-transform group-hover:scale-105 ${isOnline ? 'bg-secondary/20 text-secondary border-secondary/20' : 'bg-white/5 text-on-surface-variant border-white/5'} overflow-hidden`}>
          {getAvatarUrl(m.avatarUrl) ? (
            <img src={getAvatarUrl(m.avatarUrl)!} className="w-full h-full object-cover" />
          ) : (
            m.username?.[0]?.toUpperCase()
          )}
        </div>
        {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-secondary rounded-full border-2 border-sori-right shadow-sm"></div>}
      </div>
      <span className={`text-sm font-bold truncate ${isOnline ? 'text-secondary' : 'text-on-surface-variant'}`}>{m.username}</span>
    </div>
  );

  return (
    <aside className="h-full w-64 bg-sori-right border-l border-white/5 z-40 flex flex-col shrink-0">
      <div className="px-4 h-14 border-b border-white/5 flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-50">Members — {members.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6">
        <section>
          <h3 className="px-2 text-[10px] uppercase font-black text-on-surface-variant/40 mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div> 
            Online — {onlineMembers.length}
          </h3>
          <div className="space-y-1">
            {onlineMembers.map(m => renderMember(m, true))}
          </div>
        </section>
        <section>
          <h3 className="px-2 text-[10px] uppercase font-black text-on-surface-variant/20 mb-3 flex items-center gap-2">
            Offline — {offlineMembers.length}
          </h3>
          <div className="space-y-1">
            {offlineMembers.map(m => renderMember(m, false))}
          </div>
        </section>
      </div>
    </aside>
  );
};
