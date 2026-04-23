import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@sori/ui";
import { Trash2 } from "lucide-react";

interface DeleteChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  handleDeleteChannel: () => void;
}

export const DeleteChannelModal: React.FC<DeleteChannelModalProps> = ({ isOpen, onClose, handleDeleteChannel }) => {
  const { t } = useTranslation(["chat"]);
  return (
    <AlertDialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <AlertDialogContent className="max-w-sm text-center">
        <AlertDialogHeader className="items-center">
          <div className="w-16 h-16 bg-sori-surface-danger-subtle text-sori-accent-danger rounded-2xl flex items-center justify-center mb-4">
            <Trash2 className="h-10 w-10" />
          </div>
          <AlertDialogTitle className="text-xl font-headline font-extrabold text-white">{t("chat:modals.deleteChannel.title")}</AlertDialogTitle>
          <AlertDialogDescription className="text-sori-text-muted text-sm py-2">
            {t("chat:modals.deleteChannel.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2 mt-4">
          <AlertDialogAction 
            onClick={handleDeleteChannel}
            className="w-full bg-sori-accent-danger hover:brightness-110 text-white font-bold py-6 rounded-xl shadow-lg"
          >
            {t("chat:modals.deleteChannel.confirm")}
          </AlertDialogAction>
          <AlertDialogCancel 
            className="w-full bg-sori-surface-panel hover:bg-sori-surface-hover text-white border-none font-bold py-6 rounded-xl"
          >
            {t("chat:modals.deleteChannel.cancel")}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
