import React, { RefObject, useState, useRef, useEffect } from "react";
import { LiveKitRoom, LayoutContextProvider, RoomAudioRenderer } from "@livekit/components-react";
import { SoriVoiceRoom } from "./Voice/SoriVoiceRoom";
import { StreamingTracker } from "./Voice/StreamingTracker";
import { ParticipantsVolumeManager } from "./Voice/ParticipantsVolumeManager";
import { SpeakingTracker } from "./Voice/SpeakingTracker";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { DMEmptyState, CommunityEmptyState } from "./ChatEmptyStates";
import { useChatAttachments } from "../../hooks/useChatAttachments";
import { useChatStore } from "../../store/useChatStore";
import { useUserStore } from "../../store/useUserStore";
import { useUIStore } from "../../store/useUIStore";
import { useCall } from "../../hooks/useCall";
import { cn } from "@sori/ui";
import { UploadCloud, ShieldAlert } from "lucide-react";
import { API_URL, LIVEKIT_URL } from "../../config";
import api from "../../lib/api";

interface ChatAreaProps {
  socket: any;
  isVoiceChatOpen: boolean;
  setIsVoiceChatOpen: (open: boolean) => void;
  onlineUsersSet?: Set<string>;
  
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
  const { user } = useUserStore();
  const { messages, channels, conversations, fetchMessages, fetchDMMessages } = useChatStore();
  const { 
    activeModule, activeChannelId, activeConversationId, 
    setChannelSidebarOpen, setMemberSidebarOpen 
  } = useUIStore();

  const { 
    livekitToken, connectedChannelId, status, 
    initiateCall, endCall, getChannelToken, resetCall 
  } = useCall({ socket: props.socket, currentUser: user! });

  const currentChannel = channels.find(c => c.id === activeChannelId) || null;
  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  const attachments = useChatAttachments();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isInternalChatOpen, setIsInternalChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    return messages.filter(m => 
      'content' in m && m.content?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, messages]);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => scrollToBottom("auto"), 50);
      return () => clearTimeout(timer);
    }
  }, [messages.length, activeChannelId, activeConversationId, activeModule]);

  // Load History
  useEffect(() => {
    if (activeModule === "community" && activeChannelId) {
      fetchMessages(activeChannelId!, searchQuery);
    } else if (activeModule === "dm" && activeConversationId) {
      fetchDMMessages(activeConversationId!);
    }
  }, [activeModule, activeChannelId, activeConversationId, fetchMessages, fetchDMMessages, searchQuery]);

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
      const payload = {
        content: inputValue,
        attachments: manualAttachments,
        replyToId: replyTo?.id
      };

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
    
    // Check for Secure Context
    if (!window.isSecureContext || !navigator.mediaDevices) {
      setLastError("Secure Context Required: Media devices (microphone) are blocked on this domain. Use localhost or enable HTTPS.");
      return;
    }

    try {
      setLastError(null);
      await getChannelToken(activeChannelId);
      props.socket?.emit("join_voice_channel", activeChannelId);
      props.setIsVoiceChatOpen(true);
    } catch (err) {
      console.error("Join voice failed:", err);
    }
  };

  // Sync Voice Token if user is already an occupant
  useEffect(() => {
    const isVoice = activeModule === "community" && currentChannel?.type === "voice";
    // Only auto-join if we have media access
    if (isVoice && activeChannelId && !livekitToken && window.isSecureContext && navigator.mediaDevices) {
      const occupants = useChatStore.getState().voiceOccupants[activeChannelId] || [];
      const isMeOccupant = occupants.some(o => o.userId === user?.id);
      
      if (isMeOccupant) {
        console.log("📡 Auto-connecting to voice channel", activeChannelId);
        getChannelToken(activeChannelId).catch(() => {});
      }
    }
  }, [activeChannelId, activeModule, currentChannel?.type, livekitToken, user?.id, getChannelToken]);

  const renderMainChatLayout = () => {
    const isVoice = activeModule === "community" && currentChannel?.type === "voice";

    if (activeModule === "dm" && !activeConversationId) {
      return <DMEmptyState onShowSidebar={() => setChannelSidebarOpen(true)} />;
    }
    if (activeModule === "community" && !activeChannelId) {
      return <CommunityEmptyState onShowSidebar={() => setChannelSidebarOpen(true)} />;
    }

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-sori-chat overflow-hidden">
        {!isVoice && (
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
            onInitiateCall={() => {
              if (activeConversation) {
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
            <div className="absolute inset-0 z-[100] bg-[#3d3f5c] border-4 border-dashed border-sori-primary m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none">
              <UploadCloud className="h-12 w-12 text-sori-primary mb-4" />
              <p className="text-xl font-black text-white uppercase tracking-widest">Drop to upload</p>
            </div>
          )}

          {isVoice ? (
            livekitToken && (connectedChannelId === activeChannelId || status === 'connected') && window.isSecureContext ? (
              <LiveKitRoom 
                video={false} audio={true} token={livekitToken} serverUrl={LIVEKIT_URL} connect={true}
                onConnected={() => {
                  console.log("✅ [LiveKitRoom] onConnected event");
                  setLastError(null);
                }}
                onError={(err) => {
                  console.error("❌ [LiveKitRoom] Error:", err);
                  setLastError(err.message);
                }}
                onDisconnected={() => { 
                  console.log("🔌 [LiveKitRoom] onDisconnected event");
                  props.socket?.emit("leave_voice_channel", connectedChannelId); 
                  props.setIsVoiceChatOpen(false);
                }} 
                className="flex-1 flex"
              >
                <LayoutContextProvider>
                  <SoriVoiceRoom 
                    onLeave={() => { 
                      props.socket?.emit("leave_voice_channel", connectedChannelId); 
                      props.setIsVoiceChatOpen(false); 
                      resetCall();
                    }} 
                    messages={messages} inputValue={inputValue} onInputChange={(e) => setInputValue(e.target.value)}
                    onSendMessage={handleSendMessage} user={user!} outputVolume={props.outputVolume} micGain={props.micGain}
                    participantVolumes={{}} noiseSuppression={props.noiseSuppression} toggleNoiseSuppression={props.toggleNoiseSuppression}
                    isChatOpen={isInternalChatOpen} setIsChatOpen={setIsInternalChatOpen} channelName={currentChannel?.name || "Voice Channel"}
                    startTime={null} onOpenFindFriend={() => {}} 
                    micDevices={props.micDevices} activeMicId={props.activeMicId} setActiveMic={props.setActiveMic}
                    outputDevices={props.outputDevices} activeOutputId={props.activeOutputId} setActiveOutput={props.setActiveOutput}
                    setMicGain={props.setMicGain} setOutputVolume={props.setOutputVolume}
                  />
                  <RoomAudioRenderer volume={props.outputVolume / 100} />
                </LayoutContextProvider>
              </LiveKitRoom>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                <h2 className="text-2xl font-bold text-white">Voice Channel: {currentChannel?.name}</h2>
                
                {(!window.isSecureContext || !navigator.mediaDevices) ? (
                  <div className="p-6 bg-[#453539] border border-[#ef4444] text-[#ef4444] rounded-3xl max-w-md text-center">
                    <ShieldAlert className="h-10 w-10 mx-auto mb-4 opacity-80" />
                    <h3 className="font-bold mb-2">Browser Security Block</h3>
                    <p className="text-sm opacity-90">Microphone access is blocked on this domain. Use localhost or enable the Chrome flag.</p>
                    <div className="mt-4 text-[10px] text-gray-400 bg-[#1e1e1e] p-3 rounded-xl font-mono text-left select-text">
                      💡 Tip for Chrome/Yandex:<br/>
                      1. Go to browser://flags/#unsafely-treat-insecure-origin-as-secure<br/>
                      2. Add: https://sori-web.sori.orb.local<br/>
                      3. Enable and Relaunch.
                    </div>
                  </div>
                ) : lastError ? (
                  <div className="p-4 bg-[#58373a] border border-[#ef4444] text-[#ef4444] rounded-xl max-w-md text-center text-sm">
                    <strong>Connection Error:</strong> {lastError}
                  </div>
                ) : null}

                {window.isSecureContext && navigator.mediaDevices && (
                  <button onClick={handleJoinVoice} className="bg-primary text-white px-10 py-4 rounded-2xl font-bold active:scale-95 transition-transform">Join Voice Channel</button>
                )}
              </div>
            )
          ) : (
            <MessageList 
              messages={searchQuery ? messages.filter(m => "content" in m && m.content?.toLowerCase().includes(searchQuery.toLowerCase())) : messages}
              onMessageContextMenu={() => {}} 
              isLoadingMessages={false}
              scrollRef={scrollRef} handleScroll={() => {}} showScrollButton={showScrollButton} scrollToBottom={scrollToBottom}
              onLoadMore={() => Promise.resolve()} onForward={() => {}}
            />
          )}
        </div>

        {!isVoice && (
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
    <main className="flex-1 flex flex-col h-full bg-sori-chat min-w-0 relative">
      {renderMainChatLayout()}
    </main>
  );
};
