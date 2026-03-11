import type { SessionPayload } from "./update/route";

const KEY_PREFIX = "session:";

// Fallback: in-memory (для локальной разработки без KV)
const memory = new Map<string, SessionPayload>();

function useKv(): boolean {
  return !!(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  );
}

export async function setSession(
  channelId: string,
  payload: SessionPayload,
): Promise<void> {
  memory.set(channelId, payload);
  if (useKv()) {
    try {
      const { kv } = await import("@vercel/kv");
      await kv.set(`${KEY_PREFIX}${channelId}`, payload, {
        ex: 60 * 60 * 24,
      }); // TTL 24 ч
    } catch (e) {
      console.error("KV setSession error:", e);
    }
  }
}

export async function getSession(
  channelId: string,
): Promise<SessionPayload | null> {
  if (useKv()) {
    try {
      const { kv } = await import("@vercel/kv");
      const data = await kv.get<SessionPayload>(`${KEY_PREFIX}${channelId}`);
      if (data) {
        memory.set(channelId, data);
        return data;
      }
    } catch (e) {
      console.error("KV getSession error:", e);
    }
  }
  return memory.get(channelId) ?? null;
}

export async function listSessions(): Promise<SessionPayload[]> {
  if (useKv()) {
    try {
      const { kv } = await import("@vercel/kv");
      const out: SessionPayload[] = [];
      for await (const key of kv.scanIterator({ match: `${KEY_PREFIX}*` })) {
        const data = await kv.get<SessionPayload>(key);
        if (data) out.push(data);
      }
      return out;
    } catch (e) {
      console.error("KV listSessions error:", e);
    }
  }
  return Array.from(memory.values());
}
