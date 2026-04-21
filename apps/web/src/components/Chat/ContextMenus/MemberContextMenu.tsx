import React from 'react';
import { Member } from '../../../types/chat';
import { MessageSquare, Phone } from 'lucide-react';
import { cn } from "@sori/ui";
import { getAvatarUrl } from '../../../utils/avatar';
import { useContextMenuPosition } from '../../../hooks/useContextMenuPosition';

interface MemberContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  member: Member | null;
  onlineUsersSet: Set<string>;
  currentUser: any;
  handleStartDM: (id: string) => void;
  handleStartCall: (member: Member) => void;
}

export const MemberContextMenu: React.FC<MemberContextMenuProps> = ({ 
  visible, x, y, member, onlineUsersSet, currentUser, handleStartDM, handleStartCall 
}) => {
  const menuStyles = useContextMenuPosition(x, y);

  if (!visible || !member) return null;

  const isOnline = onlineUsersSet.has(member.id);
  const isSelf = member.id === currentUser?.id;
  const memberRole = member.role || "member";

  const handleChatClick = () => handleStartDM(member.id);
  const handleCallClick = () => handleStartCall(member);

  return (
    <div 
      className="fixed z-[350] bg-sori-surface-panel border border-sori-border-subtle rounded-2xl shadow-2xl p-0 min-w-[220px] animate-in zoom-in-95 overflow-hidden shadow-black ring-1 ring-sori-border-subtle" 
      style={menuStyles}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-sori-accent-primary h-12 w-full shadow-inner"></div>
      <div className="px-4 pb-4 -mt-6">
         <div className="relative inline-block">
            {getAvatarUrl(member.avatarUrl) ? (
               <img 
                 src={getAvatarUrl(member.avatarUrl)!} 
                 className="w-16 h-16 rounded-2xl border-4 border-sori-surface-panel object-cover shadow-xl" 
                 alt={member.username} 
               />
            ) : (
               <div className="w-16 h-16 rounded-2xl border-4 border-sori-surface-panel bg-sori-surface-base flex items-center justify-center text-xl font-black text-sori-accent-primary shadow-xl">
                  {member.username[0].toUpperCase()}
               </div>
            )}
            <div className={cn(
               "absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-sori-surface-panel",
               isOnline ? "bg-sori-accent-secondary" : "bg-sori-surface-disabled"
            )}></div>
         </div>
          <div className="mt-2 text-center sm:text-left">
            <p className="text-base font-black text-sori-text-strong">{member.username}</p>
            <p className="text-[10px] font-black text-sori-accent-primary uppercase tracking-[0.2em] mt-1">
              {memberRole}
            </p>
            <p className="text-[10px] font-bold text-sori-text-muted uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-sori-accent-secondary animate-pulse" : "bg-sori-surface-disabled")}></span>
               {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
          <div className="h-px bg-sori-border-subtle my-3"></div>
          
          {!isSelf && (
            <>
              <button 
                onClick={handleChatClick}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sori-text-muted hover:bg-sori-surface-hover hover:text-sori-accent-primary transition-all font-bold text-xs group"
              >
                <MessageSquare className="h-4 w-4 text-sori-text-muted group-hover:text-sori-accent-primary" />
                Chat
              </button>
              <button 
                onClick={handleCallClick}
                disabled={!isOnline}
                className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-bold text-xs group",
                    isOnline ? "text-sori-text-muted hover:bg-sori-surface-accent-subtle hover:text-sori-accent-secondary" : "text-sori-text-disabled cursor-not-allowed"
                )}
              >
                <Phone className="h-4 w-4 text-sori-text-muted group-hover:text-sori-accent-secondary" />
                Call
              </button>
            </>
          )}
      </div>
    </div>
  );
};
