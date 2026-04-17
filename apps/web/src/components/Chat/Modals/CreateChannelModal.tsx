import React from 'react';
import { Hash, Volume2 } from 'lucide-react';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  newChannelName: string;
  setNewChannelName: (name: string) => void;
  newChannelType: "text" | "voice";
  setNewChannelType: (type: "text" | "voice") => void;
  handleCreateChannel: (e: React.FormEvent) => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ 
  isOpen, onClose, newChannelName, setNewChannelName, newChannelType, setNewChannelType, handleCreateChannel 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-sori-sidebar rounded-[2.5rem] p-8 shadow-3xl border border-white/10 animate-in zoom-in-95 duration-300">
        <h2 className="text-2xl font-black mb-6 text-white text-center tracking-tight">Create Channel</h2>
        <form onSubmit={handleCreateChannel} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div onClick={() => setNewChannelType("text")} className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest ${newChannelType === "text" ? "border-sori-primary bg-sori-primary/20 text-white" : "border-white/5 bg-black/40 text-gray-500 hover:border-white/10"}`}>
              <Hash className={newChannelType === "text" ? "text-white" : "text-gray-500"} size={20} /> Text
            </div>
            <div onClick={() => setNewChannelType("voice")} className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest ${newChannelType === "voice" ? "border-sori-primary bg-sori-primary/20 text-white" : "border-white/5 bg-black/40 text-gray-500 hover:border-white/10"}`}>
              <Volume2 className={newChannelType === "voice" ? "text-white" : "text-gray-500"} size={20} /> Voice
            </div>
          </div>
          <input 
            autoFocus 
            className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-4 text-white outline-none focus:ring-1 focus:ring-sori-primary/50 transition-all font-bold placeholder:font-medium" 
            placeholder="Channel Name" 
            value={newChannelName} 
            onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} 
          />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-black text-gray-500 hover:text-white transition-colors">CANCEL</button>
            <button type="submit" disabled={!newChannelName.trim()} className="bg-sori-primary text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-sori-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-30">CREATE</button>
          </div>
        </form>
      </div>
    </div>
  );
};
