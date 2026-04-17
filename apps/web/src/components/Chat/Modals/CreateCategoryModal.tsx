import React from 'react';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  handleCreateCategory: (e: React.FormEvent) => void;
}

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({ isOpen, onClose, newCategoryName, setNewCategoryName, handleCreateCategory }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80" onClick={onClose}></div>
      <div className="relative w-full max-w-sm bg-sori-sidebar rounded-[2rem] p-8 border border-white/10 shadow-3xl animate-in zoom-in-95 duration-300">
        <h2 className="text-xl font-black mb-6 text-white text-center tracking-tight">Create Category</h2>
        <form onSubmit={handleCreateCategory} className="space-y-6">
          <input 
            autoFocus 
            className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-4 text-white outline-none focus:ring-1 focus:ring-sori-primary/50 transition-all font-bold" 
            placeholder="Category Name" 
            value={newCategoryName} 
            onChange={(e) => setNewCategoryName(e.target.value)} 
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-black text-gray-500 hover:text-white transition-colors">CANCEL</button>
            <button type="submit" disabled={!newCategoryName.trim()} className="bg-sori-primary text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-sori-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-30">CREATE</button>
          </div>
        </form>
      </div>
    </div>
  );
};
