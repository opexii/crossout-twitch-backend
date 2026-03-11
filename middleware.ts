import { NextRequest, NextResponse } from "next/server";

/** Разрешаем CORS для оверлея Twitch (Hosted Test): запросы с *.ext-twitch.tv */
function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && (origin.endsWith(".ext-twitch.tv") || origin.includes("localhost"))
      ? origin
      : "";
  if (!allow) return {};
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!path.startsWith("/api/")) return NextResponse.next();

  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const res = NextResponse.next();
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
