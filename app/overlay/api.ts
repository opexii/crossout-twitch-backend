import type { SessionResponseDto } from "./types";

// Next.js (Vercel): process.env. Для Vite (Twitch ZIP): import.meta.env — подставляется при сборке.
const _base =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_OVERLAY_API_BASE as string) ||
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_OVERLAY_API_BASE as string) ||
  "";
const BASE = _base.replace(/\/$/, "");

export async function fetchSession(
  channelId: string,
): Promise<SessionResponseDto | null> {
  const res = await fetch(
    `${BASE}/api/session/${encodeURIComponent(channelId)}`,
    {
      cache: "no-store",
    },
  );

  if (res.status === 404) {
    return null; // нет активной сессии
  }
  if (!res.ok) {
    throw new Error(`Backend error: ${res.status}`);
  }

  const data = (await res.json()) as SessionResponseDto;
  return data;
}

