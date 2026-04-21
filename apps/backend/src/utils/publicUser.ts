import { normalizeS3Url } from "./url.js";

type UserLike = {
  id?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  status?: string | null;
  role?: string | null;
  [key: string]: any;
};

export function sanitizeUser(user?: UserLike | null) {
  if (!user) {
    return null;
  }

  return {
    id: user.id ?? null,
    username: user.username ?? null,
    avatarUrl: normalizeS3Url(user.avatarUrl) || user.avatarUrl || null,
    status: user.status ?? null,
    role: user.role ?? null,
  };
}
