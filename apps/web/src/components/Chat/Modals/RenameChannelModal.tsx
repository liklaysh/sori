import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(["chat", "common"]);
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-headline font-bold text-white text-center flex items-center justify-center gap-2">
            <Hash className="h-5 w-5 text-sori-accent-primary" />
            {t("chat:modals.renameChannel.title")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleRenameChannel} className="space-y-6 mt-4">
          <div className="relative">
            <input 
              autoFocus 
              className="w-full bg-sori-surface-panel border border-sori-border-subtle rounded-xl py-4 px-4 text-white outline-none focus:ring-1 focus:ring-sori-accent-primary transition-all" 
              placeholder={t("chat:modals.renameChannel.placeholder")}
              value={editChannelName} 
              onChange={(e) => setEditChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} 
            />
          </div>
          <DialogFooter className="flex gap-3 sm:justify-end">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-sm font-bold text-sori-text-muted hover:text-white transition-colors"
            >
              {t("common:actions.cancel")}
            </button>
            <button 
              type="submit" 
              className="bg-sori-accent-primary text-black hover:brightness-110 px-8 py-2 rounded-xl font-bold text-sm transition-all shadow-lg"
            >
              {t("common:actions.saveChanges")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
