import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../store";

export const dynamic = "force-dynamic";

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  if (origin && (origin.endsWith(".ext-twitch.tv") || origin.includes("localhost"))) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
  }
  return {};
}

type Params = {
  params: {
    channelId: string;
  };
};

export async function OPTIONS(req: NextRequest) {
  const headers = corsHeaders(req);
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(req: NextRequest, { params }: Params) {
  const channelId = params.channelId;
  const session = await getSession(channelId);
  const headers = corsHeaders(req);

  if (!session) {
    const res = NextResponse.json(
      { error: "session not found", channel_id: channelId },
      { status: 404 }
    );
    Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  const res = NextResponse.json(session);
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

