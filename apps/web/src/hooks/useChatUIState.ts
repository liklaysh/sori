import { useState, useEffect } from "react";
import { Message, Channel, VoiceOccupant, Member } from "../types/chat";

export const useChatUIState = () => {
  // 1. Modules & Basic Toggles
  const [activeModule, setActiveModule] = useState<'community' | 'dm'>('community');
  const [isChannelSidebarOpen, setIsChannelSidebarOpen] = useState(false);
  const [isMemberSidebarOpen, setIsMemberSidebarOpen] = useState(true);
  const [isVoiceChatOpen, setIsVoiceChatOpen] = useState(false);
  const [isCallMaximized, setIsCallMaximized] = useState(false);

  // 2. Modals Visibility
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFindFriendOpen, setIsFindFriendOpen] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);

  // 3. Data for Contextual actions
  const [forwardData, setForwardData] = useState<{ content: string; fileUrl?: string; fileName?: string; fileSize?: number; fileType?: string } | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [editChannelName, setEditChannelName] = useState("");

  // 4. Context Menus
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false });
  const [occupantContextMenu, setOccupantContextMenu] = useState<{ x: number, y: number, visible: boolean, occupant: VoiceOccupant | null }>({ x: 0, y: 0, visible: false, occupant: null });
  const [channelContextMenu, setChannelContextMenu] = useState<{ x: number, y: number, visible: boolean, channel: Channel | null }>({ x: 0, y: 0, visible: false, channel: null });
  const [messageContextMenu, setMessageContextMenu] = useState<{ x: number, y: number, visible: boolean, message: Message | null }>({ x: 0, y: 0, visible: false, message: null });
  const [memberContextMenu, setMemberContextMenu] = useState<{ x: number, y: number, visible: boolean, member: Member | null }>({ x: 0, y: 0, visible: false, member: null });

  // 5. Global Click Listener to close menus
  useEffect(() => {
    const handleClick = () => { 
      setContextMenu(prev => ({ ...prev, visible: false })); 
      setChannelContextMenu(prev => ({ ...prev, visible: false })); 
      setOccupantContextMenu(prev => ({ ...prev, visible: false })); 
      setMessageContextMenu(prev => ({ ...prev, visible: false }));
      setMemberContextMenu(prev => ({ ...prev, visible: false }));
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return {
    // Basic
    activeModule, setActiveModule,
    isChannelSidebarOpen, setIsChannelSidebarOpen,
    isMemberSidebarOpen, setIsMemberSidebarOpen,
    isVoiceChatOpen, setIsVoiceChatOpen,
    isCallMaximized, setIsCallMaximized,

    // Modals
    isModalOpen, setIsModalOpen,
    isCategoryModalOpen, setIsCategoryModalOpen,
    isLogoutModalOpen, setIsLogoutModalOpen,
    isRenameModalOpen, setIsRenameModalOpen,
    isDeleteModalOpen, setIsDeleteModalOpen,
    isSettingsOpen, setIsSettingsOpen,
    isFindFriendOpen, setIsFindFriendOpen,
    isForwardModalOpen, setIsForwardModalOpen,

    // Form data
    forwardData, setForwardData,
    selectedCategoryId, setSelectedCategoryId,
    editChannelName, setEditChannelName,

    // Context Menus
    contextMenu, setContextMenu,
    occupantContextMenu, setOccupantContextMenu,
    channelContextMenu, setChannelContextMenu,
    messageContextMenu, setMessageContextMenu,
    memberContextMenu, setMemberContextMenu
  };
};
