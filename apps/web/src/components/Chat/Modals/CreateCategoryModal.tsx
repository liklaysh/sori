import React from 'react';
import { useTranslation } from 'react-i18next';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  handleCreateCategory: (e: React.FormEvent) => void;
}

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({ isOpen, onClose, newCategoryName, setNewCategoryName, handleCreateCategory }) => {
  const { t } = useTranslation(["chat", "common"]);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-sori-surface-overlay" onClick={onClose}></div>
      <div className="relative w-full max-w-sm bg-sori-surface-panel rounded-[2rem] p-8 border border-sori-border-subtle shadow-3xl animate-in zoom-in-95 duration-300">
        <h2 className="text-xl font-black mb-6 text-white text-center tracking-tight">{t("chat:modals.createCategory.title")}</h2>
        <form onSubmit={handleCreateCategory} className="space-y-6">
          <input 
            autoFocus 
            className="w-full bg-sori-surface-base border border-sori-border-subtle rounded-2xl py-4 px-4 text-white outline-none focus:ring-1 focus:ring-sori-accent-primary transition-all font-bold" 
            placeholder={t("chat:modals.createCategory.placeholder")} 
            value={newCategoryName} 
            onChange={(e) => setNewCategoryName(e.target.value)} 
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-black text-sori-text-muted hover:text-white transition-colors">{t("common:actions.cancel")}</button>
            <button type="submit" disabled={!newCategoryName.trim()} className="bg-sori-accent-primary text-black px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:bg-sori-surface-disabled">{t("common:actions.create")}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
