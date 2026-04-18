import React, { useEffect, useState } from "react";

// Stores
import { useUserStore } from "../store/useUserStore";
import { useChatStore } from "../store/useChatStore";
import { useUIStore } from "../store/useUIStore";

// Hooks & Libs
import { useChatSocket } from "../hooks/useChatSocket";
import { useMediaSettings } from "../hooks/useMediaSettings";

// Components
import { ServerSidebar } from "../components/Chat/ServerSidebar";
import { ChannelSidebar } from "../components/Chat/ChannelSidebar";
import { DMSidebar } from "../components/Chat/DMSidebar";
import { ChatArea } from "../components/Chat/ChatArea";
import { MemberSidebar } from "../components/Chat/MemberSidebar";
import { SettingsModal } from "../components/Settings/SettingsModal";
import { Toaster } from "@sori/ui";

// Modals
import { LogoutModal } from "../components/Chat/Modals/LogoutModal";
import { FindFriendModal } from "../components/Chat/Modals/FindFriendModal";

const Chat: React.FC = () => {
  const { user, isAuthenticated, logout } = useUserStore();
  const { 
    fetchInitialData, fetchConversations,
    conversations
  } = useChatStore();
  
  const { 
    activeModule, setActiveModule, 
    isSettingsOpen, setSettingsOpen,
    isChannelSidebarOpen, setChannelSidebarOpen,
    isMemberSidebarOpen, setMemberSidebarOpen,
    isVoiceChatOpen, setIsVoiceChatOpen
  } = useUIStore();

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isFindFriendOpen, setIsFindFriendOpen] = useState(false);

  // Initialize Socket (URL and auth handled internally)
  const { socket, onlineUsersSet } = useChatSocket();
  
  console.log("[DIAGNOSTIC] Chat.tsx - onlineUsersSet:", Array.from(onlineUsersSet));

  // Media Settings
  const media = useMediaSettings({ initialUser: user! });

  // Initial Data Load
  useEffect(() => {
    if (isAuthenticated) {
      fetchInitialData("default-community");
      fetchConversations();
    }
  }, [isAuthenticated, fetchInitialData, fetchConversations]);

  const totalUnreadDMs = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  if (!user) return null;

  return (
    <div className="flex h-screen pl-20 overflow-hidden bg-sori-surface-base text-sori-text-primary font-body relative select-none">
      <ServerSidebar 
        onLogout={() => setIsLogoutModalOpen(true)} 
        onOpenSettings={() => setSettingsOpen(true)} 
        activeModule={activeModule} 
        setActiveModule={setActiveModule} 
        totalUnreadDMs={totalUnreadDMs} 
      />

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`fixed inset-y-0 left-20 right-0 z-40 md:relative md:left-0 md:inset-auto md:z-auto md:flex ${isChannelSidebarOpen ? "flex" : "hidden"}`}>
          <div className="absolute inset-0 bg-sori-surface-overlay md:hidden" onClick={() => setChannelSidebarOpen(false)} />
          
          <div className="relative h-full flex-shrink-0 z-50">
            {activeModule === "community" ? (
              <ChannelSidebar 
                socket={socket}
                setIsVoiceChatOpen={setIsVoiceChatOpen}
                {...media}
              />
            ) : (
              <DMSidebar 
                setIsVoiceChatOpen={setIsVoiceChatOpen}
                socket={socket}
                onlineUsersSet={onlineUsersSet}
                onOpenFindFriend={() => setIsFindFriendOpen(true)}
                {...media}
              />
            )}
          </div>
        </div>

        <ChatArea 
          socket={socket}
          isVoiceChatOpen={isVoiceChatOpen}
          setIsVoiceChatOpen={setIsVoiceChatOpen}
          onlineUsersSet={onlineUsersSet}
          {...media}
        />

        {activeModule === "community" && !isVoiceChatOpen && (
          <div className={`fixed inset-0 z-40 xl:relative xl:inset-auto xl:z-auto ${isMemberSidebarOpen ? "flex xl:flex" : "hidden xl:hidden"}`}>
            <div className="absolute inset-0 bg-sori-surface-overlay xl:hidden" onClick={() => setMemberSidebarOpen(false)} />
            <MemberSidebar onlineUsersSet={onlineUsersSet} />
          </div>
        )}
      </div>

      <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} handleLogout={logout} />
      <FindFriendModal isOpen={isFindFriendOpen} onClose={() => setIsFindFriendOpen(false)} onlineUsersSet={onlineUsersSet} />
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        {...media}
      />
      
      <Toaster />
    </div>
  );
};

export default Chat;
