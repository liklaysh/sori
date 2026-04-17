import React from 'react';
import { FolderPlus, PlusCircle } from 'lucide-react';

interface MainContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  onCreateCategory: () => void;
  onCreateChannel: () => void;
}

export const MainContextMenu: React.FC<MainContextMenuProps> = ({ visible, x, y, onCreateCategory, onCreateChannel }) => {
  if (!visible) return null;

  const getMenuStyles = (x: number, y: number) => {
    const vThreshold = window.innerHeight / 2;
    const hThreshold = window.innerWidth / 2;
    const styles: React.CSSProperties = {};
    if (y > vThreshold) styles.bottom = window.innerHeight - y; else styles.top = y;
    if (x > hThreshold) styles.right = window.innerWidth - x; else styles.left = x;
    return styles;
  };

  return (
    <div className="fixed z-[200] bg-sori-chat border border-white/10 rounded-xl shadow-2xl py-2 min-w-[200px] animate-in fade-in zoom-in-95 duration-200" style={getMenuStyles(x, y)}>
      <div 
        onClick={onCreateCategory} 
        className="px-4 py-2.5 hover:bg-sori-primary/10 hover:text-sori-primary cursor-pointer flex items-center gap-3 transition-all text-xs font-black uppercase tracking-widest"
      >
        <FolderPlus className="h-4 w-4" />
        Создать категорию
      </div>
      <div 
        onClick={onCreateChannel} 
        className="px-4 py-2.5 hover:bg-sori-primary/10 hover:text-sori-primary cursor-pointer flex items-center gap-3 transition-all text-xs font-black uppercase tracking-widest"
      >
        <PlusCircle className="h-4 w-4" />
        Создать канал
      </div>
    </div>
  );
};
