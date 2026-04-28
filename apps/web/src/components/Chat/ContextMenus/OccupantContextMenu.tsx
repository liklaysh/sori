import React from 'react';
import { useTranslation } from 'react-i18next';
import { VoiceOccupant } from '../../../types/chat';
import { RotateCcw, Volume1, Volume2 } from 'lucide-react';
import { useContextMenuPosition } from '../../../hooks/useContextMenuPosition';
import { Slider } from '@sori/ui';

interface OccupantContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  occupant: VoiceOccupant | null;
  participantVolume: number;
  onVolumeChange: (val: number) => void;
  onClose: () => void;
}

export const OccupantContextMenu: React.FC<OccupantContextMenuProps> = ({ 
  visible, x, y, occupant, participantVolume, onVolumeChange, onClose
}) => {
  const { t } = useTranslation(["voice"]);
  const menuStyles = useContextMenuPosition(x, y);

  if (!visible || !occupant) return null;

  return (
    <div
      className="fixed z-[450] bg-sori-surface-panel border border-sori-border-subtle rounded-2xl shadow-2xl p-4 w-64 animate-in zoom-in-95 shadow-black ring-1 ring-sori-border-subtle"
      style={menuStyles}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-start justify-between gap-3 border-b border-sori-border-subtle pb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase text-sori-text-muted tracking-widest">{t("voice:occupantVolume.title")}</p>
          <p className="text-sm font-black text-sori-text-strong truncate mt-1">{occupant.username}</p>
        </div>
        <div className="h-9 w-9 rounded-xl bg-sori-surface-base border border-sori-border-subtle flex items-center justify-center text-sori-accent-primary shrink-0">
          {participantVolume === 0 ? <Volume1 className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </div>
      </div>

      <div className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase text-sori-text-muted tracking-widest">{t("voice:occupantVolume.volume")}</p>
          <span className="text-sm font-black text-sori-accent-primary tabular-nums">{participantVolume}%</span>
        </div>

        <Slider
          value={[participantVolume]}
          min={0}
          max={200}
          step={1}
          onValueChange={([value]: number[]) => onVolumeChange(value)}
          className="py-2"
        />

        <div className="grid grid-cols-3 gap-2">
          {[0, 100, 200].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onVolumeChange(value)}
              className="h-8 rounded-lg bg-sori-surface-base border border-sori-border-subtle text-[10px] font-black text-sori-text-muted hover:text-sori-accent-primary hover:border-sori-border-accent transition-colors"
            >
              {value}%
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            onVolumeChange(100);
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-sori-surface-hover text-sori-text-muted hover:text-sori-accent-primary transition-colors text-[10px] font-black uppercase tracking-widest"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("voice:occupantVolume.reset")}
        </button>
      </div>
    </div>
  );
};
