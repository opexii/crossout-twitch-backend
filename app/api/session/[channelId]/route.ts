import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../store";

type Params = {
  params: {
    channelId: string;
  };
};

export async function GET(_req: NextRequest, { params }: Params) {
  const channelId = params.channelId;
  const session = await getSession(channelId);

  if (!session) {
    return NextResponse.json(
      { error: "session not found", channel_id: channelId },
      { status: 404 }
    );
  }

  return NextResponse.json(session);
}

