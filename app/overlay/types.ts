export interface FightDto {
  map: string;
  mode: string;
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
}

export interface SessionSummaryDto {
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
}

export interface SessionResponseDto {
  schema: 1;
  channel_id: string;
  nickname: string;
  session: SessionSummaryDto;
  fights: FightDto[];
}

