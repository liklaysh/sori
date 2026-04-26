import React from "react";
import { useTranslation } from "react-i18next";
import { CallLog } from "../../types/chat";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, Clock, AlertCircle } from "lucide-react";
import { cn } from "@sori/ui";
import { format } from "date-fns";

interface SystemCallToastProps {
  log: CallLog;
  count?: number; // For grouping successive events
  isCaller?: boolean;
}

export const SystemCallToast: React.FC<SystemCallToastProps> = ({ log, count = 1, isCaller }) => {
  const { t } = useTranslation(["chat"]);

  const getStatusConfig = () => {
    switch (log.status) {
      case 'missed':
        return {
          label: t("chat:systemCallToast.missedCall", { count }),
          icon: <PhoneMissed className="h-3 w-3" />,
          bgColor: "bg-sori-accent-danger",
          textColor: "text-sori-text-on-accent",
          timeColor: "text-sori-text-on-accent/70",
        };
      case 'rejected':
        return {
          label: count > 1
            ? t("chat:systemCallToast.declinedCall", { count })
            : t("chat:messages.declinedCall"),
          icon: <PhoneOff className="h-3 w-3" />,
          bgColor: "bg-sori-accent-warning",
          textColor: "text-black",
          timeColor: "text-black/70",
        };
      case 'accepted':
        return {
          label: t("chat:systemCallToast.callAccepted"),
          icon: isCaller ? <PhoneOutgoing className="h-3 w-3" /> : <PhoneIncoming className="h-3 w-3" />,
          bgColor: "bg-sori-accent-secondary",
          textColor: "text-sori-text-on-accent",
          timeColor: "text-sori-text-on-accent/70",
        };
      case 'ended':
        const durationStr = log.duration 
          ? `${Math.floor(log.duration / 60)}:${(log.duration % 60).toString().padStart(2, '0')}`
          : "";
        return {
          label: durationStr
            ? t("chat:systemCallToast.callEndedWithDuration", { duration: durationStr })
            : t("chat:systemCallToast.callEnded"),
          icon: <Clock className="h-3 w-3" />,
          bgColor: "bg-sori-surface-base",
          textColor: "text-sori-text-muted",
          timeColor: "text-sori-text-dim",
        };
      case 'timeout':
        return {
          label: t("chat:systemCallToast.noAnswer"),
          icon: <AlertCircle className="h-3 w-3" />,
          bgColor: "bg-sori-surface-base",
          textColor: "text-sori-text-muted",
          timeColor: "text-sori-text-dim",
        };
      default:
        return {
          label: t("chat:systemCallToast.voiceEvent"),
          icon: <PhoneIncoming className="h-3 w-3" />,
          bgColor: "bg-sori-surface-base",
          textColor: "text-sori-text-muted",
          timeColor: "text-sori-text-dim",
        };
    }
  };

  const config = getStatusConfig();
  const timeStr = format(new Date(log.createdAt), "HH:mm");

  return (
    <div className="w-full flex justify-center py-2 animate-in fade-in zoom-in-95 duration-300">
      <div className={cn(
        "flex items-center gap-2.5 px-4 py-1.5 rounded-full shadow-2xl transition-all hover:scale-[1.02]",
        config.bgColor,
        config.textColor
      )}>
        <div className="flex items-center justify-center">
          {config.icon}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider">
            {config.label}
          </span>
          <span className={cn("text-[9px] font-bold", config.timeColor)}>
            {timeStr}
          </span>
        </div>
      </div>
    </div>
  );
};
