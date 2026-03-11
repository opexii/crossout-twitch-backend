import type { SessionPayload } from "./update/route";

const KEY_PREFIX = "session:";
const SESSION_TTL_SEC = 60 * 60 * 24; // 24 ч

// Fallback: in-memory (для локальной разработки без KV)
const memory = new Map<string, SessionPayload>();

// Поддержка KV_REST_API_* (Vercel KV) и UPSTASH_REDIS_REST_* (Upstash в маркетплейсе)
function getKvEnv(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { url, token };
  return null;
}

async function getKv() {
  const env = getKvEnv();
  if (!env) return null;
  const { createClient } = await import("@vercel/kv");
  return createClient({ url: env.url, token: env.token });
}

// Поддержка REDIS_URL (redis://... — например Redis из маркетплейса Vercel)
// Тип через any, чтобы избежать конфликта между redis и @redis/client при присвоении в globalThis
declare global {
  // eslint-disable-next-line no-var
  var __redisUrlClient: { get: (k: string) => Promise<string | null>; set: (k: string, v: string, opts?: { EX?: number }) => Promise<string | undefined>; keys: (pattern: string) => Promise<string[]>; connect: () => Promise<void>; isOpen: boolean; on: (ev: string, fn: (err: Error) => void) => void } | null | undefined;
  // eslint-disable-next-line no-var
  var __redisUrlClientUrl: string | undefined;
}

async function getRedisUrlClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  // Используем URL как есть: redis:// для обычного порта, rediss:// только если в env уже указан TLS
  if (globalThis.__redisUrlClient && globalThis.__redisUrlClientUrl === url)
    return globalThis.__redisUrlClient;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url }) as unknown as NonNullable<typeof globalThis.__redisUrlClient>;
    client.on("error", (err) => console.error("Redis client error:", err));
    if (!client.isOpen) await client.connect();
    globalThis.__redisUrlClient = client;
    globalThis.__redisUrlClientUrl = url;
    return client;
  } catch (e) {
    console.error("Redis connect error:", e);
    return null;
  }
}

export async function setSession(
  channelId: string,
  payload: SessionPayload,
): Promise<void> {
  memory.set(channelId, payload);
  const kv = await getKv();
  if (kv) {
    try {
      await kv.set(`${KEY_PREFIX}${channelId}`, payload, {
        ex: SESSION_TTL_SEC,
      });
    } catch (e) {
      console.error("KV setSession error:", e);
    }
    return;
  }
  const redis = await getRedisUrlClient();
  if (redis) {
    try {
      await redis.set(
        `${KEY_PREFIX}${channelId}`,
        JSON.stringify(payload),
        { EX: SESSION_TTL_SEC }
      );
    } catch (e) {
      console.error("Redis setSession error:", e);
    }
  }
}

export async function getSession(
  channelId: string,
): Promise<SessionPayload | null> {
  const kv = await getKv();
  if (kv) {
    try {
      const data = await kv.get<SessionPayload>(`${KEY_PREFIX}${channelId}`);
      if (data) {
        memory.set(channelId, data);
        return data;
      }
    } catch (e) {
      console.error("KV getSession error:", e);
    }
    return memory.get(channelId) ?? null;
  }
  const redis = await getRedisUrlClient();
  if (redis) {
    try {
      const raw = await redis.get(`${KEY_PREFIX}${channelId}`);
      if (raw) {
        const data = JSON.parse(raw) as SessionPayload;
        memory.set(channelId, data);
        return data;
      }
    } catch (e) {
      console.error("Redis getSession error:", e);
    }
  }
  return memory.get(channelId) ?? null;
}

export async function listSessions(): Promise<SessionPayload[]> {
  const kv = await getKv();
  if (kv) {
    try {
      const out: SessionPayload[] = [];
      for await (const key of kv.scanIterator({ match: `${KEY_PREFIX}*` })) {
        const data = await kv.get<SessionPayload>(key);
        if (data) out.push(data);
      }
      return out;
    } catch (e) {
      console.error("KV listSessions error:", e);
    }
    return Array.from(memory.values());
  }
  const redis = await getRedisUrlClient();
  if (redis) {
    try {
      const keys = await redis.keys(`${KEY_PREFIX}*`);
      const out: SessionPayload[] = [];
      for (const key of keys) {
        const raw = await redis.get(key);
        if (raw) out.push(JSON.parse(raw) as SessionPayload);
      }
      return out;
    } catch (e) {
      console.error("Redis listSessions error:", e);
    }
  }
  return Array.from(memory.values());
}
