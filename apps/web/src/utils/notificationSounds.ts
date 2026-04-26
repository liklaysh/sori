import { useUIStore } from "../store/useUIStore";
import type { NotificationSettingKey } from "../store/useUIStore";

export type NotificationSoundEvent =
  | "voiceJoin"
  | "voiceLeave"
  | "newMessage"
  | "directCall";

const SOUND_PATHS: Record<NotificationSoundEvent, string> = {
  voiceJoin: "/sounds/notifications/voice-join.mp3",
  voiceLeave: "/sounds/notifications/voice-leave.mp3",
  newMessage: "/sounds/notifications/message-new.mp3",
  directCall: "/sounds/notifications/call-direct.mp3",
};

const SETTING_BY_EVENT: Record<NotificationSoundEvent, NotificationSettingKey> = {
  voiceJoin: "voiceJoinSound",
  voiceLeave: "voiceLeaveSound",
  newMessage: "newMessageSound",
  directCall: "directCallSound",
};

const audioCache = new Map<NotificationSoundEvent, HTMLAudioElement>();
const loopingEvents = new Set<NotificationSoundEvent>();

function getAudio(event: NotificationSoundEvent) {
  if (typeof Audio === "undefined") {
    return null;
  }

  const cached = audioCache.get(event);
  if (cached) {
    return cached;
  }

  const audio = new Audio(SOUND_PATHS[event]);
  audio.preload = "auto";
  audio.volume = 0.85;
  audioCache.set(event, audio);

  return audio;
}

export function preloadNotificationSounds() {
  (Object.keys(SOUND_PATHS) as NotificationSoundEvent[]).forEach((event) => {
    getAudio(event)?.load();
  });
}

export function playNotificationSound(event: NotificationSoundEvent) {
  const settings = useUIStore.getState().notificationSettings;
  const settingKey = SETTING_BY_EVENT[event];

  if (!settings[settingKey]) {
    return;
  }

  const audio = getAudio(event);
  if (!audio) {
    return;
  }

  audio.currentTime = 0;
  audio.loop = false;
  void audio.play().catch(() => {
    // Browsers can block playback until the first user gesture. Notification
    // sounds are optional, so blocked playback should never surface as an app error.
  });
}

export function startNotificationSoundLoop(event: NotificationSoundEvent) {
  const settings = useUIStore.getState().notificationSettings;
  const settingKey = SETTING_BY_EVENT[event];

  if (!settings[settingKey]) {
    return;
  }

  const audio = getAudio(event);
  if (!audio) {
    return;
  }

  loopingEvents.add(event);
  audio.loop = true;
  audio.currentTime = 0;
  void audio.play().catch(() => {
    loopingEvents.delete(event);
  });
}

export function stopNotificationSoundLoop(event: NotificationSoundEvent) {
  loopingEvents.delete(event);

  const audio = getAudio(event);
  if (!audio) {
    return;
  }

  audio.loop = false;
  audio.pause();
  audio.currentTime = 0;
}
