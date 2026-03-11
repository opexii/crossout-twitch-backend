declare global {
  interface Window {
    Twitch?: any;
  }
}

export function getChannelIdFromQuery(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    return (
      url.searchParams.get("channel") ??
      url.searchParams.get("channel_id") ??
      url.searchParams.get("channelId") ??
      null
    );
  } catch {
    return null;
  }
}

/** Twitch иногда передаёт параметры в hash */
function getChannelIdFromHash(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    return (
      params.get("channel") ??
      params.get("channel_id") ??
      params.get("channelId") ??
      null
    );
  } catch {
    return null;
  }
}

const TWITCH_EXT_WAIT_MS = 15000;
const TWITCH_EXT_POLL_MS = 100;

export function onChannelIdReady(cb: (channelId: string) => void) {
  if (typeof window === "undefined") return;

  const fromQuery = getChannelIdFromQuery() ?? getChannelIdFromHash();
  if (fromQuery) {
    cb(fromQuery);
    return;
  }

  if (window.Twitch?.ext) {
    window.Twitch.ext.onAuthorized((auth: { channelId: string }) => {
      cb(auth.channelId);
    });
    return;
  }

  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed += TWITCH_EXT_POLL_MS;
    const fromUrl = getChannelIdFromQuery() ?? getChannelIdFromHash();
    if (fromUrl) {
      clearInterval(timer);
      cb(fromUrl);
      return;
    }
    if (window.Twitch?.ext) {
      clearInterval(timer);
      window.Twitch.ext.onAuthorized((auth: { channelId: string }) => {
        cb(auth.channelId);
      });
      return;
    }
    if (elapsed >= TWITCH_EXT_WAIT_MS) {
      clearInterval(timer);
      const q = getChannelIdFromQuery() ?? getChannelIdFromHash();
      if (q) cb(q);
    }
  }, TWITCH_EXT_POLL_MS);
}

export {};

