import React from "react";
import { useChatStore } from "../../store/useChatStore";

interface MentionPopupProps {
  filter: string;
  onSelect: (username: string) => void;
}

export const MentionPopup: React.FC<MentionPopupProps> = ({ filter, onSelect }) => {
  const { members } = useChatStore();
  
  const filteredUsers = members.filter(u => 
    u.username.toLowerCase().includes(filter.toLowerCase())
  ).slice(0, 8);

  const showEveryone = "everyone".includes(filter.toLowerCase());

  if (filteredUsers.length === 0 && !showEveryone) return null;

  return (
    <div className="absolute bottom-full left-0 w-full bg-sori-surface-panel border border-sori-border-subtle border-b-0 rounded-t-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-2 duration-300 overflow-hidden">
      <div className="p-2 space-y-1">
        
        {filteredUsers.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-sori-accent-primary">
              Members
            </div>
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => onSelect(user.username)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-sori-surface-accent-subtle cursor-pointer transition-all group"
              >
                <div className="w-6 h-6 rounded-lg bg-sori-surface-accent-subtle flex items-center justify-center text-[10px] font-black text-sori-accent-primary border border-sori-border-accent">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-sm font-bold text-white group-hover:text-sori-accent-primary transition-colors">
                  {user.username}
                </span>
              </div>
            ))}
          </div>
        )}

        {filteredUsers.length > 0 && showEveryone && (
          <div className="h-px bg-sori-border-subtle my-2 mx-2"></div>
        )}

        {showEveryone && (
          <div className="space-y-1">
            <div
              onClick={() => onSelect("everyone")}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-sori-surface-secondary-subtle cursor-pointer transition-all group"
            >
              <div className="w-6 h-6 rounded-lg bg-sori-surface-secondary-subtle flex items-center justify-center text-[10px] font-black text-sori-accent-secondary border border-sori-border-secondary-subtle">
                @
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white group-hover:text-sori-accent-secondary transition-colors">
                  @everyone
                </span>
                <span className="text-[9px] font-medium text-sori-text-muted">
                  Notify everyone in this channel
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
