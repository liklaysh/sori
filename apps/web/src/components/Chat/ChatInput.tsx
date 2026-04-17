import React, { RefObject, useState } from "react";
import EmojiPicker from 'emoji-picker-react';
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
  const { user } = useUserStore();
  const { members, channels, conversations } = useChatStore();
  const { activeModule, activeChannelId, activeConversationId } = useUIStore();

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [mentionState, setMentionState] = useState<{ visible: boolean, filter: string, cursorPosition: number }>({ visible: false, filter: "", cursorPosition: 0 });
  
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

    socket?.emit("typing", { 
      channelId: activeModule === 'dm' ? activeConversationId : activeChannelId, 
      isTyping: val.length > 0 
    });
  };

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
    <footer className="px-4 md:px-6 pb-6 pt-0 bg-sori-chat relative shrink-0">
      {(replyTo || editingMessage) && (
        <div className="mx-1 mb-2 p-3 bg-sori-sidebar border-l-4 border-sori-primary rounded-tr-xl flex items-center justify-between animate-in slide-in-from-bottom-2 shadow-lg">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase text-sori-primary mb-0.5">{editingMessage ? "Editing" : `Replying to ${replyTo?.username || replyTo?.author?.username}`}</p>
            <p className="text-xs text-white/60 truncate font-medium">{editingMessage?.content || replyTo?.content}</p>
          </div>
          <button onClick={() => { setReplyTo(null); setEditingMessage(null); if(editingMessage) setInputValue(""); }} className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {pendingAttachments.length > 0 && (
        <div className="mx-1 mb-4 p-3 bg-sori-chat rounded-[1.5rem] border border-white/5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pendingAttachments.map((attachment) => {
              const isImage = attachment.file.type.startsWith('image/');
              return (
                <div 
                  key={attachment.id} 
                  className="relative group bg-sori-sidebar border border-white/5 rounded-2xl p-2.5 flex items-center gap-4 hover:border-sori-primary/30 transition-all duration-300 shadow-lg overflow-hidden"
                >
                  {attachment.isUploading && (
                    <div className="absolute inset-0 bg-sori-bg/80 z-20 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 text-sori-primary animate-spin" />
                      <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-sori-primary transition-all duration-300" style={{ width: `${attachment.progress}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-white lining-nums">{attachment.progress}%</span>
                    </div>
                  )}
                  
                  <div className="shrink-0 relative">
                    {isImage ? (
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black">
                        <img src={attachment.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Preview" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-sori-primary/10 flex items-center justify-center text-sori-primary border border-sori-primary/20 shadow-inner group-hover:bg-sori-primary/20 transition-colors">
                        <FileText className="h-7 w-7" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-[12px] font-bold text-white truncate group-hover:text-sori-primary transition-colors">{attachment.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{(attachment.file.size / 1024).toFixed(1)} KB</span>
                      {attachment.result && <CheckCircle className="h-3 w-3 text-green-500" />}
                    </div>
                  </div>

                  <button type="button" onClick={() => onRemoveAttachment(attachment.id)} className="absolute top-2 right-2 w-7 h-7 rounded-xl bg-sori-error/10 text-sori-error border border-sori-error/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-sori-error hover:text-white shadow-lg hover:rotate-90 z-30">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            
            <button type="button" onClick={() => fileInputRef.current?.click()} className="group bg-sori-sidebar border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 p-4 text-gray-500 hover:text-sori-primary hover:border-sori-primary/30 transition-all hover:bg-sori-primary/5 min-h-[72px]">
              <div className="p-2 bg-white/5 rounded-lg group-hover:bg-sori-primary/10 transition-colors"><PlusCircle className="h-5 w-5" /></div>
              <span className="text-[10px] font-black uppercase tracking-tighter">Add File</span>
            </button>
          </div>
        </div>
      )}

      {Object.keys(previews).length > 0 && (
        <div className="mx-1 mb-4 p-3 bg-sori-chat rounded-[1.5rem] border border-white/5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1 opacity-40">
              <Globe className="h-3 w-3 text-sori-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Detected Protocols</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(previews).map(([url, data]) => data && (
                <div key={url} className="relative group/tray">
                  <EmbedCard data={data} compact />
                  <button type="button" onClick={() => removePreview(url)} className="absolute -top-2 -right-2 w-7 h-7 rounded-xl bg-sori-error/20 text-sori-error border border-sori-error/20 opacity-0 group-hover/tray:opacity-100 transition-all flex items-center justify-center hover:bg-sori-error hover:text-white shadow-xl hover:rotate-90 z-30">
                    <X className="h-4 w-4" />
                  </button>
                  {loading[url] && (
                    <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-sori-primary animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-sori-sidebar rounded-[2rem] px-5 py-3 flex items-center gap-4 border border-white/5 focus-within:border-sori-primary/30 shadow-2xl transition-all relative">
        <div className="shrink-0 flex items-center">
          <div className="relative flex items-center">
            <button type="button" onClick={() => setShowPlusMenu(!showPlusMenu)} className={cn("text-gray-400 hover:text-sori-primary transition-all duration-300", showPlusMenu ? 'rotate-45 text-sori-primary' : '')}>
              <Paperclip className="h-6 w-6" />
            </button>
            {showPlusMenu && (
              <div className="absolute bottom-16 left-0 bg-sori-sidebar border border-white/10 rounded-2xl p-2 shadow-2xl min-w-[200px] z-[500] animate-in slide-in-from-bottom-2 fade-in duration-200 border-l-4 border-sori-primary">
                <div onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }} className="flex items-center gap-3 px-3 py-3 hover:bg-sori-primary/10 rounded-xl cursor-pointer transition-all group">
                  <Upload className="h-4 w-4 text-gray-400 group-hover:text-sori-primary transition-colors" />
                  <span className="text-xs font-bold text-white group-hover:text-sori-primary">Send Protocol (File)</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <input type="file" className="hidden" ref={fileInputRef} multiple onChange={(e) => { if (e.target.files) { Array.from(e.target.files).forEach(file => handleFileUpload(file)); e.target.value = ''; } }} />
        
        <input 
          className="flex-1 bg-transparent border-none text-sm text-white outline-none placeholder:text-white/20 min-w-0 font-medium" 
          placeholder={editingMessage ? "Edit message..." : (activeModule === 'dm' ? `Message @${otherUser?.username || "..."}` : `Message #${currentChannel?.name || "..."}`)} 
          type="text" 
          value={inputValue} 
          onChange={handleInputChange} 
        />

        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={cn("text-gray-400 hover:text-sori-primary transition-all", showEmojiPicker ? 'text-sori-primary scale-110' : '')}>
            <Smile className="h-6 w-6" />
          </button>
          <button type="submit" disabled={(!inputValue.trim() && pendingAttachments.length === 0) || pendingAttachments.some(a => a.isUploading)} className="text-sori-primary hover:scale-110 transition-all active:scale-95 disabled:opacity-30 disabled:scale-100 flex items-center justify-center p-2 rounded-xl hover:bg-sori-primary/10">
            {editingMessage ? <CheckCircle className="h-6 w-6" /> : <Send className="h-6 w-6" />}
          </button>
        </div>

        {showEmojiPicker && (
          <div className="fixed bottom-24 right-4 md:right-8 z-[1000] shadow-2xl animate-in zoom-in-95 origin-bottom-right">
            <div className="absolute inset-0 -z-10 bg-sori-sidebar rounded-[1.5rem] shadow-2xl border border-white/5"></div>
            <EmojiPicker onEmojiClick={(emojiData) => { setInputValue(inputValue + emojiData.emoji); setShowEmojiPicker(false); }} theme={"dark" as any} width={320} height={400} aria-label="Emoji Picker" />
          </div>
        )}

        {mentionState.visible && (
          <MentionPopup filter={mentionState.filter} onSelect={handleMentionSelect} />
        )}
      </form>
    </footer>
  );
};

