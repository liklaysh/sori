import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enAdmin from "./locales/en/admin.json";
import enAuth from "./locales/en/auth.json";
import enChat from "./locales/en/chat.json";
import enCommon from "./locales/en/common.json";
import enNotifications from "./locales/en/notifications.json";
import enSettings from "./locales/en/settings.json";
import enVoice from "./locales/en/voice.json";
import ruAdmin from "./locales/ru/admin.json";
import ruAuth from "./locales/ru/auth.json";
import ruChat from "./locales/ru/chat.json";
import ruCommon from "./locales/ru/common.json";
import ruNotifications from "./locales/ru/notifications.json";
import ruSettings from "./locales/ru/settings.json";
import ruVoice from "./locales/ru/voice.json";

export const LANGUAGE_STORAGE_KEY = "sori.language";
export const SUPPORTED_LANGUAGES = ["en", "ru"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const DEFAULT_LANGUAGE: AppLanguage = "en";

export function normalizeLanguage(language?: string | null): AppLanguage {
  const normalized = language?.toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.includes(normalized as AppLanguage)
    ? (normalized as AppLanguage)
    : DEFAULT_LANGUAGE;
}

function getSavedLanguage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getBrowserLanguage(): string | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  return navigator.languages?.[0] || navigator.language || null;
}

function detectInitialLanguage(): AppLanguage {
  const savedLanguage = getSavedLanguage();
  if (savedLanguage) {
    return normalizeLanguage(savedLanguage);
  }

  return normalizeLanguage(getBrowserLanguage());
}

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    chat: enChat,
    voice: enVoice,
    admin: enAdmin,
    settings: enSettings,
    notifications: enNotifications,
  },
  ru: {
    common: ruCommon,
    auth: ruAuth,
    chat: ruChat,
    voice: ruVoice,
    admin: ruAdmin,
    settings: ruSettings,
    notifications: ruNotifications,
  },
} as const;

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: detectInitialLanguage(),
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: [...SUPPORTED_LANGUAGES],
      defaultNS: "common",
      ns: ["common", "auth", "chat", "voice", "admin", "settings", "notifications"],
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });

  i18n.on("languageChanged", (language) => {
    const normalizedLanguage = normalizeLanguage(language);

    if (typeof document !== "undefined") {
      document.documentElement.lang = normalizedLanguage;
    }

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
      } catch {
        // Ignore localStorage errors in restricted environments.
      }
    }
  });
}

if (typeof document !== "undefined") {
  document.documentElement.lang = normalizeLanguage(i18n.resolvedLanguage);
}

export async function changeAppLanguage(language: AppLanguage) {
  const normalizedLanguage = normalizeLanguage(language);
  await i18n.changeLanguage(normalizedLanguage);
}

export default i18n;
