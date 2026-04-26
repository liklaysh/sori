import React from "react";
import { useTranslation } from "react-i18next";
import { Bell, Volume2 } from "lucide-react";
import { Switch, cn } from "@sori/ui";
import { NotificationSettingKey, useUIStore } from "../../../store/useUIStore";

type NotificationRowProps = {
  title: string;
  description: string;
  settingKey: NotificationSettingKey;
};

const NotificationRow: React.FC<NotificationRowProps> = ({ title, description, settingKey }) => {
  const checked = useUIStore((state) => state.notificationSettings[settingKey]);
  const setNotificationSetting = useUIStore((state) => state.setNotificationSetting);

  return (
    <div className="flex items-center justify-between gap-5 rounded-2xl bg-sori-surface-base border border-sori-border-subtle px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-sm font-black text-sori-text-strong">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-sori-text-muted">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={(value) => setNotificationSetting(settingKey, value)}
        aria-label={title}
      />
    </div>
  );
};

type NotificationGroupProps = {
  icon: "bell" | "volume";
  title: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
};

const NotificationGroup: React.FC<NotificationGroupProps> = ({ icon, title, checked, onCheckedChange, children }) => {
  const Icon = icon === "bell" ? Bell : Volume2;

  return (
    <section className="bg-sori-surface-panel rounded-[2rem] p-6 border border-sori-border-subtle space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center border border-sori-border-subtle bg-sori-surface-elevated shrink-0",
              icon === "bell" ? "text-sori-accent-primary" : "text-sori-accent-secondary",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-sori-text-muted truncate">{title}</h2>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
};

export const NotificationsTab: React.FC = () => {
  const { t } = useTranslation(["settings"]);
  const notificationSettings = useUIStore((state) => state.notificationSettings);
  const setNotificationSettings = useUIStore((state) => state.setNotificationSettings);

  const regularEnabled = notificationSettings.channelMessagePopups && notificationSettings.directMessagePopups;
  const soundEnabled = notificationSettings.voiceJoinSound
    && notificationSettings.voiceLeaveSound
    && notificationSettings.newMessageSound
    && notificationSettings.directCallSound;

  return (
    <div className="space-y-8 md:space-y-12 animate-in slide-in-from-bottom-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-sori-text-strong mb-2">{t("settings:notifications.title")}</h1>
        <p className="text-sori-text-muted text-sm">{t("settings:notifications.description")}</p>
      </div>

      <div className="space-y-6 pb-12">
        <NotificationGroup
          icon="bell"
          title={t("settings:notifications.regular.title")}
          checked={regularEnabled}
          onCheckedChange={(checked) => setNotificationSettings({
            channelMessagePopups: checked,
            directMessagePopups: checked,
          })}
        >
          <NotificationRow
            title={t("settings:notifications.regular.channelPopups.title")}
            description={t("settings:notifications.regular.channelPopups.description")}
            settingKey="channelMessagePopups"
          />
          <NotificationRow
            title={t("settings:notifications.regular.directPopups.title")}
            description={t("settings:notifications.regular.directPopups.description")}
            settingKey="directMessagePopups"
          />
        </NotificationGroup>

        <NotificationGroup
          icon="volume"
          title={t("settings:notifications.sound.title")}
          checked={soundEnabled}
          onCheckedChange={(checked) => setNotificationSettings({
            voiceJoinSound: checked,
            voiceLeaveSound: checked,
            newMessageSound: checked,
            directCallSound: checked,
          })}
        >
          <NotificationRow
            title={t("settings:notifications.sound.voiceJoin.title")}
            description={t("settings:notifications.sound.voiceJoin.description")}
            settingKey="voiceJoinSound"
          />
          <NotificationRow
            title={t("settings:notifications.sound.voiceLeave.title")}
            description={t("settings:notifications.sound.voiceLeave.description")}
            settingKey="voiceLeaveSound"
          />
          <NotificationRow
            title={t("settings:notifications.sound.newMessage.title")}
            description={t("settings:notifications.sound.newMessage.description")}
            settingKey="newMessageSound"
          />
          <NotificationRow
            title={t("settings:notifications.sound.directCall.title")}
            description={t("settings:notifications.sound.directCall.description")}
            settingKey="directCallSound"
          />
        </NotificationGroup>
      </div>
    </div>
  );
};
