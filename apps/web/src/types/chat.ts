export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  user?: User;
}

export interface Attachment {
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  fileType?: string | null;
}

export interface CallLog {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  status: 'accepted' | 'ended' | 'missed' | 'rejected' | 'timeout' | 'error';
  duration?: number | null;
  createdAt: number | string;
  type: "system_call";
}

export interface Message {
  id: string;
  content: string;
  authorId: string;
  username?: string;
  author?: User;
  channelId?: string | null;
  conversationId?: string | null;
  createdAt: number | string;
  parentId?: string | null;
  parent?: Message | null;
  isEdited?: boolean;
  editedAt?: number | string | null;
  isDeleted?: boolean;
  linkMetadata?: string | null;
  reactions?: Reaction[];
  attachments?: Attachment[] | null;
  attachment?: Attachment | null;
  type?: "text" | "call_missed" | "call_ended" | "call_rejected" | "system_call" | string;
  requestId?: string;
}

export type DirectMessage = (Message & { conversationId: string; isRead: boolean; isDelivered?: boolean; callId?: string | null }) | CallLog;

export type ChatItem = Message | CallLog;

export interface DMConversation {
  id: string;
  user1Id: string;
  user2Id: string;
  user1?: User;
  user2?: User;
  lastMessage?: string;
  updatedAt: number | string;
  unreadCount?: number;
}

export interface Channel {
  id: string;
  name: string;
  type: "text" | "voice";
  communityId: string;
  categoryId: string;
  categoryName?: string;
}

export interface Community {
  id: string;
  name: string;
  iconUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  communityId: string;
  order: number;
}

export interface Member {
  id: string;
  username: string;
  avatarUrl?: string | null;
  status: "online" | "offline" | "idle" | "dnd";
  role: string;
}

export interface VoiceOccupant {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  joinedAt: number;
  heartbeatAt?: number;
  isStreaming?: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  status?: "online" | "offline" | "idle" | "dnd";
  role?: string;
  noiseSuppression?: boolean;
  micGain?: number;
  outputVolume?: number;
}

export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
  isPrivate?: boolean;
}
