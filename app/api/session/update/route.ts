import { NextRequest, NextResponse } from "next/server";
import { listSessions, setSession } from "../store";

export type SessionPayload = {
  schema: number;
  channel_id: string;
  nickname: string;
  session: {
    weapon_set: string;
    is_best_of_n: boolean;
    start_time: string | null;
    duration_seconds: number;
    total_fights: number;
    wins: number;
    losses: number;
    kills: number;
    deaths: number;
    avg_damage: number;
    rating: number;
  };
  fights: Array<{
    map: string;
    map_tech: string;
    mode: string;
    mode_tech: string;
    is_win: boolean | null;
    kills: number;
    deaths: number;
    damage: number;
    score: number;
    duration: number;
    end_time: string;
    start_time: string;
    is_bon_match: boolean;
    mvp: boolean;
    half_mvp: boolean;
    is_ffa: boolean;
    winner_team: string | number | null;
    players: Array<{
      nickname: string;
      team: string | number | null;
      is_bot: boolean;
      power_score: number;
      kills: number;
      deaths: number;
      damage_dealt: number;
      damage_received: number;
      score: number;
      weapons_def: string[];
      weapons: string[];
      is_self: boolean;
      placement?: number;
    }>;
  }>;
};

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as SessionPayload;

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    if (!payload.channel_id) {
      return NextResponse.json(
        { error: "channel_id is required" },
        { status: 400 }
      );
    }

    setSession(payload.channel_id, payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in /api/session/update POST:", error);
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}

// Вспомогательный GET, чтобы можно было посмотреть список доступных каналов
export function GET() {
  const summary = listSessions().map((s) => ({
    channel_id: s.channel_id,
    nickname: s.nickname,
    fights: s.fights.length,
  }));
  return NextResponse.json(summary);
}

