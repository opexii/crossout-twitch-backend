declare global {
  interface Window {
    Twitch?: any;
  }
}

export function getChannelIdFromQuery(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("channel");
  } catch {
    return null;
  }
}

export function onChannelIdReady(cb: (channelId: string) => void) {
  // Попытка получить из Twitch Extension JS API
  if (typeof window !== "undefined" && window.Twitch?.ext) {
    window.Twitch.ext.onAuthorized((auth: { channelId: string }) => {
      cb(auth.channelId);
    });
    return;
  }

  // Локальный/dev режим: берём ?channel=...
  const fromQuery = getChannelIdFromQuery();
  if (fromQuery) {
    cb(fromQuery);
  }
}

export {};

