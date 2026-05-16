import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { API_URL } from "../../config";
import {
  WEB_CLIENT_BUILD_ID,
  WEB_CLIENT_VERSION,
  isComparableBuild,
} from "../../utils/clientInfo";

type SystemVersion = {
  version?: string;
  buildId?: string;
  commit?: string;
};

function isOutdated(serverVersion: SystemVersion) {
  if (isComparableBuild(WEB_CLIENT_BUILD_ID) && isComparableBuild(serverVersion.buildId)) {
    return serverVersion.buildId !== WEB_CLIENT_BUILD_ID;
  }

  if (isComparableBuild(WEB_CLIENT_VERSION) && isComparableBuild(serverVersion.version)) {
    return serverVersion.version !== WEB_CLIENT_VERSION;
  }

  return false;
}

export function WebUpdateGate() {
  const { i18n } = useTranslation();
  const [serverVersion, setServerVersion] = useState<SystemVersion | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkVersion = async () => {
      try {
        const response = await fetch(`${API_URL}/api/system/version?_=${Date.now()}`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          return;
        }

        const nextVersion = await response.json() as SystemVersion;
        if (!cancelled && isOutdated(nextVersion)) {
          setServerVersion(nextVersion);
        }
      } catch {
        // Version checks are intentionally quiet; the gate only appears when a newer build is confirmed.
      }
    };

    const initialTimeout = window.setTimeout(checkVersion, 12_000);
    const intervalId = window.setInterval(checkVersion, 60_000);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimeout);
      window.clearInterval(intervalId);
    };
  }, []);

  if (!serverVersion) {
    return null;
  }

  const isRussian = i18n.language?.startsWith("ru");

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-sori-surface-base/95 px-4 text-sori-text-primary">
      <div className="w-full max-w-md rounded-2xl border border-sori-border-accent bg-sori-surface-main p-6 shadow-2xl">
        <p className="text-[11px] font-black uppercase tracking-widest text-sori-accent-primary">
          {isRussian ? "Доступно обновление" : "Update available"}
        </p>
        <h2 className="mt-3 text-2xl font-black text-sori-text-strong">
          {isRussian ? "Нужно обновить страницу" : "Refresh required"}
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-sori-text-muted">
          {isRussian
            ? `На сервере доступна новая версия SORI ${serverVersion.version || ""}. Чтобы не ловить старую сборку веб-клиента, обнови страницу.`
            : `A newer SORI ${serverVersion.version || ""} build is available on this server. Refresh the page to avoid running an outdated web client.`}
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-xl bg-sori-accent-primary px-4 py-3 text-sm font-black uppercase tracking-widest text-black transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sori-accent-primary/50"
          onClick={() => window.location.reload()}
        >
          {isRussian ? "Обновить страницу" : "Refresh page"}
        </button>
      </div>
    </div>
  );
}
