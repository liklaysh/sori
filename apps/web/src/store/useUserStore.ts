import { create } from "zustand";
import api from "../lib/api";
import { User } from "../types/chat";

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  setUser: (user: User | null) => void;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get("/auth/me");
      const data = res.data as { user: User | null };
      set({ user: data.user, isAuthenticated: !!data.user, isLoading: false });
    } catch (err) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      set({ user: null, isAuthenticated: false });
      window.location.href = "/login";
    }
  },
}));
