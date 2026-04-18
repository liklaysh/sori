import React, { useState } from "react";
import { Message, Reaction } from "../../types/chat";
import { useUserStore } from "../../store/useUserStore";
import { cn } from "@sori/ui";
import { CornerUpLeft, FileText, Download, X, PhoneMissed, Phone, PhoneOff, Forward, Copy, Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useServerTime } from "../../hooks/useServerTime";
import { EmbedCard } from "./EmbedCard";
import { LinkMetadata } from "../../types/chat";
import { API_URL } from "../../config";

interface MessageItemProps {
  msg: Message;
  onContextMenu: (e: React.MouseEvent) => void;
  onForward?: (data: any) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ msg, onContextMenu, onForward }) => {
  const { user } = useUserStore();
  const { formatServerTimestamp } = useServerTime();
  const [showLightbox, setShowLightbox] = useState(false);
  
  if (!user) return null;

  const isMe = msg.authorId === user.id;
  const username = msg.username || msg.author?.username || "Unknown";

  const isImage = msg.fileType?.startsWith('image/');
  const isVideo = msg.fileType?.startsWith('video/');

  const parseLinkMetadata = (raw: string | null | undefined): LinkMetadata[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "object" && parsed !== null) return [parsed as LinkMetadata];
      return [];
    } catch (e) {
      return [];
    }
  };

  const linkData = parseLinkMetadata(msg.linkMetadata);

  const groupedReactions = (msg.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatFileSize = (bytes?: number | null) => {
    if (bytes === null || bytes === undefined) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatMessageTime = (dateValue: string | number) => {
    try {
      return format(formatServerTimestamp(dateValue), "dd.MM.yy HH:mm");
    } catch (e) {
      return "";
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (msg.fileUrl) {
      navigator.clipboard.writeText(msg.fileUrl);
      toast.success("Link copied to clipboard");
    }
  };

  const renderContentWithLinks = (content?: string | null) => {
    if (!content) return "";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={index} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-sori-text-strong underline decoration-sori-border-strong hover:text-sori-accent-primary hover:decoration-sori-accent-primary transition-all underline-offset-2 break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div 
      id={msg.id}
      onContextMenu={onContextMenu}
      className={`flex flex-col gap-1 group animate-in slide-in-from-bottom-1 duration-300 ${isMe ? "items-end" : "items-start"}`}
    >
      {msg.parent && !msg.isDeleted && (
        <div className={`flex items-center gap-2 mb-[-8px] text-sori-text-muted hover:text-sori-text-strong transition-colors cursor-pointer max-w-[70%] ${isMe ? "flex-row-reverse" : "ml-12"}`}>
          <CornerUpLeft className="h-3 w-3" />
          <p className="text-[10px] truncate italic">
            <span className="font-bold">{msg.parent.username || msg.parent.author?.username}:</span> {msg.parent.content}
          </p>
        </div>
      )}

      <div className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[11px] transition-transform group-hover:scale-105 shadow-inner shrink-0 ${isMe ? "bg-sori-surface-accent-subtle text-sori-accent-primary border border-sori-border-accent" : "bg-sori-surface-panel text-sori-text-dim border border-sori-border-subtle"} overflow-hidden`}>
          {msg.author?.avatarUrl ? (
            <img 
               src={msg.author.avatarUrl.startsWith('http') ? msg.author.avatarUrl : `${API_URL}/uploads/${msg.author.avatarUrl}`} 
               className="w-full h-full object-cover" 
            />
          ) : (
            username[0].toUpperCase()
          )}
        </div>
        <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-full`}>
          <div className="flex items-baseline gap-2 mb-0.5 px-1">
            <span className={`text-[11px] font-black ${isMe ? "text-sori-accent-primary" : "text-sori-accent-secondary"}`}>
              {isMe ? "You" : username}
            </span>
            <span className="text-[10px] font-bold text-sori-text-muted tracking-tight">
              {formatMessageTime(msg.createdAt)}
            </span>
            {msg.isEdited && !msg.isDeleted && (
              <span className="text-[8px] font-black text-sori-text-muted uppercase italic">
                (edited {msg.editedAt ? format(formatServerTimestamp(msg.editedAt), "HH:mm") : ""})
              </span>
            )}
          </div>
          
          <div className={`flex flex-col gap-2 ${isMe ? 'items-end' : 'items-start'} max-w-[calc(100vw-120px)] md:max-w-md lg:max-w-lg xl:max-w-xl`}>
            {msg.type === 'call_missed' ? (
              <div className="flex items-center gap-3 py-3 px-5 bg-sori-surface-danger-subtle border border-sori-border-danger-dim rounded-2xl animate-in fade-in zoom-in-95 duration-500 my-1">
                <div className="w-10 h-10 rounded-xl bg-sori-surface-danger-subtle flex items-center justify-center text-sori-error shadow-inner">
                  <PhoneMissed className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sori-text-strong text-xs font-black tracking-tight uppercase">Missed Call</p>
                  <p className="text-[10px] text-sori-error font-bold">{formatMessageTime(msg.createdAt)}</p>
                </div>
              </div>
            ) : msg.type === 'call_ended' ? (
              <div className="flex items-center gap-3 py-3 px-5 bg-sori-surface-accent-subtle border border-sori-border-accent rounded-2xl animate-in fade-in zoom-in-95 duration-500 my-1">
                <div className="w-10 h-10 rounded-xl bg-sori-surface-accent-subtle flex items-center justify-center text-sori-accent-primary shadow-inner">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sori-text-strong text-xs font-black tracking-tight uppercase">Call Ended</p>
                  <p className="text-[10px] text-sori-accent-primary font-black uppercase tracking-widest leading-none mt-0.5">Duration: {msg.content}</p>
                </div>
              </div>
            ) : msg.type === 'call_rejected' ? (
              <div className="flex items-center gap-3 py-3 px-5 bg-sori-surface-panel border border-sori-border-subtle rounded-2xl animate-in fade-in zoom-in-95 duration-500 my-1">
                <div className="w-10 h-10 rounded-xl bg-sori-surface-main flex items-center justify-center text-sori-text-dim">
                  <PhoneOff className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sori-text-dim text-xs font-black tracking-tight uppercase">Declined Call</p>
                  <p className="text-[10px] text-sori-text-muted font-bold">{formatMessageTime(msg.createdAt)}</p>
                </div>
              </div>
            ) : msg.content && (
              <div className="relative group/content w-full">
                <div className={`
                  px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words w-full
                  ${msg.isDeleted ? "bg-sori-surface-base text-sori-text-muted italic border border-sori-border-subtle" : 
                    isMe ? "bg-sori-accent-primary text-black rounded-tr-none shadow-lg" : "bg-sori-surface-panel text-sori-text-primary rounded-tl-none border border-sori-border-subtle"}
                `}>
                  {renderContentWithLinks(msg.content)}
                </div>
              </div>
            )}

            {linkData.length > 0 && !msg.isDeleted && (
              <div className="flex flex-col gap-2 w-full">
                {linkData.map((data, idx) => (
                  <EmbedCard key={`${msg.id}-embed-${idx}`} data={data} />
                ))}
              </div>
            )}

            {msg.fileUrl && !msg.isDeleted && (
              <div className={`max-w-md rounded-2xl overflow-hidden border border-sori-border-subtle bg-sori-surface-base group/file relative`}>
                {isImage ? (
                  <div className="cursor-pointer" onClick={() => setShowLightbox(true)}>
                    <img src={msg.fileUrl || undefined} alt={msg.fileName || 'Attachment'} className="max-h-80 w-auto object-contain hover:brightness-110 transition-all" loading="lazy" />
                  </div>
                ) : isVideo ? (
                  <video src={msg.fileUrl || undefined} controls className="max-h-80 w-auto" />
                ) : (
                  <div className="p-4 flex items-center gap-4 min-w-[240px]">
                      <FileText className="h-6 w-6" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-sori-text-strong truncate">{msg.fileName}</p>
                      <p className="text-[10px] text-sori-text-muted font-black uppercase tracking-widest">{formatFileSize(msg.fileSize)}</p>
                    </div>
                    <a 
                      href={msg.fileUrl} 
                      download={msg.fileName} 
                      className="w-10 h-10 rounded-xl bg-sori-surface-accent-subtle text-sori-accent-primary flex items-center justify-center hover:bg-sori-accent-primary hover:text-black transition-all shadow-sm"
                      title="Download"
                    >
                      <Download className="h-5 w-5" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {Object.keys(groupedReactions).length > 0 && !msg.isDeleted && (
            <div className={`flex flex-wrap gap-1.5 mt-1.5 ${isMe ? "justify-end" : "justify-start"}`}>
              {Object.entries(groupedReactions).map(([emoji, count]) => (
                <div key={emoji} className="flex items-center gap-1 bg-sori-surface-panel border border-sori-border-subtle rounded-lg px-1.5 py-0.5 hover:bg-sori-surface-hover transition-colors cursor-pointer">
                  <span className="text-xs">{emoji}</span>
                  <span className="text-[9px] font-black text-sori-text-dim">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showLightbox && isImage && (
        <div 
          className="fixed inset-0 z-[1000] bg-sori-surface-base flex items-center justify-center p-8 animate-in fade-in duration-300"
          onClick={() => setShowLightbox(false)}
        >
          <div className="absolute top-6 right-6 flex gap-3">
             <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onForward?.({
                    content: msg.content || "",
                    fileUrl: msg.fileUrl || undefined,
                    fileName: msg.fileName || undefined,
                    fileSize: msg.fileSize || undefined,
                    fileType: msg.fileType || undefined
                  });
                }}
                className="w-12 h-12 rounded-2xl bg-sori-surface-panel text-white flex items-center justify-center hover:bg-sori-accent-primary hover:text-black transition-all shadow-lg border border-sori-border-subtle"
                title="Forward"
              >
                <Forward className="h-6 w-6" />
             </button>
             <button 
                onClick={handleCopy}
                className="w-12 h-12 rounded-2xl bg-sori-surface-panel text-sori-text-strong flex items-center justify-center hover:bg-sori-surface-hover transition-all shadow-lg border border-sori-border-subtle"
                title="Copy Link"
              >
                <Copy className="h-6 w-6" />
             </button>
             <a 
                href={msg.fileUrl!} 
                download={msg.fileName}
                onClick={e => e.stopPropagation()}
                className="w-12 h-12 rounded-2xl bg-sori-surface-panel text-white flex items-center justify-center hover:bg-sori-accent-primary hover:text-black transition-all shadow-lg border border-sori-border-subtle"
                title="Save"
             >
                <Save className="h-6 w-6" />
             </a>
             <button 
                className="w-12 h-12 rounded-2xl bg-sori-surface-panel text-sori-text-strong flex items-center justify-center hover:bg-sori-accent-danger transition-all"
                onClick={() => setShowLightbox(false)}
             >
                <X className="h-6 w-6" />
             </button>
          </div>
          <img 
            src={msg.fileUrl || undefined} 
            className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300" 
            alt="Fullscreen preview" 
          />
        </div>
      )}
    </div>
  );
};
