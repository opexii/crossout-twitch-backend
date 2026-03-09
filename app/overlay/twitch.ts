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

const TWITCH_EXT_WAIT_MS = 5000;
const TWITCH_EXT_POLL_MS = 100;

export function onChannelIdReady(cb: (channelId: string) => void) {
  if (typeof window === "undefined") return;

  // Сразу проверяем query (браузер с ?channel=...)
  const fromQuery = getChannelIdFromQuery();
  if (fromQuery) {
    cb(fromQuery);
    return;
  }

  // Сразу проверяем Twitch Extension API (если скрипт уже загружен)
  if (window.Twitch?.ext) {
    window.Twitch.ext.onAuthorized((auth: { channelId: string }) => {
      cb(auth.channelId);
    });
    return;
  }

  // Во фрейме Twitch скрипт может подгрузиться позже — ждём появления Twitch.ext
  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed += TWITCH_EXT_POLL_MS;
    if (window.Twitch?.ext) {
      clearInterval(timer);
      window.Twitch.ext.onAuthorized((auth: { channelId: string }) => {
        cb(auth.channelId);
      });
      return;
    }
    if (elapsed >= TWITCH_EXT_WAIT_MS) {
      clearInterval(timer);
      // Таймаут: повторно проверить query (на случай если добавили позже)
      const q = getChannelIdFromQuery();
      if (q) cb(q);
    }
  }, TWITCH_EXT_POLL_MS);
}

export {};

