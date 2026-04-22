import React from "react";
import { useChatStore } from "../../store/useChatStore";
import { Member } from "../../types/chat";
import { getAvatarUrl } from "../../utils/avatar";
import { cn } from "@sori/ui";

interface MemberSidebarProps {
  onlineUsersSet: Set<string>;
  onMemberClick?: (member: Member, x: number, y: number) => void;
}

export const MemberSidebar: React.FC<MemberSidebarProps> = ({ onlineUsersSet, onMemberClick }) => {
  const { members } = useChatStore();
  
  const onlineMembers = members.filter(m => onlineUsersSet.has(m.id));
  const offlineMembers = members.filter(m => !onlineUsersSet.has(m.id));

  const renderMember = (m: Member, isOnline: boolean) => (
    <div 
      key={m.id} 
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMemberClick?.(m, e.clientX, e.clientY);
      }}
      className={cn(
        "flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer group transition-all active:scale-[0.98]",
        isOnline ? "hover:bg-sori-surface-hover" : "text-sori-text-dim grayscale"
      )}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black border transition-transform group-hover:scale-105 ${isOnline ? 'bg-sori-surface-accent-subtle text-sori-accent-secondary border-sori-border-accent' : 'bg-sori-surface-panel text-sori-text-muted border-sori-border-subtle'} overflow-hidden`}>
          {getAvatarUrl(m.avatarUrl) ? (
            <img src={getAvatarUrl(m.avatarUrl)!} className="w-full h-full object-cover" />
          ) : (
            m.username?.[0]?.toUpperCase()
          )}
        </div>
        {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-sori-accent-secondary rounded-full border-2 border-sori-surface-panel shadow-sm"></div>}
      </div>
      <span className={`text-sm font-bold truncate ${isOnline ? 'text-sori-accent-secondary' : 'text-sori-text-muted'}`}>{m.username}</span>
    </div>
  );

  return (
    <aside className="h-full min-h-0 w-64 bg-sori-surface-panel border-l border-sori-border-subtle z-40 flex flex-col shrink-0">
      <div className="px-4 h-14 border-b border-sori-border-subtle flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] font-black uppercase tracking-widest text-sori-text-muted">Members — {members.length}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-6">
        <section>
          <h3 className="px-2 text-[9px] uppercase font-black text-sori-text-dim mb-3 flex items-center gap-2 tracking-[0.2em] opacity-80">
            <div className="w-1.5 h-1.5 bg-sori-accent-secondary rounded-full shadow-[0_0_8px_rgba(109,245,225,0.4)]"></div> 
            Online — {onlineMembers.length}
          </h3>
          <div className="space-y-1">
            {onlineMembers.map(m => renderMember(m, true))}
          </div>
        </section>
        <section>
          <h3 className="px-2 text-[9px] uppercase font-black text-sori-text-dim mb-3 flex items-center gap-2 tracking-[0.2em] opacity-80">
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
