import React from 'react';
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
  return (
    <AlertDialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <AlertDialogContent className="max-w-sm text-center">
        <AlertDialogHeader className="items-center">
          <div className="w-16 h-16 bg-sori-error/10 text-sori-error rounded-2xl flex items-center justify-center mb-4">
            <Trash2 className="h-10 w-10" />
          </div>
          <AlertDialogTitle className="text-xl font-headline font-extrabold text-white">Delete Channel</AlertDialogTitle>
          <AlertDialogDescription className="text-on-surface-variant text-sm py-2">
            This action is irreversible. All messages and data associated with this channel will be permanently purged from the neural network.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2 mt-4">
          <AlertDialogAction 
            onClick={handleDeleteChannel}
            className="w-full bg-sori-error hover:bg-sori-error/90 text-white font-bold py-6 rounded-xl shadow-lg"
          >
            Purge Channel
          </AlertDialogAction>
          <AlertDialogCancel 
            className="w-full bg-white/5 hover:bg-white/10 text-white border-none font-bold py-6 rounded-xl"
          >
            Abort Action
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
