import React from 'react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle,
} from "@sori/ui";
import { LogOut } from "lucide-react";

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  handleLogout: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({ isOpen, onClose, handleLogout }) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-sm text-center">
        <AlertDialogHeader className="items-center">
          <div className="w-12 h-12 bg-sori-error/10 text-sori-error rounded-xl flex items-center justify-center mb-2">
            <LogOut className="h-8 w-8" />
          </div>
          <AlertDialogTitle className="text-xl font-headline font-extrabold text-white">Sign Out</AlertDialogTitle>
          <AlertDialogDescription className="text-on-surface-variant text-sm pb-3">
            Are you sure you want to log out of Sanctuary?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row sm:flex-row gap-3 mt-2">
          <AlertDialogCancel 
            className="flex-1 bg-white/5 hover:bg-white/10 text-white border-none font-bold py-4 rounded-xl mt-0"
          >
            Stay Connected
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleLogout}
            className="flex-1 bg-sori-error hover:bg-sori-error/90 text-white font-bold py-4 rounded-xl"
          >
            Log Out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
