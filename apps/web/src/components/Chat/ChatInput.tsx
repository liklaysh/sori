import React, { RefObject, Suspense, lazy, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MentionPopup } from "./MentionPopup";
import { Message } from "../../types/chat";
import { useChatStore } from "../../store/useChatStore";
import { useUserStore } from "../../store/useUserStore";
import { useUIStore } from "../../store/useUIStore";
import { cn } from "@sori/ui";
import { 
  X, 
  FileText, 
  CheckCircle, 
  PlusCircle, 
  Upload, 
  Smile, 
  Send,
  Loader2,
  Paperclip,
  Globe
} from "lucide-react";
import { useLinkPreviews } from "../../hooks/useLinkPreviews";
import { EmbedCard } from "./EmbedCard";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

interface PendingAttachment {
  file: File;
  url: string;
  progress: number;
  isUploading: boolean;
  id: string;
  result?: {
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  };
}

interface ChatInputProps {
  inputValue: string;
  setInputValue: (val: string) => void;
  onSendMessage: (e: React.FormEvent, attachments?: PendingAttachment[]) => void;
  editingMessage: Message | null;
  setEditingMessage: (m: Message | null) => void;
  replyTo: Message | null;
  setReplyTo: (m: Message | null) => void;
  handleFileUpload: (file: File) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  pendingAttachments: PendingAttachment[];
  onRemoveAttachment: (id: string) => void;
  socket: any; 
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue, setInputValue, onSendMessage, editingMessage, setEditingMessage,
  replyTo, setReplyTo, pendingAttachments, onRemoveAttachment, handleFileUpload, 
  fileInputRef, socket
}) => {
  const trayShellClass = "mx-auto w-full max-w-[76rem]";
  const { t } = useTranslation(["chat", "common"]);
  const { user } = useUserStore();
  const { members, channels, conversations } = useChatStore();
  const { activeModule, activeChannelId, activeConversationId } = useUIStore();

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [mentionState, setMentionState] = useState<{ visible: boolean, filter: string, cursorPosition: number }>({ visible: false, filter: "", cursorPosition: 0 });
  const typingStopTimeoutRef = useRef<number | null>(null);
  const lastTypingEmitAtRef = useRef(0);
  
  const { previews, loading, removePreview, clearPreviews } = useLinkPreviews(inputValue);

  const currentChannel = channels.find(c => c.id === activeChannelId);
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const otherUser = activeModule === 'dm' ? (activeConversation?.user1Id === user?.id ? activeConversation?.user2 : activeConversation?.user1) : null;

  const handleMentionSelect = (username: string) => {
    const before = inputValue.substring(0, mentionState.cursorPosition);
    const after = inputValue.substring(mentionState.cursorPosition + mentionState.filter.length + 1);
    setInputValue(`${before}@${username} ${after}`);
    setMentionState({ visible: false, filter: "", cursorPosition: 0 });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    setInputValue(val);

    const lastAtPos = val.lastIndexOf("@", pos - 1);
    if (lastAtPos !== -1) {
      const textAfterAt = val.substring(lastAtPos + 1, pos);
      if (!textAfterAt.includes(" ")) {
        setMentionState({ visible: true, filter: textAfterAt, cursorPosition: lastAtPos });
      } else {
        setMentionState(prev => ({ ...prev, visible: false }));
      }
    } else {
      setMentionState(prev => ({ ...prev, visible: false }));
    }

    const channelId = activeModule === 'dm' ? activeConversationId : activeChannelId;
    if (!channelId || !socket) {
      return;
    }

    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
    }

    const now = Date.now();
    if (val.length > 0 && now - lastTypingEmitAtRef.current >= 300) {
      socket.emit("typing", { channelId, isTyping: true });
      lastTypingEmitAtRef.current = now;
    }

    typingStopTimeoutRef.current = window.setTimeout(() => {
      socket.emit("typing", { channelId, isTyping: false });
      typingStopTimeoutRef.current = null;
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (typingStopTimeoutRef.current) {
        window.clearTimeout(typingStopTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() && pendingAttachments.length === 0) return;
    if (pendingAttachments.some(a => a.isUploading)) return;

    onSendMessage(e, pendingAttachments);
    setShowEmojiPicker(false);
    setShowPlusMenu(false);
    clearPreviews();
  };

  return (
    <footer className="px-2 md:px-3 pb-2 pt-0 bg-sori-surface-main relative shrink-0">
      {(replyTo || editingMessage) && (
        <div className={cn(trayShellClass, "mb-2 p-3 bg-sori-surface-panel border-l-4 border-sori-accent-primary rounded-tr-2xl rounded-br-2xl flex items-center justify-between animate-in slide-in-from-bottom-2")}>
            <div className="min-w-0">
            <p className="text-[9px] font-black uppercase text-sori-accent-primary mb-0.5">
              {editingMessage
                ? t("chat:editing")
                : t("chat:replyingTo", { name: replyTo?.username || replyTo?.author?.username })}
            </p>
            <p className="text-xs text-sori-text-muted truncate font-medium">{editingMessage?.content || replyTo?.content}</p>
          </div>
          <button onClick={() => { setReplyTo(null); setEditingMessage(null); if(editingMessage) setInputValue(""); }} className="w-8 h-8 rounded-full hover:bg-sori-surface-hover flex items-center justify-center text-sori-text-muted hover:text-sori-text-strong transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}


      {Object.keys(previews).length > 0 && (
        <div className={cn(trayShellClass, "mb-4 p-4 bg-sori-surface-main rounded-2xl border border-sori-border-medium animate-in fade-in slide-in-from-bottom-2 duration-300")}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <Globe className="h-3 w-3 text-sori-accent-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-sori-text-muted">{t("chat:detectedProtocols")}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(previews).map(([url, data]) => data && (
                <div key={url} className="relative group/tray">
                  <EmbedCard data={data} compact />
                  <button type="button" onClick={() => removePreview(url)} className="absolute -top-2 -right-2 w-7 h-7 rounded-xl bg-sori-accent-danger-subtle text-sori-accent-danger border border-sori-border-danger transition-all flex items-center justify-center hover:bg-sori-accent-danger hover:text-white shadow-xl hover:rotate-90 z-30">
                    <X className="h-4 w-4" />
                  </button>
                  {loading[url] && (
                    <div className="absolute inset-0 bg-sori-surface-base rounded-2xl flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-sori-accent-primary animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {pendingAttachments.length > 0 && (
        <div className={cn(trayShellClass, "mb-4 p-4 bg-sori-surface-main rounded-2xl border border-sori-border-medium animate-in fade-in slide-in-from-bottom-2 duration-300")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pendingAttachments.map((attachment) => {
              const isImage = attachment.file.type.startsWith('image/');
              return (
                <div 
                  key={attachment.id} 
                  className="relative group bg-sori-surface-panel border border-sori-border-medium rounded-2xl p-2.5 flex items-center gap-4 hover:border-sori-border-accent transition-all duration-300 overflow-hidden"
                >
                  {attachment.isUploading && (
                    <div className="absolute inset-0 bg-sori-surface-base z-20 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 text-sori-accent-primary animate-spin" />
                      <div className="w-16 h-1 bg-sori-border-medium rounded-full overflow-hidden">
                        <div className="h-full bg-sori-accent-primary transition-all duration-300" style={{ width: `${attachment.progress}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-sori-text-strong lining-nums">{attachment.progress}%</span>
                    </div>
                  )}
                  
                  <div className="shrink-0 relative">
                    {isImage ? (
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-sori-border-medium bg-sori-surface-base">
                        <img src={attachment.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Preview" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-sori-surface-hover flex items-center justify-center text-sori-accent-primary border border-sori-border-accent group-hover:bg-sori-surface-accent-subtle transition-colors">
                        <FileText className="h-7 w-7" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-[12px] font-bold text-sori-text-strong truncate group-hover:text-sori-accent-primary transition-colors">{attachment.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-sori-text-muted">{(attachment.file.size / 1024).toFixed(1)} KB</span>
                      {attachment.result && <CheckCircle className="h-3 w-3 text-sori-accent-success" />}
                    </div>
                  </div>

                  <button type="button" onClick={() => onRemoveAttachment(attachment.id)} className="absolute top-2 right-2 w-7 h-7 rounded-xl bg-sori-surface-danger-subtle text-sori-accent-danger border border-sori-border-subtle transition-all flex items-center justify-center hover:bg-sori-accent-danger hover:text-sori-text-on-accent hover:rotate-90 z-30">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            
            <button type="button" onClick={() => fileInputRef.current?.click()} className="group bg-sori-surface-panel border-2 border-dashed border-sori-border-medium rounded-2xl flex flex-col items-center justify-center gap-2 p-4 text-sori-text-muted hover:text-sori-accent-primary hover:border-sori-border-accent transition-all hover:bg-sori-surface-accent-subtle min-h-[72px]">
              <div className="p-2 bg-sori-surface-hover rounded-lg group-hover:bg-sori-surface-accent-subtle transition-colors"><PlusCircle className="h-5 w-5" /></div>
              <span className="text-[10px] font-black uppercase tracking-tighter">{t("chat:addFile")}</span>
            </button>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={cn(
        trayShellClass,
        "bg-sori-surface-panel rounded-2xl px-4 py-2.5 flex items-center gap-3.5 border border-sori-border-subtle focus-within:border-sori-accent-primary/20 shadow-2xl transition-all relative"
      )}>
        <div className="shrink-0 flex items-center">
          <div className="relative flex items-center">
            <button type="button" onClick={() => setShowPlusMenu(!showPlusMenu)} className={cn("text-sori-text-muted hover:text-sori-accent-primary transition-all duration-300", showPlusMenu ? 'rotate-45 text-sori-accent-primary' : '')}>
              <Paperclip className="h-6 w-6" />
            </button>
            {showPlusMenu && (
              <div className="absolute bottom-11 left-0 bg-sori-surface-panel border border-sori-border-medium rounded-2xl p-2 shadow-2xl min-w-[200px] z-[500] animate-in slide-in-from-bottom-2 fade-in duration-200 border-l-4 border-sori-accent-primary">
                <div onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }} className="flex items-center gap-3 px-3 py-3 hover:bg-sori-accent-primary-subtle rounded-xl cursor-pointer transition-all group">
                  <Upload className="h-4 w-4 text-sori-text-muted group-hover:text-sori-accent-primary transition-colors" />
                  <span className="text-xs font-bold text-white group-hover:text-sori-accent-primary">{t("chat:sendFile")}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <input
          type="file"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              Array.from(e.target.files).forEach((file) => {
                void handleFileUpload(file);
              });
              e.target.value = '';
            }
          }}
        />
        
        <input 
          className="flex-1 bg-transparent border-none text-sm text-white outline-none placeholder:text-sori-text-dim min-w-0 font-medium" 
          placeholder={editingMessage
            ? t("chat:placeholders.editMessage")
            : (activeModule === 'dm'
              ? t("chat:placeholders.messageUser", { username: otherUser?.username || "..." })
              : t("chat:placeholders.messageChannel", { channel: currentChannel?.name || "..." }))}
          type="text" 
          value={inputValue} 
          onChange={handleInputChange} 
        />

        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={cn("text-sori-text-muted hover:text-sori-accent-primary transition-all", showEmojiPicker ? 'text-sori-accent-primary scale-110' : '')}>
            <Smile className="h-6 w-6" />
          </button>
          <button type="submit" disabled={(!inputValue.trim() && pendingAttachments.length === 0) || pendingAttachments.some(a => a.isUploading)} className="text-sori-accent-primary hover:scale-110 transition-all active:scale-95 disabled:bg-sori-surface-selected disabled:text-sori-text-muted disabled:scale-100 flex items-center justify-center p-2 rounded-xl hover:bg-sori-accent-primary-subtle">
            {editingMessage ? <CheckCircle className="h-6 w-6" /> : <Send className="h-6 w-6" />}
          </button>
        </div>

        {showEmojiPicker && (
          <Suspense fallback={null}>
            <div className="fixed bottom-24 right-4 md:right-8 z-[1000] shadow-2xl animate-in zoom-in-95 origin-bottom-right">
              <div className="absolute inset-0 -z-10 bg-sori-surface-panel rounded-[1.5rem] shadow-2xl border border-sori-border-medium"></div>
              <EmojiPicker onEmojiClick={(emojiData) => { setInputValue(inputValue + emojiData.emoji); setShowEmojiPicker(false); }} theme={"dark" as any} width={320} height={400} aria-label="Emoji Picker" />
            </div>
          </Suspense>
        )}

        {mentionState.visible && (
          <MentionPopup filter={mentionState.filter} onSelect={handleMentionSelect} />
        )}
      </form>
    </footer>
  );
};
