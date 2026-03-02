import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../update/route";

type Params = {
  params: {
    channelId: string;
  };
};

export function GET(_req: NextRequest, { params }: Params) {
  const channelId = params.channelId;
  const session = getSession(channelId);

  if (!session) {
    return NextResponse.json(
      { error: "session not found", channel_id: channelId },
      { status: 404 }
    );
  }

  return NextResponse.json(session);
}

