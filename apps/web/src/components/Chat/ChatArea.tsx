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
import { UploadCloud } from "lucide-react";
import { API_URL, LIVEKIT_URL } from "../../config";
import api from "../../lib/api";

interface ChatAreaProps {
  socket: any;
  isVoiceChatOpen: boolean;
  setIsVoiceChatOpen: (open: boolean) => void;
  
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

  const { livekitToken, initiateCall, endCall } = useCall({ socket: props.socket, currentUser: user! });

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
      fetchMessages(activeChannelId);
    } else if (activeModule === "dm" && activeConversationId) {
      fetchDMMessages(activeConversationId);
    }
  }, [activeModule, activeChannelId, activeConversationId, fetchMessages, fetchDMMessages]);

  const handleSendMessage = async (e: React.FormEvent, manualAttachments?: any[]) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() && !manualAttachments?.length) return;

    try {
      const payload = {
        content: inputValue,
        attachments: manualAttachments,
        replyToId: replyTo?.id
      };

      let res;
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
    try {
      await api.post("/calls/token", { channelId: activeChannelId });
      props.socket?.emit("join_voice_channel", activeChannelId);
      props.setIsVoiceChatOpen(true);
    } catch (err) {
      console.error("Join voice failed:", err);
    }
  };

  const renderMainChatLayout = () => {
    const isVoice = activeModule === "community" && currentChannel?.type === "voice";

    if (activeModule === "dm" && !activeConversationId) {
      return <DMEmptyState onShowSidebar={() => setChannelSidebarOpen(true)} />;
    }
    if (activeModule === "community" && !activeChannelId) {
      return <CommunityEmptyState onShowSidebar={() => setChannelSidebarOpen(true)} />;
    }

    return (
      <div className="flex-1 flex flex-col min-w-0 h-full relative" onDragEnter={attachments.handleDrag} onDragOver={attachments.handleDrag} onDrop={attachments.handleDrop}>
        <ChatHeader 
          activeModule={activeModule} currentChannel={currentChannel} activeConversation={activeConversation}
          user={user!} isVoice={isVoice} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          setIsChannelSidebarOpen={setChannelSidebarOpen} setIsMemberSidebarOpen={setMemberSidebarOpen}
          setIsVoiceChatOpen={props.setIsVoiceChatOpen} livekitToken={livekitToken}
        />

        <div className="flex-1 overflow-hidden flex flex-col relative">
          {attachments.dragActive && (
            <div className="absolute inset-0 z-[100] bg-primary/10 border-4 border-dashed border-primary m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none">
              <UploadCloud className="h-12 w-12 text-primary mb-4" />
              <p className="text-xl font-black text-white uppercase tracking-widest">Drop to upload</p>
            </div>
          )}

          {isVoice ? (
            livekitToken ? (
              <LiveKitRoom 
                video={false} audio={true} token={livekitToken} serverUrl={LIVEKIT_URL} connect={true}
                onDisconnected={() => { props.socket?.emit("leave_voice_channel", activeChannelId); props.setIsVoiceChatOpen(false); }} 
                className="flex-1 flex"
              >
                <LayoutContextProvider>
                  <SoriVoiceRoom 
                    onLeave={() => { props.socket?.emit("leave_voice_channel", activeChannelId); props.setIsVoiceChatOpen(false); }} 
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
                <button onClick={handleJoinVoice} className="bg-primary text-white px-10 py-4 rounded-2xl font-bold">Join Voice Channel</button>
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

  return <main className="flex-1 flex flex-col h-full bg-sori-chat min-w-0">{renderMainChatLayout()}</main>;
};
