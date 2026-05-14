import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Attachment, Message, Reaction } from "../../types/chat";
import { useUserStore } from "../../store/useUserStore";
import { cn } from "@sori/ui";
import { CornerUpLeft, FileText, Download, X, PhoneMissed, Phone, PhoneOff, Forward, Copy, Save, Music, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useServerTime } from "../../hooks/useServerTime";
import { EmbedCard } from "./EmbedCard";
import { LinkMetadata } from "../../types/chat";
import { getAvatarUrl } from "../../utils/avatar";
import { getMessageAttachments } from "../../utils/chatMessages";

interface MessageItemProps {
  msg: Message;
  onContextMenu: (e: React.MouseEvent) => void;
  onForward?: (data: any) => void;
  onReaction?: (message: Message, emoji: string) => void;
}

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function AudioAttachmentBubble({
  attachment,
  fileSizeLabel,
  downloadTitle,
}: {
  attachment: Attachment;
  fileSizeLabel: string;
  downloadTitle: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const progressMax = duration || 0;
  const progressValue = Math.min(currentTime, progressMax || currentTime || 0);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.volume = volume;
  }, [volume]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
    setIsPlaying(false);
  };

  const seekTo = (value: string) => {
    const nextTime = Number(value);
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(nextTime)) {
      return;
    }

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const setNextVolume = (value: string) => {
    const nextVolume = Number(value);
    if (!Number.isFinite(nextVolume)) {
      return;
    }

    setVolume(nextVolume);
  };

  return (
    <div className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-sori-border-subtle bg-sori-surface-elevated p-3.5 shadow-sm sm:w-[420px]">
      <audio
        ref={audioRef}
        src={attachment.fileUrl}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="mb-3 flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sori-border-accent bg-sori-surface-accent-subtle text-sori-accent-primary">
          <Music className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-sori-text-strong">{attachment.fileName || "Voice Message"}</p>
          <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-sori-text-muted">
            {[fileSizeLabel, duration ? formatAudioTime(duration) : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        <a
          href={attachment.fileUrl}
          download={attachment.fileName}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sori-text-muted transition hover:bg-sori-surface-hover hover:text-sori-accent-primary"
          title={downloadTitle}
        >
          <Download className="h-4 w-4" />
        </a>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sori-accent-primary text-black transition hover:brightness-110"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-black tabular-nums">
            <span className="text-sori-text-strong">{formatAudioTime(currentTime)}</span>
            <span className="text-sori-text-muted">{formatAudioTime(duration)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={progressMax}
            step={0.1}
            value={progressValue}
            disabled={!progressMax}
            onChange={(event) => seekTo(event.target.value)}
            className="h-1.5 w-full cursor-pointer accent-sori-accent-primary disabled:cursor-default disabled:opacity-50"
            aria-label="Audio progress"
          />
        </div>

        <div className="group/volume flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsVolumeOpen((current) => !current)}
            className="grid h-9 w-9 place-items-center rounded-xl text-sori-text-muted transition hover:bg-sori-surface-hover hover:text-sori-accent-primary"
            aria-label="Audio volume"
          >
            {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => setNextVolume(event.target.value)}
            className={cn(
              "h-1.5 cursor-pointer accent-sori-accent-primary transition-all group-hover/volume:w-16 group-hover/volume:opacity-100 group-focus-within/volume:w-16 group-focus-within/volume:opacity-100",
              isVolumeOpen ? "w-16 opacity-100" : "w-0 opacity-0"
            )}
            aria-label="Audio volume"
          />
        </div>
      </div>
    </div>
  );
}

export const MessageItem: React.FC<MessageItemProps> = ({ msg, onContextMenu, onForward, onReaction }) => {
  const { t } = useTranslation(["chat", "common", "notifications"]);
  const { user } = useUserStore();
  const { formatServerTimestamp } = useServerTime();
  const [lightboxAttachment, setLightboxAttachment] = useState<Attachment | null>(null);
  
  if (!user) return null;

  const isMe = msg.authorId === user.id;
  const username = msg.username || msg.author?.username || t("chat:messages.deletedUser");
  const attachments = getMessageAttachments(msg);

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
    acc[r.emoji] = acc[r.emoji] || { count: 0, mine: false };
    acc[r.emoji].count += 1;
    if (r.userId === user.id) acc[r.emoji].mine = true;
    return acc;
  }, {} as Record<string, { count: number; mine: boolean }>);
  const reactionEntries = Object.entries(groupedReactions);
  const hasReactions = reactionEntries.length > 0 && !msg.isDeleted;

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

  const handleCopy = (attachment: Attachment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (attachment.fileUrl) {
      navigator.clipboard.writeText(attachment.fileUrl);
      toast.success(t("notifications:clipboard.linkCopied"));
    }
  };

  const renderAttachment = (attachment: Attachment, index: number) => {
    const isImage = attachment.fileType?.startsWith('image/');
    const isVideo = attachment.fileType?.startsWith('video/');
    const isAudio = attachment.fileType?.startsWith('audio/');

    if (isAudio) {
      return (
        <AudioAttachmentBubble
          key={`${msg.id}-attachment-${index}`}
          attachment={attachment}
          fileSizeLabel={formatFileSize(attachment.fileSize)}
          downloadTitle={t("common:actions.download")}
        />
      );
    }

    return (
      <div
        key={`${msg.id}-attachment-${index}`}
        className="max-w-md rounded-2xl overflow-hidden border border-sori-border-subtle bg-sori-surface-elevated group/file relative shadow-lg"
      >
        {isImage ? (
          <div className="cursor-pointer" onClick={() => setLightboxAttachment(attachment)}>
            <img src={attachment.fileUrl} alt={attachment.fileName || 'Attachment'} className="max-h-80 w-auto object-contain hover:brightness-110 transition-all" loading="lazy" />
          </div>
        ) : isVideo ? (
          <video src={attachment.fileUrl} controls className="max-h-80 w-auto" />
        ) : (
          <div className="p-4 flex items-center gap-4 min-w-[240px]">
            <FileText className="h-6 w-6" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-sori-text-strong truncate">{attachment.fileName}</p>
              <p className="text-[10px] text-sori-text-muted font-black uppercase tracking-widest">{formatFileSize(attachment.fileSize)}</p>
            </div>
            <a
              href={attachment.fileUrl}
              download={attachment.fileName}
              className="w-10 h-10 rounded-xl bg-sori-surface-accent-subtle text-sori-accent-primary flex items-center justify-center hover:bg-sori-accent-primary hover:text-black transition-all shadow-sm"
              title={t("common:actions.download")}
            >
              <Download className="h-5 w-5" />
            </a>
          </div>
        )}
      </div>
    );
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
      id={`msg-${msg.id}`}
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
          {getAvatarUrl(msg.author?.avatarUrl) ? (
            <img 
               src={getAvatarUrl(msg.author?.avatarUrl)!}
               className="w-full h-full object-cover" 
            />
          ) : (
            username[0].toUpperCase()
          )}
        </div>
        <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-full`}>
          <div className="flex items-baseline gap-2 mb-0.5 px-1">
            <span className={`text-[11px] font-black ${isMe ? "text-sori-accent-primary" : "text-sori-accent-secondary"}`}>
              {isMe ? t("chat:messages.you") : username}
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
          
          <div className={cn(
            "relative flex flex-col gap-2 max-w-[calc(100vw-120px)] md:max-w-md lg:max-w-lg xl:max-w-xl",
            isMe ? "items-end" : "items-start",
            hasReactions && "mb-4"
          )}>
            {msg.type === 'call_missed' ? (
              <div className="flex items-center gap-3 py-3 px-5 bg-sori-surface-danger-subtle border border-sori-border-danger-dim rounded-2xl animate-in fade-in zoom-in-95 duration-500 my-1">
                <div className="w-10 h-10 rounded-xl bg-sori-surface-danger-subtle flex items-center justify-center text-sori-accent-danger shadow-inner">
                  <PhoneMissed className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sori-text-strong text-xs font-black tracking-tight uppercase">{t("chat:messages.missedCall")}</p>
                  <p className="text-[10px] text-sori-accent-danger font-bold">{formatMessageTime(msg.createdAt)}</p>
                </div>
              </div>
            ) : msg.type === 'call_ended' ? (
              <div className="flex items-center gap-3 py-3 px-5 bg-sori-surface-accent-subtle border border-sori-border-accent rounded-2xl animate-in fade-in zoom-in-95 duration-500 my-1">
                <div className="w-10 h-10 rounded-xl bg-sori-surface-accent-subtle flex items-center justify-center text-sori-accent-primary shadow-inner">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sori-text-strong text-xs font-black tracking-tight uppercase">{t("chat:messages.callEnded")}</p>
                  <p className="text-[10px] text-sori-accent-primary font-black uppercase tracking-widest leading-none mt-0.5">{t("chat:messages.duration", { duration: msg.content })}</p>
                </div>
              </div>
            ) : msg.type === 'call_rejected' ? (
              <div className="flex items-center gap-3 py-3 px-5 bg-sori-accent-warning border border-sori-accent-warning rounded-2xl animate-in fade-in zoom-in-95 duration-500 my-1">
                <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center text-black">
                  <PhoneOff className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-black text-xs font-black tracking-tight uppercase">{t("chat:messages.declinedCall")}</p>
                  <p className="text-[10px] text-black/70 font-bold">{formatMessageTime(msg.createdAt)}</p>
                </div>
              </div>
            ) : (msg.content && (msg.type !== 'file' || msg.content.trim() !== "")) && (
              <div className="relative group/content w-full">
                <div className={cn(
                  "px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words w-full transition-all duration-200 select-text cursor-text",
                  msg.isDeleted 
                    ? "bg-sori-surface-base text-sori-text-dim italic border border-sori-border-subtle shadow-none" 
                    : isMe 
                      ? "bg-sori-chat-bubble-me text-sori-text-strong rounded-tr-none shadow-none border border-sori-chat-bubble-me-border" 
                      : "bg-sori-surface-panel text-sori-text-primary rounded-tl-none border-none shadow-[inset_0_0_0_1px_var(--sori-border-subtle)]"
                )}>
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

            {attachments.length > 0 && !msg.isDeleted && (
              <div className="flex flex-col gap-2 w-full">
                {attachments.map((attachment, index) => renderAttachment(attachment, index))}
              </div>
            )}

            {hasReactions && (
              <div className="absolute -bottom-3 left-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap gap-1.5">
                {reactionEntries.map(([emoji, reaction]) => (
                  <button
                    type="button"
                    key={emoji}
                    className={cn(
                      "flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 text-sori-text-primary transition-colors cursor-pointer",
                      reaction.mine
                        ? "border-sori-border-accent bg-sori-surface-accent-subtle text-sori-text-strong hover:border-sori-border-accent"
                        : "border-sori-border-subtle bg-sori-surface-elevated hover:bg-sori-surface-hover"
                  )}
                  onClick={() => onReaction?.(msg, emoji)}
                >
                  <span className="text-xs leading-none">{emoji}</span>
                  <span className={cn(
                    "text-[10px] font-black leading-none",
                    reaction.mine ? "text-sori-accent-primary" : "text-sori-text-dim"
                  )}>{reaction.count}</span>
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {lightboxAttachment && (
        <div 
          className="fixed inset-0 z-[1000] bg-sori-surface-base flex items-center justify-center p-8 animate-in fade-in duration-300"
          onClick={() => setLightboxAttachment(null)}
        >
          <div className="absolute top-6 right-6 flex gap-3">
             <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onForward?.({
                    content: msg.content || "",
                    attachments: attachments.length > 0 ? attachments : undefined,
                    attachment: attachments[0] || undefined,
                  });
                }}
                className="w-12 h-12 rounded-2xl bg-sori-surface-panel text-white flex items-center justify-center hover:bg-sori-accent-primary hover:text-black transition-all shadow-lg border border-sori-border-subtle"
                title={t("common:actions.forward")}
              >
                <Forward className="h-6 w-6" />
             </button>
             <button 
                onClick={(e) => handleCopy(lightboxAttachment, e)}
                className="w-12 h-12 rounded-2xl bg-sori-surface-panel text-sori-text-strong flex items-center justify-center hover:bg-sori-surface-hover transition-all shadow-lg border border-sori-border-subtle"
                title={t("common:actions.copyLink")}
              >
                <Copy className="h-6 w-6" />
             </button>
             <a 
                href={lightboxAttachment.fileUrl} 
                download={lightboxAttachment.fileName}
                onClick={e => e.stopPropagation()}
                className="w-12 h-12 rounded-2xl bg-sori-surface-panel text-white flex items-center justify-center hover:bg-sori-accent-primary hover:text-black transition-all shadow-lg border border-sori-border-subtle"
                title={t("common:actions.save")}
             >
                <Save className="h-6 w-6" />
             </a>
             <button 
                className="w-12 h-12 rounded-2xl bg-sori-surface-panel text-sori-text-strong flex items-center justify-center hover:bg-sori-accent-danger transition-all"
                onClick={() => setLightboxAttachment(null)}
             >
                <X className="h-6 w-6" />
             </button>
          </div>
          <img 
            src={lightboxAttachment.fileUrl} 
            className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300" 
            alt={t("chat:messages.fullscreenPreview")} 
          />
        </div>
      )}
    </div>
  );
};
