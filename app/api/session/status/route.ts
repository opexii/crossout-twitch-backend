import { NextResponse } from "next/server";
import { listSessions } from "../store";

export const dynamic = "force-dynamic";

/**
 * GET /api/session/status — диагностика: какой storage используется и сколько сессий.
 */
export async function GET() {
  const hasKv =
    !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
    !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const hasRedisUrl = !!process.env.REDIS_URL;

  let storage: "kv" | "redis" | "memory" = "memory";
  if (hasKv) storage = "kv";
  else if (hasRedisUrl) storage = "redis";

  let sessionsCount = 0;
  let error: string | undefined;
  try {
    const sessions = await listSessions();
    sessionsCount = sessions.length;
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    storage,
    hasRedisUrl,
    hasKvEnv: hasKv,
    sessionsCount,
    ...(error && { error }),
  });
}
