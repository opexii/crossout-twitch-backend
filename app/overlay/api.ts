import type { SessionResponseDto } from "./types";

// На Vercel фронтенд и backend работают на одном домене,
// поэтому достаточно относительного пути.
const BASE = "";

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

