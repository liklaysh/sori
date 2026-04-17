import React from "react";
import { MessageSquare, Sparkles, Menu } from "lucide-react";

interface EmptyStateProps {
  onShowSidebar: () => void;
}

export const DMEmptyState: React.FC<EmptyStateProps> = ({ onShowSidebar }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
    <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mb-6 animate-in zoom-in-95 duration-500">
      <MessageSquare className="h-12 w-12 text-primary fill-primary/20" />
    </div>
    <h2 className="text-2xl md:text-3xl font-headline font-black text-white mb-2">Private Conversations</h2>
    <p className="text-on-surface-variant max-w-sm">Select a user to start a conversation or find a new friend.</p>
    
    <button onClick={onShowSidebar} className="mt-8 md:hidden bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
      <Menu className="h-5 w-5" /> Show Conversations
    </button>
  </div>
);

export const CommunityEmptyState: React.FC<EmptyStateProps> = ({ onShowSidebar }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
    <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mb-6 animate-pulse">
      <Sparkles className="h-12 w-12 text-primary" />
    </div>
    <h2 className="text-2xl md:text-3xl font-headline font-black text-white mb-2">Welcome to Sanctuary</h2>
    <p className="text-on-surface-variant max-w-sm">Select a channel from the left to start communicating with your community.</p>
    
    <button onClick={onShowSidebar} className="mt-8 md:hidden bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
      <Menu className="h-5 w-5" /> Explore Channels
    </button>
  </div>
);
