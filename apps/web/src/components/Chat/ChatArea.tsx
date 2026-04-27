import React, { Suspense, lazy, RefObject, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { DMEmptyState, CommunityEmptyState } from "./ChatEmptyStates";
import { useChatAttachments } from "../../hooks/useChatAttachments";
import { ChatItem } from "../../types/chat";
import { useChatStore } from "../../store/useChatStore";
import { useUserStore } from "../../store/useUserStore";
import { useVoiceStore } from "../../store/useVoiceStore";
import { useUIStore } from "../../store/useUIStore";
import { cn } from "@sori/ui";
import { UploadCloud, ShieldAlert } from "lucide-react";
import api from "../../lib/api";
import { getChannelContextKey, getConversationContextKey } from "../../utils/chatMessages";
import { playNotificationSound } from "../../utils/notificationSounds";

const EMPTY_CHAT_ITEMS: ChatItem[] = [];
const LiveKitSession = lazy(() => import("./Voice/LiveKitSession"));

interface ChatAreaProps {
  socket: any;
  isVoiceChatOpen: boolean;
  setIsVoiceChatOpen: (open: boolean) => void;
  onlineUsersSet?: Set<string>;
  
  // Call Orchestration (from Chat.tsx)
  initiateCall: (user: any) => void;
  endCall: (metrics?: any) => void;
  status: string;
  livekitToken: string | null;
  connectedChannelId: string | null;
  resetCall: () => void;
  getChannelToken: (channelId: string) => Promise<string>;
  setIsDisconnecting: (val: boolean) => void;
  isDisconnecting: boolean;
  partner: { id: string, username: string, avatarUrl?: string } | null;
  callId: string | null;

  // Media settings (from useMediaSettings)
  noiseSuppression: boolean;
  toggleNoiseSuppression: () => void;
  outputVolume: number;
  micGain: number;
  micDevices: MediaDeviceInfo[];
  activeMicId?: string;
  setActiveMic: (id: string) => void;
  outputDevices: MediaDeviceInfo[];
  activeOutputId?: string;
  setActiveOutput: (id: string) => void;
  setMicGain: (gain: number) => void;
  setOutputVolume: (volume: number) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = (props) => {
  const { t } = useTranslation(["voice"]);
  const { user } = useUserStore();
  const { 
    activeModule, activeChannelId, activeConversationId, 
    setChannelSidebarOpen, setMemberSidebarOpen 
  } = useUIStore();
  const { channels, conversations, fetchMessages, fetchDMMessages } = useChatStore();
  const contextKey = activeModule === "community"
    ? (activeChannelId ? getChannelContextKey(activeChannelId) : null)
    : (activeConversationId ? getConversationContextKey(activeConversationId) : null);
  const messagesBucket = useChatStore((state) => (
    contextKey ? state.messagesByContext[contextKey] : undefined
  ));
  const messages = messagesBucket ?? EMPTY_CHAT_ITEMS;

  const { 
    initiateCall, endCall, getChannelToken, resetCall,
    setIsDisconnecting, isDisconnecting,
    livekitToken, connectedChannelId, status, partner, callId,
    setActiveOutput, setMicGain, setOutputVolume
  } = props;

  const currentChannel = channels.find(c => c.id === activeChannelId) || null;
  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;
  const isVoiceChannelContext = activeModule === "community" && currentChannel?.type === "voice";
  const isDirectCallSession = Boolean(livekitToken && callId && partner && !connectedChannelId);
  const hasVoiceChannelSession = Boolean(livekitToken && connectedChannelId);

  const attachments = useChatAttachments();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isInternalChatOpen, setIsInternalChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    return messages.filter(m => 
      'content' in m && m.content?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, messages]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  };

  const handleLoadMore = async () => {
    const before = messages[0]?.createdAt;
    if (!before) return;

    const beforeIso = new Date(before).toISOString();

    if (activeModule === "community" && activeChannelId) {
      await fetchMessages(activeChannelId, {
        search: debouncedSearchQuery,
        before: beforeIso,
        append: true,
      });
    } else if (activeModule === "dm" && activeConversationId) {
      await fetchDMMessages(activeConversationId, {
        search: debouncedSearchQuery,
        before: beforeIso,
        append: true,
      });
    }
  };

  // Mark DM as read when it becomes active
  useEffect(() => {
    if (activeModule === "dm" && activeConversationId) {
      const conv = conversations.find(c => c.id === activeConversationId);
      if (conv && (conv.unreadCount || 0) > 0) {
        useChatStore.getState().markConversationAsRead(activeConversationId);
      }
    }
  }, [activeModule, activeConversationId, conversations]);

  // Load History
  useEffect(() => {
    if (activeModule === "community" && activeChannelId) {
      fetchMessages(activeChannelId, { search: debouncedSearchQuery });
    } else if (activeModule === "dm" && activeConversationId) {
      fetchDMMessages(activeConversationId, { search: debouncedSearchQuery });
    }
  }, [activeModule, activeChannelId, activeConversationId, fetchMessages, fetchDMMessages, debouncedSearchQuery]);

  // Join channel room for sockets
  useEffect(() => {
    if (activeModule === "community" && activeChannelId && props.socket) {
      props.socket.emit("join_channel", activeChannelId);
    }
  }, [activeModule, activeChannelId, props.socket]);

  const handleSendMessage = async (e: React.FormEvent, manualAttachments?: any[]) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() && !manualAttachments?.length) return;

    try {
      const uploadedAttachments = (manualAttachments || [])
        .map((attachment) => attachment?.result)
        .filter(Boolean);
      const firstAttachment = uploadedAttachments[0];
      const payload: any = {
        content: inputValue,
        parentId: replyTo?.id
      };

      if (uploadedAttachments.length > 0) {
        payload.attachments = uploadedAttachments;
        payload.attachment = {
          fileUrl: firstAttachment.fileUrl,
          fileName: firstAttachment.fileName,
          fileSize: firstAttachment.fileSize,
          fileType: firstAttachment.fileType,
        };
      }

      let res: any;
      if (activeModule === "community" && activeChannelId) {
        res = await api.post(`/channels/${activeChannelId}/messages`, payload);
      } else if (activeModule === "dm" && activeConversationId) {
        res = await api.post(`/dm/conversations/${activeConversationId}/messages`, payload);
      }

      if (res) {
        setInputValue("");
        setReplyTo(null);
        setEditingMessage(null);
        attachments.clearAttachments();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleJoinVoice = async () => {
    if (!activeChannelId) return;
    if (connectedChannelId === activeChannelId && livekitToken) {
      props.setIsVoiceChatOpen(true);
      return;
    }
    
    // Check for Secure Context
    if (!window.isSecureContext || !navigator.mediaDevices) {
      setLastError("Secure Context Required: Media devices (microphone) are blocked on this domain. Use localhost or enable HTTPS.");
      return;
    }

    try {
      setLastError(null);
      setIsDisconnecting(false);
      await getChannelToken(activeChannelId);
      props.socket?.emit("join_voice_channel", activeChannelId);
      props.setIsVoiceChatOpen(true);
      playNotificationSound("voiceJoin");
    } catch (err) {
      console.error("Join voice failed:", err);
    }
  };

  // Sync Voice Token if user is already an occupant
  useEffect(() => {
    const isVoice = activeModule === "community" && currentChannel?.type === "voice";
    
    if (isDisconnecting) {
      return;
    }

    // Only auto-join if we have media access
    if (isVoice && activeChannelId && !livekitToken && window.isSecureContext && navigator.mediaDevices) {
      const occupants = useChatStore.getState().voiceOccupants[activeChannelId] || [];
      const isMeOccupant = occupants.some(o => o.userId === user?.id);
      
      if (isMeOccupant) {
        getChannelToken(activeChannelId).catch(() => {});
      }
    }
  }, [activeChannelId, activeModule, currentChannel?.type, livekitToken, user?.id, getChannelToken, isDisconnecting]);

  // Safe Guard Reset: Only when switching to a DIFFERENT channel
  const lastChannelRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeChannelId && activeChannelId !== lastChannelRef.current) {
      setIsDisconnecting(false);
      lastChannelRef.current = activeChannelId;
    }
  }, [activeChannelId, setIsDisconnecting]);

  const renderMainChatLayout = () => {
    const isVoice = isVoiceChannelContext;
    const isExpandedDirectCallSession = Boolean(isDirectCallSession && props.isVoiceChatOpen);
    const showFullVoiceUI = isDirectCallSession ? isExpandedDirectCallSession : isVoice;
    
    if (activeModule === "dm" && !activeConversationId) {
      return <DMEmptyState onShowSidebar={() => setChannelSidebarOpen(true)} />;
    }
    if (activeModule === "community" && !activeChannelId) {
      return <CommunityEmptyState onShowSidebar={() => setChannelSidebarOpen(true)} />;
    }

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-sori-surface-main overflow-hidden">
        {!showFullVoiceUI && (
          <ChatHeader 
            activeModule={activeModule} 
            currentChannel={currentChannel} 
            activeConversation={activeConversation}
            user={user!} 
            isVoice={isVoice} 
            searchQuery={searchQuery} 
            setSearchQuery={setSearchQuery}
            setIsChannelSidebarOpen={setChannelSidebarOpen} 
            setIsMemberSidebarOpen={setMemberSidebarOpen}
            setIsVoiceChatOpen={props.setIsVoiceChatOpen} 
            livekitToken={livekitToken}
            onInitiateCall={(targetUser) => {
              if (targetUser) {
                initiateCall(targetUser);
              } else if (activeConversation) {
                const partnerUser = activeConversation.user1Id === user?.id 
                  ? activeConversation.user2 
                  : activeConversation.user1;
                
                if (partnerUser) {
                  initiateCall({
                    id: partnerUser.id,
                    username: partnerUser.username,
                    avatarUrl: partnerUser.avatarUrl
                  });
                }
              }
            }}
            callStatus={status}
            onlineUsersSet={props.onlineUsersSet}
            searchResults={searchResults}
            onResultClick={(msg) => {
               const element = document.getElementById(`msg-${msg.id}`);
               if (element) {
                 element.scrollIntoView({ behavior: 'smooth', block: 'center' });
               }
            }}
          />
        )}

        <div className="flex-1 overflow-hidden flex flex-col relative" onDragEnter={attachments.handleDrag} onDragOver={attachments.handleDrag} onDrop={attachments.handleDrop}>
          {attachments.dragActive && (
            <div className="absolute inset-0 z-[100] bg-sori-surface-main border-4 border-dashed border-sori-accent-primary m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none">
              <UploadCloud className="h-12 w-12 text-sori-accent-primary mb-4" />
              <p className="text-xl font-black text-sori-text-strong uppercase tracking-widest">Drop to upload</p>
            </div>
          )}

          {(isDirectCallSession || hasVoiceChannelSession) && window.isSecureContext ? (
            <Suspense fallback={<div className="flex-1 bg-sori-surface-main" />}>
              <LiveKitSession
                socket={props.socket}
                livekitToken={livekitToken!}
                connectedChannelId={connectedChannelId}
                activeChannelId={activeChannelId}
                callId={callId}
                partner={partner}
                status={status}
                showFullVoiceUI={showFullVoiceUI}
                activeModule={activeModule}
                currentChannelName={currentChannel?.name}
                isInternalChatOpen={isInternalChatOpen}
                setIsInternalChatOpen={setIsInternalChatOpen}
                messages={messages}
                inputValue={inputValue}
                setInputValue={setInputValue}
                onSendMessage={handleSendMessage}
                onLoadMore={handleLoadMore}
                searchQuery={searchQuery}
                scrollRef={scrollRef}
                showScrollButton={showScrollButton}
                scrollToBottom={scrollToBottom}
                user={user!}
                outputVolume={props.outputVolume}
                micGain={props.micGain}
                noiseSuppression={props.noiseSuppression}
                toggleNoiseSuppression={props.toggleNoiseSuppression}
                micDevices={props.micDevices}
                activeMicId={props.activeMicId}
                setActiveMic={props.setActiveMic}
                outputDevices={props.outputDevices}
                activeOutputId={props.activeOutputId}
                setActiveOutput={props.setActiveOutput}
                setMicGain={props.setMicGain}
                setOutputVolume={props.setOutputVolume}
                onConnected={() => {
                  setLastError(null);
                  setIsDisconnecting(false);
                }}
                onDisconnected={() => {
                  props.setIsVoiceChatOpen(false);
                  if (callId && partner && !connectedChannelId) {
                    setIsDisconnecting(false);
                    endCall();
                    return;
                  }
                  if (connectedChannelId) {
                    props.socket?.emit("leave_voice_channel", connectedChannelId);
                    resetCall();
                    setIsDisconnecting(true);
                  }
                }}
                onLeave={() => {
                  props.setIsVoiceChatOpen(false);
                  if (callId && partner && !connectedChannelId) {
                    endCall();
                    return;
                  }
                  if (connectedChannelId) {
                    playNotificationSound("voiceLeave");
                  }
                  props.socket?.emit("leave_voice_channel", connectedChannelId);
                  resetCall();
                  setIsDisconnecting(true);
                }}
                onPeerGone={() => {
                  setIsDisconnecting(true);
                  props.setIsVoiceChatOpen(false);
                  endCall();
                }}
              />
            </Suspense>
          ) : (
            isVoice ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                <h2 className="text-2xl font-bold text-sori-text-strong">Voice Channel: {currentChannel?.name}</h2>
                
                {(!window.isSecureContext || !navigator.mediaDevices) ? (
                  <div className="p-6 bg-sori-surface-danger-subtle border border-sori-accent-danger text-sori-accent-danger rounded-3xl max-w-md text-center">
                    <ShieldAlert className="h-10 w-10 mx-auto mb-4 opacity-80" />
                    <h3 className="font-bold mb-2">Browser Security Block</h3>
                    <p className="text-sm text-sori-text-strong font-medium">Microphone access is blocked on this domain. Use localhost or enable the Chrome flag.</p>
                    <div className="mt-4 text-[10px] text-sori-text-muted bg-sori-surface-base border border-sori-border-subtle p-3 rounded-xl font-mono text-left select-text">
                      💡 Tip for Chrome/Yandex:<br/>
                      1. Go to browser://flags/#unsafely-treat-insecure-origin-as-secure<br/>
                      2. Add: https://sori-web.sori.orb.local<br/>
                      3. Enable and Relaunch.
                    </div>
                  </div>
                ) : lastError ? (
                  <div className="p-4 bg-sori-surface-danger-subtle border border-sori-accent-danger text-sori-accent-danger rounded-xl max-w-md text-center text-sm">
                    <strong className="text-sori-text-strong">Connection Error:</strong> {lastError}
                  </div>
                ) : null}

                {window.isSecureContext && navigator.mediaDevices && (
                  <button onClick={handleJoinVoice} className="bg-sori-accent-primary text-black px-10 py-4 rounded-2xl font-bold active:scale-95 transition-transform">{t("voice:room.joinVoiceChannel")}</button>
                )}
              </div>
            ) : (
              <MessageList 
                messages={searchQuery ? messages.filter(m => "content" in m && m.content?.toLowerCase().includes(searchQuery.toLowerCase())) : messages}
                onMessageContextMenu={() => {}} 
                isLoadingMessages={false}
                scrollRef={scrollRef} handleScroll={() => {}} showScrollButton={showScrollButton} scrollToBottom={scrollToBottom}
                onLoadMore={handleLoadMore} onForward={() => {}}
              />
            )
          )}
        </div>

        {!showFullVoiceUI && (
          <ChatInput 
            inputValue={inputValue} setInputValue={setInputValue} onSendMessage={handleSendMessage} 
            editingMessage={editingMessage} setEditingMessage={setEditingMessage} 
            replyTo={replyTo} setReplyTo={setReplyTo} 
            pendingAttachments={attachments.pendingAttachments} onRemoveAttachment={attachments.removePendingAttachment}
            handleFileUpload={attachments.handleFileUpload} fileInputRef={attachments.fileInputRef}
            socket={props.socket}
          />
        )}
      </div>
    );
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-sori-surface-main min-w-0 relative">
      {renderMainChatLayout()}
    </main>
  );
};
