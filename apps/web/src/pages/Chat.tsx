import React, { Suspense, lazy, useEffect, useRef, useState } from "react";

// Stores
import { useUserStore } from "../store/useUserStore";
import { useChatStore } from "../store/useChatStore";
import { useUIStore } from "../store/useUIStore";
import { Member } from "../types/chat";

// Hooks & Libs
import { useChatSocket } from "../hooks/useChatSocket";
import { useMediaSettings } from "../hooks/useMediaSettings";
import { useCall } from "../hooks/useCall";
import { preloadNotificationSounds } from "../utils/notificationSounds";

// Components
import { ServerSidebar } from "../components/Chat/ServerSidebar";
import { ChannelSidebar } from "../components/Chat/ChannelSidebar";
import { DMSidebar } from "../components/Chat/DMSidebar";
import { ChatArea } from "../components/Chat/ChatArea";
import { MemberSidebar } from "../components/Chat/MemberSidebar";
import { MemberContextMenu } from "../components/Chat/ContextMenus/MemberContextMenu";

const SettingsModal = lazy(() =>
  import("../components/Settings/SettingsModal").then((module) => ({ default: module.SettingsModal })),
);
const CallOverlay = lazy(() =>
  import("../components/Chat/Voice/CallOverlay").then((module) => ({ default: module.CallOverlay })),
);
const LogoutModal = lazy(() =>
  import("../components/Chat/Modals/LogoutModal").then((module) => ({ default: module.LogoutModal })),
);
const FindFriendModal = lazy(() =>
  import("../components/Chat/Modals/FindFriendModal").then((module) => ({ default: module.FindFriendModal })),
);

const Chat: React.FC = () => {
  const { user, isAuthenticated, logout } = useUserStore();
  
  const { 
    fetchInitialData, fetchConversations,
    conversations, startDM, members
  } = useChatStore();
  
  const { 
    activeModule, setActiveModule, 
    isSettingsOpen, setSettingsOpen,
    isChannelSidebarOpen, setChannelSidebarOpen,
    isMemberSidebarOpen, setMemberSidebarOpen,
    isVoiceChatOpen, setIsVoiceChatOpen,
    memberContextMenu, setMemberContextMenu,
    setActiveConversationId, activeConversationId
  } = useUIStore();

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isFindFriendOpen, setIsFindFriendOpen] = useState(false);
  const initializedDirectCallRef = useRef<string | null>(null);

  // Initialize Socket (URL and auth handled internally)
  const { socket, onlineUsersSet } = useChatSocket();
  

  // Media Settings
  const media = useMediaSettings({ initialUser: user! });

  // Call Orchestration (Source of Truth)
  const call = useCall({ socket });
  const isDirectCallOverlayVisible = !call.connectedChannelId && !!call.partner && call.status !== "idle";

  // Global Context Menu Closer
  useEffect(() => {
    const handleGlobalClick = () => {
      if (memberContextMenu?.visible) {
        setMemberContextMenu(null);
      }
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [memberContextMenu, setMemberContextMenu]);

  const selectedMember = memberContextMenu?.member
    ? members.find((member) => member.id === memberContextMenu.member.id) || memberContextMenu.member
    : null;

  const handleMemberClick = (member: Member, x: number, y: number) => {
    setMemberContextMenu({ x, y, visible: true, member });
  };

  const handleContextMenuStartDM = async (userId: string) => {
    if (userId === user?.id) {
      return;
    }
    const conv = await startDM(userId);
    if (conv) {
      setActiveModule("dm");
      setActiveConversationId(conv.id);
    }
    setMemberContextMenu(null);
  };

  const handleContextMenuStartCall = (member: Member) => {
    call.initiateCall({
      id: member.id,
      username: member.username,
      avatarUrl: member.avatarUrl
    });
    setMemberContextMenu(null);
  };

  useEffect(() => {
    const isDirectCallSession = Boolean(
      call.callId && call.partner && !call.connectedChannelId && call.status !== "idle",
    );

    if (!isDirectCallSession) {
      initializedDirectCallRef.current = null;
      return;
    }

    if (initializedDirectCallRef.current !== call.callId) {
      initializedDirectCallRef.current = call.callId;
      setIsVoiceChatOpen(false);
    }
  }, [call.callId, call.connectedChannelId, call.partner, call.status, setIsVoiceChatOpen]);

  // Initial Data Load
  useEffect(() => {
    if (isAuthenticated) {
      preloadNotificationSounds();
      fetchInitialData("default-community");
      fetchConversations();
    }
  }, [isAuthenticated, fetchInitialData, fetchConversations]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const channelSidebarQuery = window.matchMedia("(min-width: 768px)");
    const memberSidebarQuery = window.matchMedia("(min-width: 1280px)");

    const syncResponsiveLayout = () => {
      setChannelSidebarOpen(channelSidebarQuery.matches);
      setMemberSidebarOpen(
        memberSidebarQuery.matches && (activeModule === "community" || activeModule === "dm") && !isVoiceChatOpen,
      );
    };

    syncResponsiveLayout();

    const addListener = (query: MediaQueryList, listener: () => void) => {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", listener);
        return () => query.removeEventListener("change", listener);
      }

      query.addListener(listener);
      return () => query.removeListener(listener);
    };

    const removeChannelListener = addListener(channelSidebarQuery, syncResponsiveLayout);
    const removeMemberListener = addListener(memberSidebarQuery, syncResponsiveLayout);

    return () => {
      removeChannelListener();
      removeMemberListener();
    };
  }, [
    activeModule,
    isVoiceChatOpen,
    setChannelSidebarOpen,
    setMemberSidebarOpen,
  ]);

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
        <div className={`fixed inset-y-0 left-20 right-0 z-40 md:static md:z-auto ${isChannelSidebarOpen ? "flex" : "hidden"}`}>
          <div className="absolute inset-0 bg-sori-surface-overlay md:hidden" onClick={() => setChannelSidebarOpen(false)} />
          
          <div className="relative h-full flex-shrink-0 z-50">
            {activeModule === "community" ? (
              <ChannelSidebar 
                socket={socket}
                setIsVoiceChatOpen={setIsVoiceChatOpen}
                livekitToken={call.livekitToken}
                connectedChannelId={call.connectedChannelId}
                status={call.status}
                getChannelToken={call.getChannelToken}
                resetCall={call.resetCall}
                setIsDisconnecting={call.setIsDisconnecting}
                {...media}
              />
            ) : (
              <DMSidebar 
                setIsVoiceChatOpen={setIsVoiceChatOpen}
                socket={socket}
                onlineUsersSet={onlineUsersSet}
                onOpenFindFriend={() => setIsFindFriendOpen(true)}
                livekitToken={call.livekitToken}
                connectedChannelId={call.connectedChannelId}
                partner={call.partner}
                endCall={call.endCall}
                setIsDisconnecting={call.setIsDisconnecting}
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
          initiateCall={call.initiateCall}
          endCall={call.endCall}
          getChannelToken={call.getChannelToken}
          resetCall={call.resetCall}
          setIsDisconnecting={call.setIsDisconnecting}
          isDisconnecting={call.isDisconnecting}
          status={call.status}
          partner={call.partner}
          callId={call.callId}
          livekitToken={call.livekitToken}
          connectedChannelId={call.connectedChannelId}
          {...media}
        />

        {(activeModule === "community" || activeModule === "dm") && !isVoiceChatOpen && (
          <div className={`fixed inset-0 z-40 xl:static xl:z-auto ${isMemberSidebarOpen ? "flex" : "hidden"}`}>
            <div className="absolute inset-0 bg-sori-surface-overlay xl:hidden" onClick={() => setMemberSidebarOpen(false)} />
            <MemberSidebar onlineUsersSet={onlineUsersSet} onMemberClick={handleMemberClick} />
          </div>
        )}
      </div>

      <MemberContextMenu 
        visible={!!memberContextMenu?.visible}
        x={memberContextMenu?.x || 0}
        y={memberContextMenu?.y || 0}
        member={selectedMember}
        onlineUsersSet={onlineUsersSet}
        currentUser={user}
        handleStartDM={handleContextMenuStartDM}
        handleStartCall={handleContextMenuStartCall}
      />

      {(isLogoutModalOpen || isFindFriendOpen || isSettingsOpen || isDirectCallOverlayVisible) && (
        <Suspense fallback={null}>
          <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} handleLogout={logout} />
          <FindFriendModal isOpen={isFindFriendOpen} onClose={() => setIsFindFriendOpen(false)} onlineUsersSet={onlineUsersSet} />
          
          <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setSettingsOpen(false)} 
            {...media}
          />
          
          {isDirectCallOverlayVisible && (
            <CallOverlay 
              status={call.status}
              partner={call.partner}
              onAccept={call.acceptCall}
              onReject={call.rejectCall}
              onCancel={call.endCall}
              startTime={call.startTime}
              isMaximized={isVoiceChatOpen}
              onToggleMaximize={() => setIsVoiceChatOpen(true)}
              isPartnerSpeaking={call.isPartnerSpeaking}
            />
          )}
        </Suspense>
      )}
    </div>
  );
};

export default Chat;
