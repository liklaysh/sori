import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, Volume2 } from 'lucide-react';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; type: "text" | "voice"; categoryId: string }) => void;
  initialCategoryId?: string;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ 
  isOpen, onClose, onCreate, initialCategoryId 
}) => {
  const { t } = useTranslation(["chat", "common"]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setType("text");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      type,
      categoryId: initialCategoryId || ""
    });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-sori-surface-overlay" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-sori-surface-panel rounded-[2.5rem] p-8 shadow-3xl border border-sori-border-subtle animate-in zoom-in-95 duration-300">
        <h2 className="text-2xl font-black mb-6 text-white text-center tracking-tight text-[rgb(219,222,225)]">{t("chat:modals.createChannel.title")}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div 
              onClick={() => setType("text")} 
              className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest ${type === "text" ? "border-sori-accent-primary bg-sori-surface-accent-subtle text-white" : "border-sori-border-subtle bg-sori-surface-base text-sori-text-muted hover:border-sori-border-accent"}`}
            >
              <Hash className={type === "text" ? "text-white" : "text-sori-text-muted"} size={20} /> {t("chat:modals.createChannel.text")}
            </div>
            <div 
              onClick={() => setType("voice")} 
              className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest ${type === "voice" ? "border-sori-accent-primary bg-sori-surface-accent-subtle text-white" : "border-sori-border-subtle bg-sori-surface-base text-sori-text-muted hover:border-sori-border-accent"}`}
            >
              <Volume2 className={type === "voice" ? "text-white" : "text-sori-text-muted"} size={20} /> {t("chat:modals.createChannel.voice")}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-sori-text-muted pl-4">{t("chat:modals.createChannel.channelName")}</label>
            <input 
              autoFocus 
              className="w-full bg-sori-surface-base border border-sori-border-subtle rounded-2xl py-4 px-4 text-white outline-none focus:ring-1 focus:ring-sori-accent-primary transition-all font-bold placeholder:font-medium" 
              placeholder={t("chat:modals.createChannel.placeholder")} 
              value={name} 
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} 
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-black text-sori-text-muted hover:text-white transition-colors">{t("common:actions.cancel")}</button>
            <button type="submit" disabled={!name.trim()} className="bg-sori-accent-primary text-black px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:bg-sori-surface-disabled">{t("common:actions.create")}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
