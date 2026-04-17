import type { Socket as BaseSocket } from "socket.io";

export interface UserProfile {
  id: string;
  username: string;
  role: string;
  avatarUrl?: string | null;
  [key: string]: any;
}

export interface Socket extends BaseSocket {
  user: UserProfile;
}
