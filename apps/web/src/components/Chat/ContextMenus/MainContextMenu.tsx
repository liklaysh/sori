import React from 'react';
import { FolderPlus, PlusCircle } from 'lucide-react';
import { useContextMenuPosition } from '../../../hooks/useContextMenuPosition';

interface MainContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  onCreateCategory: () => void;
  onCreateChannel: () => void;
}

export const MainContextMenu: React.FC<MainContextMenuProps> = ({ visible, x, y, onCreateCategory, onCreateChannel }) => {
  const menuStyles = useContextMenuPosition(x, y);

  if (!visible) return null;

  return (
    <div className="fixed z-[200] bg-sori-surface-panel border border-sori-border-subtle rounded-xl shadow-2xl py-2 min-w-[200px] animate-in fade-in zoom-in-95 duration-200" style={menuStyles}>
      <div 
        onClick={onCreateCategory} 
        className="px-4 py-2.5 hover:bg-sori-surface-hover hover:text-sori-accent-primary cursor-pointer flex items-center gap-3 transition-all text-xs font-black uppercase tracking-widest"
      >
        <FolderPlus className="h-4 w-4" />
        Создать категорию
      </div>
      <div 
        onClick={onCreateChannel} 
        className="px-4 py-2.5 hover:bg-sori-surface-accent-subtle hover:text-sori-accent-primary cursor-pointer flex items-center gap-3 transition-all text-xs font-black uppercase tracking-widest"
      >
        <PlusCircle className="h-4 w-4" />
        Создать канал
      </div>
    </div>
  );
};
