import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@sori/ui";
import { Hash } from "lucide-react";

interface RenameChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  editChannelName: string;
  setEditChannelName: (name: string) => void;
  handleRenameChannel: (e: React.FormEvent) => void;
}

export const RenameChannelModal: React.FC<RenameChannelModalProps> = ({ 
  isOpen, onClose, editChannelName, setEditChannelName, handleRenameChannel 
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-headline font-bold text-white text-center flex items-center justify-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            Rename Channel
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleRenameChannel} className="space-y-6 mt-4">
          <div className="relative">
            <input 
              autoFocus 
              className="w-full bg-black/20 border border-white/5 rounded-xl py-4 px-4 text-white outline-none focus:ring-1 focus:ring-primary/50 transition-all" 
              placeholder="channel-name"
              value={editChannelName} 
              onChange={(e) => setEditChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} 
            />
          </div>
          <DialogFooter className="flex gap-3 sm:justify-end">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="bg-primary hover:bg-primary/90 text-white px-8 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/20"
            >
              Save Changes
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

