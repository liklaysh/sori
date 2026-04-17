import { create } from "zustand";
import { persist } from "zustand/middleware";

type ModuleType = "community" | "dm";

interface UIState {
  // Persistence
  collapsedCategories: Set<string>;
  sidebarWidth: number;
  activeModule: ModuleType;
  activeChannelId: string | null;
  activeConversationId: string | null;

  // Modals & Sidebars (Usually non-persistent)
  isSettingsOpen: boolean;
  isChannelSidebarOpen: boolean;
  isMemberSidebarOpen: boolean;
  isVoiceChatOpen: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  
  // Actions
  toggleCategory: (categoryId: string) => void;
  setSidebarWidth: (width: number) => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveModule: (module: ModuleType) => void;
  setActiveChannelId: (id: string | null) => void;
  setActiveConversationId: (id: string | null) => void;
  setChannelSidebarOpen: (open: boolean) => void;
  setMemberSidebarOpen: (open: boolean) => void;
  setIsVoiceChatOpen: (open: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setIsDeafened: (deafened: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      collapsedCategories: new Set(),
      sidebarWidth: 240,
      activeModule: "community",
      activeChannelId: null,
      activeConversationId: null,

      isSettingsOpen: false,
      isChannelSidebarOpen: true,
      isMemberSidebarOpen: true,
      isVoiceChatOpen: false,
      isMuted: false,
      isDeafened: false,

      toggleCategory: (categoryId) => set((state) => {
        const next = new Set(state.collapsedCategories);
        if (next.has(categoryId)) next.delete(categoryId);
        else next.add(categoryId);
        return { collapsedCategories: next };
      }),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
      setActiveModule: (activeModule) => set({ activeModule }),
      setActiveChannelId: (activeChannelId) => {
        console.log("🛠️ [UIStore] setActiveChannelId:", activeChannelId);
        set({ activeChannelId });
      },
      setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
      setChannelSidebarOpen: (isChannelSidebarOpen) => set({ isChannelSidebarOpen }),
      setMemberSidebarOpen: (isMemberSidebarOpen) => set({ isMemberSidebarOpen }),
      setIsVoiceChatOpen: (isVoiceChatOpen) => set({ isVoiceChatOpen }),
      setIsMuted: (isMuted) => set({ isMuted }),
      setIsDeafened: (isDeafened) => set({ isDeafened }),
    }),
    {
      name: "sori-ui-storage",
      partialize: (state) => ({
        collapsedCategories: state.collapsedCategories,
        sidebarWidth: state.sidebarWidth,
        activeModule: state.activeModule,
        activeChannelId: state.activeChannelId,
        activeConversationId: state.activeConversationId,
        isMuted: state.isMuted,
        isDeafened: state.isDeafened,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const { state } = JSON.parse(str);
          return {
            state: {
              ...state,
              collapsedCategories: new Set(state.collapsedCategories),
            },
          };
        },
        setItem: (name, value) => {
          const { state } = value as any;
          const storageValue = {
            state: {
              ...state,
              collapsedCategories: Array.from(state.collapsedCategories),
            },
          };
          localStorage.setItem(name, JSON.stringify(storageValue));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
